/**
 * Marine Fog Effects System
 * Specialized system for creating realistic marine fog effects over water bodies
 */

import { TerrainAnalysis, WaterBodyInfo } from './TerrainAnalyzer';
import { DensityConfig } from '../geometry/DensityCalculator';
import { CloudGeneratorConfig } from '../../../types/cloud';

export interface MarineFogParameters {
  intensity: number; // 0-1
  thickness: number; // vertical thickness in meters
  horizontalSpread: number; // horizontal spread in meters
  density: number; // fog density 0-1
  visibility: number; // visibility distance in meters
  color: [number, number, number]; // RGB color 0-1
  opacity: number; // overall opacity 0-1
}

export interface FogFormationConditions {
  temperature: number; // air temperature in Celsius
  waterTemperature: number; // water temperature in Celsius
  humidity: number; // relative humidity 0-1
  windSpeed: number; // wind speed in m/s
  pressure: number; // atmospheric pressure in hPa
  timeOfDay: number; // hour of day 0-23
}

export interface MarineFogType {
  name: string;
  description: string;
  formationConditions: Partial<FogFormationConditions>;
  parameters: MarineFogParameters;
  densityConfig: DensityConfig;
  generatorConfig: CloudGeneratorConfig;
}

/**
 * Creates and manages marine fog effects for different water body types
 */
export class MarineFogEffects {
  private fogTypes: Map<string, MarineFogType> = new Map();
  private activeEffects: Map<string, MarineFogParameters> = new Map();

  constructor() {
    this.initializeFogTypes();
  }

  /**
   * Create marine fog effect for a specific water body
   */
  public createMarineFog(
    waterBodyInfo: WaterBodyInfo,
    analysis: TerrainAnalysis,
    conditions?: Partial<FogFormationConditions>
  ): MarineFogParameters | null {
    const fogType = this.selectFogType(waterBodyInfo, analysis, conditions);
    
    if (!fogType) {
      return null; // No fog conditions met
    }

    // Calculate fog parameters based on conditions
    const parameters = this.calculateFogParameters(fogType, analysis, conditions);
    
    // Cache the effect
    const effectId = this.generateEffectId(waterBodyInfo, analysis);
    this.activeEffects.set(effectId, parameters);
    
    return parameters;
  }

  /**
   * Create advection fog (warm air over cold water)
   */
  public createAdvectionFog(
    waterTemperature: number,
    airTemperature: number,
    humidity: number,
    windSpeed: number
  ): MarineFogParameters | null {
    // Advection fog forms when warm, moist air moves over cooler water
    const temperatureDifference = airTemperature - waterTemperature;
    
    if (temperatureDifference < 2 || humidity < 0.7 || windSpeed > 8) {
      return null; // Conditions not met
    }

    const intensity = Math.min(1, (temperatureDifference / 10) * (humidity - 0.6) / 0.4);
    const windFactor = Math.max(0.3, 1 - windSpeed / 10);

    return {
      intensity: intensity * windFactor,
      thickness: 50 + temperatureDifference * 20,
      horizontalSpread: 2000 + windSpeed * 500,
      density: 0.7 + intensity * 0.3,
      visibility: Math.max(100, 1000 - intensity * 800),
      color: [0.85, 0.88, 0.92],
      opacity: 0.8 + intensity * 0.2
    };
  }

  /**
   * Create radiation fog (cooling at night)
   */
  public createRadiationFog(
    temperature: number,
    humidity: number,
    windSpeed: number,
    timeOfDay: number
  ): MarineFogParameters | null {
    // Radiation fog forms during clear, calm nights
    const isNightTime = timeOfDay < 6 || timeOfDay > 20;
    
    if (!isNightTime || humidity < 0.8 || windSpeed > 3 || temperature > 15) {
      return null; // Conditions not met
    }

    const nightFactor = timeOfDay < 6 ? (6 - timeOfDay) / 6 : (timeOfDay - 20) / 4;
    const intensity = nightFactor * (humidity - 0.7) / 0.3;

    return {
      intensity: intensity * 0.8,
      thickness: 20 + intensity * 30,
      horizontalSpread: 1000 + intensity * 1500,
      density: 0.6 + intensity * 0.4,
      visibility: Math.max(50, 500 - intensity * 400),
      color: [0.88, 0.90, 0.94],
      opacity: 0.7 + intensity * 0.3
    };
  }

  /**
   * Create evaporation fog (cold air over warm water)
   */
  public createEvaporationFog(
    waterTemperature: number,
    airTemperature: number,
    humidity: number
  ): MarineFogParameters | null {
    // Evaporation fog forms when cold air moves over warmer water
    const temperatureDifference = waterTemperature - airTemperature;
    
    if (temperatureDifference < 5 || humidity > 0.6) {
      return null; // Conditions not met
    }

    const intensity = Math.min(1, temperatureDifference / 15);
    const humidityFactor = Math.max(0.2, (0.6 - humidity) / 0.6);

    return {
      intensity: intensity * humidityFactor,
      thickness: 10 + temperatureDifference * 5,
      horizontalSpread: 500 + temperatureDifference * 100,
      density: 0.5 + intensity * 0.4,
      visibility: Math.max(200, 2000 - intensity * 1500),
      color: [0.90, 0.92, 0.95],
      opacity: 0.6 + intensity * 0.3
    };
  }

