/**
 * Terrain analysis system for geographic context-aware cloud generation
 * Analyzes map regions to determine terrain type, elevation, and environmental factors
 */

import { MapBounds } from '../../../types';
import { GeographicContext } from '../geometry/DensityCalculator';

export interface TerrainType {
  type: 'water' | 'land' | 'urban' | 'mountain' | 'desert' | 'forest' | 'coastal';
  confidence: number; // 0-1
}

export interface ElevationData {
  elevation: number; // meters above sea level
  slope: number; // degrees
  aspect: number; // degrees (0-360, north = 0)
}

export interface WaterBodyInfo {
  distance: number; // meters to nearest water
  type: 'ocean' | 'lake' | 'river' | 'none';
  size: 'small' | 'medium' | 'large';
}

export interface UrbanInfo {
  density: number; // 0-1, urban density
  type: 'residential' | 'commercial' | 'industrial' | 'rural';
  buildingHeight: number; // average building height in meters
}

export interface ClimateInfo {
  temperature: number; // Celsius
  humidity: number; // 0-1
  windSpeed: number; // m/s
  windDirection: number; // degrees
  season: 'spring' | 'summer' | 'autumn' | 'winter';
}

export interface TerrainAnalysis {
  terrainType: TerrainType;
  elevation: ElevationData;
  waterBody: WaterBodyInfo;
  urban: UrbanInfo;
  climate: ClimateInfo;
  geographicContext: GeographicContext;
}

/**
 * Analyzes terrain and geographic features to provide context for cloud generation
 */
export class TerrainAnalyzer {
  private elevationCache: Map<string, ElevationData> = new Map();
  private terrainCache: Map<string, TerrainAnalysis> = new Map();
  private cacheTimeout = 300000; // 5 minutes

  /**
   * Analyze terrain at a specific geographic location
   */
  public async analyzeLocation(
    longitude: number,
    latitude: number,
    radius: number = 1000
  ): Promise<TerrainAnalysis> {
    const cacheKey = `${longitude.toFixed(4)}_${latitude.toFixed(4)}_${radius}`;
    
    // Check cache first
    const cached = this.terrainCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Perform analysis
    const analysis = await this.performTerrainAnalysis(longitude, latitude, radius);
    
    // Cache result
    this.terrainCache.set(cacheKey, analysis);
    
    // Schedule cache cleanup
    setTimeout(() => {
      this.terrainCache.delete(cacheKey);
    }, this.cacheTimeout);

    return analysis;
  }

  /**
   * Analyze terrain for a map bounds area
   */
  public async analyzeBounds(bounds: MapBounds): Promise<TerrainAnalysis[]> {
    const analyses: TerrainAnalysis[] = [];
    
    // Sample points across the bounds
    const sampleCount = 9; // 3x3 grid
    const latStep = (bounds.north - bounds.south) / 2;
    const lngStep = (bounds.east - bounds.west) / 2;

    for (let latIndex = 0; latIndex < 3; latIndex++) {
      for (let lngIndex = 0; lngIndex < 3; lngIndex++) {
        const lat = bounds.south + latIndex * latStep;
        const lng = bounds.west + lngIndex * lngStep;
        
        const analysis = await this.analyzeLocation(lng, lat, 500);
        analyses.push(analysis);
      }
    }

    return analyses;
  }

  /**
   * Get dominant terrain type for a region
   */
  public getDominantTerrain(analyses: TerrainAnalysis[]): TerrainType {
    const terrainCounts = new Map<string, { count: number; confidence: number }>();

    for (const analysis of analyses) {
      const type = analysis.terrainType.type;
      const existing = terrainCounts.get(type) || { count: 0, confidence: 0 };
      
      terrainCounts.set(type, {
        count: existing.count + 1,
        confidence: existing.confidence + analysis.terrainType.confidence
      });
    }

    let dominantType = 'land';
    let maxScore = 0;

    for (const [type, data] of terrainCounts) {
      const score = data.count * (data.confidence / data.count);
      if (score > maxScore) {
        maxScore = score;
        dominantType = type;
      }
    }

    return {
      type: dominantType as TerrainType['type'],
      confidence: maxScore / analyses.length
    };
  }

  /**
   * Perform the actual terrain analysis
   */
  private async performTerrainAnalysis(
    longitude: number,
    latitude: number,
    radius: number
  ): Promise<TerrainAnalysis> {
    // Get elevation data
    const elevation = await this.getElevationData(longitude, latitude);
    
    // Determine terrain type
    const terrainType = this.classifyTerrain(longitude, latitude, elevation);
    
    // Analyze water bodies
    const waterBody = this.analyzeWaterBodies(longitude, latitude);
    
    // Analyze urban features
    const urban = this.analyzeUrbanFeatures(longitude, latitude);
    
    // Get climate information
    const climate = this.getClimateInfo(longitude, latitude);

    // Create geographic context
    const geographicContext: GeographicContext = {
      elevation: elevation.elevation,
      waterDistance: waterBody.distance,
      urbanDensity: urban.density,
      temperature: climate.temperature,
      humidity: climate.humidity
    };

    return {
      terrainType,
      elevation,
      waterBody,
      urban,
      climate,
      geographicContext
    };
  }

