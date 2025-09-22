/**
 * Adaptive Cloud Density System
 * Dynamically adjusts cloud density based on map region, terrain, and environmental factors
 */

import { MapBounds } from '../../../types/cloud';
import { TerrainAnalyzer, TerrainAnalysis } from './TerrainAnalyzer';
import { GeographicCloudPatterns } from './GeographicCloudPatterns';
import { DensityConfig, GeographicContext } from '../geometry/DensityCalculator';

export interface DensityAdaptationRule {
  name: string;
  condition: (analysis: TerrainAnalysis) => boolean;
  densityModifier: (baseDensity: number, analysis: TerrainAnalysis) => number;
  priority: number; // Higher priority rules override lower priority ones
}

export interface RegionalDensityProfile {
  regionId: string;
  bounds: MapBounds;
  baseDensity: number;
  adaptationRules: DensityAdaptationRule[];
  environmentalFactors: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    seasonalFactor: number;
    timeOfDayFactor: number;
  };
  lastUpdated: number;
}

export interface MarineFogConfig {
  enabled: boolean;
  intensity: number; // 0-1
  spreadRadius: number; // meters
  dissipationRate: number; // per hour
  temperatureThreshold: number; // Celsius
  humidityThreshold: number; // 0-1
}

export interface UrbanAdaptationConfig {
  heatIslandEffect: boolean;
  pollutionHaze: boolean;
  buildingWakeEffects: boolean;
  intensityMultiplier: number; // 0-2
}

export interface AdaptiveDensityConfig {
  updateInterval: number; // milliseconds
  blendingRadius: number; // meters for smooth transitions
  marineFog: MarineFogConfig;
  urbanAdaptation: UrbanAdaptationConfig;
  enableRealTimeAdaptation: boolean;
  maxDensityVariation: number; // 0-1, maximum allowed density change
}

/**
 * Manages dynamic cloud density adaptation based on geographic and environmental factors
 */
export class AdaptiveCloudDensitySystem {
  private terrainAnalyzer: TerrainAnalyzer;
  private cloudPatterns: GeographicCloudPatterns;
  private config: AdaptiveDensityConfig;
  private densityProfiles: Map<string, RegionalDensityProfile> = new Map();
  private adaptationRules: DensityAdaptationRule[] = [];
  private updateTimer: NodeJS.Timeout | null = null;

  constructor(
    terrainAnalyzer: TerrainAnalyzer,
    cloudPatterns: GeographicCloudPatterns,
    config: AdaptiveDensityConfig = {
      updateInterval: 30000, // 30 seconds
      blendingRadius: 1000, // 1km
      marineFog: {
        enabled: true,
        intensity: 0.8,
        spreadRadius: 5000,
        dissipationRate: 0.1,
        temperatureThreshold: 20,
        humidityThreshold: 0.8
      },
      urbanAdaptation: {
        heatIslandEffect: true,
        pollutionHaze: true,
        buildingWakeEffects: true,
        intensityMultiplier: 1.2
      },
      enableRealTimeAdaptation: true,
      maxDensityVariation: 0.5
    }
  ) {
    this.terrainAnalyzer = terrainAnalyzer;
    this.cloudPatterns = cloudPatterns;
    this.config = config;
    
    this.initializeAdaptationRules();
    
    if (this.config.enableRealTimeAdaptation) {
      this.startRealTimeUpdates();
    }
  }

  /**
   * Get adaptive cloud density for a specific location
   */
  public async getAdaptiveDensity(
    longitude: number,
    latitude: number,
    baseDensity: number = 0.6
  ): Promise<number> {
    // Get terrain analysis for the location
    const analysis = await this.terrainAnalyzer.analyzeLocation(longitude, latitude, 500);
    
    // Apply adaptation rules
    let adaptedDensity = baseDensity;
    
    // Apply rules in priority order
    const applicableRules = this.adaptationRules
      .filter(rule => rule.condition(analysis))
      .sort((a, b) => b.priority - a.priority);
    
    for (const rule of applicableRules) {
      adaptedDensity = rule.densityModifier(adaptedDensity, analysis);
    }

    // Apply marine fog effects if applicable
    if (this.config.marineFog.enabled) {
      adaptedDensity = this.applyMarineFogEffects(adaptedDensity, analysis);
    }

    // Apply urban adaptation effects
    adaptedDensity = this.applyUrbanAdaptationEffects(adaptedDensity, analysis);

    // Apply environmental factors
    adaptedDensity = this.applyEnvironmentalFactors(adaptedDensity, analysis);

    // Clamp to valid range with maximum variation limit
    const maxChange = this.config.maxDensityVariation;
    const minDensity = Math.max(0, baseDensity - maxChange);
    const maxDensity = Math.min(1, baseDensity + maxChange);
    
    return Math.max(minDensity, Math.min(maxDensity, adaptedDensity));
  }

