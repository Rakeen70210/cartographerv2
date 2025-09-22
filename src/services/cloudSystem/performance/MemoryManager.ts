/**
 * Memory Management System
 * Manages texture pooling, progressive loading, and resource cleanup for cloud rendering
 */

import { MapBounds } from '../../../types/map';

export interface TexturePoolEntry {
  id: string;
  texture: WebGLTexture;
  size: number; // bytes
  lastUsed: number;
  inUse: boolean;
  resolution: number;
  format: string;
}

export interface CloudResourceEntry {
  id: string;
  type: 'texture' | 'buffer' | 'shader';
  resource: WebGLTexture | WebGLBuffer | WebGLProgram;
  size: number; // bytes
  priority: number; // 0-10, higher = more important
  lastAccessed: number;
  accessCount: number;
  bounds?: MapBounds; // For spatial resources
}

export interface MemoryUsageStats {
  totalAllocated: number; // bytes
  textureMemory: number;
  bufferMemory: number;
  shaderMemory: number;
  pooledTextures: number;
  activeResources: number;
  cacheHitRate: number;
  lastCleanup: number;
}

export interface MemoryManagerConfig {
  maxMemoryMB: number;
  texturePoolSize: number;
  cleanupInterval: number; // ms
  maxUnusedTime: number; // ms
  progressiveLoadingEnabled: boolean;
  spatialCachingEnabled: boolean;
  memoryPressureThreshold: number; // 0-1
}

export class MemoryManager {
  private gl: WebGLRenderingContext | null = null;
  private config: MemoryManagerConfig;
  private texturePool: Map<string, TexturePoolEntry> = new Map();
  private resourceCache: Map<string, CloudResourceEntry> = new Map();
  private memoryUsage: MemoryUsageStats;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private loadingQueue: Array<{ id: string; priority: number; loader: () => Promise<any> }> = [];
  private isLoading = false;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(config: Partial<MemoryManagerConfig> = {}) {
    this.config = {
      maxMemoryMB: 100,
      texturePoolSize: 50,
      cleanupInterval: 30000, // 30 seconds
      maxUnusedTime: 120000, // 2 minutes
      progressiveLoadingEnabled: true,
      spatialCachingEnabled: true,
      memoryPressureThreshold: 0.8,
      ...config
    };

    this.memoryUsage = {
      totalAllocated: 0,
      textureMemory: 0,
      bufferMemory: 0,
      shaderMemory: 0,
      pooledTextures: 0,
      activeResources: 0,
      cacheHitRate: 0,
      lastCleanup: Date.now()
    };

    this.startCleanupTimer();
  }

  /**
   * Initialize memory manager with WebGL context
   */
  public initialize(gl: WebGLRenderingContext): void {
    this.gl = gl;
    console.log('MemoryManager initialized with WebGL context');
  }

  /**
   * Get or create a texture from the pool
   */
  public getPooledTexture(
    id: string,
    resolution: number,
    format: string = 'RGBA'
  ): WebGLTexture | null {
    if (!this.gl) return null;

    // Check if texture exists in pool
    const poolEntry = this.texturePool.get(id);
    if (poolEntry && poolEntry.resolution === resolution && poolEntry.format === format) {
      poolEntry.lastUsed = Date.now();
      poolEntry.inUse = true;
      this.cacheHits++;
      return poolEntry.texture;
    }

    this.cacheMisses++;

    // Create new texture if pool has space
    if (this.texturePool.size < this.config.texturePoolSize) {
      const texture = this.createTexture(resolution, format);
      if (texture) {
        const size = this.calculateTextureSize(resolution, format);
        const entry: TexturePoolEntry = {
          id,
          texture,
          size,
          lastUsed: Date.now(),
          inUse: true,
          resolution,
          format
        };

        this.texturePool.set(id, entry);
        this.memoryUsage.textureMemory += size;
        this.memoryUsage.pooledTextures++;
        return texture;
      }
    }

    // Pool is full, try to reuse least recently used texture
    const lruEntry = this.findLRUTexture();
    if (lruEntry && !lruEntry.inUse) {
      // Reuse existing texture
      this.gl.deleteTexture(lruEntry.texture);
      this.memoryUsage.textureMemory -= lruEntry.size;

      const newTexture = this.createTexture(resolution, format);
      if (newTexture) {
        const newSize = this.calculateTextureSize(resolution, format);
        lruEntry.texture = newTexture;
        lruEntry.size = newSize;
        lruEntry.resolution = resolution;
        lruEntry.format = format;
        lruEntry.lastUsed = Date.now();
        lruEntry.inUse = true;

        this.memoryUsage.textureMemory += newSize;
        this.texturePool.set(id, lruEntry);
        return newTexture;
      }
    }

    return null;
  }