  /**
   * Get elevation data for a location (simplified implementation)
   */
  private async getElevationData(longitude: number, latitude: number): Promise<ElevationData> {
    const cacheKey = `elev_${longitude.toFixed(4)}_${latitude.toFixed(4)}`;
    
    if (this.elevationCache.has(cacheKey)) {
      return this.elevationCache.get(cacheKey)!;
    }

    // Simplified elevation calculation based on geographic patterns
    // In a real implementation, this would query elevation APIs or datasets
    let elevation = 0;
    
    // Simulate elevation based on latitude (mountains tend to be at certain latitudes)
    const absLat = Math.abs(latitude);
    if (absLat > 40 && absLat < 70) {
      // Mountain regions
      elevation = Math.random() * 2000 + 500;
    } else if (absLat < 30) {
      // Tropical/coastal regions
      elevation = Math.random() * 200;
    } else {
      // Temperate regions
      elevation = Math.random() * 800 + 100;
    }

    // Add some noise based on longitude for variety
    const longitudeNoise = Math.sin(longitude * 0.1) * 200;
    elevation += longitudeNoise;

    // Ensure non-negative elevation
    elevation = Math.max(0, elevation);

    const elevationData: ElevationData = {
      elevation,
      slope: Math.random() * 30, // Random slope 0-30 degrees
      aspect: Math.random() * 360 // Random aspect
    };

    this.elevationCache.set(cacheKey, elevationData);
    return elevationData;
  }

  /**
   * Classify terrain type based on location and elevation
   */
  private classifyTerrain(
    longitude: number,
    latitude: number,
    elevation: ElevationData
  ): TerrainType {
    // Simplified terrain classification
    // In practice, this would use land cover datasets
    
    if (elevation.elevation > 1500) {
      return { type: 'mountain', confidence: 0.9 };
    }
    
    if (elevation.elevation < 10) {
      // Near sea level - could be water or coastal
      const coastalProb = Math.random();
      if (coastalProb > 0.7) {
        return { type: 'water', confidence: 0.8 };
      } else {
        return { type: 'coastal', confidence: 0.7 };
      }
    }

    // Check for urban areas (simplified - based on population density heuristics)
    const urbanProb = this.getUrbanProbability(longitude, latitude);
    if (urbanProb > 0.6) {
      return { type: 'urban', confidence: urbanProb };
    }

    // Check for desert regions (simplified - based on latitude and longitude)
    if (this.isDesertRegion(longitude, latitude)) {
      return { type: 'desert', confidence: 0.8 };
    }

    // Default to land/forest
    return { type: 'forest', confidence: 0.6 };
  }

  /**
   * Analyze water bodies near the location
   */
  private analyzeWaterBodies(longitude: number, latitude: number): WaterBodyInfo {
    // Simplified water body analysis
    // In practice, this would use hydrographic datasets
    
    const distanceToCoast = this.getDistanceToCoast(longitude, latitude);
    
    if (distanceToCoast < 1000) {
      return {
        distance: distanceToCoast,
        type: 'ocean',
        size: 'large'
      };
    }

    // Check for inland water bodies
    const inlandWaterDistance = this.getInlandWaterDistance(longitude, latitude);
    
    if (inlandWaterDistance < 5000) {
      return {
        distance: inlandWaterDistance,
        type: inlandWaterDistance < 1000 ? 'lake' : 'river',
        size: inlandWaterDistance < 500 ? 'large' : 'medium'
      };
    }

    return {
      distance: Math.min(distanceToCoast, inlandWaterDistance),
      type: 'none',
      size: 'small'
    };
  }

  /**
   * Analyze urban features
   */
  private analyzeUrbanFeatures(longitude: number, latitude: number): UrbanInfo {
    const urbanDensity = this.getUrbanProbability(longitude, latitude);
    
    let type: UrbanInfo['type'] = 'rural';
    let buildingHeight = 5;

    if (urbanDensity > 0.8) {
      type = 'commercial';
      buildingHeight = 50;
    } else if (urbanDensity > 0.6) {
      type = 'residential';
      buildingHeight = 15;
    } else if (urbanDensity > 0.4) {
      type = 'industrial';
      buildingHeight = 10;
    }

    return {
      density: urbanDensity,
      type,
      buildingHeight
    };
  }

