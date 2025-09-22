/**
 * Utility functions and presets for noise generation
 */

import { NoiseConfiguration } from './PerlinNoise';

/**
 * Predefined noise configurations for different cloud types
 */
export const NoisePresets = {
  /**
   * Dense, detailed clouds with high contrast
   */
  CUMULUS: {
    octaves: 6,
    persistence: 0.5,
    lacunarity: 2.0,
    scale: 0.01
  } as NoiseConfiguration,

  /**
   * Wispy, high-altitude clouds
   */
  CIRRUS: {
    octaves: 4,
    persistence: 0.3,
    lacunarity: 2.5,
    scale: 0.005
  } as NoiseConfiguration,

  /**
   * Thick, low-hanging fog
   */
  STRATUS: {
    octaves: 3,
    persistence: 0.7,
    lacunarity: 1.8,
    scale: 0.02
  } as NoiseConfiguration,

  /**
   * Performance-optimized for mobile devices
   */
  MOBILE_OPTIMIZED: {
    octaves: 3,
    persistence: 0.5,
    lacunarity: 2.0,
    scale: 0.015
  } as NoiseConfiguration
};

/**
 * Utility functions for noise manipulation
 */
export class NoiseUtils {
  /**
   * Clamp noise value to 0-1 range
   */
  static clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  /**
   * Apply smooth step function for better cloud edges
   */
  static smoothStep(edge0: number, edge1: number, x: number): number {
    const t = this.clamp((x - edge0) / (edge1 - edge0));
    return t * t * (3.0 - 2.0 * t);
  }

  /**
   * Remap noise value from [-1, 1] to [0, 1] range
   */
  static remapToPositive(value: number): number {
    return (value + 1.0) * 0.5;
  }

  /**
   * Apply turbulence effect to noise
   */
  static turbulence(value: number, intensity: number = 1.0): number {
    return Math.abs(value) * intensity;
  }

  /**
   * Create ridged noise pattern
   */
  static ridge(value: number, sharpness: number = 1.0): number {
    return (1.0 - Math.abs(value)) * sharpness;
  }

  /**
   * Combine multiple noise values with different blend modes
   */
  static blend(a: number, b: number, mode: 'add' | 'multiply' | 'overlay' | 'screen'): number {
    switch (mode) {
      case 'add':
        return this.clamp(a + b);
      case 'multiply':
        return a * b;
      case 'overlay':
        return a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b);
      case 'screen':
        return 1 - (1 - a) * (1 - b);
      default:
        return a;
    }
  }

  /**
   * Generate time-based animation offset for cloud movement
   */
  static getAnimationOffset(time: number, speed: number, direction: number): [number, number] {
    const radians = (direction * Math.PI) / 180;
    const offset = time * speed;
    return [
      Math.cos(radians) * offset,
      Math.sin(radians) * offset
    ];
  }
}