  /**
   * Get density profile for a map region
   */
  public async getRegionalDensityProfile(bounds: MapBounds): Promise<RegionalDensityProfile> {
    const regionId = this.generateRegionId(bounds);
    
    // Check if we have a cached profile
    const existingProfile = this.densityProfiles.get(regionId);
    if (existingProfile && this.isProfileValid(existingProfile)) {
      return existingProfile;
    }

    // Create new profile
    const profile = await this.createRegionalProfile(bounds);
    this.densityProfiles.set(regionId, profile);
    
    return profile;
  }

  /**
   * Create marine fog effects for water bodies
   */
  public createMarineFogEffect(
    waterType: 'ocean' | 'lake' | 'river',
    analysis: TerrainAnalysis
  ): number {
    if (!this.config.marineFog.enabled) {
      return 1.0; // No modification
    }

    const { temperature, humidity } = analysis.climate;
    const { distance: waterDistance } = analysis.waterBody;

    // Check if conditions are right for marine fog
    const temperatureCondition = temperature <= this.config.marineFog.temperatureThreshold;
    const humidityCondition = humidity >= this.config.marineFog.humidityThreshold;
    const proximityCondition = waterDistance <= this.config.marineFog.spreadRadius;

    if (!temperatureCondition || !humidityCondition || !proximityCondition) {
      return 1.0; // No fog conditions
    }

    // Calculate fog intensity based on conditions
    let fogIntensity = this.config.marineFog.intensity;

    // Temperature factor (cooler = more fog)
    const tempFactor = Math.max(0, (this.config.marineFog.temperatureThreshold - temperature) / 10);
    fogIntensity *= (1 + tempFactor * 0.5);

    // Humidity factor
    const humidityFactor = (humidity - this.config.marineFog.humidityThreshold) / (1 - this.config.marineFog.humidityThreshold);
    fogIntensity *= (1 + humidityFactor * 0.3);

    // Distance factor (closer to water = more fog)
    const distanceFactor = 1 - (waterDistance / this.config.marineFog.spreadRadius);
    fogIntensity *= distanceFactor;

    // Water type specific adjustments
    switch (waterType) {
      case 'ocean':
        fogIntensity *= 1.2; // Oceans produce more fog
        break;
      case 'lake':
        fogIntensity *= 1.0; // Lakes produce moderate fog
        break;
      case 'river':
        fogIntensity *= 0.7; // Rivers produce less fog
        break;
    }

    return 1 + fogIntensity;
  }

  /**
   * Create urban cloud pattern adaptations
   */
  public createUrbanCloudAdaptation(analysis: TerrainAnalysis): number {
    const { density: urbanDensity, type: urbanType, buildingHeight } = analysis.urban;
    
    if (urbanDensity < 0.1) {
      return 1.0; // No urban effects
    }

    let adaptationFactor = 1.0;

    // Heat island effect - reduces natural cloud formation
    if (this.config.urbanAdaptation.heatIslandEffect) {
      const heatIslandIntensity = urbanDensity * (buildingHeight / 50);
      adaptationFactor *= (1 - heatIslandIntensity * 0.3);
    }

    // Pollution haze - adds artificial cloud-like effects
    if (this.config.urbanAdaptation.pollutionHaze) {
      const pollutionIntensity = urbanDensity * this.getPollutionFactor(urbanType);
      adaptationFactor += pollutionIntensity * 0.4;
    }

    // Building wake effects - creates turbulence and local cloud formation
    if (this.config.urbanAdaptation.buildingWakeEffects) {
      const wakeIntensity = (buildingHeight / 100) * urbanDensity;
      adaptationFactor += wakeIntensity * 0.2;
    }

    return adaptationFactor * this.config.urbanAdaptation.intensityMultiplier;
  }