  /**
   * Get climate information for location
   */
  private getClimateInfo(longitude: number, latitude: number): ClimateInfo {
    // Simplified climate model based on latitude
    const absLat = Math.abs(latitude);
    
    // Temperature based on latitude
    let temperature = 30 - (absLat * 0.6); // Rough temperature gradient
    
    // Seasonal variation (simplified)
    const dayOfYear = new Date().getDayOfYear();
    const seasonalVariation = Math.sin((dayOfYear / 365) * 2 * Math.PI) * 10;
    temperature += seasonalVariation;

    // Humidity based on proximity to water and latitude
    const waterDistance = this.getDistanceToCoast(longitude, latitude);
    let humidity = 0.7 - (waterDistance / 50000); // Decrease with distance from water
    humidity = Math.max(0.2, Math.min(0.9, humidity));

    // Wind patterns (simplified)
    const windSpeed = 5 + Math.random() * 10; // 5-15 m/s
    const windDirection = Math.random() * 360;

    // Determine season
    const month = new Date().getMonth();
    let season: ClimateInfo['season'];
    if (month >= 2 && month <= 4) season = 'spring';
    else if (month >= 5 && month <= 7) season = 'summer';
    else if (month >= 8 && month <= 10) season = 'autumn';
    else season = 'winter';

    return {
      temperature,
      humidity,
      windSpeed,
      windDirection,
      season
    };
  }

  /**
   * Get urban probability for a location (simplified heuristic)
   */
  private getUrbanProbability(longitude: number, latitude: number): number {
    // Simplified urban detection based on known urban coordinates
    // In practice, this would use population density datasets
    
    const majorCities = [
      { lat: 40.7128, lng: -74.0060, density: 0.9 }, // New York
      { lat: 34.0522, lng: -118.2437, density: 0.8 }, // Los Angeles
      { lat: 51.5074, lng: -0.1278, density: 0.9 }, // London
      { lat: 35.6762, lng: 139.6503, density: 0.95 }, // Tokyo
      // Add more cities as needed
    ];

    let maxDensity = 0;
    
    for (const city of majorCities) {
      const distance = this.calculateDistance(latitude, longitude, city.lat, city.lng);
      if (distance < 100000) { // Within 100km
        const densityFactor = Math.exp(-distance / 20000); // Exponential decay
        const adjustedDensity = city.density * densityFactor;
        maxDensity = Math.max(maxDensity, adjustedDensity);
      }
    }

    return maxDensity;
  }

  /**
   * Check if location is in a desert region
   */
  private isDesertRegion(longitude: number, latitude: number): boolean {
    // Simplified desert detection based on known desert regions
    const desertRegions = [
      { lat: 25, lng: -115, radius: 500000 }, // Sonoran Desert
      { lat: 30, lng: 35, radius: 1000000 }, // Arabian Desert
      { lat: -25, lng: 135, radius: 800000 }, // Australian Outback
      // Add more desert regions as needed
    ];

    for (const desert of desertRegions) {
      const distance = this.calculateDistance(latitude, longitude, desert.lat, desert.lng);
      if (distance < desert.radius) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get distance to nearest coast (simplified)
   */
  private getDistanceToCoast(longitude: number, latitude: number): number {
    // Simplified coastal distance calculation
    // In practice, this would use coastline datasets
    
    // Rough approximation based on continental boundaries
    const continentalInteriors = [
      { lat: 40, lng: -100, radius: 1000000 }, // North America interior
      { lat: 55, lng: 100, radius: 2000000 }, // Asia interior
      { lat: -15, lng: -60, radius: 800000 }, // South America interior
    ];

    let minDistanceToCoast = 50000; // Default 50km from coast

    for (const interior of continentalInteriors) {
      const distance = this.calculateDistance(latitude, longitude, interior.lat, interior.lng);
      if (distance < interior.radius) {
        const interiorFactor = 1 - (distance / interior.radius);
        const additionalDistance = interiorFactor * 1500000; // Up to 1500km inland
        minDistanceToCoast = Math.max(minDistanceToCoast, additionalDistance);
      }
    }

    return minDistanceToCoast;
  }

  /**
   * Get distance to inland water bodies
   */
  private getInlandWaterDistance(longitude: number, latitude: number): number {
    // Simplified inland water detection
    const majorLakes = [
      { lat: 46.8, lng: -84.5, radius: 50000 }, // Lake Superior
      { lat: 61.5, lng: -159.5, radius: 30000 }, // Lake Iliamna
      // Add more major lakes and rivers
    ];

    let minDistance = 100000; // Default 100km from water

    for (const lake of majorLakes) {
      const distance = this.calculateDistance(latitude, longitude, lake.lat, lake.lng);
      minDistance = Math.min(minDistance, Math.max(0, distance - lake.radius));
    }

    return minDistance;
  }

  /**
   * Calculate distance between two geographic points using Haversine formula
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.elevationCache.clear();
    this.terrainCache.clear();
  }
}

// Extend Date prototype for day of year calculation
declare global {
  interface Date {
    getDayOfYear(): number;
  }
}

Date.prototype.getDayOfYear = function(): number {
  const start = new Date(this.getFullYear(), 0, 0);
  const diff = this.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
};