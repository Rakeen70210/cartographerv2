/**
 * Performance Manager
 * Manages cloud system performance optimization and monitoring
 */

import { DeviceCapabilities, PerformanceTier, PerformanceMode } from '../../../types/cloud';
import { DeviceCapabilityDetector } from './DeviceCapabilityDetector';
import { FrameRateMonitor } from './FrameRateMonitor';

export interface PerformanceManagerConfig {
  autoOptimize: boolean;
  targetFrameRate: number;
  adaptiveQuality: boolean;
  memoryThreshold: number; // MB
}

export interface PerformanceMetrics {
  frameRate: number;
  memoryUsage: number;
  gpuUtilization: number;
  renderTime: number;
  lastOptimization: number;
}

export class PerformanceManager {
  private deviceCapabilities: DeviceCapabilities | null = null;
  private currentTier: PerformanceTier | null = null;
  private currentMode: PerformanceMode = 'medium';
  private frameRateMonitor: FrameRateMonitor;
  private capabilityDetector: DeviceCapabilityDetector;
  private config: PerformanceManagerConfig;
  private metrics: PerformanceMetrics;
  private optimizationCallbacks: Array<(mode: PerformanceMode, tier: PerformanceTier) => void> = [];
  private isInitialized = false;

  constructor(config: Partial<PerformanceManagerConfig> = {}) {
    this.config = {
      autoOptimize: true,
      targetFrameRate: 60,
      adaptiveQuality: true,
      memoryThreshold: 100,
      ...config
    };

    this.frameRateMonitor = new FrameRateMonitor();
    this.capabilityDetector = DeviceCapabilityDetector.getInstance();
    
    this.metrics = {
      frameRate: 0,
      memoryUsage: 0,
      gpuUtilization: 0,
      renderTime: 0,
      lastOptimization: 0
    };
  }

  /**
   * Initialize performance manager and detect device capabilities
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Detect device capabilities
      this.deviceCapabilities = await this.capabilityDetector.detectCapabilities();
      
      // Get recommended performance tier
      this.currentTier = this.capabilityDetector.getRecommendedPerformanceTier(this.deviceCapabilities);
      
      // Set initial performance mode
      this.currentMode = this.capabilityDetector.getRecommendedPerformanceMode(this.deviceCapabilities);
      
      // Start frame rate monitoring
      this.frameRateMonitor.start();
      
      // Set up adaptive optimization if enabled
      if (this.config.adaptiveQuality) {
        this.startAdaptiveOptimization();
      }

      this.isInitialized = true;
      
      console.log('PerformanceManager initialized:', {
        capabilities: this.deviceCapabilities,
        tier: this.currentTier,
        mode: this.currentMode
      });
    } catch (error) {
      console.error('Failed to initialize PerformanceManager:', error);
      // Use fallback settings
      this.setFallbackConfiguration();
    }
  }

  /**
   * Get current device capabilities
   */
  public getDeviceCapabilities(): DeviceCapabilities | null {
    return this.deviceCapabilities;
  }

  /**
   * Get current performance tier
   */
  public getCurrentTier(): PerformanceTier | null {
    return this.currentTier;
  }

  /**
   * Get current performance mode
   */
  public getCurrentMode(): PerformanceMode {
    return this.currentMode;
  }

  /**
   * Set performance mode manually
   */
  public setPerformanceMode(mode: PerformanceMode): void {
    if (this.currentMode === mode) return;

    this.currentMode = mode;
    
    // Update tier based on new mode
    if (this.deviceCapabilities) {
      const availableTiers = this.capabilityDetector.getPerformanceTiers();
      const compatibleTiers = availableTiers.filter(tier => 
        this.capabilityDetector.getRecommendedPerformanceMode(this.deviceCapabilities!) === mode ||
        this.isTierCompatibleWithMode(tier, mode)
      );
      
      if (compatibleTiers.length > 0) {
        this.currentTier = compatibleTiers[compatibleTiers.length - 1]; // Use highest compatible tier
      }
    }

    this.notifyOptimizationCallbacks();
    console.log(`Performance mode set to: ${mode}`);
  }

  /**
   * Get recommended performance mode based on current conditions
   */
  public getRecommendedPerformanceMode(): PerformanceMode {
    if (!this.deviceCapabilities) return 'low';
    
    const baseRecommendation = this.capabilityDetector.getRecommendedPerformanceMode(this.deviceCapabilities);
    
    // Adjust based on current performance metrics
    if (this.config.adaptiveQuality) {
      const currentFPS = this.frameRateMonitor.getCurrentFPS();
      const targetFPS = this.config.targetFrameRate;
      
      if (currentFPS < targetFPS * 0.8) {
        // Performance is poor, recommend lower mode
        return this.getLowerPerformanceMode(baseRecommendation);
      } else if (currentFPS > targetFPS * 0.95 && baseRecommendation !== 'high') {
        // Performance is good, can potentially increase
        return this.getHigherPerformanceMode(baseRecommendation);
      }
    }
    
    return baseRecommendation;
  }

