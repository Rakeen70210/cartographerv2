/**
 * WindSystem
 * Manages wind effects for cloud animation with configurable parameters
 */

import { WindConfig } from '../../../types/cloud';

export interface WindSystemConfig {
  baseDirection: number; // Base wind direction in degrees
  baseSpeed: number; // Base wind speed multiplier
  turbulenceIntensity: number; // Turbulence intensity (0-1)
  gustFrequency: number; // Frequency of wind gusts
  gustIntensity: number; // Intensity of wind gusts
}

export class WindSystem {
  private config: WindConfig;
  private startTime: number;
  private lastUpdateTime: number;
  private cachedOffset: [number, number] = [0, 0];
  private cachedVector: [number, number] = [0, 0];
  private updateThrottle: number = 16; // Update every 16ms (60fps)

  constructor(initialConfig: WindConfig) {
    this.config = { ...initialConfig };
    this.startTime = Date.now();
    this.lastUpdateTime = 0;
    this.updateCachedValues();
  }

  /**
   * Update wind configuration
   */
  updateConfig(newConfig: Partial<WindConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.updateCachedValues();
  }

  /**
   * Get current wind configuration
   */
  getConfig(): WindConfig {
    return { ...this.config };
  }

  /**
   * Calculate time-based wind offset for smooth cloud drifting
   */
  calculateWindOffset(currentTime?: number): [number, number] {
    const time = currentTime ?? Date.now();
    
    // Throttle updates for performance
    if (time - this.lastUpdateTime < this.updateThrottle) {
      return this.cachedOffset;
    }

    if (!this.config.enabled) {
      this.cachedOffset = [0, 0];
      this.lastUpdateTime = time;
      return this.cachedOffset;
    }

    const elapsedTime = (time - this.startTime) * 0.001; // Convert to seconds
    
    // Convert direction from degrees to radians
    const directionRad = (this.config.direction * Math.PI) / 180;
    
    // Base wind movement - linear drift
    const baseOffsetX = Math.cos(directionRad) * this.config.speed * elapsedTime * 0.01;
    const baseOffsetY = Math.sin(directionRad) * this.config.speed * elapsedTime * 0.01;
    
    // Add turbulence for more natural, organic movement
    const turbulenceScale = this.config.turbulence * 0.02;
    const turbulenceX = Math.sin(elapsedTime * 0.1 + directionRad) * turbulenceScale;
    const turbulenceY = Math.cos(elapsedTime * 0.15 + directionRad) * turbulenceScale;
    
    // Add subtle gusts for additional realism
    const gustX = Math.sin(elapsedTime * 0.05) * this.config.turbulence * 0.01;
    const gustY = Math.cos(elapsedTime * 0.07) * this.config.turbulence * 0.01;
    
    this.cachedOffset = [
      baseOffsetX + turbulenceX + gustX,
      baseOffsetY + turbulenceY + gustY
    ];
    
    this.lastUpdateTime = time;
    return this.cachedOffset;
  }

  /**
   * Get normalized wind vector for shader uniforms
   */
  getWindVector(): [number, number] {
    if (!this.config.enabled) {
      return [0, 0];
    }

    return this.cachedVector;
  }

  /**
   * Get wind intensity at current time (includes gusts and turbulence)
   */
  getWindIntensity(currentTime?: number): number {
    if (!this.config.enabled) {
      return 0;
    }

    const time = (currentTime ?? Date.now()) * 0.001;
    const baseIntensity = this.config.speed;
    
    // Add turbulence variation
    const turbulenceVariation = Math.sin(time * 0.2) * this.config.turbulence * 0.3;
    
    // Add gust effects
    const gustVariation = Math.sin(time * 0.08) * this.config.turbulence * 0.2;
    
    return Math.max(0, baseIntensity + turbulenceVariation + gustVariation);
  }

