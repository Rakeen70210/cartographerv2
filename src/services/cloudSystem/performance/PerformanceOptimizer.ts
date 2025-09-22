/**
 * Performance Optimizer
 * Integrates all performance optimization systems for cloud rendering
 */

import { DeviceCapabilities, PerformanceTier, PerformanceMode } from '../../../types/cloud';
import { MapBounds } from '../../../types/map';
import { DeviceCapabilityDetector } from './DeviceCapabilityDetector';
import { PerformanceManager } from './PerformanceManager';
import { LODSystem, LODLevel } from './LODSystem';
import { MemoryManager } from './MemoryManager';
import { FrameRateMonitor } from './FrameRateMonitor';

export interface PerformanceOptimizerConfig {
  autoOptimization: boolean;
  aggressiveOptimization: boolean;
  memoryLimit: number; // MB
  targetFrameRate: number;
  adaptiveQuality: boolean;
}

export interface OptimizationResult {
  performanceMode: PerformanceMode;
  lodLevel: LODLevel;
  textureResolution: number;
  maxVisibleCells: number;
  memoryUsage: number;
  frameRate: number;
  optimizationsApplied: string[];
}

export class PerformanceOptimizer {
  private deviceCapabilities: DeviceCapabilities | null = null;
  private performanceManager: PerformanceManager;
  private lodSystem: LODSystem | null = null;
  private memoryManager: MemoryManager;
  private frameRateMonitor: FrameRateMonitor;
  private capabilityDetector: DeviceCapabilityDetector;
  private config: PerformanceOptimizerConfig;
  private isInitialized = false;
  private lastOptimization = 0;
  private optimizationCallbacks: Array<(result: OptimizationResult) => void> = [];

  constructor(config: Partial<PerformanceOptimizerConfig> = {}) {
    this.config = {
      autoOptimization: true,
      aggressiveOptimization: false,
      memoryLimit: 100,
      targetFrameRate: 60,
      adaptiveQuality: true,
      ...config
    };

    this.capabilityDetector = DeviceCapabilityDetector.getInstance();
    this.performanceManager = new PerformanceManager({
      autoOptimize: this.config.autoOptimization,
      targetFrameRate: this.config.targetFrameRate,
      adaptiveQuality: this.config.adaptiveQuality,
      memoryThreshold: this.config.memoryLimit
    });
    
    this.memoryManager = new MemoryManager({
      maxMemoryMB: this.config.memoryLimit,
      progressiveLoadingEnabled: true,
      spatialCachingEnabled: true
    });
    
    this.frameRateMonitor = new FrameRateMonitor();
  }

  /**
   * Initialize the performance optimizer
   */
  public async initialize(gl?: WebGLRenderingContext): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize performance manager and detect capabilities
      await this.performanceManager.initialize();
      this.deviceCapabilities = this.performanceManager.getDeviceCapabilities();

      if (!this.deviceCapabilities) {
        throw new Error('Failed to detect device capabilities');
      }

      // Initialize LOD system with detected capabilities
      const recommendedTier = this.capabilityDetector.getRecommendedPerformanceTier(this.deviceCapabilities);
      const recommendedMode = this.capabilityDetector.getRecommendedPerformanceMode(this.deviceCapabilities);
      
      this.lodSystem = new LODSystem(recommendedTier, recommendedMode, {
        adaptiveQuality: this.config.adaptiveQuality,
        performanceThreshold: this.config.targetFrameRate * 0.8
      });

      // Initialize memory manager with WebGL context if provided
      if (gl) {
        this.memoryManager.initialize(gl);
      }

      // Start frame rate monitoring
      this.frameRateMonitor.start();

      // Set up performance monitoring callbacks
      this.performanceManager.onOptimization((mode, tier) => {
        this.handlePerformanceChange(mode, tier);
      });

