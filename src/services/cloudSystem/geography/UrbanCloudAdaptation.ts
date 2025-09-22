/**
 * Urban Cloud Adaptation System
 * Handles cloud pattern modifications for urban environments including heat islands,
 * pollution effects, and building wake turbulence
 */

import { TerrainAnalysis, UrbanInfo } from './TerrainAnalyzer';
import { DensityConfig } from '../geometry/DensityCalculator';
import { CloudGeneratorConfig } from '../../../types/cloud';

export interface UrbanHeatIslandEffect {
  intensity: number; // 0-1, strength of heat island
  radius: number; // meters, affected radius
  temperatureIncrease: number; // Celsius, temperature increase
  convectionStrength: number; // 0-1, strength of convective effects
}

export interface PollutionHazeEffect {
  particleDensity: number; // 0-1, density of pollution particles
  visibility: number; // meters, reduced visibility
  color: [number, number, number]; // RGB color tint 0-1
  layerHeight: number; // meters, height of pollution layer
}

export interface BuildingWakeEffect {
  turbulenceIntensity: number; // 0-1, strength of turbulence
  wakeLength: number; // meters, length of building wake
  verticalMixing: number; // 0-1, strength of vertical air mixing
  cloudFormationBonus: number; // 0-1, increased cloud formation in wakes
}

export interface UrbanCloudProfile {
  urbanType: UrbanInfo['type'];
  density: number; // urban density 0-1
  buildingHeight: number; // average building height in meters
  heatIsland: UrbanHeatIslandEffect;
  pollutionHaze: PollutionHazeEffect;
  buildingWakes: BuildingWakeEffect;
  adaptedDensityConfig: DensityConfig;
  adaptedGeneratorConfig: CloudGeneratorConfig;
}

export interface UrbanAdaptationSettings {
  enableHeatIslandEffect: boolean;
  enablePollutionHaze: boolean;
  enableBuildingWakes: boolean;
  adaptationIntensity: number; // 0-1, overall adaptation strength
  pollutionSources: {
    industrial: number; // 0-1, industrial pollution level
    traffic: number; // 0-1, traffic pollution level
    residential: number; // 0-1, residential pollution level
  };
}

/**
 * Manages cloud adaptations for urban environments
 */
export class UrbanCloudAdaptation {
  private settings: UrbanAdaptationSettings;
  private urbanProfiles: Map<string, UrbanCloudProfile> = new Map();

  constructor(settings: UrbanAdaptationSettings = {
    enableHeatIslandEffect: true,
    enablePollutionHaze: true,
    enableBuildingWakes: true,
    adaptationIntensity: 0.8,
    pollutionSources: {
      industrial: 0.8,
      traffic: 0.6,
      residential: 0.3
    }
  }) {
    this.settings = settings;
  }

  /**
   * Create urban cloud profile for a specific urban area
   */
  public createUrbanProfile(analysis: TerrainAnalysis): UrbanCloudProfile {
    const { urban } = analysis;
    const profileId = this.generateProfileId(urban);
    
    // Check if profile already exists
    const existingProfile = this.urbanProfiles.get(profileId);
    if (existingProfile) {
      return existingProfile;
    }

    // Create new profile
    const profile: UrbanCloudProfile = {
      urbanType: urban.type,
      density: urban.density,
      buildingHeight: urban.buildingHeight,
      heatIsland: this.calculateHeatIslandEffect(urban, analysis),
      pollutionHaze: this.calculatePollutionHazeEffect(urban, analysis),
      buildingWakes: this.calculateBuildingWakeEffect(urban, analysis),
      adaptedDensityConfig: this.createUrbanDensityConfig(urban, analysis),
      adaptedGeneratorConfig: this.createUrbanGeneratorConfig(urban, analysis)
    };

    this.urbanProfiles.set(profileId, profile);
    return profile;
  }

