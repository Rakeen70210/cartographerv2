import { Skia, SkPath, BlurStyle, BlendMode, SkPaint } from '@shopify/react-native-skia';
import { SkiaFogViewport } from '../../../types/skiaFog';

/**
 * Configuration for blur mask effects
 */
export interface BlurMaskConfig {
  blurRadius: number;
  blurStyle: BlurStyle;
  blendMode: BlendMode;
  featherIntensity: number; // 0-1, controls edge softness
}

/**
 * Default blur mask configuration for natural fog edges
 */
export const DEFAULT_BLUR_CONFIG: BlurMaskConfig = {
  blurRadius: 20,
  blurStyle: BlurStyle.Normal,
  blendMode: BlendMode.SrcOut, // Cut out explored areas from fog
  featherIntensity: 0.7
};

/**
 * Manages blur mask creation and application for soft-edged fog masking
 */
export class BlurMaskManager {
  private cachedPaint: SkPaint | null = null;
  private lastConfig: BlurMaskConfig | null = null;

  /**
   * Create a blur mask filter with the specified configuration
   */
  public createBlurMask(config: BlurMaskConfig = DEFAULT_BLUR_CONFIG) {
    // Create blur mask filter using Skia
    const maskFilter = Skia.MaskFilter.MakeBlur(
      config.blurStyle,
      config.blurRadius,
      true // respectCTM - respect coordinate transform matrix
    );

    return maskFilter;
  }

  /**
   * Create a paint object configured for fog masking with blur effects
   */
  public createMaskPaint(config: BlurMaskConfig = DEFAULT_BLUR_CONFIG): SkPaint {
    // Return cached paint if configuration hasn't changed
    if (this.cachedPaint && this.configEquals(config, this.lastConfig)) {
      return this.cachedPaint;
    }

    const paint = Skia.Paint();
    
    // Set blend mode for cutting out explored areas
    paint.setBlendMode(config.blendMode);
    
    // Apply blur mask filter
    const maskFilter = this.createBlurMask(config);
    paint.setMaskFilter(maskFilter);
    
    // Set alpha based on feather intensity
    const alpha = Math.round(255 * config.featherIntensity);
    paint.setAlphaf(alpha / 255);
    
    // Enable anti-aliasing for smooth edges
    paint.setAntiAlias(true);

    // Cache the result
    this.cachedPaint = paint;

    return paint;
  }

  /**
   * Apply blur mask to a path for soft-edged masking
   */
  public applyBlurMaskToPath(
    path: SkPath,
    config: BlurMaskConfig = DEFAULT_BLUR_CONFIG
  ): { maskedPath: SkPath; paint: SkPaint } {
    const paint = this.createMaskPaint(config);
    
    // Create a copy of the path to avoid modifying the original
    const maskedPath = Skia.Path.MakeFromSVGString(path.toSVGString()) || path;
    
    return {
      maskedPath,
      paint
    };
  }

  /**
   * Create adaptive blur configuration based on zoom level and viewport
   */
  public createAdaptiveBlurConfig(
    zoomLevel: number,
    viewport: SkiaFogViewport,
    baseConfig: BlurMaskConfig = DEFAULT_BLUR_CONFIG
  ): BlurMaskConfig {
    // Adjust blur radius based on zoom level
    // Higher zoom = smaller blur radius for more detail
    // Lower zoom = larger blur radius for smoother appearance
    const zoomFactor = Math.max(0.3, Math.min(2.0, 1.0 / Math.sqrt(zoomLevel)));
    const adaptiveBlurRadius = baseConfig.blurRadius * zoomFactor;
    
    // Adjust feather intensity based on viewport size
    // Larger viewports can handle more intense feathering
    const viewportArea = viewport.width * viewport.height;
    const normalizedArea = Math.min(1.0, viewportArea / (1920 * 1080)); // Normalize to 1080p
    const adaptiveFeatherIntensity = baseConfig.featherIntensity * (0.5 + 0.5 * normalizedArea);

    return {
      ...baseConfig,
      blurRadius: Math.max(5, Math.min(50, adaptiveBlurRadius)), // Clamp between 5-50
      featherIntensity: Math.max(0.3, Math.min(1.0, adaptiveFeatherIntensity)) // Clamp between 0.3-1.0
    };
  }

  /**
   * Create multiple blur layers for enhanced soft edge effects
   */
  public createLayeredBlurEffect(
    path: SkPath,
    layers: number = 3,
    baseConfig: BlurMaskConfig = DEFAULT_BLUR_CONFIG
  ): Array<{ maskedPath: SkPath; paint: SkPaint; intensity: number }> {
    const results: Array<{ maskedPath: SkPath; paint: SkPaint; intensity: number }> = [];
    
    for (let i = 0; i < layers; i++) {
      const layerIntensity = (i + 1) / layers;
      const layerConfig: BlurMaskConfig = {
        ...baseConfig,
        blurRadius: baseConfig.blurRadius * layerIntensity,
        featherIntensity: baseConfig.featherIntensity * (1.0 - layerIntensity * 0.3)
      };
      
      const { maskedPath, paint } = this.applyBlurMaskToPath(path, layerConfig);
      
      results.push({
        maskedPath,
        paint,
        intensity: layerIntensity
      });
    }
    
    return results;
  }

  /**
   * Optimize blur configuration for performance based on device capabilities
   */
  public optimizeForPerformance(
    config: BlurMaskConfig,
    deviceTier: 'low' | 'mid' | 'high' = 'mid'
  ): BlurMaskConfig {
    const performanceMultipliers = {
      low: { blur: 0.5, feather: 0.7 },
      mid: { blur: 0.8, feather: 0.9 },
      high: { blur: 1.0, feather: 1.0 }
    };
    
    const multiplier = performanceMultipliers[deviceTier];
    
    return {
      ...config,
      blurRadius: Math.max(3, config.blurRadius * multiplier.blur),
      featherIntensity: config.featherIntensity * multiplier.feather
    };
  }

  /**
   * Check if two blur configurations are equal
   */
  private configEquals(config1: BlurMaskConfig, config2: BlurMaskConfig | null): boolean {
    if (!config2) return false;
    
    return config1.blurRadius === config2.blurRadius &&
           config1.blurStyle === config2.blurStyle &&
           config1.blendMode === config2.blendMode &&
           config1.featherIntensity === config2.featherIntensity;
  }

  /**
   * Clear cached objects for memory management
   */
  public clearCache(): void {
    this.cachedPaint = null;
    this.lastConfig = null;
  }

  /**
   * Get cache statistics for debugging
   */
  public getCacheStats(): { 
    hasCachedPaint: boolean; 
    lastConfig: BlurMaskConfig | null 
  } {
    return {
      hasCachedPaint: this.cachedPaint !== null,
      lastConfig: this.lastConfig ? { ...this.lastConfig } : null
    };
  }

  /**
   * Validate blur configuration parameters
   */
  public validateConfig(config: BlurMaskConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (config.blurRadius < 0 || config.blurRadius > 100) {
      errors.push('Blur radius must be between 0 and 100');
    }
    
    if (config.featherIntensity < 0 || config.featherIntensity > 1) {
      errors.push('Feather intensity must be between 0 and 1');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}