/**
 * AnimationController - Performance-aware cloud animation management
 * Coordinates drift, morphing, and dissipation animations with frame rate monitoring
 */

import { 
  AnimationState, 
  DissipationAnimation, 
  Vector2, 
  PerformanceMode 
} from '../../../types/cloud';
import { DriftAnimation, DriftConfig } from './DriftAnimation';
import { MorphingEffects, MorphingConfig, MorphingData } from './MorphingEffects';
import { IAnimationController } from '../interfaces';

export interface AnimationControllerConfig {
  targetFrameRate: number; // Target FPS (default: 60)
  performanceCheckInterval: number; // ms between performance checks
  qualityAdjustmentThreshold: number; // FPS threshold for quality adjustment
  batchUpdateInterval: number; // ms between batched shader updates
}

export interface FrameRateStats {
  current: number;
  average: number;
  min: number;
  max: number;
  samples: number[];
}

export class AnimationController implements IAnimationController {
  private config: AnimationControllerConfig;
  private driftAnimation: DriftAnimation;
  private morphingEffects: MorphingEffects;
  private frameRateStats: FrameRateStats;
  private animationQuality: 'low' | 'medium' | 'high' = 'high';
  private performanceCheckTimer: number | null = null;
  private batchUpdateTimer: number | null = null;
  private lastFrameTime: number = 0;
  private isDisposed: boolean = false;

  // Batched updates to minimize shader uniform changes
  private pendingUniforms: Map<string, any> = new Map();
  private onUniformUpdate?: (uniforms: Record<string, any>) => void;

  // Animation state
  private currentState: AnimationState;
  private activeDissipations: DissipationAnimation[] = [];

  constructor(config: Partial<AnimationControllerConfig> = {}) {
    this.config = {
      targetFrameRate: 60,
      performanceCheckInterval: 1000, // Check every second
      qualityAdjustmentThreshold: 45, // Adjust quality if FPS drops below 45
      batchUpdateInterval: 16, // ~60 FPS for uniform updates
      ...config
    };

    // Initialize frame rate tracking
    this.frameRateStats = {
      current: 60,
      average: 60,
      min: 60,
      max: 60,
      samples: []
    };

    // Initialize animation components
    this.driftAnimation = new DriftAnimation();
    this.morphingEffects = new MorphingEffects();

    // Initialize animation state with defaults from sub-components
    const driftState = this.driftAnimation.getAnimationState();
    const morphState = this.morphingEffects.getAnimationState();

    this.currentState = {
      cloudDrift: {
        offset: { x: 0, y: 0 },
        speed: driftState.cloudDrift?.speed ?? 0,
        direction: driftState.cloudDrift?.direction ?? 0
      },
      dissipation: {
        active: false,
        center: [0, 0],
        radius: 0,
        progress: 0,
        duration: 0
      },
      morphing: {
        noiseOffset: 0,
        morphSpeed: morphState.morphing?.morphSpeed ?? 0
      }
    };

    this.setupAnimationCallbacks();
    this.startPerformanceMonitoring();
    this.startBatchedUpdates();
  }

  /**
   * Start cloud drift animation
   */
  startCloudDrift(windSpeed: number, direction: number): void {
    if (this.isDisposed) return;

    const driftConfig: Partial<DriftConfig> = {
      windSpeed,
      windDirection: direction,
      enabled: true
    };

    this.driftAnimation.updateConfig(driftConfig);
    this.driftAnimation.start();

    // Update AnimationController state to match drift animation config
    this.currentState.cloudDrift.speed = windSpeed;
    this.currentState.cloudDrift.direction = direction;
  }

  /**
   * Stop cloud drift animation
   */
  stopCloudDrift(): void {
    this.driftAnimation.stop();
  }

