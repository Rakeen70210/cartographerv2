import { Skia, SkPath, SkPaint, SkCanvas, PathOp } from '@shopify/react-native-skia';
import { GenericExploredArea } from '../../../types/fog';
import { SkiaFogViewport, DissipationAnimation } from '../../../types/skiaFog';
import { ExplorationMaskManager } from './ExplorationMaskManager';
import { BlurMaskManager, BlurMaskConfig, DEFAULT_BLUR_CONFIG } from './BlurMaskManager';

/**
 * Configuration for the fog masking system
 */
export interface FogMaskingConfig {
  blurConfig: BlurMaskConfig;
  enableAdaptiveBlur: boolean;
  enableLayeredBlur: boolean;
  layerCount: number;
  performanceMode: 'low' | 'mid' | 'high';
}

/**
 * Default configuration for fog masking
 */
export const DEFAULT_FOG_MASKING_CONFIG: FogMaskingConfig = {
  blurConfig: DEFAULT_BLUR_CONFIG,
  enableAdaptiveBlur: true,
  enableLayeredBlur: false,
  layerCount: 2,
  performanceMode: 'mid'
};

/**
 * Result of fog masking operations
 */
export interface FogMaskingResult {
  exploredAreasPath: SkPath;
  dissipationPath: SkPath | null;
  combinedMaskPath: SkPath;
  maskPaint: SkPaint;
  layeredEffects?: Array<{ path: SkPath; paint: SkPaint; intensity: number }>;
}

/**
 * Unified system for managing fog masking with explored areas and dissipation animations
 */
export class FogMaskingSystem {
  private explorationMaskManager: ExplorationMaskManager;
  private blurMaskManager: BlurMaskManager;
  private config: FogMaskingConfig;

  constructor(config: FogMaskingConfig = DEFAULT_FOG_MASKING_CONFIG) {
    this.explorationMaskManager = new ExplorationMaskManager();
    this.blurMaskManager = new BlurMaskManager();
    this.config = { ...config };
  }

  /**
   * Generate complete fog masking for the current frame
   */
  public generateFogMask(
    exploredAreas: GenericExploredArea[],
    dissipationAnimations: DissipationAnimation[],
    viewport: SkiaFogViewport,
    zoomLevel: number
  ): FogMaskingResult {
    // Generate path for explored areas
    const exploredAreasPath = this.explorationMaskManager.getExploredAreasPath(
      exploredAreas,
      viewport
    );

    // Generate path for active dissipation animations
    const dissipationPath = this.createDissipationPath(dissipationAnimations, viewport);

    // Combine paths
    const combinedMaskPath = this.combinePaths(exploredAreasPath, dissipationPath);

    // Create blur configuration (adaptive if enabled)
    const blurConfig = this.config.enableAdaptiveBlur
      ? this.blurMaskManager.createAdaptiveBlurConfig(zoomLevel, viewport, this.config.blurConfig)
      : this.blurMaskManager.optimizeForPerformance(this.config.blurConfig, this.config.performanceMode);

    // Apply blur mask
    const { maskedPath: finalMaskPath, paint: maskPaint } = this.blurMaskManager.applyBlurMaskToPath(
      combinedMaskPath,
      blurConfig
    );

    // Create layered effects if enabled
    let layeredEffects: Array<{ path: SkPath; paint: SkPaint; intensity: number }> | undefined;
    if (this.config.enableLayeredBlur) {
      layeredEffects = this.blurMaskManager.createLayeredBlurEffect(
        combinedMaskPath,
        this.config.layerCount,
        blurConfig
      ).map(layer => ({
        path: layer.maskedPath,
        paint: layer.paint,
        intensity: layer.intensity
      }));
    }

    return {
      exploredAreasPath,
      dissipationPath,
      combinedMaskPath: finalMaskPath,
      maskPaint,
      layeredEffects
    };
  }

