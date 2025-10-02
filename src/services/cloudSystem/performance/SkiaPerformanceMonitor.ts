/**
 * Skia Performance Monitor
 * Specialized performance monitoring for Skia fog overlay with adaptive quality control
 */

import { FrameRateMonitor, FrameRateMetrics } from './FrameRateMonitor';
import { DeviceCapabilityDetector } from './DeviceCapabilityDetector';
import { PerformanceManager, PerformanceManagerConfig } from './PerformanceManager';
import { DeviceCapabilities, PerformanceTier, PerformanceMode } from '../../../types/cloud';

export interface SkiaPerformanceConfig {
  targetFPS: number;
  adaptiveQuality: boolean;
  performanceCheckInterval: number;
  qualityReductionThreshold: number;
  qualityImprovementThreshold: number;
  maxConsecutivePoorFrames: number;
  enableDebugLogging: boolean;
  logThrottleMs: number;
  maxLogsPerWindow: number;
  logWindowMs: number;
}

export interface SkiaQualitySettings {
  shaderComplexity: 'simple' | 'standard' | 'advanced';
  cloudDensity: number;
  animationSpeed: number;
  blurRadius: number;
  updateFrequency: number;
  enableLayeredEffects: boolean;
}

export interface SkiaPerformanceMetrics extends FrameRateMetrics {
  qualityLevel: number; // 0-100
  adaptationCount: number;
  lastAdaptation: number;
  isStable: boolean;
  recommendations: string[];
}

export class SkiaPerformanceMonitor {
  private frameRateMonitor: FrameRateMonitor;
  private performanceManager: PerformanceManager;
  private deviceCapabilities: DeviceCapabilities | null = null;
  private config: SkiaPerformanceConfig;
  private currentQuality: SkiaQualitySettings;
  private baselineQuality: SkiaQualitySettings;
  private isRunning = false;
  private adaptationCount = 0;
  private lastAdaptation = 0;
  private consecutivePoorFrames = 0;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private qualityChangeCallbacks: Array<(quality: SkiaQualitySettings) => void> = [];
  private logTimestamps: Map<string, number> = new Map();
  private logWindowStart = 0;
  private logWindowCount = 0;

  constructor(config: Partial<SkiaPerformanceConfig> = {}) {
    this.config = {
      targetFPS: 30, // Conservative target for mobile
      adaptiveQuality: true,
      performanceCheckInterval: 1000, // Check every second
      qualityReductionThreshold: 25, // Reduce quality if FPS drops below this
      qualityImprovementThreshold: 50, // Improve quality if FPS is above this
      maxConsecutivePoorFrames: 3,
      enableDebugLogging: false,
      logThrottleMs: 5000,
      maxLogsPerWindow: 3,
      logWindowMs: 15000,
      ...config
    };

    this.frameRateMonitor = new FrameRateMonitor();
    this.performanceManager = new PerformanceManager({
      autoOptimize: false, // We handle optimization manually
      targetFrameRate: this.config.targetFPS,
      adaptiveQuality: this.config.adaptiveQuality
    });

    // Initialize with conservative quality settings
    this.currentQuality = this.getConservativeQuality();
    this.baselineQuality = { ...this.currentQuality };
  }

  /**
   * Initialize performance monitoring
   */
  public async initialize(): Promise<void> {
    try {
      // Initialize performance manager to get device capabilities
      await this.performanceManager.initialize();
      this.deviceCapabilities = this.performanceManager.getDeviceCapabilities();

      // Set initial quality based on device capabilities
      if (this.deviceCapabilities) {
        this.currentQuality = this.getOptimalQualityForDevice(this.deviceCapabilities);
        this.baselineQuality = { ...this.currentQuality };
      }

      this.log('SkiaPerformanceMonitor initialized', {
        deviceCapabilities: this.deviceCapabilities,
        initialQuality: this.currentQuality
      });
    } catch (error) {
      console.error('Failed to initialize SkiaPerformanceMonitor:', error);
      // Continue with conservative settings
    }
  }

  /**
   * Start performance monitoring
   */
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.frameRateMonitor.start();
    
    if (this.config.adaptiveQuality) {
      this.startAdaptiveMonitoring();
    }

    this.log('Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.frameRateMonitor.stop();
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.log('Performance monitoring stopped');
  }

  /**
   * Get current quality settings
   */
  public getCurrentQuality(): SkiaQualitySettings {
    return { ...this.currentQuality };
  }

