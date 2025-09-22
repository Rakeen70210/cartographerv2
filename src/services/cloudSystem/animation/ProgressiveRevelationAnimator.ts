/**
 * ProgressiveRevelationAnimator - Multi-stage cloud dissipation with opacity transitions
 * Implements progressive revelation with satisfying animation curves over 2-3 seconds
 */

import { 
  DissipationAnimation, 
  EasingFunction,
  CloudGeographicArea 
} from '../../../types/cloud';
import { EasingFunctions } from './EasingFunctions';

export interface RevelationStage {
  name: string;
  startProgress: number; // 0-1, when this stage begins
  endProgress: number; // 0-1, when this stage ends
  opacityStart: number; // Starting opacity for this stage
  opacityEnd: number; // Ending opacity for this stage
  radiusMultiplier: number; // Radius multiplier for this stage
  easing: EasingFunction; // Easing function for this stage
}

export interface ProgressiveRevelationConfig {
  totalDuration: number; // Total animation duration in ms
  stages: RevelationStage[]; // Animation stages
  smoothTransitions: boolean; // Whether to smooth transitions between stages
  transitionOverlap: number; // Overlap between stages (0-1)
  minOpacity: number; // Final minimum opacity
  maxRadius: number; // Maximum revelation radius
}

export interface RevelationState {
  active: boolean;
  currentStage: number;
  stageProgress: number; // Progress within current stage (0-1)
  totalProgress: number; // Overall animation progress (0-1)
  currentOpacity: number;
  currentRadius: number;
  center: [number, number];
}

export interface RevelationAnimation {
  id: string;
  center: [number, number];
  config: ProgressiveRevelationConfig;
  state: RevelationState;
  startTime: number;
  onStageChange?: (stage: number, stageName: string) => void;
  onComplete?: () => void;
}

/**
 * ProgressiveRevelationAnimator manages multi-stage cloud dissipation animations
 */
export class ProgressiveRevelationAnimator {
  private activeAnimations: Map<string, RevelationAnimation> = new Map();
  private animationFrameId: number | null = null;
  private isDisposed: boolean = false;

  // Callbacks
  private onAnimationUpdate?: (animations: RevelationAnimation[]) => void;
  private onAnimationComplete?: (animationId: string) => void;
  private onUniformUpdate?: (uniforms: Record<string, any>) => void;

  // Default configuration for standard revelation
  private static readonly DEFAULT_CONFIG: ProgressiveRevelationConfig = {
    totalDuration: 2500, // 2.5 seconds
    smoothTransitions: true,
    transitionOverlap: 0.1, // 10% overlap between stages
    minOpacity: 0.0,
    maxRadius: 100,
    stages: [
      {
        name: 'initial_fade',
        startProgress: 0.0,
        endProgress: 0.3,
        opacityStart: 1.0,
        opacityEnd: 0.7,
        radiusMultiplier: 0.2,
        easing: EasingFunctions.quad.out
      },
      {
        name: 'rapid_expansion',
        startProgress: 0.2,
        endProgress: 0.7,
        opacityStart: 0.7,
        opacityEnd: 0.2,
        radiusMultiplier: 0.8,
        easing: EasingFunctions.cubic.out
      },
      {
        name: 'final_clearing',
        startProgress: 0.6,
        endProgress: 1.0,
        opacityStart: 0.2,
        opacityEnd: 0.0,
        radiusMultiplier: 1.0,
        easing: EasingFunctions.sine.out
      }
    ]
  };

  constructor() {
    // Constructor is intentionally minimal - configuration is per-animation
  }

