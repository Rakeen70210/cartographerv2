/**
 * Tests for TerrainAwareCloudGenerator
 */

import { TerrainAwareCloudGenerator } from '../TerrainAwareCloudGenerator';
import { MapBounds, CloudGeneratorConfig } from '../../../../types/cloud';

describe('TerrainAwareCloudGenerator', () => {
  let generator: TerrainAwareCloudGenerator;
  
  beforeEach(() => {
    generator = new TerrainAwareCloudGenerator({
      enableTerrainAnalysis: true,
      cacheAnalysisResults: true,
      adaptationIntensity: 0.8,
      blendRadius: 2000,
      updateFrequency: 60000
    });
  });

  afterEach(() => {
    generator.dispose();
  });

  describe('generateCloudPatch', () => {
    it('should generate a cloud patch with terrain awareness', async () => {
      const bounds: MapBounds = {
        north: 40.7589,
        south: 40.7489,
        east: -73.9741,
        west: -73.9841
      };

      const config: CloudGeneratorConfig = {
        cloudDensity: 0.6,
        noiseScale: 0.001,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        windDirection: { x: 1, y: 0 },
        windSpeed: 2
      };

      const patch = await generator.generateCloudPatch(bounds, config);

      expect(patch).toBeDefined();
      expect(patch.id).toBeDefined();
      expect(patch.vertices).toBeInstanceOf(Float32Array);
      expect(patch.indices).toBeInstanceOf(Uint16Array);
      expect(patch.densityMap).toBeInstanceOf(Float32Array);
      expect(patch.vertexCount).toBeGreaterThan(0);
      expect(patch.indexCount).toBeGreaterThan(0);
    });

    it('should generate different patches for different terrain types', async () => {
      const oceanBounds: MapBounds = {
        north: 40.7589,
        south: 40.7489,
        east: -73.9741,
        west: -73.9841
      };

      const mountainBounds: MapBounds = {
        north: 46.8589,
        south: 46.8489,
        east: -121.7741,
        west: -121.7841
      };

      const config: CloudGeneratorConfig = {
        cloudDensity: 0.6,
        noiseScale: 0.001,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        windDirection: { x: 1, y: 0 },
        windSpeed: 2
      };

      const oceanPatch = await generator.generateCloudPatch(oceanBounds, config);
      const mountainPatch = await generator.generateCloudPatch(mountainBounds, config);

      // Patches should have different characteristics
      expect(oceanPatch.id).not.toBe(mountainPatch.id);
      
      // Ocean areas might have different density patterns than mountains
      const oceanAvgDensity = Array.from(oceanPatch.densityMap).reduce((a, b) => a + b, 0) / oceanPatch.densityMap.length;
      const mountainAvgDensity = Array.from(mountainPatch.densityMap).reduce((a, b) => a + b, 0) / mountainPatch.densityMap.length;
      
      // They should be different (though we can't predict which will be higher)
      expect(Math.abs(oceanAvgDensity - mountainAvgDensity)).toBeGreaterThan(0.01);
    });
  });

  describe('calculateCloudCoverage', () => {
    it('should calculate cloud coverage for a geographic area', async () => {
      const area = {
        center: [-74.0060, 40.7128] as [number, number], // New York City
        radius: 1000
      };

      const coverage = await generator.calculateCloudCoverage(area);

      expect(coverage).toBeGreaterThanOrEqual(0);
      expect(coverage).toBeLessThanOrEqual(1);
    });

    it('should return different coverage for different terrain types', async () => {
      const urbanArea = {
        center: [-74.0060, 40.7128] as [number, number], // NYC
        radius: 1000
      };

      const oceanArea = {
        center: [-74.0060, 40.5000] as [number, number], // Ocean
        radius: 1000
      };

      const urbanCoverage = await generator.calculateCloudCoverage(urbanArea);
      const oceanCoverage = await generator.calculateCloudCoverage(oceanArea);

      // Coverage should be different for different terrain types
      expect(Math.abs(urbanCoverage - oceanCoverage)).toBeGreaterThan(0.05);
    });
  });

  describe('updateCloudDensity', () => {
    it('should update cloud density based on terrain', async () => {
      const bounds: MapBounds = {
        north: 40.7589,
        south: 40.7489,
        east: -73.9741,
        west: -73.9841
      };

      const config: CloudGeneratorConfig = {
        cloudDensity: 0.6,
        noiseScale: 0.001,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        windDirection: { x: 1, y: 0 },
        windSpeed: 2
      };

      const patch = await generator.generateCloudPatch(bounds, config);
      const originalDensity = Array.from(patch.densityMap);

      generator.updateCloudDensity(patch, 0.8);

      const updatedDensity = Array.from(patch.densityMap);
      
      // Density should have changed
      expect(updatedDensity).not.toEqual(originalDensity);
    });
  });

  describe('generateNoisePattern', () => {
    it('should generate noise pattern', () => {
      const config: CloudGeneratorConfig = {
        cloudDensity: 0.6,
        noiseScale: 0.001,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        windDirection: { x: 1, y: 0 },
        windSpeed: 2
      };

      const pattern = generator.generateNoisePattern(64, 64, config);

      expect(pattern).toBeInstanceOf(Float32Array);
      expect(pattern.length).toBe(64 * 64);
      
      // Should contain valid density values
      for (let i = 0; i < pattern.length; i++) {
        expect(pattern[i]).toBeGreaterThanOrEqual(0);
        expect(pattern[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('configuration', () => {
    it('should work with terrain analysis disabled', async () => {
      const basicGenerator = new TerrainAwareCloudGenerator({
        enableTerrainAnalysis: false,
        cacheAnalysisResults: false,
        adaptationIntensity: 0,
        blendRadius: 0,
        updateFrequency: 60000
      });

      const bounds: MapBounds = {
        north: 40.7589,
        south: 40.7489,
        east: -73.9741,
        west: -73.9841
      };

      const config: CloudGeneratorConfig = {
        cloudDensity: 0.6,
        noiseScale: 0.001,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        windDirection: { x: 1, y: 0 },
        windSpeed: 2
      };

      const patch = await basicGenerator.generateCloudPatch(bounds, config);

      expect(patch).toBeDefined();
      expect(patch.vertices).toBeInstanceOf(Float32Array);
      
      basicGenerator.dispose();
    });
  });
});