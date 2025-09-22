/**
 * Basic Animation System Tests
 * Simple tests to verify animation components work
 */

import { DriftAnimation } from '../DriftAnimation';
import { MorphingEffects } from '../MorphingEffects';
import { EasingFunctions } from '../EasingFunctions';

describe('Basic Animation Tests', () => {
  describe('DriftAnimation', () => {
    it('should create drift animation with default config', () => {
      const drift = new DriftAnimation();
      const offset = drift.getOffset();
      
      expect(offset.x).toBe(0);
      expect(offset.y).toBe(0);
    });

    it('should update config correctly', () => {
      const drift = new DriftAnimation();
      drift.updateConfig({ windSpeed: 10, windDirection: 180 });
      
      const velocity = drift.getVelocity();
      expect(velocity.x).toBeCloseTo(0, 1); // South wind
      expect(velocity.y).toBeCloseTo(10, 1);
    });
  });

  describe('MorphingEffects', () => {
    it('should create morphing effects with default config', () => {
      const morphing = new MorphingEffects();
      const data = morphing.getMorphingData();
      
      expect(data.noiseOffset).toBe(0);
      expect(data.morphIntensity).toBe(0.3);
    });

    it('should calculate morphing factor correctly', () => {
      const morphing = new MorphingEffects({ intensity: 0.5 });
      const factor = morphing.calculateMorphingFactor({ x: 10, y: 20 }, 0.5);
      
      expect(typeof factor).toBe('number');
      expect(factor).toBeGreaterThanOrEqual(0);
      expect(factor).toBeLessThanOrEqual(1);
    });
  });

  describe('EasingFunctions', () => {
    it('should provide linear easing', () => {
      expect(EasingFunctions.linear(0)).toBe(0);
      expect(EasingFunctions.linear(0.5)).toBe(0.5);
      expect(EasingFunctions.linear(1)).toBe(1);
    });

    it('should provide cloud-specific easing', () => {
      const drift = EasingFunctions.cloud.drift(0.5);
      const dissipation = EasingFunctions.cloud.dissipation(0.5);
      
      expect(typeof drift).toBe('number');
      expect(typeof dissipation).toBe('number');
    });

    it('should validate easing functions', () => {
      expect(EasingFunctions.validate(EasingFunctions.linear)).toBe(true);
      expect(EasingFunctions.validate(EasingFunctions.quad.in)).toBe(true);
    });
  });
});