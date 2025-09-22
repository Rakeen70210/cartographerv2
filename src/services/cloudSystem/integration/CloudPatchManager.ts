/**
 * Cloud Patch Manager
 * Handles automatic loading and unloading of cloud patches based on viewport
 */

import { MapBounds, CloudPatch } from '../../../types/cloud';
import { ViewportManager } from './ViewportManager';

export interface CloudPatchConfig {
  maxLoadedPatches: number;
  loadDistance: number; // Distance in meters to start loading patches
  unloadDistance: number; // Distance in meters to unload patches
  patchSize: number; // Size of each patch in meters
  preloadBuffer: number; // Number of patches to preload around visible area
}

export interface PatchLoadState {
  id: string;
  bounds: MapBounds;
  state: 'unloaded' | 'loading' | 'loaded' | 'error';
  priority: number; // Higher priority loads first
  lastAccessed: number;
  loadPromise?: Promise<CloudPatch>;
}

/**
 * Manages cloud patch loading and unloading based on viewport changes
 */
export class CloudPatchManager {
  private viewportManager: ViewportManager;
  private config: CloudPatchConfig;
  
  // Patch state tracking
  private patches = new Map<string, PatchLoadState>();
  private loadedPatches = new Map<string, CloudPatch>();
  
  // Loading queue
  private loadQueue: string[] = [];
  private isProcessingQueue = false;
  
  // Callbacks
  private onPatchLoaded?: (patch: CloudPatch) => void;
  private onPatchUnloaded?: (patchId: string) => void;
  private onLoadingStateChange?: (loading: boolean) => void;

  constructor(
    viewportManager: ViewportManager,
    config?: Partial<CloudPatchConfig>
  ) {
    this.viewportManager = viewportManager;
    
    // Default configuration
    this.config = {
      maxLoadedPatches: 100,
      loadDistance: 5000, // 5km
      unloadDistance: 10000, // 10km
      patchSize: 1000, // 1km patches
      preloadBuffer: 2, // 2 patches around visible area
      ...config
    };
    
    // Set up viewport change handler
    this.setupViewportHandler();
  }

  /**
   * Set up viewport change handling
   */
  private setupViewportHandler(): void {
    this.viewportManager.onViewportChange((viewport) => {
      this.updatePatchVisibility(viewport.bounds, viewport.center);
    });
  }

  /**
   * Update patch visibility based on current viewport
   */
  private updatePatchVisibility(bounds: MapBounds, center: [number, number]): void {
    // Calculate required patches for current viewport
    const requiredPatches = this.calculateRequiredPatches(bounds);
    
    // Update patch priorities based on distance from center
    this.updatePatchPriorities(requiredPatches, center);
    
    // Queue patches for loading
    this.queuePatchesForLoading(requiredPatches);
    
    // Unload distant patches
    this.unloadDistantPatches(center);
    
    // Process loading queue
    this.processLoadQueue();
  }

