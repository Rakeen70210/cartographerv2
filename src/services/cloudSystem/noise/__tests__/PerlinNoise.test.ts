/**
 * Unit tests for Perlin noise generator
 */

import { PerlinNoise, NoiseConfiguration } from '../PerlinNoise';
import { NoisePresets, NoiseUtils } from '../NoiseUtils';

describe('PerlinNoise', () => {
  let noise: PerlinNoise;
  let testConfig: NoiseConfiguration;

  beforeEach(() => {
    noise = new PerlinNoise(12345); // Fixed seed for consistent tests
    testConfig = {
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      scale: 0.01
    };
  });

  describe('noise generation consistency', () => {
    it('should generate consistent values for same coordinates', () => {
      const x = 100;
      const y = 200;
      
      const value1 = noise.noise(x, y, testConfig);
      const value2 = noise.noise(x, y, testConfig);
      
      expect(value1).toBe(value2);
    });

    it('should generate different values for different coordinates', () => {
      const value1 = noise.noise(100, 200, testConfig);
      const value2 = noise.noise(101, 200, testConfig);
      
      expect(value1).not.toBe(value2);
    });

    it('should generate same values with same seed', () => {
      const noise1 = new PerlinNoise(54321);
      const noise2 = new PerlinNoise(54321);
      
      const value1 = noise1.noise(50, 75, testConfig);
      const value2 = noise2.noise(50, 75, testConfig);
      
      expect(value1).toBe(value2);
    });

    it('should generate different values with different seeds', () => {
      const noise1 = new PerlinNoise(11111);
      const noise2 = new PerlinNoise(22222);
      
      const value1 = noise1.noise(50, 75, testConfig);
      const value2 = noise2.noise(50, 75, testConfig);
      
      expect(value1).not.toBe(value2);
    });
  });

  describe('noise value ranges', () => {
    it('should generate values in reasonable range', () => {
      const samples = 1000;
      const values: number[] = [];
      
      for (let i = 0; i < samples; i++) {
        const x = Math.random() * 1000;
        const y = Math.random() * 1000;
        values.push(noise.noise(x, y, testConfig));
      }
      
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      // Noise should be roughly in [-1, 1] range after normalization
      expect(min).toBeGreaterThan(-2);
      expect(max).toBeLessThan(2);
    });

    it('should have smooth transitions between adjacent points', () => {
      const x = 100;
      const y = 100;
      const step = 0.1;
      
      const value1 = noise.noise(x, y, testConfig);
      const value2 = noise.noise(x + step, y, testConfig);
      
      // Adjacent values should not differ too dramatically
      const difference = Math.abs(value1 - value2);
      expect(difference).toBeLessThan(0.5);
    });
  });

  describe('octave configuration effects', () => {
    it('should produce more detail with higher octaves', () => {
      const lowOctaveConfig = { ...testConfig, octaves: 1 };
      const highOctaveConfig = { ...testConfig, octaves: 6 };
      
      // Sample multiple points to measure variation
      const samplePoints = 100;
      let lowVariation = 0;
      let highVariation = 0;
      
      for (let i = 0; i < samplePoints - 1; i++) {
        const x = i * 0.1;
        const y = 0;
        
        const lowVal1 = noise.noise(x, y, lowOctaveConfig);
        const lowVal2 = noise.noise(x + 0.1, y, lowOctaveConfig);
        lowVariation += Math.abs(lowVal1 - lowVal2);
        
        const highVal1 = noise.noise(x, y, highOctaveConfig);
        const highVal2 = noise.noise(x + 0.1, y, highOctaveConfig);
        highVariation += Math.abs(highVal1 - highVal2);
      }
      
      // Higher octaves should generally produce more variation
      expect(highVariation).toBeGreaterThan(lowVariation);
    });

    it('should respect persistence parameter', () => {
      const lowPersistence = { ...testConfig, persistence: 0.1 };
      const highPersistence = { ...testConfig, persistence: 0.9 };
      
      const x = 123.456;
      const y = 789.012;
      
      const lowValue = noise.noise(x, y, lowPersistence);
      const highValue = noise.noise(x, y, highPersistence);
      
      // Values should be different based on persistence
      expect(lowValue).not.toBe(highValue);
    });
  });

  describe('performance characteristics', () => {
    it('should generate noise within reasonable time', () => {
      const startTime = performance.now();
      const iterations = 1000;
      
      for (let i = 0; i < iterations; i++) {
        noise.noise(i * 0.1, i * 0.1, testConfig);
      }
      
      const endTime = performance.now();
      const timePerIteration = (endTime - startTime) / iterations;
      
      // Should be fast enough for real-time use (< 1ms per call)
      expect(timePerIteration).toBeLessThan(1);
    });

    it('should handle large coordinate values', () => {
      const largeX = 1000000;
      const largeY = 2000000;
      
      expect(() => {
        const value = noise.noise(largeX, largeY, testConfig);
        expect(typeof value).toBe('number');
        expect(isFinite(value)).toBe(true);
      }).not.toThrow();
    });

    it('should handle negative coordinates', () => {
      const negativeX = -500;
      const negativeY = -1000;
      
      expect(() => {
        const value = noise.noise(negativeX, negativeY, testConfig);
        expect(typeof value).toBe('number');
        expect(isFinite(value)).toBe(true);
      }).not.toThrow();
    });
  });
});