  /**
   * Release a pooled texture back to the pool
   */
  public releasePooledTexture(id: string): void {
    const entry = this.texturePool.get(id);
    if (entry) {
      entry.inUse = false;
      entry.lastUsed = Date.now();
    }
  }

  /**
   * Cache a cloud resource with spatial information
   */
  public cacheResource(
    id: string,
    resource: WebGLTexture | WebGLBuffer | WebGLProgram,
    type: 'texture' | 'buffer' | 'shader',
    size: number,
    priority: number = 5,
    bounds?: MapBounds
  ): void {
    // Check memory pressure before caching
    if (this.isMemoryPressureHigh()) {
      this.performEmergencyCleanup();
    }

    const entry: CloudResourceEntry = {
      id,
      resource,
      type,
      size,
      priority,
      lastAccessed: Date.now(),
      accessCount: 1,
      bounds
    };

    // Remove existing entry if it exists
    const existing = this.resourceCache.get(id);
    if (existing) {
      this.updateMemoryUsage(existing.type, -existing.size);
    }

    this.resourceCache.set(id, entry);
    this.updateMemoryUsage(type, size);
    this.memoryUsage.activeResources = this.resourceCache.size;
  }

  /**
   * Get cached resource
   */
  public getCachedResource(id: string): CloudResourceEntry | null {
    const entry = this.resourceCache.get(id);
    if (entry) {
      entry.lastAccessed = Date.now();
      entry.accessCount++;
      this.cacheHits++;
      return entry;
    }

    this.cacheMisses++;
    return null;
  }

  /**
   * Remove resource from cache
   */
  public removeCachedResource(id: string): void {
    const entry = this.resourceCache.get(id);
    if (entry) {
      this.cleanupResource(entry);
      this.resourceCache.delete(id);
      this.memoryUsage.activeResources = this.resourceCache.size;
    }
  }

  /**
   * Progressive loading based on map movement
   */
  public queueProgressiveLoad(
    id: string,
    loader: () => Promise<any>,
    priority: number = 5
  ): void {
    if (!this.config.progressiveLoadingEnabled) {
      // Load immediately if progressive loading is disabled
      loader().catch(error => console.error('Resource loading failed:', error));
      return;
    }

    // Add to loading queue
    this.loadingQueue.push({ id, priority, loader });
    this.loadingQueue.sort((a, b) => b.priority - a.priority); // Sort by priority

    // Start processing queue if not already loading
    if (!this.isLoading) {
      this.processLoadingQueue();
    }
  }

  /**
   * Update spatial cache based on map bounds
   */
  public updateSpatialCache(viewportBounds: MapBounds, cameraPosition: [number, number]): void {
    if (!this.config.spatialCachingEnabled) return;

    const currentTime = Date.now();
    const resourcesToRemove: string[] = [];

    // Check each cached resource
    for (const [id, entry] of this.resourceCache) {
      if (entry.bounds) {
        const distance = this.calculateDistance(cameraPosition, entry.bounds);
        const isVisible = this.isInViewport(entry.bounds, viewportBounds);
        
        // Remove resources that are far away and haven't been accessed recently
        if (!isVisible && distance > 5000 && currentTime - entry.lastAccessed > 60000) {
          resourcesToRemove.push(id);
        }
      }
    }

    // Remove distant resources
    resourcesToRemove.forEach(id => this.removeCachedResource(id));
  }