  /**
   * Calculate which patches are required for the current viewport
   */
  private calculateRequiredPatches(bounds: MapBounds): string[] {
    const patches: string[] = [];
    
    // Calculate patch grid coordinates
    const patchSizeDegrees = this.metersToDegrees(this.config.patchSize);
    
    // Add buffer around visible area
    const buffer = this.config.preloadBuffer * patchSizeDegrees;
    const expandedBounds = {
      north: bounds.north + buffer,
      south: bounds.south - buffer,
      east: bounds.east + buffer,
      west: bounds.west - buffer
    };
    
    // Generate patch IDs for the expanded bounds
    const startX = Math.floor(expandedBounds.west / patchSizeDegrees);
    const endX = Math.ceil(expandedBounds.east / patchSizeDegrees);
    const startY = Math.floor(expandedBounds.south / patchSizeDegrees);
    const endY = Math.ceil(expandedBounds.north / patchSizeDegrees);
    
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const patchId = `patch_${x}_${y}`;
        patches.push(patchId);
        
        // Initialize patch state if not exists
        if (!this.patches.has(patchId)) {
          this.initializePatchState(patchId, x, y, patchSizeDegrees);
        }
      }
    }
    
    return patches;
  }

  /**
   * Initialize patch state for a new patch
   */
  private initializePatchState(patchId: string, gridX: number, gridY: number, patchSize: number): void {
    const bounds: MapBounds = {
      west: gridX * patchSize,
      east: (gridX + 1) * patchSize,
      south: gridY * patchSize,
      north: (gridY + 1) * patchSize
    };
    
    const patchState: PatchLoadState = {
      id: patchId,
      bounds,
      state: 'unloaded',
      priority: 0,
      lastAccessed: Date.now()
    };
    
    this.patches.set(patchId, patchState);
  }

  /**
   * Update patch priorities based on distance from viewport center
   */
  private updatePatchPriorities(requiredPatches: string[], center: [number, number]): void {
    for (const patchId of requiredPatches) {
      const patch = this.patches.get(patchId);
      if (!patch) continue;
      
      // Calculate distance from viewport center to patch center
      const patchCenter = this.getPatchCenter(patch.bounds);
      const distance = this.calculateDistance(center, patchCenter);
      
      // Higher priority for closer patches (inverse distance)
      patch.priority = 1000 - distance;
      patch.lastAccessed = Date.now();
    }
  }

  /**
   * Queue patches for loading based on priority
   */
  private queuePatchesForLoading(requiredPatches: string[]): void {
    const patchesToLoad = requiredPatches
      .map(id => this.patches.get(id)!)
      .filter(patch => patch.state === 'unloaded')
      .sort((a, b) => b.priority - a.priority) // Higher priority first
      .map(patch => patch.id);
    
    // Add to load queue if not already queued
    for (const patchId of patchesToLoad) {
      if (!this.loadQueue.includes(patchId)) {
        this.loadQueue.push(patchId);
      }
    }
    
    // Sort queue by priority
    this.loadQueue.sort((a, b) => {
      const patchA = this.patches.get(a)!;
      const patchB = this.patches.get(b)!;
      return patchB.priority - patchA.priority;
    });
  }

  /**
   * Unload patches that are too far from the viewport center
   */
  private unloadDistantPatches(center: [number, number]): void {
    const unloadDistanceMeters = this.config.unloadDistance;
    const patchesToUnload: string[] = [];
    
    for (const [patchId, patch] of this.patches.entries()) {
      if (patch.state !== 'loaded') continue;
      
      const patchCenter = this.getPatchCenter(patch.bounds);
      const distance = this.calculateDistance(center, patchCenter);
      
      if (distance > unloadDistanceMeters) {
        patchesToUnload.push(patchId);
      }
    }
    
    // Also unload oldest patches if we exceed the limit
    if (this.loadedPatches.size > this.config.maxLoadedPatches) {
      const sortedPatches = Array.from(this.patches.entries())
        .filter(([_, patch]) => patch.state === 'loaded')
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      
      const excessCount = this.loadedPatches.size - this.config.maxLoadedPatches;
      for (let i = 0; i < excessCount; i++) {
        patchesToUnload.push(sortedPatches[i][0]);
      }
    }
    
    // Unload patches
    for (const patchId of patchesToUnload) {
      this.unloadPatch(patchId);
    }
  }

  /**
   * Process the loading queue
   */
  private async processLoadQueue(): Promise<void> {
    if (this.isProcessingQueue || this.loadQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    this.notifyLoadingStateChange(true);
    
    try {
      // Process patches in batches to avoid overwhelming the system
      const batchSize = 3;
      const batch = this.loadQueue.splice(0, batchSize);
      
      const loadPromises = batch.map(patchId => this.loadPatch(patchId));
      await Promise.allSettled(loadPromises);
      
      // Continue processing if there are more patches
      if (this.loadQueue.length > 0) {
        setTimeout(() => this.processLoadQueue(), 50); // Small delay between batches
      } else {
        this.notifyLoadingStateChange(false);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Load a single patch
   */
  private async loadPatch(patchId: string): Promise<void> {
    const patch = this.patches.get(patchId);
    if (!patch || patch.state !== 'unloaded') {
      return;
    }
    
    patch.state = 'loading';
    
    try {
      // Create load promise (placeholder - will be replaced with actual cloud generation)
      const loadPromise = this.generateCloudPatch(patch.bounds);
      patch.loadPromise = loadPromise;
      
      const cloudPatch = await loadPromise;
      
      // Store loaded patch
      this.loadedPatches.set(patchId, cloudPatch);
      patch.state = 'loaded';
      
      console.log(`🌥️ Loaded cloud patch: ${patchId}`);
      
      // Notify callback
      if (this.onPatchLoaded) {
        this.onPatchLoaded(cloudPatch);
      }
      
    } catch (error) {
      console.error(`🌥️ Failed to load cloud patch ${patchId}:`, error);
      patch.state = 'error';
    }
  }

  /**
   * Unload a patch
   */
  private unloadPatch(patchId: string): void {
    const patch = this.patches.get(patchId);
    if (!patch || patch.state !== 'loaded') {
      return;
    }
    
    // Remove from loaded patches
    this.loadedPatches.delete(patchId);
    patch.state = 'unloaded';
    
    console.log(`🌥️ Unloaded cloud patch: ${patchId}`);
    
    // Notify callback
    if (this.onPatchUnloaded) {
      this.onPatchUnloaded(patchId);
    }
  }

  /**
   * Generate cloud patch (placeholder implementation)
   */
  private async generateCloudPatch(bounds: MapBounds): Promise<CloudPatch> {
    // This is a placeholder - will be replaced with actual cloud generation
    // when the cloud generation system is implemented
    
    return new Promise((resolve) => {
      setTimeout(() => {
        const patch: CloudPatch = {
          id: `patch_${Date.now()}`,
          bounds: {
            minX: bounds.west,
            minY: bounds.south,
            maxX: bounds.east,
            maxY: bounds.north
          },
          vertices: new Float32Array(0),
          indices: new Uint16Array(0),
          densityMap: new Float32Array(0),
          textureCoords: new Float32Array(0)
        };
        
        resolve(patch);
      }, Math.random() * 100 + 50); // Simulate loading time
    });
  }

  /**
   * Get center coordinates of a patch
   */
  private getPatchCenter(bounds: MapBounds): [number, number] {
    return [
      (bounds.west + bounds.east) / 2,
      (bounds.south + bounds.north) / 2
    ];
  }

  /**
   * Calculate distance between two geographic points (rough approximation)
   */
  private calculateDistance(point1: [number, number], point2: [number, number]): number {
    const [lng1, lat1] = point1;
    const [lng2, lat2] = point2;
    
    // Simple distance calculation (not accounting for Earth curvature)
    const deltaLng = lng2 - lng1;
    const deltaLat = lat2 - lat1;
    
    // Convert to approximate meters (rough calculation)
    const metersPerDegree = 111000; // Approximate meters per degree at equator
    const distance = Math.sqrt(deltaLng * deltaLng + deltaLat * deltaLat) * metersPerDegree;
    
    return distance;
  }

  /**
   * Convert meters to degrees (rough approximation)
   */
  private metersToDegrees(meters: number): number {
    return meters / 111000; // Approximate conversion
  }

  /**
   * Set callback for patch loaded events
   */
  setOnPatchLoaded(callback: (patch: CloudPatch) => void): void {
    this.onPatchLoaded = callback;
  }

  /**
   * Set callback for patch unloaded events
   */
  setOnPatchUnloaded(callback: (patchId: string) => void): void {
    this.onPatchUnloaded = callback;
  }

  /**
   * Set callback for loading state changes
   */
  setOnLoadingStateChange(callback: (loading: boolean) => void): void {
    this.onLoadingStateChange = callback;
  }

  /**
   * Get currently loaded patches
   */
  getLoadedPatches(): Map<string, CloudPatch> {
    return new Map(this.loadedPatches);
  }

  /**
   * Get patch loading statistics
   */
  getLoadingStats(): {
    totalPatches: number;
    loadedPatches: number;
    loadingPatches: number;
    queuedPatches: number;
  } {
    const loadingCount = Array.from(this.patches.values())
      .filter(patch => patch.state === 'loading').length;
    
    return {
      totalPatches: this.patches.size,
      loadedPatches: this.loadedPatches.size,
      loadingPatches: loadingCount,
      queuedPatches: this.loadQueue.length
    };
  }

  /**
   * Force reload of all patches in current viewport
   */
  forceReload(): void {
    console.log('🌥️ Forcing reload of all patches...');
    
    // Clear all loaded patches
    for (const patchId of this.loadedPatches.keys()) {
      this.unloadPatch(patchId);
    }
    
    // Clear load queue
    this.loadQueue = [];
    
    // Trigger update
    const viewport = this.viewportManager.getCurrentViewport();
    if (viewport) {
      this.updatePatchVisibility(viewport.bounds, viewport.center);
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    console.log('🌥️ Disposing cloud patch manager...');
    
    // Clear all patches
    this.patches.clear();
    this.loadedPatches.clear();
    this.loadQueue = [];
    
    // Clear callbacks
    this.onPatchLoaded = undefined;
    this.onPatchUnloaded = undefined;
    this.onLoadingStateChange = undefined;
  }

  // Private notification methods

  private notifyLoadingStateChange(loading: boolean): void {
    if (this.onLoadingStateChange) {
      this.onLoadingStateChange(loading);
    }
  }
}