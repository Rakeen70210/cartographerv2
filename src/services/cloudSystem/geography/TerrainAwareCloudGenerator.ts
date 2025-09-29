/**
 * Terrain-aware cloud generator
 * Integrates terrain analysis with cloud generation to create contextually appropriate clouds
 */

import { CloudPatch, CloudGeneratorConfig, MapBounds } from '../../../types/cloud';
import { TerrainAnalyzer, TerrainAnalysis } from './TerrainAnalyzer';
import { GeographicCloudPatterns, GeographicCloudStyle } from './GeographicCloudPatterns';
import { CloudDensityCalculator, DensityConfig, GeographicContext } from '../geometry/DensityCalculator';
import { CloudGeometryGenerator } from '../geometry/CloudGeometry';
import { IProceduralCloudGenerator } from '../interfaces';

export interface TerrainAwareGeneratorConfig {
  enableTerrainAnalysis: boolean;
  cacheAnalysisResults: boolean;
  adaptationIntensity: number; // 0-1, how much terrain affects clouds
  blendRadius: number; // meters, radius for blending between different terrain types
  updateFrequency: number; // milliseconds, how often to update terrain analysis
}

export interface CloudRegion {
  id: string;
  bounds: MapBounds;
  terrainAnalysis: TerrainAnalysis;
  cloudStyle: GeographicCloudStyle;
  densityConfig: DensityConfig;
  generatorConfig: CloudGeneratorConfig;
  lastUpdated: number;
}

/**
 * Advanced cloud generator that adapts to terrain and geographic context
 */
export class TerrainAwareCloudGenerator implements IProceduralCloudGenerator {
  private terrainAnalyzer: TerrainAnalyzer;
  private cloudPatterns: GeographicCloudPatterns;
  private densityCalculator: CloudDensityCalculator;
  private config: TerrainAwareGeneratorConfig;
  private cloudRegions: Map<string, CloudRegion> = new Map();
  private analysisCache: Map<string, TerrainAnalysis> = new Map();

  constructor(
    config: TerrainAwareGeneratorConfig = {
      enableTerrainAnalysis: true,
      cacheAnalysisResults: true,
      adaptationIntensity: 0.8,
      blendRadius: 2000,
      updateFrequency: 60000 // 1 minute
    },
    seed: number = 12345
  ) {
    this.config = config;
    this.terrainAnalyzer = new TerrainAnalyzer();
    this.cloudPatterns = new GeographicCloudPatterns();
    this.densityCalculator = new CloudDensityCalculator(seed);
  }

  /**
   * Generate a cloud patch with terrain awareness
   */
  public async generateCloudPatch(bounds: MapBounds, baseConfig: CloudGeneratorConfig): Promise<CloudPatch> {
    if (!this.config.enableTerrainAnalysis) {
      return this.generateBasicCloudPatch(bounds, baseConfig);
    }

    // Get or create cloud region for this area
    const region = await this.getOrCreateCloudRegion(bounds);
    
    // Use terrain-adapted configuration
    const adaptedConfig = this.blendConfigurations(baseConfig, region.generatorConfig, this.config.adaptationIntensity);
    
    // Generate cloud patch with geographic context
    return this.generateContextualCloudPatch(bounds, adaptedConfig, region.terrainAnalysis);
  }

  /**
   * Update cloud density based on terrain context
   */
  public updateCloudDensity(patch: CloudPatch, density: number): void {
    // Find the region this patch belongs to
    const region = this.findRegionForPatch(patch);
    
    if (region) {
      // Apply terrain-specific density modifications
      const modifiedDensity = this.applyTerrainDensityModifications(density, region.terrainAnalysis);
      
      // Update the patch density map
      for (let i = 0; i < patch.densityMap.length; i++) {
        patch.densityMap[i] = Math.max(0, Math.min(1, patch.densityMap[i] * modifiedDensity));
      }
    }
  }