  /**
   * Optimize performance based on current conditions
   */
  public optimizePerformance(): void {
    if (!this.config.autoOptimize || !this.isInitialized) return;

    const recommendedMode = this.getRecommendedPerformanceMode();
    
    if (recommendedMode !== this.currentMode) {
      console.log(`Auto-optimizing performance: ${this.currentMode} -> ${recommendedMode}`);
      this.setPerformanceMode(recommendedMode);
      this.metrics.lastOptimization = Date.now();
    }
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Register callback for performance optimization events
   */
  public onOptimization(callback: (mode: PerformanceMode, tier: PerformanceTier) => void): void {
    this.optimizationCallbacks.push(callback);
  }

  /**
   * Remove optimization callback
   */
  public removeOptimizationCallback(callback: (mode: PerformanceMode, tier: PerformanceTier) => void): void {
    const index = this.optimizationCallbacks.indexOf(callback);
    if (index > -1) {
      this.optimizationCallbacks.splice(index, 1);
    }
  }

  /**
   * Check if current performance is acceptable
   */
  public isPerformanceAcceptable(): boolean {
    const currentFPS = this.frameRateMonitor.getCurrentFPS();
    const targetFPS = this.config.targetFrameRate;
    
    return currentFPS >= targetFPS * 0.8; // 80% of target is acceptable
  }

  /**
   * Get performance recommendations
   */
  public getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (!this.isPerformanceAcceptable()) {
      recommendations.push('Consider reducing cloud quality for better performance');
    }
    
    if (this.metrics.memoryUsage > this.config.memoryThreshold) {
      recommendations.push('Memory usage is high, consider reducing texture resolution');
    }
    
    if (this.currentMode === 'high' && this.deviceCapabilities?.gpuTier === 'low') {
      recommendations.push('High quality mode may not be optimal for this device');
    }
    
    return recommendations;
  }

  /**
   * Dispose of performance manager resources
   */
  public dispose(): void {
    this.frameRateMonitor.stop();
    this.optimizationCallbacks.length = 0;
    this.isInitialized = false;
  }

  /**
   * Start adaptive optimization monitoring
   */
  private startAdaptiveOptimization(): void {
    // Check performance every 5 seconds
    setInterval(() => {
      this.optimizePerformance();
    }, 5000);
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    this.metrics.frameRate = this.frameRateMonitor.getCurrentFPS();
    this.metrics.renderTime = this.frameRateMonitor.getAverageFrameTime();
    
    // Estimate memory usage (simplified)
    if (this.currentTier) {
      this.metrics.memoryUsage = this.estimateMemoryUsage(this.currentTier);
    }
    
    // GPU utilization is difficult to measure directly, use frame time as proxy
    this.metrics.gpuUtilization = Math.min(100, (this.metrics.renderTime / 16.67) * 100); // 16.67ms = 60fps
  }

  /**
   * Estimate current memory usage
   */
  private estimateMemoryUsage(tier: PerformanceTier): number {
    // Simplified memory estimation based on tier settings
    const textureMemory = (tier.textureResolution * tier.textureResolution * 4) / (1024 * 1024);
    const vertexMemory = (tier.maxCloudCells * 1000 * 4 * 8) / (1024 * 1024);
    return textureMemory + vertexMemory;
  }

  /**
   * Check if tier is compatible with performance mode
   */
  private isTierCompatibleWithMode(tier: PerformanceTier, mode: PerformanceMode): boolean {
    const modeQualityMap: Record<PerformanceMode, string[]> = {
      low: ['low'],
      medium: ['low', 'medium'],
      high: ['low', 'medium', 'high']
    };
    
    return modeQualityMap[mode].includes(tier.animationQuality);
  }

  /**
   * Get lower performance mode
   */
  private getLowerPerformanceMode(current: PerformanceMode): PerformanceMode {
    const modes: PerformanceMode[] = ['low', 'medium', 'high'];
    const currentIndex = modes.indexOf(current);
    return currentIndex > 0 ? modes[currentIndex - 1] : current;
  }

  /**
   * Get higher performance mode
   */
  private getHigherPerformanceMode(current: PerformanceMode): PerformanceMode {
    const modes: PerformanceMode[] = ['low', 'medium', 'high'];
    const currentIndex = modes.indexOf(current);
    return currentIndex < modes.length - 1 ? modes[currentIndex + 1] : current;
  }

  /**
   * Set fallback configuration when initialization fails
   */
  private setFallbackConfiguration(): void {
    this.currentMode = 'low';
    this.currentTier = {
      name: 'fallback',
      maxCloudCells: 25,
      textureResolution: 256,
      animationQuality: 'low',
      shaderComplexity: 'simple',
      updateFrequency: 15
    };
    this.isInitialized = true;
  }

  /**
   * Notify all optimization callbacks
   */
  private notifyOptimizationCallbacks(): void {
    if (this.currentTier) {
      this.optimizationCallbacks.forEach(callback => {
        try {
          callback(this.currentMode, this.currentTier!);
        } catch (error) {
          console.error('Error in optimization callback:', error);
        }
      });
    }
  }
}