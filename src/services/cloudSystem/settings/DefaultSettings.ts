/**
 * DefaultSettings
 * Default cloud settings configurations for different scenarios
 */

import { CloudSettings, PerformanceMode } from '../../../types/cloud';

export class DefaultSettings {
  /**
   * Get standard default settings
   */
  static getDefault(): CloudSettings {
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
   * Get performance-optimized settings
   */
  static getPerformanceOptimized(): CloudSettings {
    return {
      density: 0.5,
      animationSpeed: 0.5,
      quality: 'low',
      colorScheme: 'day',
      opacity: 0.6,
      contrast: 0.8,
    };
  }

  /**
   * Get high-quality settings
   */
  static getHighQuality(): CloudSettings {
    return {
      density: 0.9,
      animationSpeed: 1.5,
      quality: 'high',
      colorScheme: 'day',
      opacity: 1.0,
      contrast: 1.2,
    };
  }

  /**
   * Get settings for specific performance mode
   */
  static getForPerformanceMode(mode: PerformanceMode): CloudSettings {
    switch (mode) {
      case 'low':
        return DefaultSettings.getPerformanceOptimized();
      case 'high':
        return DefaultSettings.getHighQuality();
      case 'medium':
      default:
        return DefaultSettings.getDefault();
    }
  }

  /**
   * Get day color scheme settings
   */
  static getDayScheme(): Partial<CloudSettings> {
    return {
      colorScheme: 'day',
      opacity: 0.8,
      contrast: 1.0,
    };
  }

  /**
   * Get night color scheme settings
   */
  static getNightScheme(): Partial<CloudSettings> {
    return {
      colorScheme: 'night',
      opacity: 0.9,
      contrast: 1.1,
    };
  }

  /**
   * Get minimal cloud settings (for battery saving)
   */
  static getMinimal(): CloudSettings {
    return {
      density: 0.3,
      animationSpeed: 0.2,
      quality: 'low',
      colorScheme: 'day',
      opacity: 0.4,
      contrast: 0.6,
    };
  }

  /**
   * Get realistic cloud settings
   */
  static getRealistic(): CloudSettings {
    return {
      density: 0.8,
      animationSpeed: 0.8,
      quality: 'high',
      colorScheme: 'day',
      opacity: 0.9,
      contrast: 1.1,
    };
  }

  /**
   * Get stylized cloud settings
   */
  static getStylized(): CloudSettings {
    return {
      density: 0.6,
      animationSpeed: 1.2,
      quality: 'medium',
      colorScheme: 'day',
      opacity: 0.7,
      contrast: 1.3,
    };
  }

  /**
   * Get settings presets
   */
  static getPresets(): Record<string, CloudSettings> {
    return {
      default: DefaultSettings.getDefault(),
      performance: DefaultSettings.getPerformanceOptimized(),
      quality: DefaultSettings.getHighQuality(),
      minimal: DefaultSettings.getMinimal(),
      realistic: DefaultSettings.getRealistic(),
      stylized: DefaultSettings.getStylized(),
    };
  }

  /**
   * Get preset names
   */
  static getPresetNames(): string[] {
    return Object.keys(DefaultSettings.getPresets());
  }

  /**
   * Get preset by name
   */
  static getPreset(name: string): CloudSettings | null {
    const presets = DefaultSettings.getPresets();
    return presets[name] || null;
  }
}