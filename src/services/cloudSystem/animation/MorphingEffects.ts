/**
 * MorphingEffects - Handles noise-based cloud shape evolution
 * Implements subtle density variations and natural cloud morphing
 */

import { Vector2, AnimationState } from '../../../types/cloud';

export interface MorphingConfig {
  morphSpeed: number; // 0-2, controls how fast clouds change shape
  intensity: number; // 0-1, controls how dramatic the morphing is
  noiseScale: number; // Controls the scale of morphing patterns
  densityVariation: number; // 0-1, controls density fluctuation
  enabled: boolean;
}

export interface MorphingState {
  noiseOffset: number;
  densityOffset: number;
  time: number;
  lastUpdate: number;
  phase: number; // For cyclical variations
}

export class MorphingEffects {
  private config: MorphingConfig;
  private state: MorphingState;
  private animationFrameId: number | null = null;
  private onUpdate?: (morphingData: MorphingData) => void;

  constructor(config: Partial<MorphingConfig> = {}) {
    this.config = {
      morphSpeed: 0.5, // Default moderate morphing
      intensity: 0.3, // Subtle by default
      noiseScale: 0.02, // Fine-grained morphing
      densityVariation: 0.2, // Moderate density changes
      enabled: true,
      ...config
    };

    this.state = {
      noiseOffset: 0,
      densityOffset: 0,
      time: 0,
      lastUpdate: performance.now(),
      phase: 0
    };
  }

  /**
   * Start the morphing animation loop
   */
  start(onUpdate?: (morphingData: MorphingData) => void): void {
    if (this.animationFrameId !== null) {
      this.stop();
    }

    this.onUpdate = onUpdate;
    this.state.lastUpdate = performance.now();
    this.animate();
  }