  /**
   * Calculate heat island effect parameters
   */
  private calculateHeatIslandEffect(urban: UrbanInfo, analysis: TerrainAnalysis): UrbanHeatIslandEffect {
    if (!this.settings.enableHeatIslandEffect) {
      return {
        intensity: 0,
        radius: 0,
        temperatureIncrease: 0,
        convectionStrength: 0
      };
    }

    const { density, buildingHeight, type } = urban;
    const baseTemperature = analysis.climate.temperature;
    
    // Calculate heat island intensity based on urban characteristics
    let intensity = density * this.settings.adaptationIntensity;
    
    // Adjust based on urban type
    const typeMultipliers = {
      'commercial': 1.3,
      'industrial': 1.5,
      'residential': 1.0,
      'rural': 0.3
    };
    intensity *= typeMultipliers[type];
    
    // Building height effect (taller buildings = stronger heat island)
    const heightFactor = Math.min(2, buildingHeight / 50);
    intensity *= heightFactor;
    
    // Temperature increase (typically 2-8°C in dense urban areas)
    const temperatureIncrease = intensity * 6;
    
    // Affected radius (larger for denser areas)
    const radius = 1000 + density * 3000 + (buildingHeight / 10) * 500;
    
    // Convection strength (heat creates updrafts)
    const convectionStrength = intensity * Math.max(0.3, (baseTemperature + temperatureIncrease) / 30);

    return {
      intensity,
      radius,
      temperatureIncrease,
      convectionStrength
    };
  }

  /**
   * Calculate pollution haze effect parameters
   */
  private calculatePollutionHazeEffect(urban: UrbanInfo, analysis: TerrainAnalysis): PollutionHazeEffect {
    if (!this.settings.enablePollutionHaze) {
      return {
        particleDensity: 0,
        visibility: 10000,
        color: [1, 1, 1],
        layerHeight: 0
      };
    }

    const { density, type } = urban;
    const windSpeed = analysis.climate.windSpeed;
    const humidity = analysis.climate.humidity;
    
    // Base pollution level based on urban type
    const typePollution = {
      'industrial': this.settings.pollutionSources.industrial,
      'commercial': this.settings.pollutionSources.traffic,
      'residential': this.settings.pollutionSources.residential,
      'rural': 0.1
    };
    
    let particleDensity = typePollution[type] * density * this.settings.adaptationIntensity;
    
    // Wind dispersal effect (stronger winds reduce pollution)
    const windFactor = Math.max(0.3, 1 - windSpeed / 15);
    particleDensity *= windFactor;
    
    // Humidity effect (higher humidity can trap pollutants)
    const humidityFactor = 1 + (humidity - 0.5) * 0.4;
    particleDensity *= humidityFactor;
    
    // Visibility reduction (more pollution = less visibility)
    const visibility = Math.max(500, 10000 - particleDensity * 8000);
    
    // Color tint (pollution creates brownish/grayish tint)
    const tintStrength = particleDensity * 0.3;
    const color: [number, number, number] = [
      1 - tintStrength * 0.2, // Slight red reduction
      1 - tintStrength * 0.15, // Slight green reduction
      1 - tintStrength * 0.1   // Minimal blue reduction
    ];
    
    // Layer height (pollution typically stays in lower atmosphere)
    const layerHeight = 200 + particleDensity * 300;

    return {
      particleDensity,
      visibility,
      color,
      layerHeight
    };
  }

  /**
   * Calculate building wake effect parameters
   */
  private calculateBuildingWakeEffect(urban: UrbanInfo, analysis: TerrainAnalysis): BuildingWakeEffect {
    if (!this.settings.enableBuildingWakes) {
      return {
        turbulenceIntensity: 0,
        wakeLength: 0,
        verticalMixing: 0,
        cloudFormationBonus: 0
      };
    }

    const { density, buildingHeight } = urban;
    const windSpeed = analysis.climate.windSpeed;
    
    // Turbulence intensity based on building height and density
    let turbulenceIntensity = (buildingHeight / 100) * density * this.settings.adaptationIntensity;
    
    // Wind speed effect (moderate winds create more turbulence)
    const windFactor = windSpeed < 2 ? 0.3 : 
                      windSpeed < 8 ? windSpeed / 8 : 
                      Math.max(0.5, 1 - (windSpeed - 8) / 12);
    turbulenceIntensity *= windFactor;
    
    // Wake length (typically 5-10 times building height)
    const wakeLength = buildingHeight * (5 + density * 5);
    
    // Vertical mixing strength
    const verticalMixing = turbulenceIntensity * 0.8;
    
    // Cloud formation bonus (turbulence can enhance cloud formation)
    const cloudFormationBonus = turbulenceIntensity * 0.3;

    return {
      turbulenceIntensity,
      wakeLength,
      verticalMixing,
      cloudFormationBonus
    };
  }