  /**
   * Perform cleanup of unused resources
   */
  public performCleanup(): void {
    const currentTime = Date.now();
    const resourcesToCleanup: string[] = [];

    // Clean up unused textures in pool
    for (const [id, entry] of this.texturePool) {
      if (!entry.inUse && currentTime - entry.lastUsed > this.config.maxUnusedTime) {
        resourcesToCleanup.push(id);
      }
    }

    resourcesToCleanup.forEach(id => {
      const entry = this.texturePool.get(id);
      if (entry && this.gl) {
        this.gl.deleteTexture(entry.texture);
        this.memoryUsage.textureMemory -= entry.size;
        this.memoryUsage.pooledTextures--;
        this.texturePool.delete(id);
      }
    });

    // Clean up unused cached resources
    const cacheCleanupIds: string[] = [];
    for (const [id, entry] of this.resourceCache) {
      if (currentTime - entry.lastAccessed > this.config.maxUnusedTime && entry.priority < 7) {
        cacheCleanupIds.push(id);
      }
    }

    cacheCleanupIds.forEach(id => this.removeCachedResource(id));

    this.memoryUsage.lastCleanup = currentTime;
    console.log(`Memory cleanup completed. Removed ${resourcesToCleanup.length + cacheCleanupIds.length} resources.`);
  }

  /**
   * Get current memory usage statistics
   */
  public getMemoryUsage(): MemoryUsageStats {
    this.memoryUsage.cacheHitRate = this.cacheHits / Math.max(1, this.cacheHits + this.cacheMisses);
    this.memoryUsage.totalAllocated = this.memoryUsage.textureMemory + 
                                     this.memoryUsage.bufferMemory + 
                                     this.memoryUsage.shaderMemory;
    return { ...this.memoryUsage };
  }

  /**
   * Check if memory pressure is high
   */
  public isMemoryPressureHigh(): boolean {
    const usage = this.getMemoryUsage();
    const maxBytes = this.config.maxMemoryMB * 1024 * 1024;
    return usage.totalAllocated / maxBytes > this.config.memoryPressureThreshold;
  }

  /**
   * Perform emergency cleanup when memory pressure is high
   */
  public performEmergencyCleanup(): void {
    console.warn('Performing emergency memory cleanup due to high memory pressure');

    // Remove low priority resources first
    const lowPriorityResources = Array.from(this.resourceCache.entries())
      .filter(([_, entry]) => entry.priority < 5)
      .sort((a, b) => a[1].priority - b[1].priority);

    const targetReduction = this.memoryUsage.totalAllocated * 0.3; // Remove 30% of memory
    let freedMemory = 0;

    for (const [id, entry] of lowPriorityResources) {
      if (freedMemory >= targetReduction) break;
      
      freedMemory += entry.size;
      this.removeCachedResource(id);
    }

    // Also clean up unused pooled textures
    const unusedTextures = Array.from(this.texturePool.entries())
      .filter(([_, entry]) => !entry.inUse);

    for (const [id, entry] of unusedTextures) {
      if (freedMemory >= targetReduction) break;
      
      if (this.gl) {
        this.gl.deleteTexture(entry.texture);
        this.memoryUsage.textureMemory -= entry.size;
        this.memoryUsage.pooledTextures--;
        this.texturePool.delete(id);
        freedMemory += entry.size;
      }
    }

    console.log(`Emergency cleanup freed ${(freedMemory / (1024 * 1024)).toFixed(2)} MB`);
  }

