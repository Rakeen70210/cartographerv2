/**
 * Tests for SkiaUniformBatcher
 */

import { SkiaUniformBatcher } from '../SkiaUniformBatcher';
import { SkiaCloudUniforms } from '../SkiaCloudShader';

// Mock AppState for testing
jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() }))
  }
}));

describe('SkiaUniformBatcher', () => {
  let batcher: SkiaUniformBatcher;
  let mockUpdateCallback: jest.Mock;

  beforeEach(() => {
    batcher = new SkiaUniformBatcher({
      batchTimeout: 50, // Short timeout for testing
      enableSmartUpdates: true,
      debugLogging: false
    });

    mockUpdateCallback = jest.fn();
    batcher.onUniformUpdate(mockUpdateCallback);
  });

  afterEach(() => {
    batcher.dispose();
  });

  describe('Basic Batching', () => {
    it('should batch multiple uniform updates', async () => {
      const uniforms1: Partial<SkiaCloudUniforms> = {
        u_time: 1.0,
        u_cloud_density: 0.5
      };

      const uniforms2: Partial<SkiaCloudUniforms> = {
        u_animation_speed: 1.2,
        u_zoom: 10
      };

      batcher.queueUpdate('test1', uniforms1);
      batcher.queueUpdate('test2', uniforms2);

      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockUpdateCallback).toHaveBeenCalledTimes(1);
      
      const batchedUniforms = mockUpdateCallback.mock.calls[0][0];
      expect(batchedUniforms).toMatchObject({
        u_time: 1.0,
        u_cloud_density: 0.5,
        u_animation_speed: 1.2,
        u_zoom: 10
      });
    });

    it('should process high priority updates immediately', () => {
      const uniforms: Partial<SkiaCloudUniforms> = {
        u_time: 2.0
      };

      batcher.queueUpdate('urgent', uniforms, 'high');

      expect(mockUpdateCallback).toHaveBeenCalledTimes(1);
      expect(mockUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({ u_time: 2.0 })
      );
    });

    it('should flush pending updates immediately', () => {
      const uniforms: Partial<SkiaCloudUniforms> = {
        u_cloud_density: 0.8
      };

      batcher.queueUpdate('test', uniforms);
      
      const result = batcher.flush();

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(1);
      expect(mockUpdateCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Smart Update Detection', () => {
    it('should skip updates with unchanged values', async () => {
      const uniforms: Partial<SkiaCloudUniforms> = {
        u_cloud_density: 0.5
      };

      // First update
      batcher.queueUpdate('test', uniforms);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second update with same values
      batcher.queueUpdate('test', uniforms);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should only process the first update
      expect(mockUpdateCallback).toHaveBeenCalledTimes(1);
    });

    it('should detect significant changes in numeric values', () => {
      const uniforms1: Partial<SkiaCloudUniforms> = {
        u_cloud_density: 0.5
      };

      const uniforms2: Partial<SkiaCloudUniforms> = {
        u_cloud_density: 0.8 // Significant change
      };

      const detection1 = batcher.detectChanges(uniforms1);
      const detection2 = batcher.detectChanges(uniforms2);

      expect(detection1.hasChanges).toBe(true);
      expect(detection1.significantChanges).toContain('u_cloud_density');

      expect(detection2.hasChanges).toBe(true);
      expect(detection2.significantChanges).toContain('u_cloud_density');
    });

    it('should detect minor changes in numeric values', () => {
      // First set a baseline value
      batcher.queueUpdate('baseline', { u_cloud_density: 0.5 });
      batcher.flush();

      const uniforms: Partial<SkiaCloudUniforms> = {
        u_cloud_density: 0.51 // Minor change
      };

      const detection = batcher.detectChanges(uniforms);

      expect(detection.hasChanges).toBe(true);
      expect(detection.minorChanges).toContain('u_cloud_density');
      expect(detection.significantChanges).not.toContain('u_cloud_density');
    });
  });

  describe('Animation Pause/Resume', () => {
    it('should pause and resume animation updates', () => {
      expect(batcher.isAnimationPaused()).toBe(false);

      batcher.pauseAnimation();
      expect(batcher.isAnimationPaused()).toBe(true);

      // Low priority updates should be skipped when paused
      batcher.queueUpdate('test', { u_time: 1.0 }, 'low');
      expect(mockUpdateCallback).not.toHaveBeenCalled();

      // High priority updates should still work
      batcher.queueUpdate('urgent', { u_time: 2.0 }, 'high');
      expect(mockUpdateCallback).toHaveBeenCalledTimes(1);

      batcher.resumeAnimation();
      expect(batcher.isAnimationPaused()).toBe(false);
    });
  });

  describe('Performance Statistics', () => {
    it('should track batch statistics', async () => {
      const uniforms: Partial<SkiaCloudUniforms> = {
        u_time: 1.0,
        u_cloud_density: 0.5
      };

      batcher.queueUpdate('test', uniforms);
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = batcher.getStats();

      expect(stats.totalBatches).toBe(1);
      expect(stats.totalUpdates).toBe(1);
      expect(stats.lastBatchTime).toBeGreaterThan(0);
    });

    it('should calculate cache hit rate correctly', async () => {
      const uniforms: Partial<SkiaCloudUniforms> = {
        u_cloud_density: 0.5
      };

      // First update
      batcher.queueUpdate('test1', uniforms);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second update with same values (should be skipped)
      batcher.queueUpdate('test2', uniforms);
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = batcher.getStats();

      expect(stats.totalUpdates).toBe(1);
      expect(stats.totalSkipped).toBe(1);
      expect(stats.cacheHitRate).toBe(50); // 1 skipped out of 2 total
    });
  });

  describe('Error Handling', () => {
    it('should handle callback errors gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });

      batcher.onUniformUpdate(errorCallback);

      // Should not throw when callback errors
      expect(() => {
        batcher.queueUpdate('test', { u_time: 1.0 }, 'high');
      }).not.toThrow();
    });

    it('should continue processing after errors', async () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });

      batcher.onUniformUpdate(errorCallback);
      batcher.onUniformUpdate(mockUpdateCallback);

      batcher.queueUpdate('test', { u_time: 1.0 });
      await new Promise(resolve => setTimeout(resolve, 100));

      // Both callbacks should have been called despite the error
      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(mockUpdateCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Resource Management', () => {
    it('should clear all data when cleared', () => {
      batcher.queueUpdate('test', { u_time: 1.0 });
      
      const statsBefore = batcher.getStats();
      expect(statsBefore.totalUpdates).toBeGreaterThanOrEqual(0);

      batcher.clear();

      // Should not process cleared updates
      const result = batcher.flush();
      expect(result.processedCount).toBe(0);
    });

    it('should dispose of all resources', () => {
      const statsCallback = jest.fn();
      batcher.onBatchStats(statsCallback);

      batcher.dispose();

      // Should not call callbacks after disposal
      batcher.queueUpdate('test', { u_time: 1.0 }, 'high');
      expect(mockUpdateCallback).not.toHaveBeenCalled();
      expect(statsCallback).not.toHaveBeenCalled();
    });
  });
});