  /**
   * Start a new progressive revelation animation
   */
  startRevelation(
    center: [number, number],
    options: Partial<{
      config: Partial<ProgressiveRevelationConfig>;
      id: string;
      onStageChange: (stage: number, stageName: string) => void;
      onComplete: () => void;
    }> = {}
  ): string {
    if (this.isDisposed) {
      throw new Error('ProgressiveRevelationAnimator has been disposed');
    }

    const animationId = options.id || this.generateAnimationId();
    const config = this.mergeConfig(options.config || {});

    const animation: RevelationAnimation = {
      id: animationId,
      center,
      config,
      state: {
        active: true,
        currentStage: 0,
        stageProgress: 0,
        totalProgress: 0,
        currentOpacity: config.stages[0].opacityStart,
        currentRadius: 0,
        center
      },
      startTime: performance.now(),
      onStageChange: options.onStageChange,
      onComplete: options.onComplete
    };

    this.activeAnimations.set(animationId, animation);

    // Start animation loop if not already running
    if (!this.animationFrameId) {
      this.startAnimationLoop();
    }

    return animationId;
  }

  /**
   * Stop a specific revelation animation
   */
  stopRevelation(animationId: string): boolean {
    const animation = this.activeAnimations.get(animationId);
    if (animation) {
      animation.state.active = false;
      this.activeAnimations.delete(animationId);
      
      // Stop animation loop if no active animations
      if (this.activeAnimations.size === 0 && this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      
      return true;
    }
    return false;
  }

  /**
   * Stop all active revelation animations
   */
  stopAllRevelations(): void {
    this.activeAnimations.clear();
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Get all active revelation animations
   */
  getActiveRevelations(): RevelationAnimation[] {
    return Array.from(this.activeAnimations.values());
  }

  /**
   * Check if any revelations are currently active
   */
  hasActiveRevelations(): boolean {
    return this.activeAnimations.size > 0;
  }

  /**
   * Get revelation state for a specific animation
   */
  getRevelationState(animationId: string): RevelationState | null {
    const animation = this.activeAnimations.get(animationId);
    return animation ? { ...animation.state } : null;
  }

  /**
   * Set callback for animation updates
   */
  setAnimationUpdateCallback(callback: (animations: RevelationAnimation[]) => void): void {
    this.onAnimationUpdate = callback;
  }

  /**
   * Set callback for animation completion
   */
  setAnimationCompleteCallback(callback: (animationId: string) => void): void {
    this.onAnimationComplete = callback;
  }

  /**
   * Set callback for uniform updates
   */
  setUniformUpdateCallback(callback: (uniforms: Record<string, any>) => void): void {
    this.onUniformUpdate = callback;
  }

  /**
   * Create a fast revelation (1.5 seconds)
   */
  static createFastRevelation(): Partial<ProgressiveRevelationConfig> {
    return {
      totalDuration: 1500,
      stages: [
        {
          name: 'quick_fade',
          startProgress: 0.0,
          endProgress: 0.4,
          opacityStart: 1.0,
          opacityEnd: 0.5,
          radiusMultiplier: 0.3,
          easing: EasingFunctions.quad.out
        },
        {
          name: 'rapid_clear',
          startProgress: 0.3,
          endProgress: 1.0,
          opacityStart: 0.5,
          opacityEnd: 0.0,
          radiusMultiplier: 1.0,
          easing: EasingFunctions.cubic.out
        }
      ]
    };
  }

  /**
   * Create a dramatic revelation (3.5 seconds)
   */
  static createDramaticRevelation(): Partial<ProgressiveRevelationConfig> {
    return {
      totalDuration: 3500,
      stages: [
        {
          name: 'slow_start',
          startProgress: 0.0,
          endProgress: 0.2,
          opacityStart: 1.0,
          opacityEnd: 0.9,
          radiusMultiplier: 0.1,
          easing: EasingFunctions.sine.in
        },
        {
          name: 'building_momentum',
          startProgress: 0.15,
          endProgress: 0.5,
          opacityStart: 0.9,
          opacityEnd: 0.6,
          radiusMultiplier: 0.4,
          easing: EasingFunctions.quad.out
        },
        {
          name: 'accelerated_clearing',
          startProgress: 0.4,
          endProgress: 0.8,
          opacityStart: 0.6,
          opacityEnd: 0.1,
          radiusMultiplier: 0.9,
          easing: EasingFunctions.cubic.out
        },
        {
          name: 'final_polish',
          startProgress: 0.75,
          endProgress: 1.0,
          opacityStart: 0.1,
          opacityEnd: 0.0,
          radiusMultiplier: 1.0,
          easing: EasingFunctions.sine.out
        }
      ]
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.isDisposed = true;
    this.stopAllRevelations();
    this.onAnimationUpdate = undefined;
    this.onAnimationComplete = undefined;
    this.onUniformUpdate = undefined;
  }

  /**
   * Start the animation loop
   */
  private startAnimationLoop(): void {
    const animate = () => {
      if (this.isDisposed || this.activeAnimations.size === 0) {
        this.animationFrameId = null;
        return;
      }

      this.updateAnimations();
      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Update all active animations
   */
  private updateAnimations(): void {
    const currentTime = performance.now();
    const completedAnimations: string[] = [];
    const uniforms: Record<string, any> = {};

    // Collect animation data for shader uniforms
    const revelationCenters: number[] = [];
    const revelationRadii: number[] = [];
    const revelationOpacities: number[] = [];

    for (const [id, animation] of this.activeAnimations.entries()) {
      const elapsed = currentTime - animation.startTime;
      const totalProgress = Math.min(elapsed / animation.config.totalDuration, 1);
      
      // Update animation state
      this.updateAnimationState(animation, totalProgress);

      // Collect data for shaders
      revelationCenters.push(animation.state.center[0], animation.state.center[1]);
      revelationRadii.push(animation.state.currentRadius);
      revelationOpacities.push(animation.state.currentOpacity);

      // Check if animation is complete
      if (totalProgress >= 1) {
        animation.state.active = false;
        completedAnimations.push(id);
        
        if (animation.onComplete) {
          animation.onComplete();
        }
      }
    }

    // Update shader uniforms
    if (this.onUniformUpdate) {
      uniforms.u_revelationCenters = new Float32Array(revelationCenters);
      uniforms.u_revelationRadii = new Float32Array(revelationRadii);
      uniforms.u_revelationOpacities = new Float32Array(revelationOpacities);
      uniforms.u_revelationCount = this.activeAnimations.size;
      
      this.onUniformUpdate(uniforms);
    }

    // Remove completed animations
    for (const id of completedAnimations) {
      this.activeAnimations.delete(id);
      if (this.onAnimationComplete) {
        this.onAnimationComplete(id);
      }
    }

    // Notify about animation updates
    if (this.onAnimationUpdate) {
      this.onAnimationUpdate(this.getActiveRevelations());
    }
  }

  /**
   * Update the state of a single animation
   */
  private updateAnimationState(animation: RevelationAnimation, totalProgress: number): void {
    const config = animation.config;
    const state = animation.state;
    
    state.totalProgress = totalProgress;

    // Find current stage
    const currentStage = this.findCurrentStage(config.stages, totalProgress);
    
    // Check for stage change
    if (currentStage !== state.currentStage) {
      state.currentStage = currentStage;
      if (animation.onStageChange) {
        animation.onStageChange(currentStage, config.stages[currentStage].name);
      }
    }

    const stage = config.stages[currentStage];
    
    // Calculate progress within current stage
    const stageRange = stage.endProgress - stage.startProgress;
    const stageProgress = Math.max(0, Math.min(1, 
      (totalProgress - stage.startProgress) / stageRange
    ));
    
    state.stageProgress = stageProgress;

    // Apply easing to stage progress
    const easedProgress = stage.easing(stageProgress);

    // Calculate current opacity
    state.currentOpacity = this.interpolateValue(
      stage.opacityStart,
      stage.opacityEnd,
      easedProgress
    );

    // Handle smooth transitions between stages
    if (config.smoothTransitions && currentStage > 0) {
      state.currentOpacity = this.applyStageTransition(
        animation, 
        state.currentOpacity, 
        totalProgress
      );
    }

    // Calculate current radius
    const baseRadius = config.maxRadius * stage.radiusMultiplier;
    state.currentRadius = baseRadius * easedProgress;

    // Ensure minimum values
    state.currentOpacity = Math.max(config.minOpacity, state.currentOpacity);
  }

  /**
   * Find the current stage based on total progress
   */
  private findCurrentStage(stages: RevelationStage[], totalProgress: number): number {
    for (let i = stages.length - 1; i >= 0; i--) {
      if (totalProgress >= stages[i].startProgress) {
        return i;
      }
    }
    return 0;
  }

  /**
   * Apply smooth transitions between stages
   */
  private applyStageTransition(
    animation: RevelationAnimation,
    currentOpacity: number,
    totalProgress: number
  ): number {
    const config = animation.config;
    const currentStage = animation.state.currentStage;
    
    if (currentStage === 0 || !config.smoothTransitions) {
      return currentOpacity;
    }

    const stage = config.stages[currentStage];
    const prevStage = config.stages[currentStage - 1];
    
    // Check if we're in the transition overlap zone
    const transitionStart = stage.startProgress;
    const transitionEnd = transitionStart + (stage.endProgress - stage.startProgress) * config.transitionOverlap;
    
    if (totalProgress >= transitionStart && totalProgress <= transitionEnd) {
      const transitionProgress = (totalProgress - transitionStart) / (transitionEnd - transitionStart);
      const smoothTransition = EasingFunctions.sine.inOut(transitionProgress);
      
      // Blend between previous stage end opacity and current stage opacity
      return this.interpolateValue(
        prevStage.opacityEnd,
        currentOpacity,
        smoothTransition
      );
    }

    return currentOpacity;
  }

  /**
   * Interpolate between two values
   */
  private interpolateValue(start: number, end: number, progress: number): number {
    return start + (end - start) * progress;
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config: Partial<ProgressiveRevelationConfig>): ProgressiveRevelationConfig {
    return {
      ...ProgressiveRevelationAnimator.DEFAULT_CONFIG,
      ...config,
      stages: config.stages || ProgressiveRevelationAnimator.DEFAULT_CONFIG.stages
    };
  }

  /**
   * Generate a unique animation ID
   */
  private generateAnimationId(): string {
    return `revelation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Utility functions for progressive revelation
 */
export class ProgressiveRevelationUtils {
  /**
   * Create a custom revelation configuration
   */
  static createCustomRevelation(
    duration: number,
    stageCount: number = 3
  ): Partial<ProgressiveRevelationConfig> {
    const stages: RevelationStage[] = [];
    const stageLength = 1 / stageCount;
    const overlap = 0.1;

    for (let i = 0; i < stageCount; i++) {
      const startProgress = Math.max(0, i * stageLength - (i > 0 ? overlap : 0));
      const endProgress = Math.min(1, (i + 1) * stageLength);
      
      stages.push({
        name: `stage_${i + 1}`,
        startProgress,
        endProgress,
        opacityStart: 1 - (i / stageCount) * 0.8,
        opacityEnd: 1 - ((i + 1) / stageCount) * 0.8,
        radiusMultiplier: (i + 1) / stageCount,
        easing: i === stageCount - 1 ? EasingFunctions.sine.out : EasingFunctions.cubic.out
      });
    }

    return {
      totalDuration: duration,
      stages
    };
  }

  /**
   * Validate revelation configuration
   */
  static validateConfig(config: ProgressiveRevelationConfig): boolean {
    if (!config.stages || config.stages.length === 0) {
      return false;
    }

    // Check stage progression
    for (let i = 0; i < config.stages.length; i++) {
      const stage = config.stages[i];
      
      if (stage.startProgress < 0 || stage.startProgress > 1 ||
          stage.endProgress < 0 || stage.endProgress > 1 ||
          stage.startProgress >= stage.endProgress) {
        return false;
      }
      
      if (i > 0 && stage.startProgress < config.stages[i - 1].startProgress) {
        return false;
      }
    }

    return (
      config.totalDuration > 0 &&
      config.minOpacity >= 0 && config.minOpacity <= 1 &&
      config.maxRadius > 0 &&
      config.transitionOverlap >= 0 && config.transitionOverlap <= 1
    );
  }
}