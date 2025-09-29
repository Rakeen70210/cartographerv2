/**
 * Cloud density calculation functions using noise algorithms
 */

import { PerlinNoise, NoiseConfiguration, NoiseUtils } from '../noise';

export interface DensityConfig {
  baseNoise: NoiseConfiguration;
  detailNoise?: NoiseConfiguration;
  ridgeNoise?: NoiseConfiguration;
  turbulenceIntensity: number;
  densityThreshold: number;
  falloffDistance: number;
}

export interface GeographicContext {
  elevation: number;
  waterDistance: number; // Distance to nearest water body
  urbanDensity: number; // 0-1, how urban the area is
  temperature: number; // Simulated temperature
  humidity: number; // Simulated humidity
}

/**
 * Advanced cloud density calculator with geographic context
 */
export class CloudDensityCalculator {
  private baseNoise: PerlinNoise;
  private detailNoise: PerlinNoise;
  private ridgeNoise: PerlinNoise;

  constructor(seed: number = 12345) {
    this.baseNoise = new PerlinNoise(seed);
    this.detailNoise = new PerlinNoise(seed + 1000);
    this.ridgeNoise = new PerlinNoise(seed + 2000);
  }

  /**
   * Calculate cloud density at a specific world position
   */
  public calculateDensity(
    x: number,
    y: number,
    config: DensityConfig,
    context?: GeographicContext,
    time: number = 0
  ): number {
    // Apply time-based animation offset
    const [offsetX, offsetY] = NoiseUtils.getAnimationOffset(time, 0.1, 45);
    const animatedX = x + offsetX;
    const animatedY = y + offsetY;

    // Base cloud pattern
    let density = this.baseNoise.noise(animatedX, animatedY, config.baseNoise);

    // Add detail layer if configured
    if (config.detailNoise) {
      const detail = this.detailNoise.noise(animatedX, animatedY, config.detailNoise);
      density = NoiseUtils.blend(density, detail, 'add');
    }

    // Add ridge patterns for more interesting cloud shapes
    if (config.ridgeNoise) {
      const ridge = NoiseUtils.ridge(
        this.ridgeNoise.noise(animatedX, animatedY, config.ridgeNoise)
      );
      density = NoiseUtils.blend(density, ridge * 0.3, 'overlay');
    }

    // Apply turbulence for more chaotic cloud edges
    if (config.turbulenceIntensity > 0) {
      const turbulence = NoiseUtils.turbulence(density, config.turbulenceIntensity);
      density = NoiseUtils.blend(density, turbulence, 'multiply');
    }

    // Remap to positive range
    density = NoiseUtils.remapToPositive(density);

    // Apply geographic context modifications
    if (context) {
      density = this.applyGeographicContext(density, context);
    }

    // Apply density threshold and falloff
    density = this.applyDensityThreshold(density, config.densityThreshold, config.falloffDistance);

    return NoiseUtils.clamp(density);
  }