  /**
   * Get wind direction with turbulence variation
   */
  getWindDirection(currentTime?: number): number {
    if (!this.config.enabled) {
      return 0;
    }

    const time = (currentTime ?? Date.now()) * 0.001;
    const baseDirection = this.config.direction;
    
    // Add directional turbulence (small variations in wind direction)
    const directionVariation = Math.sin(time * 0.1) * this.config.turbulence * 15; // ±15 degrees max
    
    return (baseDirection + directionVariation + 360) % 360;
  }

  /**
   * Reset wind system timing (useful when resuming from background)
   */
  resetTiming(): void {
    this.startTime = Date.now();
    this.lastUpdateTime = 0;
    this.updateCachedValues();
  }

  /**
   * Set update throttle for performance optimization
   */
  setUpdateThrottle(throttleMs: number): void {
    this.updateThrottle = Math.max(8, throttleMs); // Minimum 8ms (120fps)
  }

  /**
   * Update cached values that don't change frequently
   */
  private updateCachedValues(): void {
    if (!this.config.enabled) {
      this.cachedVector = [0, 0];
      return;
    }

    // Convert direction to normalized vector
    const directionRad = (this.config.direction * Math.PI) / 180;
    this.cachedVector = [
      Math.cos(directionRad) * this.config.speed,
      Math.sin(directionRad) * this.config.speed
    ];
  }

  /**
   * Get wind system performance metrics
   */
  getPerformanceMetrics(): {
    updateFrequency: number;
    lastUpdateTime: number;
    cacheHitRate: number;
  } {
    return {
      updateFrequency: 1000 / this.updateThrottle,
      lastUpdateTime: this.lastUpdateTime,
      cacheHitRate: this.lastUpdateTime > 0 ? 1 : 0, // Simplified metric
    };
  }

  /**
   * Dispose of the wind system
   */
  dispose(): void {
    // Clean up any resources if needed
    this.cachedOffset = [0, 0];
    this.cachedVector = [0, 0];
  }
}

/**
 * Factory function to create a wind system with default configuration
 */
export function createWindSystem(config?: Partial<WindConfig>): WindSystem {
  const defaultConfig: WindConfig = {
    direction: 45, // Northeast
    speed: 1.0,
    enabled: true,
    turbulence: 0.3,
  };

  return new WindSystem({ ...defaultConfig, ...config });
}

/**
 * Utility functions for wind calculations
 */
export const WindUtils = {
  /**
   * Convert wind direction from compass bearing to mathematical angle
   */
  compassToMath(compassDegrees: number): number {
    return (90 - compassDegrees + 360) % 360;
  },

  /**
   * Convert mathematical angle to compass bearing
   */
  mathToCompass(mathDegrees: number): number {
    return (90 - mathDegrees + 360) % 360;
  },

  /**
   * Interpolate between two wind configurations
   */
  interpolateWindConfig(
    from: WindConfig,
    to: WindConfig,
    factor: number
  ): WindConfig {
    const t = Math.max(0, Math.min(1, factor));
    
    return {
      direction: from.direction + (to.direction - from.direction) * t,
      speed: from.speed + (to.speed - from.speed) * t,
      enabled: t > 0.5 ? to.enabled : from.enabled,
      turbulence: from.turbulence + (to.turbulence - from.turbulence) * t,
    };
  },

  /**
   * Validate wind configuration
   */
  validateConfig(config: Partial<WindConfig>): boolean {
    if (config.direction !== undefined) {
      if (typeof config.direction !== 'number' || config.direction < 0 || config.direction >= 360) {
        return false;
      }
    }

    if (config.speed !== undefined) {
      if (typeof config.speed !== 'number' || config.speed < 0 || config.speed > 2) {
        return false;
      }
    }

    if (config.enabled !== undefined) {
      if (typeof config.enabled !== 'boolean') {
        return false;
      }
    }

    if (config.turbulence !== undefined) {
      if (typeof config.turbulence !== 'number' || config.turbulence < 0 || config.turbulence > 1) {
        return false;
      }
    }

    return true;
  },
};