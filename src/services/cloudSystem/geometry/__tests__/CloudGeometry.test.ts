/**
 * Unit tests for cloud geometry generation
 */

import { CloudGrid, CloudGeometryGenerator, CloudGridConfig } from '../CloudGeometry';
import { CloudDensityCalculator, DensityConfig } from '../DensityCalculator';
import { NoisePresets } from '../../noise';

describe('CloudGrid', () => {
  let grid: CloudGrid;
  let config: CloudGridConfig;

  beforeEach(() => {
    config = {
      cellSize: 1000, // 1km cells
      resolution: 8, // 8x8 vertices per cell
      maxCells: 100,
      noiseConfig: NoisePresets.CUMULUS
    };
    grid = new CloudGrid(config, 12345);
  });

  describe('cell management', () => {
    it('should create cells on demand', () => {
      const cell = grid.getCell(500, 500);
      expect(cell).toBeDefined();
      expect(cell.id).toBe('0_0');
      expect(cell.worldPosition).toEqual([0, 0]);
    });

    it('should return same cell for coordinates in same grid', () => {
      const cell1 = grid.getCell(100, 200);
      const cell2 = grid.getCell(300, 400);
      expect(cell1.id).toBe(cell2.id);
    });

    it('should create different cells for different grids', () => {
      const cell1 = grid.getCell(500, 500);
      const cell2 = grid.getCell(1500, 1500);
      expect(cell1.id).not.toBe(cell2.id);
    });

    it('should generate vertices for cells', () => {
      const cell = grid.getCell(0, 0);
      expect(cell.vertices).toBeDefined();
      expect(cell.vertices.length).toBe(config.resolution * config.resolution);
    });

    it('should calculate cell density', () => {
      const cell = grid.getCell(0, 0);
      expect(typeof cell.density).toBe('number');
      expect(cell.density).toBeGreaterThanOrEqual(0);
    });
  });

  describe('bounds queries', () => {
    it('should return cells within bounds', () => {
      // Create some cells
      grid.getCell(0, 0);
      grid.getCell(1000, 0);
      grid.getCell(0, 1000);
      grid.getCell(2000, 2000);

      const bounds = { minX: -500, minY: -500, maxX: 1500, maxY: 1500 };
      const cellsInBounds = grid.getCellsInBounds(bounds);
      
      expect(cellsInBounds.length).toBe(3); // Should exclude the far cell
    });
  });

  describe('cell state management', () => {
    it('should update dissipation state', () => {
      const cell = grid.getCell(0, 0);
      const dissipationState = {
        active: true,
        progress: 0.5,
        center: [100, 100] as [number, number],
        radius: 200
      };

      grid.updateCellDissipation(cell.id, dissipationState);
      const updatedCell = grid.getCell(0, 0);
      expect(updatedCell.dissipationState).toEqual(dissipationState);
    });

    it('should mark cells as explored', () => {
      const cell = grid.getCell(0, 0);
      expect(cell.explored).toBe(false);

      grid.markCellExplored(cell.id);
      const updatedCell = grid.getCell(0, 0);
      expect(updatedCell.explored).toBe(true);
    });
  });
});

describe('CloudGeometryGenerator', () => {
  let grid: CloudGrid;
  let config: CloudGridConfig;

  beforeEach(() => {
    config = {
      cellSize: 1000,
      resolution: 4, // Small for testing
      maxCells: 10,
      noiseConfig: NoisePresets.CUMULUS
    };
    grid = new CloudGrid(config, 12345);
  });

  describe('patch generation', () => {
    it('should generate valid cloud patch', () => {
      const cell = grid.getCell(0, 0);
      const patch = CloudGeometryGenerator.generatePatch(cell, config.resolution);

      expect(patch.id).toBe(cell.id);
      expect(patch.vertexCount).toBe(config.resolution * config.resolution);
      expect(patch.indexCount).toBe((config.resolution - 1) * (config.resolution - 1) * 6);
      expect(patch.vertices.length).toBe(patch.vertexCount * 3);
      expect(patch.textureCoords.length).toBe(patch.vertexCount * 2);
      expect(patch.densityMap.length).toBe(patch.vertexCount);
      expect(patch.indices.length).toBe(patch.indexCount);
    });

    it('should calculate valid bounding box', () => {
      const cell = grid.getCell(0, 0);
      const patch = CloudGeometryGenerator.generatePatch(cell, config.resolution);

      expect(patch.bounds.minX).toBeLessThanOrEqual(patch.bounds.maxX);
      expect(patch.bounds.minY).toBeLessThanOrEqual(patch.bounds.maxY);
    });

    it('should generate valid triangle indices', () => {
      const cell = grid.getCell(0, 0);
      const patch = CloudGeometryGenerator.generatePatch(cell, config.resolution);

      // Check that all indices are within vertex range
      for (let i = 0; i < patch.indices.length; i++) {
        expect(patch.indices[i]).toBeLessThan(patch.vertexCount);
        expect(patch.indices[i]).toBeGreaterThanOrEqual(0);
      }

      // Check that indices form valid triangles (groups of 3)
      expect(patch.indices.length % 3).toBe(0);
    });
  });

  describe('level of detail', () => {
    it('should reduce geometry complexity with LOD', () => {
      const cell = grid.getCell(0, 0);
      const originalPatch = CloudGeometryGenerator.generatePatch(cell, config.resolution);
      const lodPatch = CloudGeometryGenerator.applyLOD(originalPatch, 2);

      expect(lodPatch.vertexCount).toBeLessThan(originalPatch.vertexCount);
      expect(lodPatch.indexCount).toBeLessThan(originalPatch.indexCount);
    });

    it('should not modify patch when LOD level is 1', () => {
      const cell = grid.getCell(0, 0);
      const originalPatch = CloudGeometryGenerator.generatePatch(cell, config.resolution);
      const lodPatch = CloudGeometryGenerator.applyLOD(originalPatch, 1);

      expect(lodPatch.vertexCount).toBe(originalPatch.vertexCount);
      expect(lodPatch.indexCount).toBe(originalPatch.indexCount);
    });
  });
});

