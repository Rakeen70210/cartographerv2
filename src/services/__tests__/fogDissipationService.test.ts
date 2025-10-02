import { fogDissipationService } from '../fogDissipationService';
import { store } from '../../store';
import { resetFogState } from '../../store/slices/fogSlice';

// Mock React Native's Animated API for testing
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Animated: {
    Value: jest.fn().mockImplementation((value) => ({
      setValue: jest.fn(),
      stopAnimation: jest.fn(),
      _value: value,
    })),
    timing: jest.fn().mockImplementation(() => ({
      start: jest.fn((callback) => {
        if (callback) {
          setTimeout(() => callback({ finished: true }), 10);
        }
      }),
    })),
  },
  Easing: {
    out: jest.fn(fn => fn),
    cubic: jest.fn(),
    linear: jest.fn(),
    bounce: jest.fn(),
    inOut: jest.fn(fn => fn),
  },
}));

describe('FogDissipationService', () => {
  beforeEach(() => {
    // Reset Redux state
    store.dispatch(resetFogState());
    
    // Clean up service state
    fogDissipationService.cancelAllAnimations();
  });

  afterEach(() => {
    fogDissipationService.cleanup();
  });

  describe('startClearingAnimation', () => {
    it('should start a clearing animation and update Redux state', () => {
      const center: [number, number] = [-122.4194, 37.7749]; // San Francisco
      const radius = 100;

      const animationId = fogDissipationService.startClearingAnimation(center, radius);

      expect(animationId).toBeDefined();
      expect(typeof animationId).toBe('string');

      // Check Redux state
      const state = store.getState();
      expect(state.fog.animationInProgress).toBe(true);
      expect(state.fog.activeAnimations).toContain(animationId);
      expect(state.fog.clearingAreas).toHaveLength(1);
      expect(state.fog.clearingAreas[0].center).toEqual(center);
      expect(state.fog.clearingAreas[0].radius).toBe(radius);
    });

    it('should create animation with custom options', () => {
      const center: [number, number] = [-122.4194, 37.7749];
      const radius = 150;
      const duration = 3000;
      const easing = 'bounce';

      const animationId = fogDissipationService.startClearingAnimation(center, radius, {
        duration,
        easing: easing as any
      });

      expect(animationId).toBeDefined();

      // Check that animation was created with correct parameters
      const animation = fogDissipationService.getAnimation(animationId);
      expect(animation).toBeDefined();
      expect(animation?.center).toEqual(center);
      expect(animation?.duration).toBe(duration);
    });
  });

  describe('startMultipleClearingAnimations', () => {
    it('should start multiple animations efficiently', () => {
      const areas = [
        { center: [-122.4194, 37.7749] as [number, number], radius: 100 },
        { center: [-122.4094, 37.7849] as [number, number], radius: 120 },
        { center: [-122.4294, 37.7649] as [number, number], radius: 80 },
      ];

      const animationIds = fogDissipationService.startMultipleClearingAnimations(areas);

      expect(animationIds).toHaveLength(3);
      expect(animationIds.every(id => typeof id === 'string')).toBe(true);

      // Check Redux state
      const state = store.getState();
      expect(state.fog.animationInProgress).toBe(true);
      expect(state.fog.activeAnimations).toHaveLength(3);
      expect(state.fog.clearingAreas).toHaveLength(3);

      // Verify each area was added correctly
      areas.forEach((area, index) => {
        expect(state.fog.clearingAreas[index].center).toEqual(area.center);
        expect(state.fog.clearingAreas[index].radius).toBe(area.radius);
      });
    });
  });

  describe('cancelClearingAnimation', () => {
    it('should cancel an active animation', () => {
      const center: [number, number] = [-122.4194, 37.7749];
      const radius = 100;

      const animationId = fogDissipationService.startClearingAnimation(center, radius);
      
      // Verify animation is active
      expect(fogDissipationService.getAnimation(animationId)).toBeDefined();

      // Cancel the animation
      const cancelled = fogDissipationService.cancelClearingAnimation(animationId);
      expect(cancelled).toBe(true);

      // Check that animation is no longer active
      const state = store.getState();
      expect(state.fog.activeAnimations).not.toContain(animationId);
    });

    it('should return false for non-existent animation', () => {
      const cancelled = fogDissipationService.cancelClearingAnimation('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });

  describe('getActiveAnimations', () => {
    it('should return all active animations', () => {
      const areas = [
        { center: [-122.4194, 37.7749] as [number, number], radius: 100 },
        { center: [-122.4094, 37.7849] as [number, number], radius: 120 },
      ];

      fogDissipationService.startMultipleClearingAnimations(areas);

      const activeAnimations = fogDissipationService.getActiveAnimations();
      expect(activeAnimations).toHaveLength(2);
      
      activeAnimations.forEach((animation, index) => {
        expect(animation.center).toEqual(areas[index].center);
        expect(animation.isActive).toBe(true);
      });
    });
  });

  describe('syncWithReduxState', () => {
    it('should sync service state with Redux state', () => {
      // Start an animation
      const animationId = fogDissipationService.startClearingAnimation([-122.4194, 37.7749], 100);
      
      // Manually modify Redux state (simulating external change)
      store.dispatch(resetFogState());
      
      // Sync should clean up the animation
      fogDissipationService.syncWithReduxState();
      
      // Animation should no longer be active in service
      const activeAnimations = fogDissipationService.getActiveAnimations();
      expect(activeAnimations).toHaveLength(0);
    });
  });

  describe('getAnimationStats', () => {
    it('should return correct animation statistics', () => {
      const areas = [
        { center: [-122.4194, 37.7749] as [number, number], radius: 100 },
        { center: [-122.4094, 37.7849] as [number, number], radius: 120 },
      ];

      fogDissipationService.startMultipleClearingAnimations(areas);

      const stats = fogDissipationService.getAnimationStats();
      expect(stats.activeCount).toBe(2);
      expect(stats.totalStarted).toBe(2);
      expect(typeof stats.averageDuration).toBe('number');
    });
  });

  describe('cleanup', () => {
    it('should clean up expired animations', () => {
      const animationId = fogDissipationService.startClearingAnimation([-122.4194, 37.7749], 100);
      
      // Perform cleanup
      fogDissipationService.cleanup();
      
      // Should still have active animation (not expired)
      const activeAnimations = fogDissipationService.getActiveAnimations();
      expect(activeAnimations.length).toBeGreaterThan(0);
    });
  });
});