  /**
   * Generate noise pattern with terrain awareness
   */
  public generateNoisePattern(
    width: number,
    height: number,
    config: CloudGeneratorConfig
  ): Float32Array {
    // For noise patterns, we use the base configuration
    // Terrain awareness is applied at the patch level
    return this.densityCalculator.calculateDensityField(
      { minX: 0, minY: 0, maxX: width, maxY: height },
      Math.max(width, height),
      this.configToNoiseConfig(config)
    );
  }

  /**
   * Calculate cloud coverage for a geographic area
   */
  public async calculateCloudCoverage(area: { center: [number, number]; radius: number }): Promise<number> {
    const [longitude, latitude] = area.center;
    
    if (!this.config.enableTerrainAnalysis) {
      return 0.6; // Default coverage
    }

    // Analyze terrain for the area
    const analysis = await this.terrainAnalyzer.analyzeLocation(longitude, latitude, area.radius);
    
    // Get cloud configuration for this terrain
    const { adaptedConfig } = this.cloudPatterns.getCloudConfigForTerrain(analysis);
    
    // Calculate coverage based on terrain-adapted density
    const baseCoverage = 1 - adaptedConfig.densityThreshold;
    const terrainModifier = this.calculateTerrainCoverageModifier(analysis);
    
    return Math.max(0, Math.min(1, baseCoverage * terrainModifier));
  }

  /**
   * Get or create a cloud region for the given bounds
   */
  private async getOrCreateCloudRegion(bounds: MapBounds): Promise<CloudRegion> {
    const regionId = this.generateRegionId(bounds);
    
    // Check if region exists and is still valid
    const existingRegion = this.cloudRegions.get(regionId);
    if (existingRegion && this.isRegionValid(existingRegion)) {
      return existingRegion;
    }

    // Create new region
    const centerLng = (bounds.east + bounds.west) / 2;
    const centerLat = (bounds.north + bounds.south) / 2;
    
    // Analyze terrain for the region center
    const terrainAnalysis = await this.terrainAnalyzer.analyzeLocation(centerLng, centerLat, 1000);
    
    // Get appropriate cloud configuration
    const { style, adaptedConfig, adaptedGenerator } = this.cloudPatterns.getCloudConfigForTerrain(terrainAnalysis);
    
    const region: CloudRegion = {
      id: regionId,
      bounds,
      terrainAnalysis,
      cloudStyle: style,
      densityConfig: adaptedConfig,
      generatorConfig: adaptedGenerator,
      lastUpdated: Date.now()
    };

    this.cloudRegions.set(regionId, region);
    
    // Clean up old regions
    this.cleanupOldRegions();
    
    return region;
  }

  /**
   * Generate a basic cloud patch without terrain analysis
   */
  private generateBasicCloudPatch(bounds: MapBounds, config: CloudGeneratorConfig): CloudPatch {
    const densityConfig = this.configToNoiseConfig(config);
    const resolution = 32; // Default resolution
    
    // Generate density field
    const densityField = this.densityCalculator.calculateDensityField(
      {
        minX: bounds.west,
        minY: bounds.south,
        maxX: bounds.east,
        maxY: bounds.north
      },
      resolution,
      densityConfig
    );

    // Create vertices and geometry
    return this.createCloudPatchFromDensity(bounds, densityField, resolution);
  }

  /**
   * Generate a contextual cloud patch with terrain analysis
   */
  private generateContextualCloudPatch(
    bounds: MapBounds,
    config: CloudGeneratorConfig,
    terrainAnalysis: TerrainAnalysis
  ): CloudPatch {
    const densityConfig = this.configToNoiseConfig(config);
    const resolution = this.getResolutionForTerrain(terrainAnalysis);
    
    // Generate density field with geographic context
    const densityField = this.densityCalculator.calculateDensityField(
      {
        minX: bounds.west,
        minY: bounds.south,
        maxX: bounds.east,
        maxY: bounds.north
      },
      resolution,
      densityConfig,
      terrainAnalysis.geographicContext
    );

    // Apply terrain-specific modifications
    this.applyTerrainSpecificEffects(densityField, terrainAnalysis, resolution);

    return this.createCloudPatchFromDensity(bounds, densityField, resolution);
  }

