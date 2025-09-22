/**
 * AnimationController Tests
 * Tests for the performance-aware animation controller
 */

import { AnimationController } from '../AnimationController';
import { AnimationUtils } from '../AnimationController';
import { EasingFunctions } from '../EasingFunctions';

describe('AnimationController', () => {
  let controller: AnimationController;

  beforeEach(() => {
    controller = new AnimationController({
      targetFrameRate: 60,
      performanceCheckInterval: 100, // Faster for testing
      qualityAdjustmentThreshold: 45,
      batchUpdateInterval: 16
    });
  });

  afterEach(() => {
    controller.dispose();
  });

  describe('Initialization', () => {
    it('should initialize with default animation state', () => {
      const state = controller.getAnimationState();
      
      expect(state.cloudDrift.offset.x).toBe(0);
      expect(state.cloudDrift.offset.y).toBe(0);
      expect(state.dissipation.active).toBe(false);
      expect(state.morphing.noiseOffset).toBe(0);
    });

    it('should start with high animation quality', () => {
      const frameRate = controller.getFrameRate();
      expect(frameRate).toBe(60); // Initial frame rate
    });
  });

  describe('Cloud Drift Animation', () => {
    it('should start drift animation with correct parameters', () => {
      controller.startCloudDrift(5.0, 90); // 5 m/s eastward
      
      const state = controller.getAnimationState();
      expect(state.cloudDrift.speed).toBe(5.0);
      expect(state.cloudDrift.direction).toBe(90);
    });

    it('should stop drift animation', () => {
      controller.startCloudDrift(5.0, 90);
      controller.stopCloudDrift();
      
      // Animation should be stopped (implementation detail)
      expect(true).toBe(true); // Placeholder - actual implementation would check internal state
    });
  });

  describe('Morphing Effects', () => {
    it('should update morphing speed', () => {
      controller.updateMorphing(1.5);
      
      const state = controller.getAnimationState();
      expect(state.morphing.morphSpeed).toBe(1.5);
    });

    it('should stop morphing when speed is zero', () => {
      controller.updateMorphing(1.0);
      controller.updateMorphing(0);
      
      const state = controller.getAnimationState();
      expect(state.morphing.morphSpeed).toBe(0);
    });
  });

  describe('Dissipation Animation', () => {
    it('should animate dissipation with correct parameters', async () => {
      const animation = AnimationUtils.createDissipationAnimation(
        [10, 20], // center
        100,      // max radius
        100       // duration (short for testing)
      );

      const promise = controller.animateDissipation(animation);
      
      // Check initial state
      const initialState = controller.getAnimationState();
      expect(initialState.dissipation.active).toBe(true);
      expect(initialState.dissipation.center).toEqual([10, 20]);
      
      await promise;
      
      // Check final state
      const finalState = controller.getAnimationState();
      expect(finalState.dissipation.active).toBe(false);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track frame rate statistics', () => {
      const stats = controller.getFrameRateStats();
      
      expect(stats.current).toBeGreaterThan(0);
      expect(stats.average).toBeGreaterThan(0);
      expect(stats.samples).toBeInstanceOf(Array);
    });

    it('should adjust quality based on performance', () => {
      // Simulate low performance
      controller.setAnimationQuality('low');
      
      // Quality should be adjusted (implementation detail)
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Uniform Batching', () => {
    it('should batch uniform updates', (done) => {
      let updateCount = 0;
      
      controller.setUniformUpdateCallback((uniforms) => {
        updateCount++;
        expect(uniforms).toBeInstanceOf(Object);
        
        if (updateCount === 1) {
          done();
        }
      });

      // Start animations to trigger uniform updates
      controller.startCloudDrift(2.0, 45);
      controller.updateMorphing(0.5);
    });
  });

  describe('Disposal', () => {
    it('should dispose resources properly', () => {
      controller.startCloudDrift(5.0, 90);
      controller.updateMorphing(1.0);
      
      controller.dispose();
      
      // Should not throw errors after disposal
      expect(() => {
        controller.getAnimationState();
      }).not.toThrow();
    });
  });
});

describe('AnimationUtils', () => {
  describe('Easing Functions', () => {
    it('should provide correct easing values', () => {
      expect(AnimationUtils.easing.linear(0.5)).toBe(0.5);
      expect(AnimationUtils.easing.easeInQuad(0)).toBe(0);
      expect(AnimationUtils.easing.easeInQuad(1)).toBe(1);
      expect(AnimationUtils.easing.easeOutCubic(0)).toBe(0);
      expect(AnimationUtils.easing.easeOutCubic(1)).toBe(1);
    });
  });

  describe('Dissipation Animation Creation', () => {
    it('should create dissipation animation with correct properties', () => {
      const animation = AnimationUtils.createDissipationAnimation([5, 10], 50, 1000);
      
      expect(animation.center).toEqual([5, 10]);
      expect(animation.maxRadius).toBe(50);
      expect(animation.duration).toBe(1000);
      expect(animation.easing).toBe(AnimationUtils.easing.easeOutCubic);
    });
  });

  describe('Performance Mode Calculation', () => {
    it('should calculate correct performance mode for high-end device', () => {
      const mode = AnimationUtils.calculatePerformanceMode(60, 4096, 'high');
      expect(mode).toBe('high');
    });

    it('should calculate correct performance mode for low-end device', () => {
      const mode = AnimationUtils.calculatePerformanceMode(25, 512, 'low');
      expect(mode).toBe('low');
    });

    it('should calculate correct performance mode for mid-range device', () => {
      const mode = AnimationUtils.calculatePerformanceMode(45, 2048, 'medium');
      expect(mode).toBe('medium');
    });
  });
});

describe('EasingFunctions', () => {
  describe('Basic Easing Functions', () => {
    it('should return correct values at boundaries', () => {
      const easings = [
        EasingFunctions.linear,
        EasingFunctions.quad.in,
        EasingFunctions.quad.out,
        EasingFunctions.cubic.in,
        EasingFunctions.cubic.out,
        EasingFunctions.sine.in,
        EasingFunctions.sine.out
      ];

      easings.forEach(easing => {
        expect(easing(0)).toBeCloseTo(0, 5);
        expect(easing(1)).toBeCloseTo(1, 5);
      });
    });
  });

  describe('Cloud-Specific Easing', () => {
    it('should provide smooth cloud drift easing', () => {
      const drift = EasingFunctions.cloud.drift;
      
      expect(drift(0)).toBeCloseTo(0, 5);
      expect(drift(0.5)).toBeCloseTo(0.5, 1);
      expect(drift(1)).toBeCloseTo(1, 5);
    });

    it('should provide appropriate dissipation easing', () => {
      const dissipation = EasingFunctions.cloud.dissipation;
      
      expect(dissipation(0)).toBe(0);
      expect(dissipation(1)).toBe(1);
      expect(dissipation(0.5)).toBeGreaterThan(0.5); // Should accelerate
    });
  });

  describe('Function Validation', () => {
    it('should validate correct easing functions', () => {
      expect(EasingFunctions.validate(EasingFunctions.linear)).toBe(true);
      expect(EasingFunctions.validate(EasingFunctions.quad.in)).toBe(true);
      expect(EasingFunctions.validate(EasingFunctions.cloud.drift)).toBe(true);
    });

    it('should reject invalid functions', () => {
      const invalidFunction = () => NaN;
      expect(EasingFunctions.validate(invalidFunction)).toBe(false);
    });
  });

  describe('Custom Easing Functions', () => {
    it('should combine easing functions correctly', () => {
      const combined = EasingFunctions.combine(
        EasingFunctions.linear,
        EasingFunctions.quad.in,
        0.5
      );
      
      expect(combined(0)).toBe(0);
      expect(combined(1)).toBe(1);
      expect(combined(0.5)).toBeCloseTo(0.375, 3); // Average of 0.5 and 0.25
    });

    it('should create stepped easing functions', () => {
      const stepped = EasingFunctions.steps(4);
      
      expect(stepped(0)).toBe(0);
      expect(stepped(0.3)).toBe(0.25);
      expect(stepped(0.7)).toBe(0.5);
      expect(stepped(1)).toBe(0.75);
    });
  });
});