  /**
   * Create urban-adapted density configuration
   */
  private createUrbanDensityConfig(urban: UrbanInfo, analysis: TerrainAnalysis): DensityConfig {
    const profile = this.urbanProfiles.get(this.generateProfileId(urban));
    const heatIsland = profile?.heatIsland || this.calculateHeatIslandEffect(urban, analysis);
    const pollution = profile?.pollutionHaze || this.calculatePollutionHazeEffect(urban, analysis);
    const wakes = profile?.buildingWakes || this.calculateBuildingWakeEffect(urban, analysis);

    // Base configuration for urban areas
    const baseConfig: DensityConfig = {
      baseNoise: {
        octaves: 5,
        persistence: 0.6,
        lacunarity: 1.8,
        scale: 0.0006
      },
      detailNoise: {
        octaves: 3,
        persistence: 0.4,
        lacunarity: 2.2,
        scale: 0.003
      },
      turbulenceIntensity: 0.3,
      densityThreshold: 0.25,
      falloffDistance: 0.4
    };

    // Apply heat island effects
    if (heatIsland.intensity > 0) {
      // Heat islands reduce natural cloud formation but increase convection
      baseConfig.densityThreshold += heatIsland.intensity * 0.2;
      baseConfig.turbulenceIntensity += heatIsland.convectionStrength * 0.3;
    }

    // Apply pollution effects
    if (pollution.particleDensity > 0) {
      // Pollution creates artificial cloud-like haze
      baseConfig.baseNoise.persistence += pollution.particleDensity * 0.2;
      baseConfig.densityThreshold -= pollution.particleDensity * 0.15;
    }

    // Apply building wake effects
    if (wakes.turbulenceIntensity > 0) {
      // Building wakes increase turbulence and local cloud formation
      baseConfig.turbulenceIntensity += wakes.turbulenceIntensity * 0.4;
      baseConfig.detailNoise!.scale *= (1 + wakes.verticalMixing * 0.5);
    }

    return baseConfig;
  }

  /**
   * Create urban-adapted generator configuration
   */
  private createUrbanGeneratorConfig(urban: UrbanInfo, analysis: TerrainAnalysis): CloudGeneratorConfig {
    const profile = this.urbanProfiles.get(this.generateProfileId(urban));
    const heatIsland = profile?.heatIsland || this.calculateHeatIslandEffect(urban, analysis);
    const pollution = profile?.pollutionHaze || this.calculatePollutionHazeEffect(urban, analysis);
    const wakes = profile?.buildingWakes || this.calculateBuildingWakeEffect(urban, analysis);

    // Base configuration
    let config: CloudGeneratorConfig = {
      cloudDensity: 0.5,
      noiseScale: 0.0006,
      octaves: 5,
      persistence: 0.6,
      lacunarity: 1.8,
      windDirection: { x: 0.7, y: 0.7 },
      windSpeed: analysis.climate.windSpeed * 0.8 // Reduced wind in urban areas
    };

    // Apply heat island effects
    if (heatIsland.intensity > 0) {
      // Heat islands create updrafts and modify wind patterns
      config.cloudDensity *= (1 - heatIsland.intensity * 0.3 + heatIsland.convectionStrength * 0.2);
      config.windSpeed *= (1 - heatIsland.intensity * 0.2); // Heat islands can reduce surface winds
    }

    // Apply pollution effects
    if (pollution.particleDensity > 0) {
      // Pollution adds to apparent cloud density
      config.cloudDensity += pollution.particleDensity * 0.3;
      config.persistence += pollution.particleDensity * 0.1;
    }

    // Apply building wake effects
    if (wakes.turbulenceIntensity > 0) {
      // Building wakes create local cloud formation
      config.cloudDensity += wakes.cloudFormationBonus;
      config.octaves = Math.min(8, config.octaves + Math.floor(wakes.turbulenceIntensity * 2));
    }

    return config;
  }