  /**
   * Apply terrain-specific effects to density field
   */
  private applyTerrainSpecificEffects(
    densityField: Float32Array,
    terrainAnalysis: TerrainAnalysis,
    resolution: number
  ): void {
    const terrainType = terrainAnalysis.terrainType.type;
    
    switch (terrainType) {
      case 'water':
        this.applyMarineFogEffects(densityField, terrainAnalysis, resolution);
        break;
      case 'mountain':
        this.applyOrographicEffects(densityField, terrainAnalysis, resolution);
        break;
      case 'urban':
        this.applyUrbanHeatIslandEffects(densityField, terrainAnalysis, resolution);
        break;
      case 'desert':
        this.applyAridClimateEffects(densityField, terrainAnalysis, resolution);
        break;
      case 'coastal':
        this.applyCoastalEffects(densityField, terrainAnalysis, resolution);
        break;
    }
  }

  /**
   * Apply marine fog effects for water bodies
   */
  private applyMarineFogEffects(
    densityField: Float32Array,
    terrainAnalysis: TerrainAnalysis,
    resolution: number
  ): void {
    const humidity = terrainAnalysis.climate.humidity;
    const temperature = terrainAnalysis.climate.temperature;
    
    // Marine fog is more likely in cool, humid conditions
    const fogFactor = humidity * (1 - Math.max(0, (temperature - 15) / 20));
    
    for (let i = 0; i < densityField.length; i++) {
      densityField[i] *= (1 + fogFactor * 0.5);
    }
  }

  /**
   * Apply orographic effects for mountainous terrain
   */
  private applyOrographicEffects(
    densityField: Float32Array,
    terrainAnalysis: TerrainAnalysis,
    resolution: number
  ): void {
    const elevation = terrainAnalysis.elevation.elevation;
    const slope = terrainAnalysis.elevation.slope;
    
    // Higher elevations and steeper slopes create more clouds
    const orographicFactor = (elevation / 2000) + (slope / 45) * 0.3;
    
    for (let i = 0; i < densityField.length; i++) {
      densityField[i] *= (1 + orographicFactor * 0.4);
    }
  }

  /**
   * Apply urban heat island effects
   */
  private applyUrbanHeatIslandEffects(
    densityField: Float32Array,
    terrainAnalysis: TerrainAnalysis,
    resolution: number
  ): void {
    const urbanDensity = terrainAnalysis.urban.density;
    const buildingHeight = terrainAnalysis.urban.buildingHeight;
    
    // Urban areas tend to have less natural cloud formation but more pollution
    const heatIslandFactor = urbanDensity * (buildingHeight / 100);
    
    for (let i = 0; i < densityField.length; i++) {
      // Reduce natural cloud density but add urban haze
      densityField[i] = densityField[i] * (1 - heatIslandFactor * 0.3) + heatIslandFactor * 0.4;
    }
  }

  /**
   * Apply arid climate effects for desert regions
   */
  private applyAridClimateEffects(
    densityField: Float32Array,
    terrainAnalysis: TerrainAnalysis,
    resolution: number
  ): void {
    const humidity = terrainAnalysis.climate.humidity;
    const temperature = terrainAnalysis.climate.temperature;
    
    // Desert regions have very low cloud formation
    const aridityFactor = (1 - humidity) * Math.max(0, (temperature - 20) / 30);
    
    for (let i = 0; i < densityField.length; i++) {
      densityField[i] *= (1 - aridityFactor * 0.7);
    }
  }

  /**
   * Apply coastal effects
   */
  private applyCoastalEffects(
    densityField: Float32Array,
    terrainAnalysis: TerrainAnalysis,
    resolution: number
  ): void {
    const waterDistance = terrainAnalysis.waterBody.distance;
    const humidity = terrainAnalysis.climate.humidity;
    
    // Coastal areas have moderate fog formation
    const coastalFactor = Math.exp(-waterDistance / 5000) * humidity;
    
    for (let i = 0; i < densityField.length; i++) {
      densityField[i] *= (1 + coastalFactor * 0.3);
    }
  }