  /**
   * Initialize adaptation rules
   */
  private initializeAdaptationRules(): void {
    // Water body proximity rule
    this.adaptationRules.push({
      name: 'Water Proximity',
      condition: (analysis) => analysis.waterBody.distance < 10000,
      densityModifier: (density, analysis) => {
        const proximityFactor = Math.exp(-analysis.waterBody.distance / 5000);
        return density * (1 + proximityFactor * 0.4);
      },
      priority: 5
    });

    // Elevation rule
    this.adaptationRules.push({
      name: 'Elevation Effect',
      condition: (analysis) => analysis.elevation.elevation > 500,
      densityModifier: (density, analysis) => {
        const elevationFactor = Math.min(2, analysis.elevation.elevation / 1000);
        return density * (1 + elevationFactor * 0.3);
      },
      priority: 4
    });

    // Desert aridity rule
    this.adaptationRules.push({
      name: 'Desert Aridity',
      condition: (analysis) => analysis.terrainType.type === 'desert',
      densityModifier: (density, analysis) => {
        const aridityFactor = 1 - analysis.climate.humidity;
        return density * (1 - aridityFactor * 0.7);
      },
      priority: 8
    });

    // Urban heat island rule
    this.adaptationRules.push({
      name: 'Urban Heat Island',
      condition: (analysis) => analysis.urban.density > 0.3,
      densityModifier: (density, analysis) => {
        const heatIslandFactor = analysis.urban.density * 0.4;
        return density * (1 - heatIslandFactor) + heatIslandFactor * 0.6;
      },
      priority: 6
    });

    // Seasonal variation rule
    this.adaptationRules.push({
      name: 'Seasonal Variation',
      condition: () => true, // Always applicable
      densityModifier: (density, analysis) => {
        const seasonalFactor = this.getSeasonalFactor(analysis.climate.season);
        return density * seasonalFactor;
      },
      priority: 2
    });

    // Temperature-humidity interaction rule
    this.adaptationRules.push({
      name: 'Temperature-Humidity Interaction',
      condition: () => true, // Always applicable
      densityModifier: (density, analysis) => {
        const { temperature, humidity } = analysis.climate;
        // Optimal cloud formation at moderate temperatures with high humidity
        const tempFactor = 1 - Math.abs(temperature - 15) / 30; // Optimal at 15°C
        const interactionFactor = tempFactor * humidity;
        return density * (0.7 + interactionFactor * 0.6);
      },
      priority: 3
    });

    // Coastal fog rule
    this.adaptationRules.push({
      name: 'Coastal Fog',
      condition: (analysis) => analysis.terrainType.type === 'coastal',
      densityModifier: (density, analysis) => {
        const coastalFactor = Math.exp(-analysis.waterBody.distance / 2000);
        const temperatureFactor = Math.max(0, (20 - analysis.climate.temperature) / 15);
        return density * (1 + coastalFactor * temperatureFactor * 0.8);
      },
      priority: 7
    });
  }

  /**
   * Apply marine fog effects
   */
  private applyMarineFogEffects(density: number, analysis: TerrainAnalysis): number {
    if (analysis.waterBody.type === 'none') {
      return density;
    }

    const fogEffect = this.createMarineFogEffect(analysis.waterBody.type, analysis);
    return density * fogEffect;
  }

  /**
   * Apply urban adaptation effects
   */
  private applyUrbanAdaptationEffects(density: number, analysis: TerrainAnalysis): number {
    if (analysis.urban.density < 0.1) {
      return density;
    }

    const urbanEffect = this.createUrbanCloudAdaptation(analysis);
    return density * urbanEffect;
  }

  /**
   * Apply environmental factors
   */
  private applyEnvironmentalFactors(density: number, analysis: TerrainAnalysis): number {
    const { temperature, humidity, windSpeed } = analysis.climate;
    
    // Wind dispersal effect
    const windFactor = Math.max(0.5, 1 - (windSpeed - 5) / 20); // Strong winds disperse clouds
    
    // Time of day effect (simplified)
    const hour = new Date().getHours();
    const timeOfDayFactor = this.getTimeOfDayFactor(hour);
    
    return density * windFactor * timeOfDayFactor;
  }

  /**
   * Get seasonal factor for cloud formation
   */
  private getSeasonalFactor(season: 'spring' | 'summer' | 'autumn' | 'winter'): number {
    switch (season) {
      case 'spring':
        return 1.1; // More clouds in spring
      case 'summer':
        return 0.9; // Fewer clouds in summer
      case 'autumn':
        return 1.2; // Most clouds in autumn
      case 'winter':
        return 1.0; // Normal clouds in winter
      default:
        return 1.0;
    }
  }

  /**
   * Get time of day factor
   */
  private getTimeOfDayFactor(hour: number): number {
    // Clouds tend to form more in late afternoon/evening
    if (hour >= 15 && hour <= 19) {
      return 1.2; // Peak cloud formation
    } else if (hour >= 6 && hour <= 10) {
      return 0.8; // Morning dissipation
    } else if (hour >= 22 || hour <= 5) {
      return 1.1; // Night fog formation
    } else {
      return 1.0; // Normal formation
    }
  }