  /**
   * Set quality settings manually
   */
  public setQuality(quality: Partial<SkiaQualitySettings>): void {
    const newQuality = { ...this.currentQuality, ...quality };
    
    if (this.isQualityDifferent(this.currentQuality, newQuality)) {
      this.currentQuality = newQuality;
      this.notifyQualityChange();
      this.log('Quality settings updated manually', newQuality);
    }
  }

  /**
   * Get comprehensive performance metrics
   */
  public getMetrics(): SkiaPerformanceMetrics {
    const frameMetrics = this.frameRateMonitor.getMetrics();
    
    return {
      ...frameMetrics,
      qualityLevel: this.calculateQualityLevel(),
      adaptationCount: this.adaptationCount,
      lastAdaptation: this.lastAdaptation,
      isStable: this.frameRateMonitor.isPerformanceStable(),
      recommendations: this.getPerformanceRecommendations()
    };
  }

  /**
   * Check if performance is currently acceptable
   */
  public isPerformanceAcceptable(): boolean {
    const currentFPS = this.frameRateMonitor.getCurrentFPS();
    return currentFPS >= this.config.targetFPS * 0.8; // 80% of target is acceptable
  }

  /**
   * Force quality adaptation based on current performance
   */
  public adaptQuality(): boolean {
    if (!this.config.adaptiveQuality) return false;

    const currentFPS = this.frameRateMonitor.getCurrentFPS();
    const targetFPS = this.config.targetFPS;

    if (currentFPS < this.config.qualityReductionThreshold) {
      return this.reduceQuality();
    } else if (currentFPS > this.config.qualityImprovementThreshold && 
               this.canImproveQuality()) {
      return this.improveQuality();
    }

    return false;
  }

  /**
   * Register callback for quality changes
   */
  public onQualityChange(callback: (quality: SkiaQualitySettings) => void): void {
    this.qualityChangeCallbacks.push(callback);
  }