  /**
   * Create sea smoke (steam fog over very warm water)
   */
  public createSeaSmoke(
    waterTemperature: number,
    airTemperature: number,
    windSpeed: number
  ): MarineFogParameters | null {
    // Sea smoke forms when very cold air moves over much warmer water
    const temperatureDifference = waterTemperature - airTemperature;
    
    if (temperatureDifference < 10 || airTemperature > 0 || windSpeed > 5) {
      return null; // Conditions not met
    }

    const intensity = Math.min(1, temperatureDifference / 20);
    const windFactor = Math.max(0.5, 1 - windSpeed / 8);

    return {
      intensity: intensity * windFactor,
      thickness: 5 + temperatureDifference * 2,
      horizontalSpread: 200 + temperatureDifference * 50,
      density: 0.8 + intensity * 0.2,
      visibility: Math.max(100, 800 - intensity * 600),
      color: [0.92, 0.94, 0.97],
      opacity: 0.9 + intensity * 0.1
    };
  }

  /**
   * Get fog configuration for cloud generation
   */
  public getFogCloudConfig(parameters: MarineFogParameters): {
    densityConfig: DensityConfig;
    generatorConfig: CloudGeneratorConfig;
  } {
    const densityConfig: DensityConfig = {
      baseNoise: {
        octaves: 3,
        persistence: 0.8,
        lacunarity: 1.5,
        scale: 0.002 / parameters.thickness * 100 // Adjust scale based on thickness
      },
      detailNoise: {
        octaves: 2,
        persistence: 0.4,
        lacunarity: 2.0,
        scale: 0.008 / parameters.thickness * 100
      },
      turbulenceIntensity: 0.1 * (1 - parameters.density), // Less turbulence for denser fog
      densityThreshold: 0.1 + (1 - parameters.intensity) * 0.3,
      falloffDistance: 0.6 * parameters.intensity
    };

    const generatorConfig: CloudGeneratorConfig = {
      cloudDensity: parameters.density,
      noiseScale: densityConfig.baseNoise.scale,
      octaves: densityConfig.baseNoise.octaves,
      persistence: densityConfig.baseNoise.persistence,
      lacunarity: densityConfig.baseNoise.lacunarity,
      windDirection: { x: 1, y: 0.2 }, // Mostly horizontal movement
      windSpeed: Math.max(0.5, 3 - parameters.intensity * 2) // Slower for denser fog
    };

    return { densityConfig, generatorConfig };
  }

  /**
   * Update fog parameters based on changing conditions
   */
  public updateFogParameters(
    effectId: string,
    newConditions: Partial<FogFormationConditions>
  ): MarineFogParameters | null {
    const existingEffect = this.activeEffects.get(effectId);
    if (!existingEffect) {
      return null;
    }

    // Recalculate parameters with new conditions
    // This is a simplified update - in practice, you'd want more sophisticated blending
    const updatedParameters = { ...existingEffect };
    
    if (newConditions.windSpeed !== undefined) {
      const windFactor = Math.max(0.3, 1 - newConditions.windSpeed / 10);
      updatedParameters.intensity *= windFactor;
      updatedParameters.horizontalSpread = Math.max(500, updatedParameters.horizontalSpread * windFactor);
    }

    if (newConditions.temperature !== undefined && newConditions.humidity !== undefined) {
      const stabilityFactor = (newConditions.humidity - 0.5) / 0.5;
      updatedParameters.density = Math.max(0.3, updatedParameters.density * (1 + stabilityFactor * 0.2));
    }

    this.activeEffects.set(effectId, updatedParameters);
    return updatedParameters;
  }