  /**
   * Animate cloud dissipation
   */
  async animateDissipation(animation: DissipationAnimation): Promise<void> {
    if (this.isDisposed) return;

    this.activeDissipations.push(animation);
    
    return new Promise((resolve) => {
      const startTime = performance.now();
      
      const animate = () => {
        if (this.isDisposed) {
          resolve();
          return;
        }

        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / animation.duration, 1);
        
        // Apply easing function
        const easedProgress = animation.easing(progress);
        
        // Update dissipation state
        this.currentState.dissipation = {
          active: true,
          center: animation.center,
          radius: animation.maxRadius * easedProgress,
          progress: easedProgress,
          duration: animation.duration
        };

        // Queue uniform update
        this.queueUniformUpdate('u_dissipationCenter', animation.center);
        this.queueUniformUpdate('u_dissipationRadius', this.currentState.dissipation.radius);
        this.queueUniformUpdate('u_dissipationProgress', easedProgress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Animation complete
          this.currentState.dissipation.active = false;
          this.activeDissipations = this.activeDissipations.filter(a => a !== animation);
          resolve();
        }
      };

      animate();
    });
  }

  /**
   * Update morphing effects
   */
  updateMorphing(speed: number): void {
    if (this.isDisposed) return;

    this.morphingEffects.updateConfig({ morphSpeed: speed });

    if (speed > 0 && !this.morphingEffects['animationFrameId']) {
      this.morphingEffects.start();
    } else if (speed === 0) {
      this.morphingEffects.stop();
    }

    // Update AnimationController state to match morphing effects config
    this.currentState.morphing.morphSpeed = speed;
  }

  /**
   * Get current animation state
   */
  getAnimationState(): AnimationState {
    return { ...this.currentState };
  }

  /**
   * Set animation quality based on performance
   */
  setAnimationQuality(quality: 'low' | 'medium' | 'high'): void {
    this.animationQuality = quality;
    this.applyQualitySettings(quality);
  }

  /**
   * Set uniform update callback
   */
  setUniformUpdateCallback(callback: (uniforms: Record<string, any>) => void): void {
    this.onUniformUpdate = callback;
  }

  /**
   * Get current frame rate
   */
  getFrameRate(): number {
    return this.frameRateStats.current;
  }

  /**
   * Get frame rate statistics
   */
  getFrameRateStats(): FrameRateStats {
    return { ...this.frameRateStats };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.isDisposed = true;
    
    this.driftAnimation.dispose();
    this.morphingEffects.dispose();
    
    if (this.performanceCheckTimer) {
      clearInterval(this.performanceCheckTimer);
    }
    
    if (this.batchUpdateTimer) {
      clearInterval(this.batchUpdateTimer);
    }

    this.activeDissipations = [];
    this.pendingUniforms.clear();
  }

  /**
   * Setup animation callbacks
   */
  private setupAnimationCallbacks(): void {
    // Drift animation callback
    this.driftAnimation.start((offset: Vector2) => {
      this.currentState.cloudDrift.offset = offset;
      this.queueUniformUpdate('u_windOffset', [offset.x, offset.y]);
    });

    // Morphing effects callback
    this.morphingEffects.start((morphingData: MorphingData) => {
      this.currentState.morphing.noiseOffset = morphingData.noiseOffset;
      this.queueUniformUpdate('u_morphingOffset', morphingData.noiseOffset);
      this.queueUniformUpdate('u_densityMultiplier', morphingData.densityMultiplier);
    });
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    this.lastFrameTime = performance.now();
    
    const checkPerformance = () => {
      if (this.isDisposed) return;

      const now = performance.now();
      const deltaTime = now - this.lastFrameTime;
      this.lastFrameTime = now;

      // Calculate current FPS (prevent division by zero)
      const currentFPS = deltaTime > 0 ? 1000 / deltaTime : this.frameRateStats.current;
      this.updateFrameRateStats(currentFPS);

      // Adjust quality if performance is poor
      if (this.frameRateStats.average < this.config.qualityAdjustmentThreshold) {
        this.adjustQualityForPerformance();
      }
    };

    // Monitor frame rate
    const frameMonitor = () => {
      if (this.isDisposed) return;
      checkPerformance();
      requestAnimationFrame(frameMonitor);
    };
    frameMonitor();

    // Periodic performance checks
    this.performanceCheckTimer = window.setInterval(() => {
      if (this.isDisposed) return;
      this.evaluatePerformance();
    }, this.config.performanceCheckInterval);
  }

  /**
   * Start batched uniform updates
   */
  private startBatchedUpdates(): void {
    this.batchUpdateTimer = window.setInterval(() => {
      if (this.isDisposed) return;
      this.flushPendingUniforms();
    }, this.config.batchUpdateInterval);
  }

  /**
   * Queue a uniform update for batching
   */
  private queueUniformUpdate(name: string, value: any): void {
    this.pendingUniforms.set(name, value);
  }

  /**
   * Flush pending uniform updates
   */
  private flushPendingUniforms(): void {
    if (this.pendingUniforms.size === 0 || !this.onUniformUpdate) {
      return;
    }

    const uniforms: Record<string, any> = {};
    this.pendingUniforms.forEach((value, name) => {
      uniforms[name] = value;
    });

    this.onUniformUpdate(uniforms);
    this.pendingUniforms.clear();
  }

  /**
   * Update frame rate statistics
   */
  private updateFrameRateStats(fps: number): void {
    this.frameRateStats.current = fps;
    
    // Add to samples (keep last 60 samples for 1-second average at 60fps)
    this.frameRateStats.samples.push(fps);
    if (this.frameRateStats.samples.length > 60) {
      this.frameRateStats.samples.shift();
    }

    // Calculate statistics
    const samples = this.frameRateStats.samples;
    this.frameRateStats.average = samples.reduce((a, b) => a + b, 0) / samples.length;
    this.frameRateStats.min = Math.min(...samples);
    this.frameRateStats.max = Math.max(...samples);
  }

  /**
   * Apply quality settings based on performance level
   */
  private applyQualitySettings(quality: 'low' | 'medium' | 'high'): void {
    switch (quality) {
      case 'low':
        this.driftAnimation.updateConfig({ 
          turbulence: 0.05,
          windSpeed: Math.min(this.driftAnimation.getVelocity().x, 2.0)
        });
        this.morphingEffects.updateConfig({ 
          morphSpeed: 0.2, 
          intensity: 0.1,
          densityVariation: 0.1
        });
        this.config.batchUpdateInterval = 33; // ~30 FPS
        break;

      case 'medium':
        this.driftAnimation.updateConfig({ 
          turbulence: 0.1,
          windSpeed: Math.min(this.driftAnimation.getVelocity().x, 5.0)
        });
        this.morphingEffects.updateConfig({ 
          morphSpeed: 0.5, 
          intensity: 0.3,
          densityVariation: 0.2
        });
        this.config.batchUpdateInterval = 22; // ~45 FPS
        break;

      case 'high':
        this.driftAnimation.updateConfig({ 
          turbulence: 0.2,
          windSpeed: this.driftAnimation.getVelocity().x // No limit
        });
        this.morphingEffects.updateConfig({ 
          morphSpeed: 1.0, 
          intensity: 0.5,
          densityVariation: 0.3
        });
        this.config.batchUpdateInterval = 16; // ~60 FPS
        break;
    }
  }

  /**
   * Automatically adjust quality based on performance
   */
  private adjustQualityForPerformance(): void {
    const avgFPS = this.frameRateStats.average;
    
    if (avgFPS < 30 && this.animationQuality !== 'low') {
      this.setAnimationQuality('low');
    } else if (avgFPS < 45 && this.animationQuality === 'high') {
      this.setAnimationQuality('medium');
    } else if (avgFPS > 55 && this.animationQuality === 'low') {
      this.setAnimationQuality('medium');
    } else if (avgFPS > 58 && this.animationQuality === 'medium') {
      this.setAnimationQuality('high');
    }
  }

  /**
   * Evaluate overall performance and make adjustments
   */
  private evaluatePerformance(): void {
    const stats = this.frameRateStats;
    
    // If we have consistent low performance, reduce animation complexity
    if (stats.average < this.config.qualityAdjustmentThreshold && 
        stats.max - stats.min > 20) {
      // High variance indicates performance instability
      this.adjustQualityForPerformance();
    }

    // Reset samples periodically to adapt to changing conditions
    if (stats.samples.length >= 60) {
      // Keep only the most recent samples
      this.frameRateStats.samples = stats.samples.slice(-30);
    }
  }
}