describe('NoiseUtils', () => {
  describe('utility functions', () => {
    it('should clamp values correctly', () => {
      expect(NoiseUtils.clamp(-0.5)).toBe(0);
      expect(NoiseUtils.clamp(0.5)).toBe(0.5);
      expect(NoiseUtils.clamp(1.5)).toBe(1);
    });

    it('should apply smooth step correctly', () => {
      expect(NoiseUtils.smoothStep(0, 1, 0)).toBe(0);
      expect(NoiseUtils.smoothStep(0, 1, 1)).toBe(1);
      expect(NoiseUtils.smoothStep(0, 1, 0.5)).toBeCloseTo(0.5, 1);
    });

    it('should remap negative values to positive', () => {
      expect(NoiseUtils.remapToPositive(-1)).toBe(0);
      expect(NoiseUtils.remapToPositive(0)).toBe(0.5);
      expect(NoiseUtils.remapToPositive(1)).toBe(1);
    });

    it('should generate animation offsets', () => {
      const [x, y] = NoiseUtils.getAnimationOffset(1, 10, 90);
      expect(x).toBeCloseTo(0, 1); // cos(90°) ≈ 0
      expect(y).toBeCloseTo(10, 1); // sin(90°) * 10 ≈ 10
    });
  });

  describe('blend modes', () => {
    it('should blend values correctly', () => {
      expect(NoiseUtils.blend(0.5, 0.3, 'add')).toBeCloseTo(0.8);
      expect(NoiseUtils.blend(0.5, 0.4, 'multiply')).toBeCloseTo(0.2);
      expect(NoiseUtils.blend(0.5, 0.5, 'screen')).toBeCloseTo(0.75);
    });
  });
});

describe('NoisePresets', () => {
  it('should have valid preset configurations', () => {
    Object.values(NoisePresets).forEach(preset => {
      expect(preset.octaves).toBeGreaterThan(0);
      expect(preset.persistence).toBeGreaterThan(0);
      expect(preset.persistence).toBeLessThanOrEqual(1);
      expect(preset.lacunarity).toBeGreaterThan(1);
      expect(preset.scale).toBeGreaterThan(0);
    });
  });

  it('should produce different results for different presets', () => {
    const noise = new PerlinNoise(12345);
    const x = 100;
    const y = 100;
    
    const cumulusValue = noise.noise(x, y, NoisePresets.CUMULUS);
    const cirrusValue = noise.noise(x, y, NoisePresets.CIRRUS);
    const stratusValue = noise.noise(x, y, NoisePresets.STRATUS);
    
    expect(cumulusValue).not.toBe(cirrusValue);
    expect(cirrusValue).not.toBe(stratusValue);
    expect(stratusValue).not.toBe(cumulusValue);
  });
});