  /**
   * Apply urban smog effect to existing cloud density
   */
  public applyUrbanSmogEffect(
    baseDensity: number,
    urban: UrbanInfo,
    analysis: TerrainAnalysis
  ): number {
    const profile = this.createUrbanProfile(analysis);
    const { pollutionHaze, heatIsland } = profile;
    
    let modifiedDensity = baseDensity;
    
    // Add pollution haze
    modifiedDensity += pollutionHaze.particleDensity * 0.4;
    
    // Reduce natural clouds due to heat island
    modifiedDensity *= (1 - heatIsland.intensity * 0.2);
    
    // Add heat-induced convective clouds
    modifiedDensity += heatIsland.convectionStrength * 0.3;
    
    return Math.max(0, Math.min(1, modifiedDensity));
  }

  /**
   * Get urban cloud color modification
   */
  public getUrbanColorModification(urban: UrbanInfo, analysis: TerrainAnalysis): [number, number, number] {
    const profile = this.createUrbanProfile(analysis);
    const { pollutionHaze } = profile;
    
    if (pollutionHaze.particleDensity < 0.1) {
      return [1, 1, 1]; // No color modification
    }
    
    return pollutionHaze.color;
  }

  /**
   * Get urban visibility modification
   */
  public getUrbanVisibilityModification(urban: UrbanInfo, analysis: TerrainAnalysis): number {
    const profile = this.createUrbanProfile(analysis);
    const { pollutionHaze } = profile;
    
    return pollutionHaze.visibility;
  }

  /**
   * Create building-specific cloud effects
   */
  public createBuildingCloudEffects(
    buildingHeight: number,
    buildingWidth: number,
    windDirection: [number, number],
    windSpeed: number
  ): {
    upwindEffect: number;
    downwindEffect: number;
    sideEffect: number;
    wakeLength: number;
  } {
    if (!this.settings.enableBuildingWakes) {
      return {
        upwindEffect: 1,
        downwindEffect: 1,
        sideEffect: 1,
        wakeLength: 0
      };
    }

    // Calculate building effects on airflow
    const buildingReynolds = (windSpeed * buildingHeight) / 15; // Simplified Reynolds number
    const aspectRatio = buildingHeight / buildingWidth;
    
    // Upwind effect (compression and acceleration)
    const upwindEffect = 1 + Math.min(0.5, buildingHeight / 100) * (windSpeed / 10);
    
    // Downwind effect (wake and turbulence)
    const wakeLength = buildingHeight * (3 + Math.min(5, windSpeed));
    const downwindEffect = 0.6 + Math.max(0, 0.4 - buildingHeight / 200);
    
    // Side effect (flow around building)
    const sideEffect = 1 + aspectRatio * 0.2 * (windSpeed / 15);
    
    return {
      upwindEffect,
      downwindEffect,
      sideEffect,
      wakeLength
    };
  }

  /**
   * Generate profile ID for caching
   */
  private generateProfileId(urban: UrbanInfo): string {
    return `urban_${urban.type}_${urban.density.toFixed(2)}_${urban.buildingHeight.toFixed(0)}`;
  }

  /**
   * Update settings
   */
  public updateSettings(newSettings: Partial<UrbanAdaptationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    // Clear cached profiles to force recalculation
    this.urbanProfiles.clear();
  }

  /**
   * Get current settings
   */
  public getSettings(): UrbanAdaptationSettings {
    return { ...this.settings };
  }

  /**
   * Clear cached profiles
   */
  public clearCache(): void {
    this.urbanProfiles.clear();
  }

  /**
   * Get all cached profiles
   */
  public getCachedProfiles(): Map<string, UrbanCloudProfile> {
    return new Map(this.urbanProfiles);
  }
}