/**
 * Utility functions for animation control
 */
export class AnimationUtils {
  /**
   * Standard easing functions for animations
   */
  static easing = {
    linear: (t: number): number => t,
    easeInQuad: (t: number): number => t * t,
    easeOutQuad: (t: number): number => t * (2 - t),
    easeInOutQuad: (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInCubic: (t: number): number => t * t * t,
    easeOutCubic: (t: number): number => (--t) * t * t + 1,
    easeInOutCubic: (t: number): number => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
  };

  /**
   * Create a dissipation animation with standard settings
   */
  static createDissipationAnimation(
    center: [number, number],
    maxRadius: number,
    duration: number = 2500
  ): DissipationAnimation {
    return {
      startTime: performance.now(),
      duration,
      center,
      maxRadius,
      easing: AnimationUtils.easing.easeOutCubic
    };
  }

  /**
   * Calculate performance mode based on device capabilities
   */
  static calculatePerformanceMode(
    frameRate: number,
    memoryMB: number,
    gpuTier: 'low' | 'medium' | 'high'
  ): PerformanceMode {
    if (frameRate < 30 || memoryMB < 1024 || gpuTier === 'low') {
      return 'low';
    } else if (frameRate < 50 || memoryMB < 2048 || gpuTier === 'medium') {
      return 'medium';
    } else {
      return 'high';
    }
  }
}