  /**
   * Initialize fog type definitions
   */
  private initializeFogTypes(): void {
    // Dense oceanic fog
    this.fogTypes.set('dense_oceanic', {
      name: 'Dense Oceanic Fog',
      description: 'Thick fog forming over ocean surfaces',
      formationConditions: {
        humidity: 0.8,
        windSpeed: 5,
        temperature: 15
      },
      parameters: {
        intensity: 0.9,
        thickness: 100,
        horizontalSpread: 5000,
        density: 0.8,
        visibility: 200,
        color: [0.82, 0.85, 0.90],
        opacity: 0.9
      },
      densityConfig: {
        baseNoise: {
          octaves: 4,
          persistence: 0.8,
          lacunarity: 1.5,
          scale: 0.0008
        },
        turbulenceIntensity: 0.1,
        densityThreshold: 0.15,
        falloffDistance: 0.5
      },
      generatorConfig: {
        cloudDensity: 0.85,
        noiseScale: 0.0008,
        octaves: 4,
        persistence: 0.8,
        lacunarity: 1.5,
        windDirection: { x: 1, y: 0 },
        windSpeed: 2
      }
    });

    // Light lake mist
    this.fogTypes.set('light_lake_mist', {
      name: 'Light Lake Mist',
      description: 'Gentle mist over lake surfaces',
      formationConditions: {
        humidity: 0.7,
        windSpeed: 3,
        timeOfDay: 6
      },
      parameters: {
        intensity: 0.5,
        thickness: 30,
        horizontalSpread: 1500,
        density: 0.5,
        visibility: 800,
        color: [0.90, 0.93, 0.96],
        opacity: 0.6
      },
      densityConfig: {
        baseNoise: {
          octaves: 3,
          persistence: 0.6,
          lacunarity: 1.8,
          scale: 0.001
        },
        turbulenceIntensity: 0.15,
        densityThreshold: 0.25,
        falloffDistance: 0.4
      },
      generatorConfig: {
        cloudDensity: 0.6,
        noiseScale: 0.001,
        octaves: 3,
        persistence: 0.6,
        lacunarity: 1.8,
        windDirection: { x: 0.7, y: 0.7 },
        windSpeed: 1.5
      }
    });

    // River valley fog
    this.fogTypes.set('river_valley_fog', {
      name: 'River Valley Fog',
      description: 'Fog following river valleys and waterways',
      formationConditions: {
        humidity: 0.75,
        windSpeed: 2,
        timeOfDay: 5
      },
      parameters: {
        intensity: 0.6,
        thickness: 40,
        horizontalSpread: 800,
        density: 0.6,
        visibility: 600,
        color: [0.88, 0.91, 0.95],
        opacity: 0.7
      },
      densityConfig: {
        baseNoise: {
          octaves: 2,
          persistence: 0.5,
          lacunarity: 2.2,
          scale: 0.002
        },
        turbulenceIntensity: 0.2,
        densityThreshold: 0.3,
        falloffDistance: 0.3
      },
      generatorConfig: {
        cloudDensity: 0.4,
        noiseScale: 0.002,
        octaves: 2,
        persistence: 0.5,
        lacunarity: 2.2,
        windDirection: { x: 1, y: 0.2 },
        windSpeed: 1
      }
    });
  }

  /**
   * Select appropriate fog type based on conditions
   */
  private selectFogType(
    waterBodyInfo: WaterBodyInfo,
    analysis: TerrainAnalysis,
    conditions?: Partial<FogFormationConditions>
  ): MarineFogType | null {
    const { type: waterType, size: waterSize } = waterBodyInfo;
    const { humidity, temperature } = analysis.climate;
    
    // Check formation conditions
    if (humidity < 0.6) {
      return null; // Not humid enough for fog
    }

    // Select based on water body type
    switch (waterType) {
      case 'ocean':
        if (waterSize === 'large' && humidity > 0.8) {
          return this.fogTypes.get('dense_oceanic')!;
        }
        break;
      case 'lake':
        if (humidity > 0.7) {
          return this.fogTypes.get('light_lake_mist')!;
        }
        break;
      case 'river':
        if (humidity > 0.75) {
          return this.fogTypes.get('river_valley_fog')!;
        }
        break;
    }

    return null;
  }

  /**
   * Calculate fog parameters based on conditions
   */
  private calculateFogParameters(
    fogType: MarineFogType,
    analysis: TerrainAnalysis,
    conditions?: Partial<FogFormationConditions>
  ): MarineFogParameters {
    const baseParams = { ...fogType.parameters };
    const { humidity, temperature, windSpeed } = analysis.climate;
    
    // Adjust intensity based on humidity
    const humidityFactor = (humidity - 0.6) / 0.4; // 0-1 range
    baseParams.intensity *= (0.5 + humidityFactor * 0.5);
    
    // Adjust based on temperature
    const tempFactor = Math.max(0.3, 1 - Math.abs(temperature - 10) / 20);
    baseParams.intensity *= tempFactor;
    
    // Adjust based on wind speed
    const windFactor = Math.max(0.2, 1 - windSpeed / 15);
    baseParams.intensity *= windFactor;
    baseParams.horizontalSpread *= (0.5 + windFactor * 0.5);
    
    // Adjust visibility based on density
    baseParams.visibility = Math.max(50, baseParams.visibility * (1 - baseParams.intensity * 0.5));
    
    return baseParams;
  }

  /**
   * Generate effect ID
   */
  private generateEffectId(waterBodyInfo: WaterBodyInfo, analysis: TerrainAnalysis): string {
    const lat = analysis.geographicContext.elevation; // Using elevation as a proxy for location
    const lng = analysis.geographicContext.waterDistance; // Using water distance as a proxy
    return `fog_${waterBodyInfo.type}_${lat.toFixed(2)}_${lng.toFixed(0)}`;
  }

  /**
   * Get all active fog effects
   */
  public getActiveEffects(): Map<string, MarineFogParameters> {
    return new Map(this.activeEffects);
  }

  /**
   * Clear fog effect
   */
  public clearFogEffect(effectId: string): void {
    this.activeEffects.delete(effectId);
  }

  /**
   * Clear all fog effects
   */
  public clearAllEffects(): void {
    this.activeEffects.clear();
  }
}