  /**
   * Get pollution factor for urban type
   */
  private getPollutionFactor(urbanType: 'residential' | 'commercial' | 'industrial' | 'rural'): number {
    switch (urbanType) {
      case 'industrial':
        return 1.5; // High pollution
      case 'commercial':
        return 1.2; // Moderate pollution
      case 'residential':
        return 1.0; // Low pollution
      case 'rural':
        return 0.5; // Very low pollution
      default:
        return 1.0;
    }
  }

  /**
   * Create regional density profile
   */
  private async createRegionalProfile(bounds: MapBounds): Promise<RegionalDensityProfile> {
    // Analyze multiple points in the region
    const analyses = await this.terrainAnalyzer.analyzeBounds(bounds);
    
    // Calculate average base density
    let totalDensity = 0;
    for (const analysis of analyses) {
      const localDensity = await this.getAdaptiveDensity(
        (bounds.east + bounds.west) / 2,
        (bounds.north + bounds.south) / 2,
        0.6
      );
      totalDensity += localDensity;
    }
    const baseDensity = totalDensity / analyses.length;

    // Calculate average environmental factors
    const avgClimate = this.calculateAverageClimate(analyses);

    return {
      regionId: this.generateRegionId(bounds),
      bounds,
      baseDensity,
      adaptationRules: [...this.adaptationRules],
      environmentalFactors: {
        temperature: avgClimate.temperature,
        humidity: avgClimate.humidity,
        windSpeed: avgClimate.windSpeed,
        seasonalFactor: this.getSeasonalFactor(avgClimate.season),
        timeOfDayFactor: this.getTimeOfDayFactor(new Date().getHours())
      },
      lastUpdated: Date.now()
    };
  }

  /**
   * Calculate average climate from multiple analyses
   */
  private calculateAverageClimate(analyses: TerrainAnalysis[]) {
    const totals = analyses.reduce(
      (acc, analysis) => ({
        temperature: acc.temperature + analysis.climate.temperature,
        humidity: acc.humidity + analysis.climate.humidity,
        windSpeed: acc.windSpeed + analysis.climate.windSpeed
      }),
      { temperature: 0, humidity: 0, windSpeed: 0 }
    );

    const count = analyses.length;
    return {
      temperature: totals.temperature / count,
      humidity: totals.humidity / count,
      windSpeed: totals.windSpeed / count,
      season: analyses[0]?.climate.season || 'summer'
    };
  }

  /**
   * Generate region ID from bounds
   */
  private generateRegionId(bounds: MapBounds): string {
    const precision = 2;
    return `region_${bounds.north.toFixed(precision)}_${bounds.south.toFixed(precision)}_${bounds.east.toFixed(precision)}_${bounds.west.toFixed(precision)}`;
  }

  /**
   * Check if profile is still valid
   */
  private isProfileValid(profile: RegionalDensityProfile): boolean {
    const age = Date.now() - profile.lastUpdated;
    return age < this.config.updateInterval * 2; // Valid for 2 update cycles
  }

  /**
   * Start real-time updates
   */
  private startRealTimeUpdates(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    this.updateTimer = setInterval(() => {
      this.updateEnvironmentalFactors();
    }, this.config.updateInterval);
  }

  /**
   * Update environmental factors for all profiles
   */
  private updateEnvironmentalFactors(): void {
    const currentHour = new Date().getHours();
    const timeOfDayFactor = this.getTimeOfDayFactor(currentHour);

    for (const profile of this.densityProfiles.values()) {
      profile.environmentalFactors.timeOfDayFactor = timeOfDayFactor;
      profile.lastUpdated = Date.now();
    }
  }

  /**
   * Add custom adaptation rule
   */
  public addAdaptationRule(rule: DensityAdaptationRule): void {
    this.adaptationRules.push(rule);
    this.adaptationRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove adaptation rule by name
   */
  public removeAdaptationRule(name: string): void {
    this.adaptationRules = this.adaptationRules.filter(rule => rule.name !== name);
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<AdaptiveDensityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.enableRealTimeAdaptation !== undefined) {
      if (newConfig.enableRealTimeAdaptation) {
        this.startRealTimeUpdates();
      } else if (this.updateTimer) {
        clearInterval(this.updateTimer);
        this.updateTimer = null;
      }
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): AdaptiveDensityConfig {
    return { ...this.config };
  }

  /**
   * Clear all cached profiles
   */
  public clearCache(): void {
    this.densityProfiles.clear();
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    this.clearCache();
  }
}