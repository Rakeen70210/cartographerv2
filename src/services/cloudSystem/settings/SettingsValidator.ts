/**
 * SettingsValidator
 * Validates cloud settings with performance safety bounds checking
 */

import { CloudSettings, WindConfig, PerformanceMode } from '../../../types/cloud';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  adjustedValue?: any;
}

export interface PerformanceBounds {
  animationSpeed: { min: number; max: number; recommended: number };
  density: { min: number; max: number; recommended: number };
  windSpeed: { min: number; max: number; recommended: number };
  windTurbulence: { min: number; max: number; recommended: number };
}

export class SettingsValidator {
  private performanceBounds: Record<PerformanceMode, PerformanceBounds>;

  constructor() {
    this.performanceBounds = {
      low: {
        animationSpeed: { min: 0.1, max: 1.0, recommended: 0.5 },
        density: { min: 0.1, max: 0.6, recommended: 0.4 },
        windSpeed: { min: 0, max: 1.0, recommended: 0.5 },
        windTurbulence: { min: 0, max: 0.3, recommended: 0.1 },
      },
      medium: {
        animationSpeed: { min: 0.1, max: 2.0, recommended: 1.0 },
        density: { min: 0.1, max: 0.8, recommended: 0.6 },
        windSpeed: { min: 0, max: 1.5, recommended: 1.0 },
        windTurbulence: { min: 0, max: 0.5, recommended: 0.3 },
      },
      high: {
        animationSpeed: { min: 0.1, max: 3.0, recommended: 1.5 },
        density: { min: 0.1, max: 1.0, recommended: 0.8 },
        windSpeed: { min: 0, max: 2.0, recommended: 1.2 },
        windTurbulence: { min: 0, max: 1.0, recommended: 0.4 },
      },
    };
  }

  /**
   * Validate animation speed with performance bounds
   */
  validateAnimationSpeed(
    speed: number, 
    performanceMode: PerformanceMode = 'medium'
  ): ValidationResult {
    const bounds = this.performanceBounds[performanceMode].animationSpeed;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof speed !== 'number' || isNaN(speed)) {
      errors.push('Animation speed must be a valid number');
      return { isValid: false, errors, warnings };
    }

    if (speed < bounds.min) {
      errors.push(`Animation speed ${speed} is below minimum ${bounds.min}`);
      return { 
        isValid: false, 
        errors, 
        warnings, 
        adjustedValue: bounds.min 
      };
    }

    if (speed > bounds.max) {
      warnings.push(`Animation speed ${speed} exceeds recommended maximum ${bounds.max} for ${performanceMode} performance mode`);
      return { 
        isValid: true, 
        errors, 
        warnings, 
        adjustedValue: bounds.max 
      };
    }

    if (speed > bounds.recommended) {
      warnings.push(`Animation speed ${speed} is above recommended value ${bounds.recommended} for optimal performance`);
    }