  /**
   * Calculate density for multiple points efficiently
   */
  public calculateDensityField(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    resolution: number,
    config: DensityConfig,
    context?: GeographicContext,
    time: number = 0
  ): Float32Array {
    const width = resolution;
    const height = resolution;
    const densityField = new Float32Array(width * height);

    const stepX = (bounds.maxX - bounds.minX) / (width - 1);
    const stepY = (bounds.maxY - bounds.minY) / (height - 1);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const worldX = bounds.minX + x * stepX;
        const worldY = bounds.minY + y * stepY;
        
        const density = this.calculateDensity(worldX, worldY, config, context, time);
        densityField[y * width + x] = density;
      }
    }

    return densityField;
  }

  /**
   * Apply geographic context to modify cloud density
   */
  private applyGeographicContext(density: number, context: GeographicContext): number {
    let modifiedDensity = density;

    // Elevation effects - higher elevation = more clouds
    const elevationFactor = 1 + (context.elevation / 1000) * 0.3; // 30% increase per 1000m
    modifiedDensity *= elevationFactor;

    // Water proximity effects - more clouds near water
    const waterFactor = 1 + Math.exp(-context.waterDistance / 5000) * 0.5; // 50% increase near water
    modifiedDensity *= waterFactor;

    // Urban heat island effect - fewer clouds in dense urban areas
    const urbanFactor = 1 - context.urbanDensity * 0.2; // 20% reduction in dense urban areas
    modifiedDensity *= Math.max(0.1, urbanFactor); // Ensure minimum factor to prevent total density loss

    // Temperature and humidity effects - ensure minimum values to prevent total density loss
    const temperatureFactor = Math.max(0.1, NoiseUtils.smoothStep(10, 30, context.temperature)); // Optimal cloud temp range
    const humidityFactor = Math.max(0.1, context.humidity); // More humidity = more clouds, minimum 0.1
    modifiedDensity *= temperatureFactor * humidityFactor;

    return modifiedDensity;
  }

  /**
   * Apply density threshold with smooth falloff
   */
  private applyDensityThreshold(
    density: number,
    threshold: number,
    falloffDistance: number
  ): number {
    if (density < threshold) {
      return Math.max(0, density); // Return small positive values instead of 0 to preserve geographic variation
    }

    if (falloffDistance <= 0) {
      return density;
    }

    // Smooth falloff above threshold
    const falloffStart = threshold;
    const falloffEnd = threshold + falloffDistance;

    if (density > falloffEnd) {
      return density;
    }

    const falloffProgress = (density - falloffStart) / falloffDistance;
    const smoothFalloff = NoiseUtils.smoothStep(0, 1, falloffProgress);

    return threshold + (density - threshold) * smoothFalloff;
  }

  /**
   * Create density configuration presets for different cloud types
   */
  public static createPresets(): Record<string, DensityConfig> {
    return {
      cumulus: {
        baseNoise: {
          octaves: 6,
          persistence: 0.5,
          lacunarity: 2.0,
          scale: 0.001
        },
        detailNoise: {
          octaves: 3,
          persistence: 0.3,
          lacunarity: 3.0,
          scale: 0.01
        },
        turbulenceIntensity: 0.3,
        densityThreshold: 0.4,
        falloffDistance: 0.2
      },

      stratus: {
        baseNoise: {
          octaves: 4,
          persistence: 0.7,
          lacunarity: 1.8,
          scale: 0.0005
        },
        turbulenceIntensity: 0.1,
        densityThreshold: 0.3,
        falloffDistance: 0.3
      },

      cirrus: {
        baseNoise: {
          octaves: 5,
          persistence: 0.3,
          lacunarity: 2.5,
          scale: 0.0003
        },
        ridgeNoise: {
          octaves: 3,
          persistence: 0.4,
          lacunarity: 2.0,
          scale: 0.002
        },
        turbulenceIntensity: 0.5,
        densityThreshold: 0.5,
        falloffDistance: 0.1
      },

      fog: {
        baseNoise: {
          octaves: 3,
          persistence: 0.8,
          lacunarity: 1.5,
          scale: 0.002
        },
        turbulenceIntensity: 0.05,
        densityThreshold: 0.2,
        falloffDistance: 0.4
      }
    };
  }

  /**
   * Interpolate between two density configurations for smooth transitions
   */
  public static interpolateConfigs(
    config1: DensityConfig,
    config2: DensityConfig,
    t: number
  ): DensityConfig {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    return {
      baseNoise: {
        octaves: Math.round(lerp(config1.baseNoise.octaves, config2.baseNoise.octaves, t)),
        persistence: lerp(config1.baseNoise.persistence, config2.baseNoise.persistence, t),
        lacunarity: lerp(config1.baseNoise.lacunarity, config2.baseNoise.lacunarity, t),
        scale: lerp(config1.baseNoise.scale, config2.baseNoise.scale, t)
      },
      turbulenceIntensity: lerp(config1.turbulenceIntensity, config2.turbulenceIntensity, t),
      densityThreshold: lerp(config1.densityThreshold, config2.densityThreshold, t),
      falloffDistance: lerp(config1.falloffDistance, config2.falloffDistance, t)
    };
  }
}