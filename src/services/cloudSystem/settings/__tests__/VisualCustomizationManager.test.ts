/**
 * VisualCustomizationManager Tests
 * Unit tests for visual customization functionality
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { VisualCustomizationManager, CloudColorScheme } from '../VisualCustomizationManager';
import { CloudSettings } from '../../../../types/cloud';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('VisualCustomizationManager', () => {
  let manager: VisualCustomizationManager;

  beforeEach(() => {
    manager = new VisualCustomizationManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('initialization', () => {
    it('should initialize with default settings', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await manager.initialize();

      const settings = manager.getCurrentSettings();
      expect(settings.selectedColorScheme).toBe('day');
      expect(settings.selectedStylePreset).toBe('realistic');
      expect(settings.opacity).toBe(0.8);
    });

    it('should load saved settings', async () => {
      const savedSettings = {
        selectedColorScheme: 'night',
        selectedStylePreset: 'dramatic',
        opacity: 0.9,
        contrast: 1.2,
      };

      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'cloud_visual_settings') {
          return Promise.resolve(JSON.stringify(savedSettings));
        }
        return Promise.resolve(null);
      });

      await manager.initialize();

      const settings = manager.getCurrentSettings();
      expect(settings.selectedColorScheme).toBe('night');
      expect(settings.selectedStylePreset).toBe('dramatic');
      expect(settings.opacity).toBe(0.9);
      expect(settings.contrast).toBe(1.2);
    });
  });

  describe('color schemes', () => {
    it('should provide built-in color schemes', async () => {
      await manager.initialize();

      const schemes = manager.getColorSchemes();
      expect(schemes.length).toBeGreaterThan(0);
      
      const dayScheme = schemes.find(s => s.id === 'day');
      expect(dayScheme).toBeDefined();
      expect(dayScheme?.name).toBe('Day');
      expect(dayScheme?.colors.primary).toBeDefined();
    });

    it('should set color scheme', async () => {
      await manager.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      await manager.setColorScheme('night');

      const settings = manager.getCurrentSettings();
      expect(settings.selectedColorScheme).toBe('night');
      expect(settings.enableCustomColors).toBe(false);
    });

    it('should set custom color scheme', async () => {
      await manager.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      const customColors: CloudColorScheme = {
        id: 'custom',
        name: 'Custom',
        description: 'Custom colors',
        colors: {
          primary: '#FF0000',
          secondary: '#00FF00',
          highlight: '#0000FF',
          ambient: '#FFFF00',
        },
        opacity: 0.9,
        contrast: 1.1,
      };

      await manager.setCustomColorScheme(customColors);

      const settings = manager.getCurrentSettings();
      expect(settings.enableCustomColors).toBe(true);
      expect(settings.customColors).toEqual(customColors);
    });

    it('should get current color scheme', async () => {
      await manager.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      await manager.setColorScheme('sunset');

      const currentScheme = manager.getCurrentColorScheme();
      expect(currentScheme?.id).toBe('sunset');
    });
  });

  describe('style presets', () => {
    it('should provide built-in style presets', async () => {
      await manager.initialize();

      const presets = manager.getStylePresets();
      expect(presets.length).toBeGreaterThan(0);
      
      const realisticPreset = presets.find(p => p.id === 'realistic');
      expect(realisticPreset).toBeDefined();
      expect(realisticPreset?.name).toBe('Realistic');
      expect(realisticPreset?.settings).toBeDefined();
    });

    it('should set style preset', async () => {
      await manager.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      await manager.setStylePreset('minimal');

      const settings = manager.getCurrentSettings();
      expect(settings.selectedStylePreset).toBe('minimal');
    });

    it('should apply preset color scheme when setting preset', async () => {
      await manager.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      await manager.setStylePreset('dramatic'); // Uses 'storm' color scheme

      const settings = manager.getCurrentSettings();
      expect(settings.selectedStylePreset).toBe('dramatic');
      expect(settings.selectedColorScheme).toBe('storm');
      expect(settings.enableCustomColors).toBe(false);
    });
  });

  describe('visual properties', () => {
    it('should update visual properties', async () => {
      await manager.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      await manager.updateVisualProperty('opacity', 0.6);
      await manager.updateVisualProperty('contrast', 1.3);

      const settings = manager.getCurrentSettings();
      expect(settings.opacity).toBe(0.6);
      expect(settings.contrast).toBe(1.3);
    });

    it('should validate visual property values', async () => {
      await manager.initialize();

      await expect(manager.updateVisualProperty('opacity', 2.5)).rejects.toThrow();
      await expect(manager.updateVisualProperty('contrast', -0.5)).rejects.toThrow();
    });
  });

  describe('applied settings', () => {
    it('should apply visual customizations to cloud settings', async () => {
      await manager.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      const baseSettings: CloudSettings = {
        density: 0.8,
        animationSpeed: 1.0,
        quality: 'medium',
        colorScheme: 'day',
        opacity: 0.8,
        contrast: 1.0,
      };

      await manager.setStylePreset('dramatic');
      await manager.updateVisualProperty('opacity', 0.9);
      await manager.updateVisualProperty('contrast', 1.2);

      const appliedSettings = manager.getAppliedCloudSettings(baseSettings);

      // Should apply preset settings and visual customizations
      expect(appliedSettings.opacity).toBeLessThanOrEqual(1.0);
      expect(appliedSettings.contrast).toBeGreaterThan(baseSettings.contrast);
    });

    it('should generate visual uniforms', async () => {
      await manager.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      await manager.setColorScheme('night');
      await manager.updateVisualProperty('brightness', 0.8);
      await manager.updateVisualProperty('saturation', 1.2);

      const uniforms = manager.getVisualUniforms();

      expect(uniforms.u_cloudPrimaryColor).toBeDefined();
      expect(uniforms.u_cloudSecondaryColor).toBeDefined();
      expect(uniforms.u_brightness).toBe(0.8);
      expect(uniforms.u_saturation).toBe(1.2);
    });
  });

  describe('custom presets', () => {
    it('should create custom preset', async () => {
      await manager.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      const customPreset = {
        name: 'My Custom Style',
        description: 'A custom style preset',
        colorScheme: 'day',
        settings: {
          density: 0.6,
          opacity: 0.7,
        },
      };

      const presetId = await manager.createCustomPreset(customPreset);

      expect(presetId).toMatch(/^custom_\d+$/);
      
      const preset = manager.getStylePreset(presetId);
      expect(preset?.name).toBe('My Custom Style');
    });

    it('should delete custom preset', async () => {
      await manager.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      const customPreset = {
        name: 'Temporary Style',
        description: 'A temporary style',
        colorScheme: 'day',
        settings: {},
      };

      const presetId = await manager.createCustomPreset(customPreset);
      expect(manager.getStylePreset(presetId)).toBeDefined();

      await manager.deleteCustomPreset(presetId);
      expect(manager.getStylePreset(presetId)).toBeNull();
    });

    it('should not delete built-in presets', async () => {
      await manager.initialize();

      await expect(manager.deleteCustomPreset('realistic')).rejects.toThrow(
        'Cannot delete built-in preset'
      );
    });
  });

  describe('import/export', () => {
    it('should export settings', async () => {
      await manager.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      await manager.setColorScheme('night');
      await manager.updateVisualProperty('opacity', 0.9);

      const exported = manager.exportSettings();
      const parsed = JSON.parse(exported);

      expect(parsed.settings).toBeDefined();
      expect(parsed.settings.selectedColorScheme).toBe('night');
      expect(parsed.settings.opacity).toBe(0.9);
      expect(parsed.timestamp).toBeDefined();
    });

    it('should import settings', async () => {
      await manager.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      const importData = {
        settings: {
          selectedColorScheme: 'storm',
          selectedStylePreset: 'minimal',
          opacity: 0.7,
          contrast: 1.3,
        },
        timestamp: Date.now(),
      };

      await manager.importSettings(JSON.stringify(importData));

      const settings = manager.getCurrentSettings();
      expect(settings.selectedColorScheme).toBe('storm');
      expect(settings.selectedStylePreset).toBe('minimal');
      expect(settings.opacity).toBe(0.7);
      expect(settings.contrast).toBe(1.3);
    });

    it('should reject invalid import data', async () => {
      await manager.initialize();

      await expect(manager.importSettings('invalid json')).rejects.toThrow();
      await expect(manager.importSettings('{}')).rejects.toThrow();
    });
  });

  describe('reset functionality', () => {
    it('should reset to defaults', async () => {
      await manager.initialize();
      mockAsyncStorage.setItem.mockResolvedValue();

      // Change some settings
      await manager.setColorScheme('night');
      await manager.updateVisualProperty('opacity', 0.5);

      // Reset to defaults
      await manager.resetToDefaults();

      const settings = manager.getCurrentSettings();
      const defaults = manager.getDefaultSettings();
      expect(settings).toEqual(defaults);
    });
  });

  describe('listeners', () => {
    it('should notify listeners when settings change', async () => {
      await manager.initialize();
      const listener = jest.fn();
      
      manager.addListener(listener);
      mockAsyncStorage.setItem.mockResolvedValue();

      await manager.setColorScheme('night');

      expect(listener).toHaveBeenCalled();
      const calledSettings = listener.mock.calls[0][0];
      expect(calledSettings.selectedColorScheme).toBe('night');
    });

    it('should remove listeners correctly', async () => {
      await manager.initialize();
      const listener = jest.fn();
      
      manager.addListener(listener);
      manager.removeListener(listener);
      mockAsyncStorage.setItem.mockResolvedValue();

      await manager.setColorScheme('night');

      expect(listener).not.toHaveBeenCalled();
    });
  });
});