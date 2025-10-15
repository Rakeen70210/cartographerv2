import { getDeviceCapabilityService, PerformanceSettings } from './deviceCapabilityService';

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsageMB: number;
  renderTime: number;
  particleCount: number;
  fogComplexity: number;
}

export interface LevelOfDetailSettings {
  zoomLevel: number;
  fogCellSize: number;
  maxFogFeatures: number;
  cloudComplexity: number;
  particleQuality: 'low' | 'medium' | 'high';
  enableAnimations: boolean;
}

export interface MemoryManagementConfig {
  maxCacheSize: number;
  cleanupInterval: number;
  memoryThreshold: number;
  aggressiveCleanup: boolean;
}

class PerformanceMonitorService {
  private deviceCapabilityService = getDeviceCapabilityService();
  private performanceSettings: PerformanceSettings | null = null;
  private currentMetrics: PerformanceMetrics = {
    fps: 60,
    frameTime: 16.67,
    memoryUsageMB: 0,
    renderTime: 0,
    particleCount: 0,
    fogComplexity: 1.0
  };

  private frameTimeHistory: number[] = [];
  private memoryHistory: number[] = [];
  private lastFrameTime = 0;
  private frameCount = 0;
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private memoryCleanupInterval: NodeJS.Timeout | null = null;
  private performanceCallbacks: ((metrics: PerformanceMetrics) => void)[] = [];

  // Level of detail configurations for different zoom levels
  private lodConfigurations: Map<string, LevelOfDetailSettings> = new Map([
    ['world', { // Zoom 0-3
      zoomLevel: 0,
      fogCellSize: 0.1, // 10km cells
      maxFogFeatures: 100,
      cloudComplexity: 0.3,
      particleQuality: 'low',
      enableAnimations: false
    }],
    ['country', { // Zoom 4-6
      zoomLevel: 4,
      fogCellSize: 0.05, // 5km cells
      maxFogFeatures: 500,
      cloudComplexity: 0.5,
      particleQuality: 'low',
      enableAnimations: true
    }],
    ['region', { // Zoom 7-10
      zoomLevel: 7,
      fogCellSize: 0.01, // 1km cells
      maxFogFeatures: 1000,
      cloudComplexity: 0.7,
      particleQuality: 'medium',
      enableAnimations: true
    }],
    ['city', { // Zoom 11-14
      zoomLevel: 11,
      fogCellSize: 0.005, // 500m cells
      maxFogFeatures: 2000,
      cloudComplexity: 0.9,
      particleQuality: 'high',
      enableAnimations: true
    }],
    ['street', { // Zoom 15+
      zoomLevel: 15,
      fogCellSize: 0.001, // 100m cells
      maxFogFeatures: 5000,
      cloudComplexity: 1.0,
      particleQuality: 'high',
      enableAnimations: true
    }]
  ]);

  private memoryManagementConfig: MemoryManagementConfig = {
    maxCacheSize: 50 * 1024 * 1024, // 50MB
    cleanupInterval: 30000, // 30 seconds
    memoryThreshold: 0.8, // 80% of available memory
    aggressiveCleanup: false
  };

  private cacheRegistry: Map<string, { size: number; lastAccessed: number; priority: number }> = new Map();

  /**
   * Initialize performance monitoring
   */
  async initialize(): Promise<void> {
    try {
      await this.deviceCapabilityService.initialize();
      this.performanceSettings = this.deviceCapabilityService.getPerformanceSettings();
      
      // Adjust LOD configurations based on device capabilities
      this.adjustLODForDevice();
      
      // Configure memory management based on device
      this.configureMemoryManagement();
      
      console.log('Performance monitor initialized with settings:', this.performanceSettings);
    } catch (error) {
      console.error('Failed to initialize performance monitor:', error);
      throw error;
    }
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.lastFrameTime = this.getTimestamp();
    
    // Start FPS monitoring
    this.monitoringInterval = setInterval(() => {
      this.updatePerformanceMetrics();
    }, 1000); // Update every second

    // Start memory cleanup
    this.memoryCleanupInterval = setInterval(() => {
      this.performMemoryCleanup();
    }, this.memoryManagementConfig.cleanupInterval);

    console.log('Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
      this.memoryCleanupInterval = null;
    }

    console.log('Performance monitoring stopped');
  }

  /**
   * Record frame timing for FPS calculation
   */
  recordFrame(frameDurationMs?: number): void {
    if (!this.isMonitoring) return;

    let frameTime: number;

    if (typeof frameDurationMs === 'number' && Number.isFinite(frameDurationMs) && frameDurationMs >= 0) {
      frameTime = frameDurationMs;
      this.lastFrameTime = this.getTimestamp();
    } else {
      const currentTime = this.getTimestamp();
      frameTime = currentTime - this.lastFrameTime;
      this.lastFrameTime = currentTime;
    }

    if (!Number.isFinite(frameTime) || frameTime <= 0) {
      return;
    }

    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift(); // Keep only last 60 frames
    }
    