    return { isValid: true, errors, warnings };
  }

  /**
   * Validate cloud density with performance bounds
   */
  validateCloudDensity(
    density: number, 
    performanceMode: PerformanceMode = 'medium'
  ): ValidationResult {
    const bounds = this.performanceBounds[performanceMode].density;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof density !== 'number' || isNaN(density)) {
      errors.push('Cloud density must be a valid number');
      return { isValid: false, errors, warnings };
    }

    if (density < bounds.min) {
      errors.push(`Cloud density ${density} is below minimum ${bounds.min}`);
      return { 
        isValid: false, 
        errors, 
        warnings, 
        adjustedValue: bounds.min 
      };
    }

    if (density > bounds.max) {
      warnings.push(`Cloud density ${density} exceeds recommended maximum ${bounds.max} for ${performanceMode} performance mode`);
      return { 
        isValid: true, 
        errors, 
        warnings, 
        adjustedValue: bounds.max 
      };
    }

    if (density > bounds.recommended) {
      warnings.push(`Cloud density ${density} is above recommended value ${bounds.recommended} for optimal performance`);
    }

    return { isValid: true, errors, warnings };
  }

  /**
   * Validate wind configuration
   */
  validateWindConfig(
    windConfig: Partial<WindConfig>, 
    performanceMode: PerformanceMode = 'medium'
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const adjustedConfig: Partial<WindConfig> = {};

    // Validate wind direction
    if (windConfig.direction !== undefined) {
      if (typeof windConfig.direction !== 'number' || isNaN(windConfig.direction)) {
        errors.push('Wind direction must be a valid number');
      } else if (windConfig.direction < 0 || windConfig.direction >= 360) {
        errors.push('Wind direction must be between 0 and 359 degrees');
        adjustedConfig.direction = ((windConfig.direction % 360) + 360) % 360;
      }
    }

    // Validate wind speed
    if (windConfig.speed !== undefined) {
      const speedValidation = this.validateWindSpeed(windConfig.speed, performanceMode);
      errors.push(...speedValidation.errors);
      warnings.push(...speedValidation.warnings);
      if (speedValidation.adjustedValue !== undefined) {
        adjustedConfig.speed = speedValidation.adjustedValue;
      }
    }

    // Validate wind turbulence
    if (windConfig.turbulence !== undefined) {
      const turbulenceValidation = this.validateWindTurbulence(windConfig.turbulence, performanceMode);
      errors.push(...turbulenceValidation.errors);
      warnings.push(...turbulenceValidation.warnings);
      if (turbulenceValidation.adjustedValue !== undefined) {
        adjustedConfig.turbulence = turbulenceValidation.adjustedValue;
      }
    }

    // Validate enabled flag
    if (windConfig.enabled !== undefined && typeof windConfig.enabled !== 'boolean') {
      errors.push('Wind enabled flag must be a boolean value');
    }

    return { 
      isValid: errors.length === 0, 
      errors, 
      warnings,
      adjustedValue: Object.keys(adjustedConfig).length > 0 ? adjustedConfig : undefined
    };
  }

  /**
   * Validate wind speed with performance bounds
   */
  private validateWindSpeed(
    speed: number, 
    performanceMode: PerformanceMode
  ): ValidationResult {
    const bounds = this.performanceBounds[performanceMode].windSpeed;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof speed !== 'number' || isNaN(speed)) {
      errors.push('Wind speed must be a valid number');
      return { isValid: false, errors, warnings };
    }

    if (speed < bounds.min) {
      errors.push(`Wind speed ${speed} is below minimum ${bounds.min}`);
      return { 
        isValid: false, 
        errors, 
        warnings, 
        adjustedValue: bounds.min 
      };
    }

    if (speed > bounds.max) {
      warnings.push(`Wind speed ${speed} exceeds recommended maximum ${bounds.max} for ${performanceMode} performance mode`);
      return { 
        isValid: true, 
        errors, 
        warnings, 
        adjustedValue: bounds.max 
      };
    }

    return { isValid: true, errors, warnings };
  }

  /**
   * Validate wind turbulence with performance bounds
   */
  private validateWindTurbulence(
    turbulence: number, 
    performanceMode: PerformanceMode
  ): ValidationResult {
    const bounds = this.performanceBounds[performanceMode].windTurbulence;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof turbulence !== 'number' || isNaN(turbulence)) {
      errors.push('Wind turbulence must be a valid number');
      return { isValid: false, errors, warnings };
    }

    if (turbulence < bounds.min) {
      errors.push(`Wind turbulence ${turbulence} is below minimum ${bounds.min}`);
      return { 
        isValid: false, 
        errors, 
        warnings, 
        adjustedValue: bounds.min 
      };
    }

    if (turbulence > bounds.max) {
      warnings.push(`Wind turbulence ${turbulence} exceeds recommended maximum ${bounds.max} for ${performanceMode} performance mode`);
      return { 
        isValid: true, 
        errors, 
        warnings, 
        adjustedValue: bounds.max 
      };
    }

    return { isValid: true, errors, warnings };
  }

  /**
   * Validate complete cloud settings
   */
  validateCloudSettings(
    settings: Partial<CloudSettings>, 
    performanceMode: PerformanceMode = 'medium'
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const adjustedSettings: Partial<CloudSettings> = {};

    // Validate animation speed
    if (settings.animationSpeed !== undefined) {
      const speedValidation = this.validateAnimationSpeed(settings.animationSpeed, performanceMode);
      errors.push(...speedValidation.errors);
      warnings.push(...speedValidation.warnings);
      if (speedValidation.adjustedValue !== undefined) {
        adjustedSettings.animationSpeed = speedValidation.adjustedValue;
      }
    }

    // Validate density
    if (settings.density !== undefined) {
      const densityValidation = this.validateCloudDensity(settings.density, performanceMode);
      errors.push(...densityValidation.errors);
      warnings.push(...densityValidation.warnings);
      if (densityValidation.adjustedValue !== undefined) {
        adjustedSettings.density = densityValidation.adjustedValue;
      }
    }

    // Validate wind configuration
    if (settings.wind !== undefined) {
      const windValidation = this.validateWindConfig(settings.wind, performanceMode);
      errors.push(...windValidation.errors);
      warnings.push(...windValidation.warnings);
      if (windValidation.adjustedValue !== undefined) {
        adjustedSettings.wind = { ...settings.wind, ...windValidation.adjustedValue };
      }
    }

    // Validate other settings
    if (settings.opacity !== undefined) {
      if (typeof settings.opacity !== 'number' || settings.opacity < 0 || settings.opacity > 1) {
        errors.push('Opacity must be a number between 0 and 1');
        adjustedSettings.opacity = Math.max(0, Math.min(1, settings.opacity || 0.8));
      }
    }

    if (settings.contrast !== undefined) {
      if (typeof settings.contrast !== 'number' || settings.contrast < 0 || settings.contrast > 2) {
        errors.push('Contrast must be a number between 0 and 2');
        adjustedSettings.contrast = Math.max(0, Math.min(2, settings.contrast || 1.0));
      }
    }

    if (settings.quality !== undefined) {
      if (!['low', 'medium', 'high'].includes(settings.quality)) {
        errors.push('Quality must be one of: low, medium, high');
      }
    }

    if (settings.colorScheme !== undefined) {
      if (!['day', 'night', 'custom'].includes(settings.colorScheme)) {
        errors.push('Color scheme must be one of: day, night, custom');
      }
    }

    return { 
      isValid: errors.length === 0, 
      errors, 
      warnings,
      adjustedValue: Object.keys(adjustedSettings).length > 0 ? adjustedSettings : undefined
    };
  }

  /**
   * Get performance bounds for a specific mode
   */
  getPerformanceBounds(performanceMode: PerformanceMode): PerformanceBounds {
    return { ...this.performanceBounds[performanceMode] };
  }

  /**
   * Get recommended settings for performance mode
   */
  getRecommendedSettings(performanceMode: PerformanceMode): Partial<CloudSettings> {
    const bounds = this.performanceBounds[performanceMode];
    
    return {
      animationSpeed: bounds.animationSpeed.recommended,
      density: bounds.density.recommended,
      wind: {
        direction: 45, // Northeast
        speed: bounds.windSpeed.recommended,
        enabled: true,
        turbulence: bounds.windTurbulence.recommended,
      },
    };
  }

  /**
   * Check if settings combination might cause performance issues
   */
  checkPerformanceRisk(settings: CloudSettings): {
    riskLevel: 'low' | 'medium' | 'high';
    reasons: string[];
    recommendations: string[];
  } {
    const reasons: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    // High animation speed increases risk
    if (settings.animationSpeed > 2.0) {
      riskScore += 2;
      reasons.push('High animation speed may impact performance');
      recommendations.push('Consider reducing animation speed to 1.5 or lower');
    }

    // High density increases risk
    if (settings.density > 0.8) {
      riskScore += 2;
      reasons.push('High cloud density may impact performance');
      recommendations.push('Consider reducing cloud density to 0.7 or lower');
    }

    // High wind speed with high turbulence increases risk
    if (settings.wind.speed > 1.5 && settings.wind.turbulence > 0.5) {
      riskScore += 1;
      reasons.push('High wind speed combined with high turbulence may impact performance');
      recommendations.push('Consider reducing either wind speed or turbulence');
    }

    // High quality with high settings increases risk
    if (settings.quality === 'high' && (settings.animationSpeed > 1.5 || settings.density > 0.7)) {
      riskScore += 1;
      reasons.push('High quality with intensive settings may impact performance');
      recommendations.push('Consider using medium quality or reducing other settings');
    }

    let riskLevel: 'low' | 'medium' | 'high';
    if (riskScore >= 4) {
      riskLevel = 'high';
    } else if (riskScore >= 2) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return { riskLevel, reasons, recommendations };
  }
}

// Singleton instance
let validatorInstance: SettingsValidator | null = null;

export const getSettingsValidator = (): SettingsValidator => {
  if (!validatorInstance) {
    validatorInstance = new SettingsValidator();
  }
  return validatorInstance;
};