describe('CloudDensityCalculator', () => {
  let calculator: CloudDensityCalculator;
  let config: DensityConfig;

  beforeEach(() => {
    calculator = new CloudDensityCalculator(12345);
    config = CloudDensityCalculator.createPresets().cumulus;
  });

  describe('density calculation', () => {
    it('should calculate consistent density values', () => {
      const x = 1000;
      const y = 2000;
      
      const density1 = calculator.calculateDensity(x, y, config);
      const density2 = calculator.calculateDensity(x, y, config);
      
      expect(density1).toBe(density2);
    });

    it('should return values in valid range', () => {
      const samples = 100;
      for (let i = 0; i < samples; i++) {
        const x = Math.random() * 10000;
        const y = Math.random() * 10000;
        const density = calculator.calculateDensity(x, y, config);
        
        expect(density).toBeGreaterThanOrEqual(0);
        expect(density).toBeLessThanOrEqual(1);
      }
    });

    it('should vary with time for animation', () => {
      const x = 1000;
      const y = 2000;
      
      const density1 = calculator.calculateDensity(x, y, config, undefined, 0);
      const density2 = calculator.calculateDensity(x, y, config, undefined, 100);
      
      // Should be different due to animation offset
      expect(density1).not.toBe(density2);
    });
  });

  describe('geographic context', () => {
    it('should modify density based on elevation', () => {
      const x = 1000;
      const y = 2000;
      
      const lowElevation = { elevation: 0, waterDistance: 10000, urbanDensity: 0, temperature: 20, humidity: 0.5 };
      const highElevation = { elevation: 2000, waterDistance: 10000, urbanDensity: 0, temperature: 20, humidity: 0.5 };
      
      const lowDensity = calculator.calculateDensity(x, y, config, lowElevation);
      const highDensity = calculator.calculateDensity(x, y, config, highElevation);
      
      expect(highDensity).toBeGreaterThan(lowDensity);
    });

    it('should modify density based on water proximity', () => {
      const x = 1000;
      const y = 2000;
      
      const nearWater = { elevation: 100, waterDistance: 100, urbanDensity: 0, temperature: 20, humidity: 0.5 };
      const farFromWater = { elevation: 100, waterDistance: 10000, urbanDensity: 0, temperature: 20, humidity: 0.5 };
      
      const nearDensity = calculator.calculateDensity(x, y, config, nearWater);
      const farDensity = calculator.calculateDensity(x, y, config, farFromWater);
      
      expect(nearDensity).toBeGreaterThan(farDensity);
    });
  });

  describe('density field calculation', () => {
    it('should generate density field efficiently', () => {
      const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
      const resolution = 16;
      
      const startTime = performance.now();
      const densityField = calculator.calculateDensityField(bounds, resolution, config);
      const endTime = performance.now();
      
      expect(densityField.length).toBe(resolution * resolution);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      
      // Check that all values are valid
      for (let i = 0; i < densityField.length; i++) {
        expect(densityField[i]).toBeGreaterThanOrEqual(0);
        expect(densityField[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('presets and interpolation', () => {
    it('should provide valid presets', () => {
      const presets = CloudDensityCalculator.createPresets();
      
      expect(presets.cumulus).toBeDefined();
      expect(presets.stratus).toBeDefined();
      expect(presets.cirrus).toBeDefined();
      expect(presets.fog).toBeDefined();
      
      Object.values(presets).forEach(preset => {
        expect(preset.baseNoise.octaves).toBeGreaterThan(0);
        expect(preset.densityThreshold).toBeGreaterThanOrEqual(0);
        expect(preset.densityThreshold).toBeLessThanOrEqual(1);
      });
    });

    it('should interpolate between configurations', () => {
      const presets = CloudDensityCalculator.createPresets();
      const interpolated = CloudDensityCalculator.interpolateConfigs(
        presets.cumulus,
        presets.stratus,
        0.5
      );
      
      expect(interpolated.baseNoise.persistence).toBeCloseTo(
        (presets.cumulus.baseNoise.persistence + presets.stratus.baseNoise.persistence) / 2,
        2
      );
    });
  });
});