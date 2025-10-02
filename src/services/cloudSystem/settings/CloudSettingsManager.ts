/**
 * CloudSettingsManager
 * Manages cloud system configuration with persistence and real-time updates
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CloudSettings, PerformanceMode, WindConfig } from '../../../types/cloud';
import { ICloudSettingsManager } from '../interfaces';
import { getSettingsValidator, ValidationResult } from './SettingsValidator';

const CLOUD_SETTINGS_KEY = 'cloud_settings';

export class CloudSettingsManager implements ICloudSettingsManager {
  private currentSettings: CloudSettings;
  private listeners: Set<(settings: CloudSettings) => void> = new Set();
  private validator = getSettingsValidator();
  private performanceMode: PerformanceMode = 'medium';

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
      wind: {
        direction: 45, // Northeast direction
        speed: 1.0,
        enabled: true,
        turbulence: 0.3,
      },
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
   * Save settings to AsyncStorage with validation and performance checking
   */
  async saveSettings(settings: CloudSettings): Promise<void> {
    try {
      // Validate settings with performance bounds
      const validation = this.validator.validateCloudSettings(settings, this.performanceMode);
      
      if (!validation.isValid) {
        throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
      }

      // Use adjusted values if provided (for performance safety)
      const finalSettings = validation.adjustedValue ? 
        { ...settings, ...validation.adjustedValue } : settings;

      // Log warnings if any
      if (validation.warnings.length > 0) {
        console.warn('Cloud settings warnings:', validation.warnings);
      }

      // Check performance risk
      const performanceRisk = this.validator.checkPerformanceRisk(finalSettings);
      if (performanceRisk.riskLevel === 'high') {
        console.warn('High performance risk detected:', {
          reasons: performanceRisk.reasons,
          recommendations: performanceRisk.recommendations
        });
      }

      await AsyncStorage.setItem(CLOUD_SETTINGS_KEY, JSON.stringify(finalSettings));
      this.currentSettings = { ...finalSettings };
      
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

    // Validate wind configuration
    if (settings.wind !== undefined) {
      if (typeof settings.wind !== 'object' || settings.wind === null) {
        return false;
      }

      // Validate wind direction (0-360)
      if (settings.wind.direction !== undefined) {
        if (typeof settings.wind.direction !== 'number' || settings.wind.direction < 0 || settings.wind.direction >= 360) {
          return false;
        }
      }

      // Validate wind speed (0-2)
      if (settings.wind.speed !== undefined) {
        if (typeof settings.wind.speed !== 'number' || settings.wind.speed < 0 || settings.wind.speed > 2) {
          return false;
        }
      }

      // Validate wind enabled flag
      if (settings.wind.enabled !== undefined) {
        if (typeof settings.wind.enabled !== 'boolean') {
          return false;
        }
      }

      // Validate wind turbulence (0-1)
      if (settings.wind.turbulence !== undefined) {
        if (typeof settings.wind.turbulence !== 'number' || settings.wind.turbulence < 0 || settings.wind.turbulence > 1) {
          return false;
        }
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
    const baseWind = this.getDefaultSettings().wind;
    
    switch (performanceMode) {
      case 'low':
        return {
          quality: 'low',
          density: 0.5,
          animationSpeed: 0.5,
          opacity: 0.6,
          wind: {
            ...baseWind,
            speed: 0.5,
            turbulence: 0.1,
          },
        };
      case 'medium':
        return {
          quality: 'medium',
          density: 0.7,
          animationSpeed: 1.0,
          opacity: 0.8,
          wind: {
            ...baseWind,
            speed: 1.0,
            turbulence: 0.3,
          },
        };
      case 'high':
        return {
          quality: 'high',
          density: 0.9,
          animationSpeed: 1.5,
          opacity: 1.0,
          wind: {
            ...baseWind,
            speed: 1.5,
            turbulence: 0.5,
          },
        };
      default:
        return this.getDefaultSettings();
    }
  }

  /**
   * Set performance mode for validation bounds
   */
  setPerformanceMode(mode: PerformanceMode): void {
    this.performanceMode = mode;
  }

  /**
   * Update wind configuration with validation
   */
  async updateWindConfig(windConfig: Partial<WindConfig>): Promise<void> {
    const currentWind = this.currentSettings.wind;
    const newWind = { ...currentWind, ...windConfig };
    
    // Validate wind configuration with performance bounds
    const validation = this.validator.validateWindConfig(newWind, this.performanceMode);
    
    if (!validation.isValid) {
      throw new Error(`Invalid wind configuration: ${validation.errors.join(', ')}`);
    }

    // Use adjusted values if provided
    const finalWind = validation.adjustedValue ? 
      { ...newWind, ...validation.adjustedValue } : newWind;

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn('Wind configuration warnings:', validation.warnings);
    }

    await this.updateSetting('wind', finalWind);
  }

  /**
   * Update animation settings with real-time validation
   */
  async updateAnimationSettings(settings: {
    animationSpeed?: number;
    density?: number;
  }): Promise<ValidationResult> {
    const updates: Partial<CloudSettings> = {};
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    // Validate animation speed
    if (settings.animationSpeed !== undefined) {
      const speedValidation = this.validator.validateAnimationSpeed(settings.animationSpeed, this.performanceMode);
      if (!speedValidation.isValid) {
        allErrors.push(...speedValidation.errors);
      } else {
        updates.animationSpeed = speedValidation.adjustedValue ?? settings.animationSpeed;
        allWarnings.push(...speedValidation.warnings);
      }
    }

    // Validate density
    if (settings.density !== undefined) {
      const densityValidation = this.validator.validateCloudDensity(settings.density, this.performanceMode);
      if (!densityValidation.isValid) {
        allErrors.push(...densityValidation.errors);
      } else {
        updates.density = densityValidation.adjustedValue ?? settings.density;
        allWarnings.push(...densityValidation.warnings);
      }
    }

    if (allErrors.length > 0) {
      throw new Error(`Invalid animation settings: ${allErrors.join(', ')}`);
    }

    // Apply updates
    const newSettings = { ...this.currentSettings, ...updates };
    await this.saveSettings(newSettings);

    return {
      isValid: true,
      errors: allErrors,
      warnings: allWarnings,
      adjustedValue: updates
    };
  }

  /**
   * Get current wind configuration
   */
  getWindConfig(): WindConfig {
    return { ...this.currentSettings.wind };
  }

  /**
   * Calculate wind offset based on time and configuration
   */
  calculateWindOffset(time: number): [number, number] {
    const wind = this.currentSettings.wind;
    
    if (!wind.enabled) {
      return [0, 0];
    }

    // Convert direction from degrees to radians
    const directionRad = (wind.direction * Math.PI) / 180;
    
    // Base wind movement
    const baseOffsetX = Math.cos(directionRad) * wind.speed * time * 0.01;
    const baseOffsetY = Math.sin(directionRad) * wind.speed * time * 0.01;
    
    // Add turbulence for more natural movement
    const turbulenceX = Math.sin(time * 0.1 + directionRad) * wind.turbulence * 0.02;
    const turbulenceY = Math.cos(time * 0.15 + directionRad) * wind.turbulence * 0.02;
    
    return [
      baseOffsetX + turbulenceX,
      baseOffsetY + turbulenceY
    ];
  }

  /**
   * Get wind vector for shader uniforms
   */
  getWindVector(): [number, number] {
    const wind = this.currentSettings.wind;
    
    if (!wind.enabled) {
      return [0, 0];
    }

    // Convert direction to normalized vector
    const directionRad = (wind.direction * Math.PI) / 180;
    return [
      Math.cos(directionRad) * wind.speed,
      Math.sin(directionRad) * wind.speed
    ];
  }

  /**
   * Dispose of the settings manager
   */
  dispose(): void {
    this.listeners.clear();
  }
}