  /**
   * Create path for dissipation animations
   */
  private createDissipationPath(
    animations: DissipationAnimation[],
    viewport: SkiaFogViewport
  ): SkPath | null {
    if (animations.length === 0) {
      return null;
    }

    const path = Skia.Path.Make();

    for (const animation of animations) {
      const screenCoords = this.convertAnimationToScreenCoords(animation, viewport);
      if (screenCoords) {
        const circlePath = Skia.Path.Make();
        circlePath.addCircle(screenCoords.x, screenCoords.y, screenCoords.radius);
        path.op(circlePath, PathOp.Union);
      }
    }

    return path;
  }

  /**
   * Convert dissipation animation to screen coordinates
   */
  private convertAnimationToScreenCoords(
    animation: DissipationAnimation,
    viewport: SkiaFogViewport
  ): { x: number; y: number; radius: number } | null {
    const [lng, lat] = animation.center;

    // Check if animation is within viewport
    if (!this.isWithinViewport(lat, lng, viewport)) {
      return null;
    }

    // Convert to screen coordinates
    const x = this.longitudeToScreenX(lng, viewport);
    const y = this.latitudeToScreenY(lat, viewport);
    const radius = animation.radius;

    return { x, y, radius };
  }

  /**
   * Combine explored areas path and dissipation path
   */
  private combinePaths(exploredPath: SkPath, dissipationPath: SkPath | null): SkPath {
    if (!dissipationPath) {
      return exploredPath;
    }

    const combinedPath = Skia.Path.MakeFromSVGString(exploredPath.toSVGString()) || exploredPath;
    combinedPath.op(dissipationPath, PathOp.Union);

    return combinedPath;
  }

  /**
   * Apply fog mask to canvas with proper blend modes
   */
  public applyMaskToCanvas(
    canvas: SkCanvas,
    maskingResult: FogMaskingResult,
    fogShaderPaint: SkPaint
  ): void {
    // Save canvas state
    canvas.save();

    try {
      // If layered effects are enabled, apply them first
      if (maskingResult.layeredEffects) {
        for (const layer of maskingResult.layeredEffects) {
          canvas.drawPath(layer.path, layer.paint);
        }
      }

      // Apply the main mask
      canvas.drawPath(maskingResult.combinedMaskPath, maskingResult.maskPaint);

    } finally {
      // Restore canvas state
      canvas.restore();
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<FogMaskingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  public getConfig(): FogMaskingConfig {
    return { ...this.config };
  }

  /**
   * Clear all caches for memory management
   */
  public clearCaches(): void {
    this.explorationMaskManager.clearCache();
    this.blurMaskManager.clearCache();
  }

  /**
   * Get comprehensive cache statistics
   */
  public getCacheStats(): {
    exploration: ReturnType<ExplorationMaskManager['getCacheStats']>;
    blur: ReturnType<BlurMaskManager['getCacheStats']>;
  } {
    return {
      exploration: this.explorationMaskManager.getCacheStats(),
      blur: this.blurMaskManager.getCacheStats()
    };
  }

  /**
   * Validate system configuration
   */
  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate blur configuration
    const blurValidation = this.blurMaskManager.validateConfig(this.config.blurConfig);
    if (!blurValidation.valid) {
      errors.push(...blurValidation.errors);
    }

    // Validate layer count
    if (this.config.layerCount < 1 || this.config.layerCount > 5) {
      errors.push('Layer count must be between 1 and 5');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Helper methods (duplicated from ExplorationMaskManager for internal use)
  private isWithinViewport(lat: number, lng: number, viewport: SkiaFogViewport): boolean {
    const { bounds } = viewport;
    return lat >= bounds.south &&
      lat <= bounds.north &&
      lng >= bounds.west &&
      lng <= bounds.east;
  }

  private longitudeToScreenX(lng: number, viewport: SkiaFogViewport): number {
    const { bounds, width } = viewport;
    const lngRange = bounds.east - bounds.west;
    const normalizedX = (lng - bounds.west) / lngRange;
    return normalizedX * width;
  }

  private latitudeToScreenY(lat: number, viewport: SkiaFogViewport): number {
    const { bounds, height } = viewport;
    const latRange = bounds.north - bounds.south;
    const normalizedY = (bounds.north - lat) / latRange;
    return normalizedY * height;
  }
}