  /**
   * Stop the morphing animation
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Update morphing configuration
   */
  updateConfig(config: Partial<MorphingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current morphing data
   */
  getMorphingData(): MorphingData {
    return {
      noiseOffset: this.state.noiseOffset,
      densityMultiplier: this.calculateDensityMultiplier(),
      morphIntensity: this.config.intensity,
      timeOffset: this.state.time,
      phaseOffset: this.state.phase
    };
  }

  /**
   * Set enabled state
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  /**
   * Reset morphing state
   */
  reset(): void {
    this.state.noiseOffset = 0;
    this.state.densityOffset = 0;
    this.state.time = 0;
    this.state.phase = 0;
    this.state.lastUpdate = performance.now();
  }

  /**
   * Main animation loop
   */
  private animate = (): void => {
    if (!this.config.enabled) {
      return;
    }

    const now = performance.now();
    const deltaTime = (now - this.state.lastUpdate) / 1000; // Convert to seconds
    this.state.lastUpdate = now;
    this.state.time += deltaTime;

    // Update morphing parameters
    this.updateMorphing(deltaTime);

    // Notify listeners of morphing update
    if (this.onUpdate) {
      this.onUpdate(this.getMorphingData());
    }

    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  /**
   * Update morphing parameters based on time
   */
  private updateMorphing(deltaTime: number): void {
    // Update noise offset for shape evolution
    this.state.noiseOffset += this.config.morphSpeed * deltaTime * 0.1;

    // Update density offset for subtle density variations
    this.state.densityOffset += this.config.morphSpeed * deltaTime * 0.05;

    // Update phase for cyclical variations
    this.state.phase += deltaTime * 0.2; // Slow phase changes
    if (this.state.phase > Math.PI * 2) {
      this.state.phase -= Math.PI * 2;
    }
  }

  /**
   * Calculate density multiplier based on current state
   */
  private calculateDensityMultiplier(): number {
    if (this.config.densityVariation <= 0) {
      return 1.0;
    }

    // Use sine wave for smooth density variations
    const variation = Math.sin(this.state.densityOffset) * this.config.densityVariation;
    return 1.0 + variation * 0.5; // Keep multiplier in reasonable range
  }

  /**
   * Get animation state for external systems
   */
  getAnimationState(): Partial<AnimationState> {
    return {
      morphing: {
        noiseOffset: this.state.noiseOffset,
        morphSpeed: this.config.morphSpeed
      }
    };
  }

  /**
   * Calculate morphing factor for a specific position
   */
  calculateMorphingFactor(position: Vector2, baseNoise: number): number {
    if (!this.config.enabled || this.config.intensity <= 0) {
      return baseNoise;
    }

    // Apply time-based morphing to the base noise
    const timeInfluence = Math.sin(this.state.time * this.config.morphSpeed + 
                                  position.x * this.config.noiseScale + 
                                  position.y * this.config.noiseScale) * 0.5 + 0.5;

    // Blend original noise with time-influenced variation
    const morphedNoise = baseNoise + (timeInfluence - 0.5) * this.config.intensity;
    
    return Math.max(0, Math.min(1, morphedNoise));
  }

  /**
   * Calculate density variation for a specific position
   */
  calculateDensityVariation(position: Vector2): number {
    if (!this.config.enabled || this.config.densityVariation <= 0) {
      return 1.0;
    }

    // Create spatial and temporal density variations
    const spatialVariation = Math.sin(position.x * 0.01 + this.state.densityOffset) *
                            Math.cos(position.y * 0.01 + this.state.densityOffset * 0.7);
    
    const temporalVariation = Math.sin(this.state.phase + position.x * 0.005) *
                             Math.cos(this.state.phase * 1.3 + position.y * 0.005);

    const combinedVariation = (spatialVariation + temporalVariation) * 0.5;
    
    return 1.0 + combinedVariation * this.config.densityVariation * 0.3;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stop();
    this.onUpdate = undefined;
  }
}

/**
 * Data structure for morphing information
 */
export interface MorphingData {
  noiseOffset: number;
  densityMultiplier: number;
  morphIntensity: number;
  timeOffset: number;
  phaseOffset: number;
}

/**
 * Utility functions for morphing effects
 */
export class MorphingUtils {
  /**
   * Create preset morphing configurations
   */
  static createPresets() {
    return {
      static: { 
        morphSpeed: 0, 
        intensity: 0, 
        noiseScale: 0.02, 
        densityVariation: 0, 
        enabled: false 
      },
      subtle: { 
        morphSpeed: 0.2, 
        intensity: 0.1, 
        noiseScale: 0.02, 
        densityVariation: 0.1, 
        enabled: true 
      },
      moderate: { 
        morphSpeed: 0.5, 
        intensity: 0.3, 
        noiseScale: 0.02, 
        densityVariation: 0.2, 
        enabled: true 
      },
      dynamic: { 
        morphSpeed: 1.0, 
        intensity: 0.5, 
        noiseScale: 0.03, 
        densityVariation: 0.3, 
        enabled: true 
      },
      dramatic: { 
        morphSpeed: 1.5, 
        intensity: 0.7, 
        noiseScale: 0.04, 
        densityVariation: 0.4, 
        enabled: true 
      }
    };
  }

  /**
   * Interpolate between two morphing configurations
   */
  static interpolateConfig(
    from: MorphingConfig, 
    to: MorphingConfig, 
    t: number
  ): MorphingConfig {
    const clampedT = Math.max(0, Math.min(1, t));
    
    return {
      morphSpeed: from.morphSpeed + (to.morphSpeed - from.morphSpeed) * clampedT,
      intensity: from.intensity + (to.intensity - from.intensity) * clampedT,
      noiseScale: from.noiseScale + (to.noiseScale - from.noiseScale) * clampedT,
      densityVariation: from.densityVariation + (to.densityVariation - from.densityVariation) * clampedT,
      enabled: clampedT < 0.5 ? from.enabled : to.enabled
    };
  }

  /**
   * Calculate smooth easing for morphing transitions
   */
  static easeInOutSine(t: number): number {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  /**
   * Apply noise-based morphing to a density value
   */
  static applyMorphing(
    baseDensity: number, 
    position: Vector2, 
    morphingData: MorphingData
  ): number {
    if (morphingData.morphIntensity <= 0) {
      return baseDensity;
    }

    // Create position-based noise variation
    const noiseX = position.x * 0.01 + morphingData.noiseOffset;
    const noiseY = position.y * 0.01 + morphingData.noiseOffset * 0.7;
    
    const noiseValue = (Math.sin(noiseX) * Math.cos(noiseY) + 1) * 0.5;
    
    // Apply morphing intensity
    const morphedDensity = baseDensity + 
      (noiseValue - 0.5) * morphingData.morphIntensity * 0.5;
    
    // Apply density multiplier
    const finalDensity = morphedDensity * morphingData.densityMultiplier;
    
    return Math.max(0, Math.min(1, finalDensity));
  }
}