      this.isInitialized = true;
      console.log('PerformanceOptimizer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PerformanceOptimizer:', error);
      throw error;
    }
  }

  /**
   * Optimize performance for current conditions
   */
  public optimizeForCurrentConditions(
    zoomLevel: number,
    mapBounds: MapBounds,
    cameraPosition: [number, number]
  ): OptimizationResult {
    if (!this.isInitialized || !this.lodSystem) {
      throw new Error('PerformanceOptimizer not initialized');
    }

    const currentFPS = this.frameRateMonitor.getCurrentFPS();
    const memoryUsage = this.memoryManager.getMemoryUsage();
    const optimizationsApplied: string[] = [];

    // Update LOD based on zoom and performance
    const lodLevel = this.lodSystem.updateLOD(zoomLevel, currentFPS);
    
    // Update spatial cache based on map position
    this.memoryManager.updateSpatialCache(mapBounds, cameraPosition);

    // Check if aggressive optimization is needed
    if (this.shouldApplyAggressiveOptimization(currentFPS, memoryUsage.totalAllocated)) {
      this.applyAggressiveOptimizations();
      optimizationsApplied.push('aggressive_optimization');
    }

    // Check memory pressure
    if (this.memoryManager.isMemoryPressureHigh()) {
      this.memoryManager.performEmergencyCleanup();
      optimizationsApplied.push('memory_cleanup');
    }

    // Update performance mode if needed
    const currentMode = this.performanceManager.getCurrentMode();
    const recommendedMode = this.performanceManager.getRecommendedPerformanceMode();
    
    if (currentMode !== recommendedMode) {
      this.performanceManager.setPerformanceMode(recommendedMode);
      optimizationsApplied.push(`mode_change_${currentMode}_to_${recommendedMode}`);
    }

    const result: OptimizationResult = {
      performanceMode: this.performanceManager.getCurrentMode(),
      lodLevel,
      textureResolution: lodLevel.textureResolution,
      maxVisibleCells: lodLevel.maxVisibleCells,
      memoryUsage: memoryUsage.totalAllocated,
      frameRate: currentFPS,
      optimizationsApplied
    };

    // Notify callbacks
    this.notifyOptimizationCallbacks(result);

    this.lastOptimization = Date.now();
    return result;
  }

  /**
   * Get current performance status
   */
  public getPerformanceStatus(): {
    deviceCapabilities: DeviceCapabilities | null;
    currentMode: PerformanceMode;
    currentLOD: LODLevel | null;
    frameRate: number;
    memoryUsage: number;
    isOptimal: boolean;
  } {
    return {
      deviceCapabilities: this.deviceCapabilities,
      currentMode: this.performanceManager.getCurrentMode(),
      currentLOD: this.lodSystem?.getCurrentLODLevel() || null,
      frameRate: this.frameRateMonitor.getCurrentFPS(),
      memoryUsage: this.memoryManager.getMemoryUsage().totalAllocated,
      isOptimal: this.isPerformanceOptimal()
    };
  }

  /**
   * Force performance mode change
   */
  public setPerformanceMode(mode: PerformanceMode): void {
    this.performanceManager.setPerformanceMode(mode);
    
    if (this.lodSystem && this.deviceCapabilities) {
      const tier = this.capabilityDetector.getRecommendedPerformanceTier(this.deviceCapabilities);
      this.lodSystem.setPerformanceMode(mode);
      this.lodSystem.setPerformanceTier(tier);
    }
  }

  /**
   * Get texture from memory pool
   */
  public getPooledTexture(id: string, resolution: number, format: string = 'RGBA'): WebGLTexture | null {
    return this.memoryManager.getPooledTexture(id, resolution, format);
  }

  /**
   * Release texture back to pool
   */
  public releasePooledTexture(id: string): void {
    this.memoryManager.releasePooledTexture(id);
  }

  /**
   * Cache a cloud resource
   */
  public cacheResource(
    id: string,
    resource: WebGLTexture | WebGLBuffer | WebGLProgram,
    type: 'texture' | 'buffer' | 'shader',
    size: number,
    priority: number = 5,
    bounds?: MapBounds
  ): void {
    this.memoryManager.cacheResource(id, resource, type, size, priority, bounds);
  }

  /**
   * Get cached resource
   */
  public getCachedResource(id: string): any {
    return this.memoryManager.getCachedResource(id);
  }

  /**
   * Perform cloud cell culling
   */
  public performCulling(
    cloudCells: Array<{ id: string; bounds: MapBounds; distance: number }>,
    viewportBounds: MapBounds,
    cameraPosition: [number, number]
  ) {
    if (!this.lodSystem) return null;
    return this.lodSystem.performCulling(cloudCells, viewportBounds, cameraPosition);
  }

  /**
   * Queue progressive loading
   */
  public queueProgressiveLoad(id: string, loader: () => Promise<any>, priority: number = 5): void {
    this.memoryManager.queueProgressiveLoad(id, loader, priority);
  }

  /**
   * Register optimization callback
   */
  public onOptimization(callback: (result: OptimizationResult) => void): void {
    this.optimizationCallbacks.push(callback);
  }

  /**
   * Remove optimization callback
   */
  public removeOptimizationCallback(callback: (result: OptimizationResult) => void): void {
    const index = this.optimizationCallbacks.indexOf(callback);
    if (index > -1) {
      this.optimizationCallbacks.splice(index, 1);
    }
  }

  /**
   * Get performance recommendations
   */
  public getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (!this.isPerformanceOptimal()) {
      recommendations.push('Performance is below optimal, consider reducing quality settings');
    }
    
    if (this.memoryManager.isMemoryPressureHigh()) {
      recommendations.push('Memory usage is high, consider reducing texture resolution');
    }
    
    const frameRate = this.frameRateMonitor.getCurrentFPS();
    if (frameRate < this.config.targetFrameRate * 0.8) {
      recommendations.push('Frame rate is low, consider enabling aggressive optimization');
    }
    
    return recommendations;
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.frameRateMonitor.stop();
    this.performanceManager.dispose();
    this.memoryManager.dispose();
    this.optimizationCallbacks.length = 0;
    this.isInitialized = false;
  }

  /**
   * Check if performance is currently optimal
   */
  private isPerformanceOptimal(): boolean {
    const frameRate = this.frameRateMonitor.getCurrentFPS();
    const memoryPressure = this.memoryManager.isMemoryPressureHigh();
    
    return frameRate >= this.config.targetFrameRate * 0.9 && !memoryPressure;
  }

  /**
   * Check if aggressive optimization should be applied
   */
  private shouldApplyAggressiveOptimization(frameRate: number, memoryUsage: number): boolean {
    if (!this.config.aggressiveOptimization) return false;
    
    const lowFrameRate = frameRate < this.config.targetFrameRate * 0.6;
    const highMemoryUsage = memoryUsage > this.config.memoryLimit * 1024 * 1024 * 0.9;
    
    return lowFrameRate || highMemoryUsage;
  }

  /**
   * Apply aggressive performance optimizations
   */
  private applyAggressiveOptimizations(): void {
    console.log('Applying aggressive performance optimizations');
    
    // Force low performance mode
    this.setPerformanceMode('low');
    
    // Perform emergency memory cleanup
    this.memoryManager.performEmergencyCleanup();
    
    // Reduce LOD quality if possible
    if (this.lodSystem && this.deviceCapabilities) {
      const lowTier = this.capabilityDetector.getPerformanceTier('low');
      if (lowTier) {
        this.lodSystem.setPerformanceTier(lowTier);
      }
    }
  }

  /**
   * Handle performance mode changes
   */
  private handlePerformanceChange(mode: PerformanceMode, tier: PerformanceTier): void {
    if (this.lodSystem) {
      this.lodSystem.setPerformanceMode(mode);
      this.lodSystem.setPerformanceTier(tier);
    }
    
    console.log(`Performance optimized: mode=${mode}, tier=${tier.name}`);
  }

  /**
   * Notify optimization callbacks
   */
  private notifyOptimizationCallbacks(result: OptimizationResult): void {
    this.optimizationCallbacks.forEach(callback => {
      try {
        callback(result);
      } catch (error) {
        console.error('Error in optimization callback:', error);
      }
    });
  }
}