  /**
   * Get appropriate resolution based on terrain type
   */
  private getResolutionForTerrain(terrainAnalysis: TerrainAnalysis): number {
    const terrainType = terrainAnalysis.terrainType.type;
    
    switch (terrainType) {
      case 'mountain':
        return 64; // Higher resolution for complex mountain clouds
      case 'urban':
        return 48; // Medium-high resolution for urban detail
      case 'water':
        return 32; // Medium resolution for marine fog
      case 'desert':
        return 24; // Lower resolution for sparse desert clouds
      default:
        return 32; // Default resolution
    }
  }

  /**
   * Create cloud patch from density field
   */
  private createCloudPatchFromDensity(
    bounds: MapBounds,
    densityField: Float32Array,
    resolution: number
  ): CloudPatch {
    // Convert bounds to world coordinates (simplified)
    const worldBounds = {
      minX: bounds.west * 111320, // Rough conversion to meters
      minY: bounds.south * 110540,
      maxX: bounds.east * 111320,
      maxY: bounds.north * 110540
    };

    // Create vertices
    const vertices = new Float32Array(resolution * resolution * 3);
    const texCoords = new Float32Array(resolution * resolution * 2);
    const indices = new Uint16Array((resolution - 1) * (resolution - 1) * 6);

    const stepX = (worldBounds.maxX - worldBounds.minX) / (resolution - 1);
    const stepY = (worldBounds.maxY - worldBounds.minY) / (resolution - 1);

    // Generate vertices
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const index = y * resolution + x;
        const density = densityField[index];
        
        vertices[index * 3] = worldBounds.minX + x * stepX;
        vertices[index * 3 + 1] = worldBounds.minY + y * stepY;
        vertices[index * 3 + 2] = density * 100; // Scale density to elevation
        
        texCoords[index * 2] = x / (resolution - 1);
        texCoords[index * 2 + 1] = y / (resolution - 1);
      }
    }

    // Generate indices
    let indexOffset = 0;
    for (let y = 0; y < resolution - 1; y++) {
      for (let x = 0; x < resolution - 1; x++) {
        const topLeft = y * resolution + x;
        const topRight = topLeft + 1;
        const bottomLeft = (y + 1) * resolution + x;
        const bottomRight = bottomLeft + 1;

        // First triangle
        indices[indexOffset++] = topLeft;
        indices[indexOffset++] = bottomLeft;
        indices[indexOffset++] = topRight;

        // Second triangle
        indices[indexOffset++] = topRight;
        indices[indexOffset++] = bottomLeft;
        indices[indexOffset++] = bottomRight;
      }
    }

    return {
      id: `terrain_patch_${Date.now()}`,
      bounds: {
        minX: bounds.west,
        minY: bounds.south,
        maxX: bounds.east,
        maxY: bounds.north
      },
      vertices,
      indices,
      densityMap: densityField,
      textureCoords: texCoords
    };
  }

  /**
   * Convert CloudGeneratorConfig to DensityConfig
   */
  private configToNoiseConfig(config: CloudGeneratorConfig): DensityConfig {
    return {
      baseNoise: {
        octaves: config.octaves,
        persistence: config.persistence,
        lacunarity: config.lacunarity,
        scale: config.noiseScale
      },
      turbulenceIntensity: 0.3,
      densityThreshold: 1 - config.cloudDensity,
      falloffDistance: 0.3
    };
  }

  /**
   * Blend two configurations
   */
  private blendConfigurations(
    config1: CloudGeneratorConfig,
    config2: CloudGeneratorConfig,
    blendFactor: number
  ): CloudGeneratorConfig {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    return {
      cloudDensity: lerp(config1.cloudDensity, config2.cloudDensity, blendFactor),
      noiseScale: lerp(config1.noiseScale, config2.noiseScale, blendFactor),
      octaves: Math.round(lerp(config1.octaves, config2.octaves, blendFactor)),
      persistence: lerp(config1.persistence, config2.persistence, blendFactor),
      lacunarity: lerp(config1.lacunarity, config2.lacunarity, blendFactor),
      windDirection: {
        x: lerp(config1.windDirection.x, config2.windDirection.x, blendFactor),
        y: lerp(config1.windDirection.y, config2.windDirection.y, blendFactor)
      },
      windSpeed: lerp(config1.windSpeed, config2.windSpeed, blendFactor)
    };
  }

  /**
   * Generate region ID from bounds
   */
  private generateRegionId(bounds: MapBounds): string {
    const precision = 3; // 3 decimal places
    return `${bounds.north.toFixed(precision)}_${bounds.south.toFixed(precision)}_${bounds.east.toFixed(precision)}_${bounds.west.toFixed(precision)}`;
  }

  /**
   * Check if region is still valid
   */
  private isRegionValid(region: CloudRegion): boolean {
    const age = Date.now() - region.lastUpdated;
    return age < this.config.updateFrequency;
  }

  /**
   * Find region for a given patch
   */
  private findRegionForPatch(patch: CloudPatch): CloudRegion | null {
    for (const region of this.cloudRegions.values()) {
      if (this.patchIntersectsRegion(patch, region)) {
        return region;
      }
    }
    return null;
  }

  /**
   * Check if patch intersects with region
   */
  private patchIntersectsRegion(patch: CloudPatch, region: CloudRegion): boolean {
    const patchBounds = patch.bounds;
    const regionBounds = region.bounds;
    
    return !(patchBounds.maxX < regionBounds.west ||
             patchBounds.minX > regionBounds.east ||
             patchBounds.maxY < regionBounds.south ||
             patchBounds.minY > regionBounds.north);
  }

  /**
   * Apply terrain density modifications
   */
  private applyTerrainDensityModifications(density: number, analysis: TerrainAnalysis): number {
    let modifiedDensity = density;
    
    // Apply geographic context modifications
    const context = analysis.geographicContext;
    
    // Elevation effects
    const elevationFactor = 1 + (context.elevation / 1000) * 0.3;
    modifiedDensity *= elevationFactor;
    
    // Water proximity effects
    const waterFactor = 1 + Math.exp(-context.waterDistance / 5000) * 0.5;
    modifiedDensity *= waterFactor;
    
    // Urban effects
    const urbanFactor = 1 - context.urbanDensity * 0.2;
    modifiedDensity *= urbanFactor;
    
    return Math.max(0, Math.min(1, modifiedDensity));
  }

  /**
   * Calculate terrain coverage modifier
   */
  private calculateTerrainCoverageModifier(analysis: TerrainAnalysis): number {
    const terrainType = analysis.terrainType.type;
    
    switch (terrainType) {
      case 'water':
        return 1.2; // More coverage over water
      case 'mountain':
        return 1.1; // Slightly more coverage in mountains
      case 'desert':
        return 0.3; // Much less coverage in deserts
      case 'urban':
        return 0.7; // Reduced coverage in urban areas
      case 'forest':
        return 1.0; // Normal coverage
      default:
        return 0.8; // Slightly reduced default coverage
    }
  }

  /**
   * Clean up old regions
   */
  private cleanupOldRegions(): void {
    const maxRegions = 50;
    const now = Date.now();
    
    if (this.cloudRegions.size <= maxRegions) {
      return;
    }

    // Remove oldest regions
    const regions = Array.from(this.cloudRegions.entries())
      .sort(([, a], [, b]) => a.lastUpdated - b.lastUpdated);
    
    const toRemove = regions.slice(0, regions.length - maxRegions);
    
    for (const [id] of toRemove) {
      this.cloudRegions.delete(id);
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.cloudRegions.clear();
    this.analysisCache.clear();
    this.terrainAnalyzer.clearCache();
  }
}