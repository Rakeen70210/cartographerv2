/**
 * CloudSettingsManager Tests
 * Unit tests for cloud settings management functionality
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CloudSettingsManager } from '../CloudSettingsManager';
import { CloudSettings } from '../../../../types/cloud';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('CloudSettingsManager', () => {
  let settingsManager: CloudSettingsManager;

  beforeEach(() => {
    settingsManager = new CloudSettingsManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    settingsManager.dispose();
  });

  describe('getDefaultSettings', () => {
    it('should return valid default settings', () => {
      const defaults = settingsManager.getDefaultSettings();
      
      expect(defaults).toEqual({
        density: 0.7,
        animationSpeed: 1.0,
        quality: 'medium',
        colorScheme: 'day',
        opacity: 0.8,
        contrast: 1.0,
      });
    });
  });

  describe('validateSettings', () => {
    it('should validate correct settings', () => {
      const validSettings: CloudSettings = {
        density: 0.5,
        animationSpeed: 1.2,
        quality: 'high',
        colorScheme: 'night',
        opacity: 0.9,
        contrast: 1.1,
      };

      expect(settingsManager.validateSettings(validSettings)).toBe(true);
    });

    it('should reject invalid density', () => {
      const invalidSettings = { density: 1.5 };
      expect(settingsManager.validateSettings(invalidSettings)).toBe(false);
    });

    it('should reject invalid animation speed', () => {
      const invalidSettings = { animationSpeed: 3.0 };
      expect(settingsManager.validateSettings(invalidSettings)).toBe(false);
    });

    it('should reject invalid quality', () => {
      const invalidSettings = { quality: 'invalid' as any };
      expect(settingsManager.validateSettings(invalidSettings)).toBe(false);
    });

    it('should reject invalid color scheme', () => {
      const invalidSettings = { colorScheme: 'invalid' as any };
      expect(settingsManager.validateSettings(invalidSettings)).toBe(false);
    });
  });

  describe('loadSettings', () => {
    it('should load settings from AsyncStorage', async () => {
      const storedSettings: CloudSettings = {
        density: 0.6,
        animationSpeed: 0.8,
        quality: 'low',
        colorScheme: 'night',
        opacity: 0.7,
        contrast: 0.9,
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(storedSettings));

      const loadedSettings = await settingsManager.loadSettings();
      
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('cloud_settings');
      expect(loadedSettings).toEqual(storedSettings);
    });

    it('should return defaults when no stored settings exist', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const loadedSettings = await settingsManager.loadSettings();
      
      expect(loadedSettings).toEqual(settingsManager.getDefaultSettings());
    });

    it('should return defaults when stored settings are invalid', async () => {
      const invalidSettings = { density: 2.0 }; // Invalid density
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(invalidSettings));

      const loadedSettings = await settingsManager.loadSettings();
      
      expect(loadedSettings).toEqual(settingsManager.getDefaultSettings());
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const loadedSettings = await settingsManager.loadSettings();
      
      expect(loadedSettings).toEqual(settingsManager.getDefaultSettings());
    });
  });

  describe('saveSettings', () => {
    it('should save valid settings to AsyncStorage', async () => {
      const settings: CloudSettings = {
        density: 0.8,
        animationSpeed: 1.5,
        quality: 'high',
        colorScheme: 'day',
        opacity: 1.0,
        contrast: 1.2,
      };

      mockAsyncStorage.setItem.mockResolvedValue();

      await settingsManager.saveSettings(settings);
      
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'cloud_settings',
        JSON.stringify(settings)
      );
    });

    it('should reject invalid settings', async () => {
      const invalidSettings = { density: 1.5 } as CloudSettings;

      await expect(settingsManager.saveSettings(invalidSettings)).rejects.toThrow(
        'Invalid settings provided'
      );
    });

    it('should notify listeners when settings are saved', async () => {
      const settings: CloudSettings = settingsManager.getDefaultSettings();
      const listener = jest.fn();

      settingsManager.addSettingsListener(listener);
      mockAsyncStorage.setItem.mockResolvedValue();

      await settingsManager.saveSettings(settings);
      
      expect(listener).toHaveBeenCalledWith(settings);
    });
  });

  describe('updateSetting', () => {
    it('should update a single setting', async () => {
      mockAsyncStorage.setItem.mockResolvedValue();

      await settingsManager.updateSetting('density', 0.9);
      
      const currentSettings = settingsManager.getCurrentSettings();
      expect(currentSettings.density).toBe(0.9);
    });

    it('should reject invalid setting values', async () => {
      await expect(settingsManager.updateSetting('density', 1.5)).rejects.toThrow();
    });
  });

  describe('listeners', () => {
    it('should add and remove listeners correctly', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      settingsManager.addSettingsListener(listener1);
      settingsManager.addSettingsListener(listener2);

      const settings = settingsManager.getDefaultSettings();
      settingsManager.applySettings(settings);

      expect(listener1).toHaveBeenCalledWith(settings);
      expect(listener2).toHaveBeenCalledWith(settings);

      settingsManager.removeSettingsListener(listener1);
      settingsManager.applySettings(settings);

      expect(listener1).toHaveBeenCalledTimes(1); // Not called again
      expect(listener2).toHaveBeenCalledTimes(2); // Called again
    });
  });

  describe('getPerformanceModeFromQuality', () => {
    it('should map quality to performance mode correctly', () => {
      expect(settingsManager.getPerformanceModeFromQuality('low')).toBe('low');
      expect(settingsManager.getPerformanceModeFromQuality('medium')).toBe('medium');
      expect(settingsManager.getPerformanceModeFromQuality('high')).toBe('high');
    });
  });

  describe('getRecommendedSettingsForDevice', () => {
    it('should return appropriate settings for low performance', () => {
      const recommended = settingsManager.getRecommendedSettingsForDevice('low');
      
      expect(recommended.quality).toBe('low');
      expect(recommended.density).toBe(0.5);
      expect(recommended.animationSpeed).toBe(0.5);
    });

    it('should return appropriate settings for high performance', () => {
      const recommended = settingsManager.getRecommendedSettingsForDevice('high');
      
      expect(recommended.quality).toBe('high');
      expect(recommended.density).toBe(0.9);
      expect(recommended.animationSpeed).toBe(1.5);
    });
  });
});