    this.frameCount++;
  }

  /**
   * Record fog generation metrics without affecting FPS calculations
   */
  recordFogGenerationMetrics(durationMs: number, featureCount: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      return;
    }

    this.currentMetrics.renderTime = durationMs;
    if (Number.isFinite(featureCount) && featureCount >= 0) {
      this.currentMetrics.fogComplexity = featureCount;
    }
  }

  /**
   * Ingest externally measured frame metrics (e.g., from Skia performance monitor)
   */
  ingestFrameMetrics(fps: number, frameTimeMs: number): void {
    if (!this.isMonitoring) return;
    if (!Number.isFinite(fps) || fps <= 0 || !Number.isFinite(frameTimeMs) || frameTimeMs <= 0) {
      return;
    }

    this.currentMetrics.fps = Math.min(fps, this.performanceSettings?.frameRateTarget ?? 60);
    this.currentMetrics.frameTime = frameTimeMs;

    this.frameTimeHistory.push(frameTimeMs);
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift();
    }
  }

  /**
   * Get level of detail settings for current zoom level
   */
  getLODSettings(zoomLevel: number): LevelOfDetailSettings {
    let selectedLOD: LevelOfDetailSettings;

    if (zoomLevel <= 3) {
      selectedLOD = this.lodConfigurations.get('world')!;
    } else if (zoomLevel <= 6) {
      selectedLOD = this.lodConfigurations.get('country')!;
    } else if (zoomLevel <= 10) {
      selectedLOD = this.lodConfigurations.get('region')!;
    } else if (zoomLevel <= 14) {
      selectedLOD = this.lodConfigurations.get('city')!;
    } else {
      selectedLOD = this.lodConfigurations.get('street')!;
    }

    // Apply device-specific adjustments
    return this.adjustLODForPerformance(selectedLOD);
  }

  /**
   * Get adaptive performance settings based on current metrics
   */
  getAdaptiveSettings(): Partial<PerformanceSettings> {
    if (!this.performanceSettings) return {};

    const currentFPS = this.currentMetrics.fps;
    const memoryUsage = this.currentMetrics.memoryUsageMB;
    
    return this.deviceCapabilityService.getAdaptiveSettings(currentFPS, memoryUsage);
  }

  /**
   * Register cache entry for memory management
   */
  registerCacheEntry(key: string, sizeBytes: number, priority: number = 1): void {
    this.cacheRegistry.set(key, {
      size: sizeBytes,
      lastAccessed: Date.now(),
      priority
    });
  }

  /**
   * Access cache entry (updates last accessed time)
   */
  accessCacheEntry(key: string): void {
    const entry = this.cacheRegistry.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
    }
  }

  /**
   * Remove cache entry
   */
  removeCacheEntry(key: string): void {
    this.cacheRegistry.delete(key);
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Add performance callback
   */
  addPerformanceCallback(callback: (metrics: PerformanceMetrics) => void): void {
    this.performanceCallbacks.push(callback);
  }

  /**
   * Remove performance callback
   */
  removePerformanceCallback(callback: (metrics: PerformanceMetrics) => void): void {
    const index = this.performanceCallbacks.indexOf(callback);
    if (index > -1) {
      this.performanceCallbacks.splice(index, 1);
    }
  }

  /**
   * Force memory cleanup
   */
  forceMemoryCleanup(): void {
    this.performMemoryCleanup(true);
  }

  // Private methods

  private async updatePerformanceMetrics(): Promise<void> {
    try {
      // Calculate FPS from frame time history
      if (this.frameTimeHistory.length > 0) {
        const avgFrameTime = this.frameTimeHistory.reduce((sum, time) => sum + time, 0) / this.frameTimeHistory.length;
        this.currentMetrics.fps = Math.min(60, 1000 / avgFrameTime);
        this.currentMetrics.frameTime = avgFrameTime;
      }

      // Get memory metrics
      const memoryMetrics = await this.deviceCapabilityService.getPerformanceMetrics();
      this.currentMetrics.memoryUsageMB = memoryMetrics.memoryUsageMB;
      
      this.memoryHistory.push(memoryMetrics.memoryUsageMB);
      if (this.memoryHistory.length > 60) {
        this.memoryHistory.shift();
      }

      // Check for performance issues
      this.checkPerformanceThresholds();

      // Notify callbacks
      this.performanceCallbacks.forEach(callback => {
        try {
          callback(this.currentMetrics);
        } catch (error) {
          console.error('Performance callback error:', error);
        }
      });
    } catch (error) {
      console.error('Error updating performance metrics:', error);
    }
  }

  private checkPerformanceThresholds(): void {
    if (!this.performanceSettings) return;

    const { fps, memoryUsageMB } = this.currentMetrics;
    const { frameRateTarget, memoryThresholdMB } = this.performanceSettings;

    // Check FPS threshold
    if (fps < frameRateTarget * 0.7) {
      console.warn(`Low FPS detected: ${fps.toFixed(1)} (target: ${frameRateTarget})`);
      this.triggerPerformanceOptimization('fps');
    }

    // Check memory threshold
    if (memoryUsageMB > memoryThresholdMB) {
      console.warn(`High memory usage: ${memoryUsageMB}MB (threshold: ${memoryThresholdMB}MB)`);
      this.triggerPerformanceOptimization('memory');
    }
  }

  private triggerPerformanceOptimization(reason: 'fps' | 'memory'): void {
    if (reason === 'memory') {
      this.memoryManagementConfig.aggressiveCleanup = true;
      this.performMemoryCleanup(true);
    }
    
    // Additional optimizations could be triggered here
    console.log(`Performance optimization triggered due to: ${reason}`);
  }

  private adjustLODForDevice(): void {
    const capabilities = this.deviceCapabilityService.getCapabilities();
    if (!capabilities) return;

    const multiplier = capabilities.tier === 'high' ? 1.2 : capabilities.tier === 'low' ? 0.6 : 1.0;

    this.lodConfigurations.forEach((lod, key) => {
      lod.maxFogFeatures = Math.floor(lod.maxFogFeatures * multiplier);
      lod.cloudComplexity *= multiplier;
      
      if (capabilities.tier === 'low') {
        lod.particleQuality = 'low';
        if (key === 'world' || key === 'country') {
          lod.enableAnimations = false;
        }
      }
    });
  }

  private adjustLODForPerformance(baseLOD: LevelOfDetailSettings): LevelOfDetailSettings {
    const adjustedLOD = { ...baseLOD };
    const { fps, memoryUsageMB } = this.currentMetrics;
    
    if (!this.performanceSettings) return adjustedLOD;

    const { frameRateTarget, memoryThresholdMB } = this.performanceSettings;

    // Adjust based on current FPS
    if (fps < frameRateTarget * 0.8) {
      adjustedLOD.maxFogFeatures = Math.floor(adjustedLOD.maxFogFeatures * 0.7);
      adjustedLOD.cloudComplexity *= 0.8;
      if (fps < frameRateTarget * 0.6) {
        adjustedLOD.particleQuality = 'low';
        adjustedLOD.enableAnimations = false;
      }
    }

    // Adjust based on memory usage
    if (memoryUsageMB > memoryThresholdMB * 0.8) {
      adjustedLOD.maxFogFeatures = Math.floor(adjustedLOD.maxFogFeatures * 0.6);
      adjustedLOD.fogCellSize *= 1.5; // Larger cells = fewer features
    }

    return adjustedLOD;
  }

  private configureMemoryManagement(): void {
    const capabilities = this.deviceCapabilityService.getCapabilities();
    if (!capabilities) return;

    const memoryGB = capabilities.memoryGB;
    
    this.memoryManagementConfig = {
      maxCacheSize: Math.min(100 * 1024 * 1024, memoryGB * 1024 * 1024 * 0.1), // 10% of total memory or 100MB max
      cleanupInterval: capabilities.tier === 'low' ? 15000 : 30000, // More frequent cleanup on low-end devices
      memoryThreshold: capabilities.tier === 'low' ? 0.7 : 0.8,
      aggressiveCleanup: capabilities.tier === 'low'
    };
  }

  private performMemoryCleanup(force: boolean = false): void {
    const now = Date.now();
    const { maxCacheSize, memoryThreshold, aggressiveCleanup } = this.memoryManagementConfig;
    
    // Calculate total cache size
    let totalCacheSize = 0;
    this.cacheRegistry.forEach(entry => {
      totalCacheSize += entry.size;
    });

    // Determine if cleanup is needed
    const needsCleanup = force || 
                        totalCacheSize > maxCacheSize || 
                        (aggressiveCleanup && totalCacheSize > maxCacheSize * 0.7);

    if (!needsCleanup) return;

    // Sort cache entries by priority and last accessed time
    const sortedEntries = Array.from(this.cacheRegistry.entries())
      .sort(([, a], [, b]) => {
        // Lower priority and older entries first
        const priorityDiff = a.priority - b.priority;
        if (priorityDiff !== 0) return priorityDiff;
        return a.lastAccessed - b.lastAccessed;
      });

    // Remove entries until we're under the threshold
    const targetSize = maxCacheSize * (aggressiveCleanup ? 0.6 : 0.8);
    let currentSize = totalCacheSize;
    let removedCount = 0;

    for (const [key, entry] of sortedEntries) {
      if (currentSize <= targetSize) break;
      
      // Don't remove recently accessed high-priority items unless forced
      const isRecent = now - entry.lastAccessed < 30000; // 30 seconds
      const isHighPriority = entry.priority >= 5;
      
      if (!force && isRecent && isHighPriority) continue;
      
      this.cacheRegistry.delete(key);
      currentSize -= entry.size;
      removedCount++;
    }

    if (removedCount > 0) {
      console.log(`Memory cleanup: removed ${removedCount} cache entries, freed ${((totalCacheSize - currentSize) / 1024 / 1024).toFixed(1)}MB`);
    }
  }

  private getTimestamp(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }

    return Date.now();
  }
}

// Singleton instance
let performanceMonitorService: PerformanceMonitorService | null = null;

export const getPerformanceMonitorService = (): PerformanceMonitorService => {
  if (!performanceMonitorService) {
    performanceMonitorService = new PerformanceMonitorService();
  }
  return performanceMonitorService;
};

export default PerformanceMonitorService;