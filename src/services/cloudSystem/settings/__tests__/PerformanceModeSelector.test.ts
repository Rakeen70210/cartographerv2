/**
 * PerformanceModeSelector Tests
 * Unit tests for performance mode selection functionality
 *
 * TEST FIXES DOCUMENTATION:
 * Fixed two test issues identified in test-fixes.md:
 *
 * 1. Test 'performAutoDetection › should detect and apply recommended mode':
 *    - ISSUE: mockPerformanceManager.setPerformanceMode was not being called
 *    - FIX: Set initial mode to 'low' before calling performAutoDetection() so when
 *      recommended mode is 'high', the setPerformanceMode will be called
 *
 * 2. Test 'isModeSupported › should return false for unsupported modes due to memory':
 *    - ISSUE: Function was returning true instead of false
 *    - FIX: Reduced memory from 100MB to 50MB to be below high mode requirement (~63MB)
 *
 * Both fixes ensure proper mock configuration before test assertions.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { PerformanceModeSelector } from '../PerformanceModeSelector';
import { PerformanceManager } from '../../performance/PerformanceManager';
import { DeviceCapabilityDetector } from '../../performance/DeviceCapabilityDetector';
import { PerformanceMode, DeviceCapabilities } from '../../../../types/cloud';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock PerformanceManager
jest.mock('../../performance/PerformanceManager');
jest.mock('../../performance/DeviceCapabilityDetector');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const MockPerformanceManager = PerformanceManager as jest.MockedClass<typeof PerformanceManager>;

describe('PerformanceModeSelector', () => {
  let selector: PerformanceModeSelector;
  let mockPerformanceManager: jest.Mocked<PerformanceManager>;
  let mockCapabilityDetector: jest.Mocked<DeviceCapabilityDetector>;

  const mockCapabilities: DeviceCapabilities = {
    gpuTier: 'medium',
    memoryMB: 1024,
    supportsFloatTextures: true,
    maxTextureSize: 2048,
    webglVersion: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocked performance manager
    mockPerformanceManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getDeviceCapabilities: jest.fn().mockReturnValue(mockCapabilities),
      getRecommendedPerformanceMode: jest.fn().mockReturnValue('medium'),
      setPerformanceMode: jest.fn(),
      isPerformanceAcceptable: jest.fn().mockReturnValue(true),
      getPerformanceRecommendations: jest.fn().mockReturnValue([]),
      dispose: jest.fn(),
    } as any;

    // Setup mocked capability detector
    mockCapabilityDetector = {
      getPerformanceTier: jest.fn().mockImplementation((name: string) => ({
        name,
        maxCloudCells: name === 'high' ? 300 : name === 'medium' ? 150 : 50,
        textureResolution: name === 'high' ? 1024 : name === 'medium' ? 512 : 256,
        animationQuality: name as any,
        shaderComplexity: 'standard' as any,
        updateFrequency: 30,
      })),
    } as any;

    MockPerformanceManager.mockImplementation(() => mockPerformanceManager);
    jest.spyOn(DeviceCapabilityDetector, 'getInstance').mockReturnValue(mockCapabilityDetector);

    selector = new PerformanceModeSelector();
  });

  afterEach(() => {
    selector.dispose();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await selector.initialize();

      expect(mockPerformanceManager.initialize).toHaveBeenCalled();
      expect(mockAsyncStorage.getItem).toHaveBeenCalled();
    });

    it('should load saved settings', async () => {
      const savedSettings = {
        currentMode: 'high' as PerformanceMode,
        autoDetect: false,
        manualOverride: true,
        lastAutoDetection: Date.now(),
      };

      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'cloud_performance_mode') {
          return Promise.resolve(JSON.stringify(savedSettings));
        }
        if (key === 'cloud_performance_auto') {
          return Promise.resolve(JSON.stringify(false));
        }
        return Promise.resolve(null);
      });

      await selector.initialize();

      const settings = selector.getCurrentSettings();
      expect(settings.currentMode).toBe('high');
      expect(settings.autoDetect).toBe(false);
      expect(settings.manualOverride).toBe(true);
    });
  });

  describe('getAvailablePerformanceModes', () => {
    it('should return all performance modes with correct information', async () => {
      await selector.initialize();

      const modes = selector.getAvailablePerformanceModes();

      expect(modes).toHaveLength(3);
      expect(modes.map(m => m.mode)).toEqual(['low', 'medium', 'high']);
      
      const mediumMode = modes.find(m => m.mode === 'medium');
      expect(mediumMode?.recommended).toBe(true); // Based on mocked recommendation
      expect(mediumMode?.name).toBe('Balanced');
    });
  });

  describe('setPerformanceMode', () => {
    it('should set performance mode manually', async () => {
      await selector.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      await selector.setPerformanceMode('high', true);

      const settings = selector.getCurrentSettings();
      expect(settings.currentMode).toBe('high');
      expect(settings.manualOverride).toBe(true);
      expect(settings.autoDetect).toBe(false);
      expect(mockPerformanceManager.setPerformanceMode).toHaveBeenCalledWith('high');
    });

    it('should save settings after mode change', async () => {
      await selector.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      await selector.setPerformanceMode('low');

      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('setAutoDetection', () => {
    it('should enable auto-detection and perform detection', async () => {
      await selector.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      await selector.setAutoDetection(true);

      const settings = selector.getCurrentSettings();
      expect(settings.autoDetect).toBe(true);
      expect(settings.manualOverride).toBe(false);
    });

    it('should disable auto-detection', async () => {
      await selector.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      await selector.setAutoDetection(false);

      const settings = selector.getCurrentSettings();
      expect(settings.autoDetect).toBe(false);
    });
  });

  describe('performAutoDetection', () => {
    it('should detect and apply recommended mode', async () => {
      await selector.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      // Set initial mode to low so it will change to high
      await selector.setPerformanceMode('low', false);
      mockPerformanceManager.getRecommendedPerformanceMode.mockReturnValue('high');

      const detectedMode = await selector.performAutoDetection();

      expect(detectedMode).toBe('high');
      expect(selector.getCurrentSettings().currentMode).toBe('high');
      expect(mockPerformanceManager.setPerformanceMode).toHaveBeenCalledWith('high');
    });

    it('should not change mode if already optimal', async () => {
      await selector.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();
      
      // Set current mode to match recommendation
      await selector.setPerformanceMode('medium', false);
      mockPerformanceManager.getRecommendedPerformanceMode.mockReturnValue('medium');

      const detectedMode = await selector.performAutoDetection();

      expect(detectedMode).toBe('medium');
      // Should not call setPerformanceMode again since mode didn't change
    });
  });

  describe('isModeSupported', () => {
    it('should return true for supported modes', async () => {
      await selector.initialize();

      expect(selector.isModeSupported('low')).toBe(true);
      expect(selector.isModeSupported('medium')).toBe(true);
    });

    it('should return false for unsupported modes due to memory', async () => {
      // Mock low memory device - set to value that will fail high mode memory check
      // High mode requires ~63MB, so set memory below that threshold
      mockPerformanceManager.getDeviceCapabilities.mockReturnValue({
        ...mockCapabilities,
        memoryMB: 50, // Very low memory - below high mode requirement (~63MB)
      });

      await selector.initialize();

      expect(selector.isModeSupported('high')).toBe(false);
    });

    it('should return false for unsupported modes due to texture size', async () => {
      // Mock device with small texture support
      mockPerformanceManager.getDeviceCapabilities.mockReturnValue({
        ...mockCapabilities,
        maxTextureSize: 256, // Small texture size
      });

      await selector.initialize();

      expect(selector.isModeSupported('high')).toBe(false); // Requires 1024px textures
    });
  });

  describe('getModeCompatibility', () => {
    it('should return compatibility info for supported mode', async () => {
      await selector.initialize();

      const compatibility = selector.getModeCompatibility('medium');

      expect(compatibility.supported).toBe(true);
      expect(compatibility.warnings).toHaveLength(0);
      expect(compatibility.requirements.length).toBeGreaterThan(0);
    });

    it('should return warnings for potentially unsupported mode', async () => {
      // Mock low-end device
      mockPerformanceManager.getDeviceCapabilities.mockReturnValue({
        ...mockCapabilities,
        gpuTier: 'low',
        memoryMB: 256,
      });

      await selector.initialize();

      const compatibility = selector.getModeCompatibility('high');

      expect(compatibility.supported).toBe(false);
      expect(compatibility.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('getPerformanceSuggestions', () => {
    it('should provide suggestions based on current state', async () => {
      await selector.initialize();
      mockPerformanceManager.getPerformanceRecommendations.mockReturnValue([
        'Consider reducing cloud quality'
      ]);
      mockPerformanceManager.getRecommendedPerformanceMode.mockReturnValue('low');

      const suggestions = selector.getPerformanceSuggestions();

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain('Consider reducing cloud quality');
    });

    it('should suggest enabling auto-detection when performance is poor', async () => {
      await selector.initialize();
      await selector.setAutoDetection(false);
      mockPerformanceManager.isPerformanceAcceptable.mockReturnValue(false);

      const suggestions = selector.getPerformanceSuggestions();

      expect(suggestions.some(s => s.includes('auto-detection'))).toBe(true);
    });
  });

  describe('listeners', () => {
    it('should notify listeners when settings change', async () => {
      await selector.initialize();
      const listener = jest.fn();
      
      selector.addListener(listener);
      mockAsyncStorage.setItem.mockResolvedValue();

      await selector.setPerformanceMode('high');

      expect(listener).toHaveBeenCalled();
      const calledSettings = listener.mock.calls[0][0];
      expect(calledSettings.currentMode).toBe('high');
    });

    it('should remove listeners correctly', async () => {
      await selector.initialize();
      const listener = jest.fn();
      
      selector.addListener(listener);
      selector.removeListener(listener);
      mockAsyncStorage.setItem.mockResolvedValue();

      await selector.setPerformanceMode('high');

      expect(listener).not.toHaveBeenCalled();
    });
  });
});