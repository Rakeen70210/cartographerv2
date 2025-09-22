/**
 * DriftAnimation - Handles wind-based cloud movement
 * Implements smooth cloud drift with configurable wind parameters
 */

import { Vector2, AnimationState } from '../../../types/cloud';

export interface DriftConfig {
  windSpeed: number; // meters per second
  windDirection: number; // degrees (0 = north, 90 = east)
  turbulence: number; // 0-1, adds randomness to movement
  enabled: boolean;
}

export interface DriftState {
  offset: Vector2;
  velocity: Vector2;
  time: number;
  lastUpdate: number;
}

export class DriftAnimation {
  private config: DriftConfig;
  private state: DriftState;
  private animationFrameId: number | null = null;
  private onUpdate?: (offset: Vector2) => void;

  constructor(config: Partial<DriftConfig> = {}) {
    this.config = {
      windSpeed: 2.0, // Default 2 m/s
      windDirection: 45, // Default northeast
      turbulence: 0.1, // Subtle randomness
      enabled: true,
      ...config
    };

    this.state = {
      offset: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      time: 0,
      lastUpdate: performance.now()
    };

    this.updateVelocity();
  }

  /**
   * Start the drift animation loop
   */
  start(onUpdate?: (offset: Vector2) => void): void {
    if (this.animationFrameId !== null) {
      this.stop();
    }

    this.onUpdate = onUpdate;
    this.state.lastUpdate = performance.now();
    this.animate();
  }

  /**
   * Stop the drift animation
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Update wind configuration
   */
  updateConfig(config: Partial<DriftConfig>): void {
    this.config = { ...this.config, ...config };
    this.updateVelocity();
  }

  /**
   * Get current drift offset
   */
  getOffset(): Vector2 {
    return { ...this.state.offset };
  }

  /**
   * Get current drift velocity
   */
  getVelocity(): Vector2 {
    return { ...this.state.velocity };
  }

  /**
   * Reset drift state to origin
   */
  reset(): void {
    this.state.offset = { x: 0, y: 0 };
    this.state.time = 0;
    this.state.lastUpdate = performance.now();
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

    // Update position based on velocity
    this.updatePosition(deltaTime);

    // Add turbulence for natural movement
    this.addTurbulence(deltaTime);

    // Notify listeners of position update
    if (this.onUpdate) {
      this.onUpdate(this.state.offset);
    }

    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  /**
   * Update velocity based on wind configuration
   */
  private updateVelocity(): void {
    // Convert wind direction from degrees to radians
    const radians = (this.config.windDirection * Math.PI) / 180;
    
    // Calculate velocity components (note: y is inverted for screen coordinates)
    this.state.velocity.x = Math.sin(radians) * this.config.windSpeed;
    this.state.velocity.y = -Math.cos(radians) * this.config.windSpeed;
  }

  /**
   * Update position based on current velocity
   */
  private updatePosition(deltaTime: number): void {
    this.state.offset.x += this.state.velocity.x * deltaTime;
    this.state.offset.y += this.state.velocity.y * deltaTime;
  }

  /**
   * Add turbulence for natural cloud movement
   */
  private addTurbulence(deltaTime: number): void {
    if (this.config.turbulence <= 0) {
      return;
    }

    // Use time-based noise for smooth turbulence
    const turbulenceScale = this.config.turbulence * this.config.windSpeed * 0.5;
    const timeScale = 0.5; // Controls turbulence frequency
    
    // Simple noise approximation using sine waves
    const noiseX = Math.sin(this.state.time * timeScale) * 
                   Math.cos(this.state.time * timeScale * 1.3) * turbulenceScale;
    const noiseY = Math.cos(this.state.time * timeScale * 0.7) * 
                   Math.sin(this.state.time * timeScale * 1.7) * turbulenceScale;

    this.state.offset.x += noiseX * deltaTime;
    this.state.offset.y += noiseY * deltaTime;
  }

  /**
   * Get animation state for external systems
   */
  getAnimationState(): Partial<AnimationState> {
    return {
      cloudDrift: {
        offset: this.getOffset(),
        speed: this.config.windSpeed,
        direction: this.config.windDirection
      }
    };
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
 * Utility functions for drift animation
 */
export class DriftUtils {
  /**
   * Convert wind direction from compass bearing to screen coordinates
   */
  static compassToScreen(bearing: number): number {
    // Convert compass bearing (0° = North) to screen coordinates (0° = East)
    return (bearing + 90) % 360;
  }

  /**
   * Calculate wind vector from speed and direction
   */
  static calculateWindVector(speed: number, direction: number): Vector2 {
    const radians = (direction * Math.PI) / 180;
    return {
      x: Math.cos(radians) * speed,
      y: Math.sin(radians) * speed
    };
  }

  /**
   * Interpolate between two drift configurations
   */
  static interpolateConfig(
    from: DriftConfig, 
    to: DriftConfig, 
    t: number
  ): DriftConfig {
    const clampedT = Math.max(0, Math.min(1, t));
    
    return {
      windSpeed: from.windSpeed + (to.windSpeed - from.windSpeed) * clampedT,
      windDirection: this.interpolateAngle(from.windDirection, to.windDirection, clampedT),
      turbulence: from.turbulence + (to.turbulence - from.turbulence) * clampedT,
      enabled: clampedT < 0.5 ? from.enabled : to.enabled
    };
  }

  /**
   * Interpolate between two angles, taking the shortest path
   */
  private static interpolateAngle(from: number, to: number, t: number): number {
    const diff = ((to - from + 540) % 360) - 180;
    return from + diff * t;
  }

  /**
   * Create preset wind configurations
   */
  static createPresets() {
    return {
      calm: { windSpeed: 0.5, windDirection: 0, turbulence: 0.05, enabled: true },
      gentle: { windSpeed: 2.0, windDirection: 45, turbulence: 0.1, enabled: true },
      moderate: { windSpeed: 5.0, windDirection: 90, turbulence: 0.2, enabled: true },
      strong: { windSpeed: 10.0, windDirection: 180, turbulence: 0.3, enabled: true },
      storm: { windSpeed: 20.0, windDirection: 225, turbulence: 0.5, enabled: true }
    };
  }
}