  /**
   * Dispose of all resources and stop cleanup timer
   */
  public dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Clean up all pooled textures
    if (this.gl) {
      for (const entry of this.texturePool.values()) {
        this.gl.deleteTexture(entry.texture);
      }
    }

    // Clean up all cached resources
    for (const entry of this.resourceCache.values()) {
      this.cleanupResource(entry);
    }

    this.texturePool.clear();
    this.resourceCache.clear();
    this.loadingQueue.length = 0;

    console.log('MemoryManager disposed');
  }

  /**
   * Create a WebGL texture with specified parameters
   */
  private createTexture(resolution: number, format: string): WebGLTexture | null {
    if (!this.gl) return null;

    const texture = this.gl.createTexture();
    if (!texture) return null;

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    
    // Set texture parameters
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

    // Allocate texture memory
    const glFormat = format === 'RGBA' ? this.gl.RGBA : this.gl.RGB;
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      glFormat,
      resolution,
      resolution,
      0,
      glFormat,
      this.gl.UNSIGNED_BYTE,
      null
    );

    return texture;
  }

  /**
   * Calculate texture memory size in bytes
   */
  private calculateTextureSize(resolution: number, format: string): number {
    const bytesPerPixel = format === 'RGBA' ? 4 : 3;
    return resolution * resolution * bytesPerPixel;
  }

  /**
   * Find least recently used texture in pool
   */
  private findLRUTexture(): TexturePoolEntry | null {
    let lruEntry: TexturePoolEntry | null = null;
    let oldestTime = Date.now();

    for (const entry of this.texturePool.values()) {
      if (!entry.inUse && entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        lruEntry = entry;
      }
    }

    return lruEntry;
  }

  /**
   * Update memory usage statistics
   */
  private updateMemoryUsage(type: 'texture' | 'buffer' | 'shader', sizeDelta: number): void {
    switch (type) {
      case 'texture':
        this.memoryUsage.textureMemory += sizeDelta;
        break;
      case 'buffer':
        this.memoryUsage.bufferMemory += sizeDelta;
        break;
      case 'shader':
        this.memoryUsage.shaderMemory += sizeDelta;
        break;
    }
  }

  /**
   * Clean up a specific resource
   */
  private cleanupResource(entry: CloudResourceEntry): void {
    if (!this.gl) return;

    switch (entry.type) {
      case 'texture':
        this.gl.deleteTexture(entry.resource as WebGLTexture);
        break;
      case 'buffer':
        this.gl.deleteBuffer(entry.resource as WebGLBuffer);
        break;
      case 'shader':
        this.gl.deleteProgram(entry.resource as WebGLProgram);
        break;
    }

    this.updateMemoryUsage(entry.type, -entry.size);
  }

  /**
   * Process the progressive loading queue
   */
  private async processLoadingQueue(): Promise<void> {
    if (this.isLoading || this.loadingQueue.length === 0) return;

    this.isLoading = true;

    while (this.loadingQueue.length > 0) {
      const item = this.loadingQueue.shift();
      if (!item) break;

      try {
        await item.loader();
      } catch (error) {
        console.error(`Failed to load resource ${item.id}:`, error);
      }

      // Small delay to prevent blocking the main thread
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.isLoading = false;
  }

  /**
   * Calculate distance between camera and resource bounds
   */
  private calculateDistance(cameraPosition: [number, number], bounds: MapBounds): number {
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;
    
    const deltaLat = cameraPosition[1] - centerLat;
    const deltaLng = cameraPosition[0] - centerLng;
    
    // Rough distance calculation (not geodesic, but sufficient for culling)
    return Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng) * 111000; // Convert to meters
  }

  /**
   * Check if bounds intersect with viewport
   */
  private isInViewport(bounds: MapBounds, viewport: MapBounds): boolean {
    return !(
      bounds.east < viewport.west ||
      bounds.west > viewport.east ||
      bounds.north < viewport.south ||
      bounds.south > viewport.north
    );
  }

  /**
   * Start the cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }
}