  /**
   * Remove quality change callback
   */
  public removeQualityChangeCallback(callback: (quality: SkiaQualitySettings) => void): void {
    const index = this.qualityChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.qualityChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Reset quality to baseline
   */
  public resetToBaseline(): void {
    this.currentQuality = { ...this.baselineQuality };
    this.adaptationCount = 0;
    this.consecutivePoorFrames = 0;
    this.notifyQualityChange();
    this.log('Quality reset to baseline');
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): string {
    const metrics = this.getMetrics();
    const quality = this.currentQuality;
    
    return `FPS: ${metrics.currentFPS.toFixed(1)} | ` +
           `Quality: ${metrics.qualityLevel}% | ` +
           `Shader: ${quality.shaderComplexity} | ` +
           `Density: ${quality.cloudDensity.toFixed(2)} | ` +
           `Adaptations: ${metrics.adaptationCount} | ` +
           `Stable: ${metrics.isStable}`;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.stop();
    this.performanceManager.dispose();
    this.qualityChangeCallbacks.length = 0;
  }

  /**
   * Start adaptive quality monitoring
   */
  private startAdaptiveMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.checkAndAdaptPerformance();
    }, this.config.performanceCheckInterval);
  }

  /**
   * Check performance and adapt quality if needed
   */
  private checkAndAdaptPerformance(): void {
    const currentFPS = this.frameRateMonitor.getCurrentFPS();
    const targetFPS = this.config.targetFPS;

    if (currentFPS < this.config.qualityReductionThreshold) {
      this.consecutivePoorFrames++;
      
      if (this.consecutivePoorFrames >= this.config.maxConsecutivePoorFrames) {
        if (this.reduceQuality()) {
          this.consecutivePoorFrames = 0;
        }
      }
    } else {
      this.consecutivePoorFrames = 0;
      
      // Try to improve quality if performance is good and stable
      if (currentFPS > this.config.qualityImprovementThreshold && 
          this.frameRateMonitor.isPerformanceStable() &&
          this.canImproveQuality()) {
        this.improveQuality();
      }
    }
  }

  /**
   * Reduce quality settings to improve performance
   */
  private reduceQuality(): boolean {
    const newQuality = { ...this.currentQuality };
    let changed = false;

    // Reduce in order of impact on performance
    if (newQuality.enableLayeredEffects) {
      newQuality.enableLayeredEffects = false;
      changed = true;
    } else if (newQuality.shaderComplexity === 'advanced') {
      newQuality.shaderComplexity = 'standard';
      changed = true;
    } else if (newQuality.blurRadius > 2) {
      newQuality.blurRadius = Math.max(2, newQuality.blurRadius - 2);
      changed = true;
    } else if (newQuality.shaderComplexity === 'standard') {
      newQuality.shaderComplexity = 'simple';
      changed = true;
    } else if (newQuality.cloudDensity > 0.3) {
      newQuality.cloudDensity = Math.max(0.3, newQuality.cloudDensity - 0.1);
      changed = true;
    } else if (newQuality.animationSpeed > 0.5) {
      newQuality.animationSpeed = Math.max(0.5, newQuality.animationSpeed - 0.2);
      changed = true;
    } else if (newQuality.updateFrequency > 15) {
      newQuality.updateFrequency = Math.max(15, newQuality.updateFrequency - 5);
      changed = true;
    }

    if (changed) {
      this.currentQuality = newQuality;
      this.adaptationCount++;
      this.lastAdaptation = Date.now();
      this.notifyQualityChange();
      this.log('Quality reduced for performance', newQuality);
    }

    return changed;
  }

  /**
   * Improve quality settings when performance allows
   */
  private improveQuality(): boolean {
    const newQuality = { ...this.currentQuality };
    const baseline = this.baselineQuality;
    let changed = false;

    // Improve in reverse order of reduction
    if (newQuality.updateFrequency < baseline.updateFrequency) {
      newQuality.updateFrequency = Math.min(baseline.updateFrequency, newQuality.updateFrequency + 5);
      changed = true;
    } else if (newQuality.animationSpeed < baseline.animationSpeed) {
      newQuality.animationSpeed = Math.min(baseline.animationSpeed, newQuality.animationSpeed + 0.2);
      changed = true;
    } else if (newQuality.cloudDensity < baseline.cloudDensity) {
      newQuality.cloudDensity = Math.min(baseline.cloudDensity, newQuality.cloudDensity + 0.1);
      changed = true;
    } else if (newQuality.shaderComplexity === 'simple' && baseline.shaderComplexity !== 'simple') {
      newQuality.shaderComplexity = 'standard';
      changed = true;
    } else if (newQuality.blurRadius < baseline.blurRadius) {
      newQuality.blurRadius = Math.min(baseline.blurRadius, newQuality.blurRadius + 2);
      changed = true;
    } else if (newQuality.shaderComplexity === 'standard' && baseline.shaderComplexity === 'advanced') {
      newQuality.shaderComplexity = 'advanced';
      changed = true;
    } else if (!newQuality.enableLayeredEffects && baseline.enableLayeredEffects) {
      newQuality.enableLayeredEffects = true;
      changed = true;
    }

    if (changed) {
      this.currentQuality = newQuality;
      this.adaptationCount++;
      this.lastAdaptation = Date.now();
      this.notifyQualityChange();
      this.log('Quality improved', newQuality);
    }

    return changed;
  }

  /**
   * Check if quality can be improved
   */
  private canImproveQuality(): boolean {
    const current = this.currentQuality;
    const baseline = this.baselineQuality;

    return (
      current.updateFrequency < baseline.updateFrequency ||
      current.animationSpeed < baseline.animationSpeed ||
      current.cloudDensity < baseline.cloudDensity ||
      current.shaderComplexity !== baseline.shaderComplexity ||
      current.blurRadius < baseline.blurRadius ||
      (!current.enableLayeredEffects && baseline.enableLayeredEffects)
    );
  }

  /**
   * Get optimal quality settings for device
   */
  private getOptimalQualityForDevice(capabilities: DeviceCapabilities): SkiaQualitySettings {
    const detector = DeviceCapabilityDetector.getInstance();
    const tier = detector.getRecommendedPerformanceTier(capabilities);
    const mode = detector.getRecommendedPerformanceMode(capabilities);

    return {
      shaderComplexity: this.getShaderComplexityForTier(tier),
      cloudDensity: this.getCloudDensityForMode(mode),
      animationSpeed: this.getAnimationSpeedForMode(mode),
      blurRadius: this.getBlurRadiusForTier(tier),
      updateFrequency: tier.updateFrequency,
      enableLayeredEffects: capabilities.gpuTier === 'high' && mode === 'high'
    };
  }

  /**
   * Get conservative quality settings for fallback
   */
  private getConservativeQuality(): SkiaQualitySettings {
    return {
      shaderComplexity: 'simple',
      cloudDensity: 0.5,
      animationSpeed: 0.8,
      blurRadius: 4,
      updateFrequency: 15,
      enableLayeredEffects: false
    };
  }

  /**
   * Get shader complexity for performance tier
   */
  private getShaderComplexityForTier(tier: PerformanceTier): 'simple' | 'standard' | 'advanced' {
    switch (tier.shaderComplexity) {
      case 'advanced': return 'advanced';
      case 'standard': return 'standard';
      default: return 'simple';
    }
  }

  /**
   * Get cloud density for performance mode
   */
  private getCloudDensityForMode(mode: PerformanceMode): number {
    switch (mode) {
      case 'high': return 0.8;
      case 'medium': return 0.6;
      default: return 0.4;
    }
  }

  /**
   * Get animation speed for performance mode
   */
  private getAnimationSpeedForMode(mode: PerformanceMode): number {
    switch (mode) {
      case 'high': return 1.2;
      case 'medium': return 1.0;
      default: return 0.8;
    }
  }

  /**
   * Get blur radius for performance tier
   */
  private getBlurRadiusForTier(tier: PerformanceTier): number {
    switch (tier.animationQuality) {
      case 'high': return 8;
      case 'medium': return 6;
      default: return 4;
    }
  }

  /**
   * Calculate current quality level as percentage
   */
  private calculateQualityLevel(): number {
    const current = this.currentQuality;
    const baseline = this.baselineQuality;

    const complexityScore = this.getComplexityScore(current.shaderComplexity) / 
                           this.getComplexityScore(baseline.shaderComplexity);
    const densityScore = current.cloudDensity / baseline.cloudDensity;
    const speedScore = current.animationSpeed / baseline.animationSpeed;
    const blurScore = current.blurRadius / baseline.blurRadius;
    const frequencyScore = current.updateFrequency / baseline.updateFrequency;
    const effectsScore = (current.enableLayeredEffects === baseline.enableLayeredEffects) ? 1 : 0.5;

    const totalScore = (complexityScore + densityScore + speedScore + blurScore + frequencyScore + effectsScore) / 6;
    return Math.round(totalScore * 100);
  }

  /**
   * Get numeric score for shader complexity
   */
  private getComplexityScore(complexity: 'simple' | 'standard' | 'advanced'): number {
    switch (complexity) {
      case 'advanced': return 3;
      case 'standard': return 2;
      default: return 1;
    }
  }

  /**
   * Check if two quality settings are different
   */
  private isQualityDifferent(a: SkiaQualitySettings, b: SkiaQualitySettings): boolean {
    return (
      a.shaderComplexity !== b.shaderComplexity ||
      Math.abs(a.cloudDensity - b.cloudDensity) > 0.01 ||
      Math.abs(a.animationSpeed - b.animationSpeed) > 0.01 ||
      a.blurRadius !== b.blurRadius ||
      a.updateFrequency !== b.updateFrequency ||
      a.enableLayeredEffects !== b.enableLayeredEffects
    );
  }

  /**
   * Get performance recommendations
   */
  private getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.frameRateMonitor.getMetrics();
    const quality = this.currentQuality;

    if (metrics.currentFPS < this.config.targetFPS * 0.8) {
      recommendations.push('Performance is below target, consider reducing quality');
    }

    if (quality.enableLayeredEffects && metrics.currentFPS < 40) {
      recommendations.push('Disable layered effects for better performance');
    }

    if (quality.shaderComplexity === 'advanced' && metrics.currentFPS < 35) {
      recommendations.push('Use standard shader complexity for better performance');
    }

    if (this.consecutivePoorFrames > 0) {
      recommendations.push(`${this.consecutivePoorFrames} consecutive poor frames detected`);
    }

    if (recommendations.length === 0 && metrics.currentFPS > this.config.qualityImprovementThreshold) {
      recommendations.push('Performance is good, quality can potentially be improved');
    }

    return recommendations;
  }

  /**
   * Notify all quality change callbacks
   */
  private notifyQualityChange(): void {
    this.qualityChangeCallbacks.forEach(callback => {
      try {
        callback(this.currentQuality);
      } catch (error) {
        console.error('Error in quality change callback:', error);
      }
    });
  }

  /**
   * Log debug information if enabled
   */
  private log(message: string, data?: any): void {
    if (this.config.enableDebugLogging) {
      const now = Date.now();
      const lastLogged = this.logTimestamps.get(message) ?? 0;

      if (this.config.logThrottleMs > 0 && now - lastLogged < this.config.logThrottleMs) {
        return;
      }

      if (this.config.maxLogsPerWindow > 0 && this.config.logWindowMs > 0) {
        if (now - this.logWindowStart > this.config.logWindowMs) {
          this.logWindowStart = now;
          this.logWindowCount = 0;
        }

        if (this.logWindowCount >= this.config.maxLogsPerWindow) {
          return;
        }

        this.logWindowCount += 1;
      }

      this.logTimestamps.set(message, now);
      console.debug(`[SkiaPerformanceMonitor] ${message}`, data || '');
    }
  }
}