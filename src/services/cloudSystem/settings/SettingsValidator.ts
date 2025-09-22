/**
 * SettingsValidator
 * Utility functions for validating cloud settings
 */

import { CloudSettings } from '../../../types/cloud';

export class SettingsValidator {
  /**
   * Validate complete settings object
   */
  static validateSettings(settings: Partial<CloudSettings>): boolean {
    if (!settings || typeof settings !== 'object') {
      return false;
    }

    return (
      SettingsValidator.validateDensity(settings.density) &&
      SettingsValidator.validateAnimationSpeed(settings.animationSpeed) &&
      SettingsValidator.validateQuality(settings.quality) &&
      SettingsValidator.validateColorScheme(settings.colorScheme) &&
      SettingsValidator.validateOpacity(settings.opacity) &&
      SettingsValidator.validateContrast(settings.contrast)
    );
  }

  /**
   * Validate density value (0-1)
   */
  static validateDensity(density?: number): boolean {
    if (density === undefined) return true;
    return typeof density === 'number' && density >= 0 && density <= 1;
  }

  /**
   * Validate animation speed (0-2)
   */
  static validateAnimationSpeed(speed?: number): boolean {
    if (speed === undefined) return true;
    return typeof speed === 'number' && speed >= 0 && speed <= 2;
  }

  /**
   * Validate quality setting
   */
  static validateQuality(quality?: CloudSettings['quality']): boolean {
    if (quality === undefined) return true;
    return ['low', 'medium', 'high'].includes(quality);
  }

  /**
   * Validate color scheme
   */
  static validateColorScheme(colorScheme?: CloudSettings['colorScheme']): boolean {
    if (colorScheme === undefined) return true;
    return ['day', 'night', 'custom'].includes(colorScheme);
  }

  /**
   * Validate opacity (0-1)
   */
  static validateOpacity(opacity?: number): boolean {
    if (opacity === undefined) return true;
    return typeof opacity === 'number' && opacity >= 0 && opacity <= 1;
  }

  /**
   * Validate contrast (0-2)
   */
  static validateContrast(contrast?: number): boolean {
    if (contrast === undefined) return true;
    return typeof contrast === 'number' && contrast >= 0 && contrast <= 2;
  }

  /**
   * Sanitize settings by clamping values to valid ranges
   */
  static sanitizeSettings(settings: Partial<CloudSettings>): Partial<CloudSettings> {
    const sanitized: Partial<CloudSettings> = {};

    if (settings.density !== undefined) {
      sanitized.density = Math.max(0, Math.min(1, settings.density));
    }

    if (settings.animationSpeed !== undefined) {
      sanitized.animationSpeed = Math.max(0, Math.min(2, settings.animationSpeed));
    }

    if (settings.quality !== undefined && SettingsValidator.validateQuality(settings.quality)) {
      sanitized.quality = settings.quality;
    }

    if (settings.colorScheme !== undefined && SettingsValidator.validateColorScheme(settings.colorScheme)) {
      sanitized.colorScheme = settings.colorScheme;
    }

    if (settings.opacity !== undefined) {
      sanitized.opacity = Math.max(0, Math.min(1, settings.opacity));
    }

    if (settings.contrast !== undefined) {
      sanitized.contrast = Math.max(0, Math.min(2, settings.contrast));
    }

    return sanitized;
  }

  /**
   * Get validation errors for settings
   */
  static getValidationErrors(settings: Partial<CloudSettings>): string[] {
    const errors: string[] = [];

    if (!SettingsValidator.validateDensity(settings.density)) {
      errors.push('Density must be a number between 0 and 1');
    }

    if (!SettingsValidator.validateAnimationSpeed(settings.animationSpeed)) {
      errors.push('Animation speed must be a number between 0 and 2');
    }

    if (!SettingsValidator.validateQuality(settings.quality)) {
      errors.push('Quality must be one of: low, medium, high');
    }

    if (!SettingsValidator.validateColorScheme(settings.colorScheme)) {
      errors.push('Color scheme must be one of: day, night, custom');
    }

    if (!SettingsValidator.validateOpacity(settings.opacity)) {
      errors.push('Opacity must be a number between 0 and 1');
    }

    if (!SettingsValidator.validateContrast(settings.contrast)) {
      errors.push('Contrast must be a number between 0 and 2');
    }

    return errors;
  }
}