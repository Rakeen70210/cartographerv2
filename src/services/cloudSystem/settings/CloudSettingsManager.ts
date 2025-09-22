/**
 * CloudSettingsManager
 * Manages cloud system configuration with persistence and real-time updates
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CloudSettings, PerformanceMode } from '../../../types/cloud';
import { ICloudSettingsManager } from '../interfaces';

const CLOUD_SETTINGS_KEY = 'cloud_settings';

export class CloudSettingsManager implements ICloudSettingsManager {
  private currentSettings: CloudSettings;
  private listeners: Set<(settings: CloudSettings) => void> = new Set();

  constructor() {
    this.currentSettings = this.getDefaultSettings();
  }

  /**
   * Get default cloud settings
   */
  getDefaultSettings(): CloudSettings {
    return {
      density: 0.7,
      animationSpeed: 1.0,
      quality: 'medium',
      colorScheme: 'day',
      opacity: 0.8,
      contrast: 1.0,
    };
  }

  /**
   * Load settings from AsyncStorage
   */
  async loadSettings(): Promise<CloudSettings> {
    try {
      const storedSettings = await AsyncStorage.getItem(CLOUD_SETTINGS_KEY);
      
      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings);
        
        // Validate and merge with defaults
        if (this.validateSettings(parsedSettings)) {
          this.currentSettings = { ...this.getDefaultSettings(), ...parsedSettings };
        } else {
          console.warn('Invalid cloud settings found, using defaults');
          this.currentSettings = this.getDefaultSettings();
        }
      } else {
        this.currentSettings = this.getDefaultSettings();
      }
      
      return this.currentSettings;
    } catch (error) {
      console.error('Failed to load cloud settings:', error);
      this.currentSettings = this.getDefaultSettings();
      return this.currentSettings;
    }
  }

  /**
   * Save settings to AsyncStorage
   */
  async saveSettings(settings: CloudSettings): Promise<void> {
    try {
      if (!this.validateSettings(settings)) {
        throw new Error('Invalid settings provided');
      }

      await AsyncStorage.setItem(CLOUD_SETTINGS_KEY, JSON.stringify(settings));
      this.currentSettings = { ...settings };
      
      // Notify listeners of settings change
      this.notifyListeners(this.currentSettings);
    } catch (error) {
      console.error('Failed to save cloud settings:', error);
      throw error;
    }
  }

  /**
   * Validate settings object
   */
  validateSettings(settings: Partial<CloudSettings>): boolean {
    if (!settings || typeof settings !== 'object') {
      return false;
    }

    // Validate density (0-1)
    if (settings.density !== undefined) {
      if (typeof settings.density !== 'number' || settings.density < 0 || settings.density > 1) {
        return false;
      }
    }

    // Validate animation speed (0-2)
    if (settings.animationSpeed !== undefined) {
      if (typeof settings.animationSpeed !== 'number' || settings.animationSpeed < 0 || settings.animationSpeed > 2) {
        return false;
      }
    }

    // Validate quality
    if (settings.quality !== undefined) {
      if (!['low', 'medium', 'high'].includes(settings.quality)) {
        return false;
      }
    }

    // Validate color scheme
    if (settings.colorScheme !== undefined) {
      if (!['day', 'night', 'custom'].includes(settings.colorScheme)) {
        return false;
      }
    }

    // Validate opacity (0-1)
    if (settings.opacity !== undefined) {
      if (typeof settings.opacity !== 'number' || settings.opacity < 0 || settings.opacity > 1) {
        return false;
      }
    }

    // Validate contrast (0-2)
    if (settings.contrast !== undefined) {
      if (typeof settings.contrast !== 'number' || settings.contrast < 0 || settings.contrast > 2) {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply settings to the cloud system (placeholder for real-time updates)
   */
  applySettings(settings: CloudSettings): void {
    this.currentSettings = { ...settings };
    this.notifyListeners(this.currentSettings);
  }

  /**
   * Get current settings
   */
  getCurrentSettings(): CloudSettings {
    return { ...this.currentSettings };
  }

  /**
   * Update specific setting
   */
  async updateSetting<K extends keyof CloudSettings>(
    key: K,
    value: CloudSettings[K]
  ): Promise<void> {
    const newSettings = { ...this.currentSettings, [key]: value };
    
    if (!this.validateSettings(newSettings)) {
      throw new Error(`Invalid value for setting ${key}: ${value}`);
    }

    await this.saveSettings(newSettings);
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(): Promise<void> {
    const defaultSettings = this.getDefaultSettings();
    await this.saveSettings(defaultSettings);
  }

  /**
   * Add listener for settings changes
   */
  addSettingsListener(listener: (settings: CloudSettings) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove settings listener
   */
  removeSettingsListener(listener: (settings: CloudSettings) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of settings changes
   */
  private notifyListeners(settings: CloudSettings): void {
    this.listeners.forEach(listener => {
      try {
        listener(settings);
      } catch (error) {
        console.error('Error in settings listener:', error);
      }
    });
  }

  /**
   * Get performance mode from quality setting
   */
  getPerformanceModeFromQuality(quality: CloudSettings['quality']): PerformanceMode {
    switch (quality) {
      case 'low':
        return 'low';
      case 'medium':
        return 'medium';
      case 'high':
        return 'high';
      default:
        return 'medium';
    }
  }

  /**
   * Get recommended settings for device performance
   */
  getRecommendedSettingsForDevice(performanceMode: PerformanceMode): Partial<CloudSettings> {
    switch (performanceMode) {
      case 'low':
        return {
          quality: 'low',
          density: 0.5,
          animationSpeed: 0.5,
          opacity: 0.6,
        };
      case 'medium':
        return {
          quality: 'medium',
          density: 0.7,
          animationSpeed: 1.0,
          opacity: 0.8,
        };
      case 'high':
        return {
          quality: 'high',
          density: 0.9,
          animationSpeed: 1.5,
          opacity: 1.0,
        };
      default:
        return this.getDefaultSettings();
    }
  }

  /**
   * Dispose of the settings manager
   */
  dispose(): void {
    this.listeners.clear();
  }
}