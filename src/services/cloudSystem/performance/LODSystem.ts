/**
 * Level of Detail (LOD) System
 * Manages cloud complexity reduction based on zoom level and performance
 */

import { PerformanceTier, PerformanceMode } from '../../../types/cloud';
import { MapBounds } from '../../../types/map';

export interface LODLevel {
  name: string;
  minZoom: number;
  maxZoom: number;
  cloudCellSize: number; // meters
  textureResolution: number;
  maxVisibleCells: number;
  cullingDistance: number; // meters
  animationQuality: 'low' | 'medium' | 'high';
  shaderComplexity: 'simple' | 'standard' | 'advanced';
}

export interface LODConfiguration {
  levels: LODLevel[];
  adaptiveQuality: boolean;
  performanceThreshold: number; // FPS threshold for quality adjustment
  cullingEnabled: boolean;
  distanceCullingEnabled: boolean;
}

export interface CullingResult {
  visibleCells: string[];
  culledCells: string[];
  totalCells: number;
  cullingReason: 'distance' | 'frustum' | 'performance' | 'none';
}

export class LODSystem {
  private configuration: LODConfiguration;
  private currentLODLevel: LODLevel;
  private performanceTier: PerformanceTier;
  private performanceMode: PerformanceMode;
  private lastFrameRate = 60;
  private adaptiveAdjustmentCooldown = 0;

  constructor(
    performanceTier: PerformanceTier,
    performanceMode: PerformanceMode,
    config: Partial<LODConfiguration> = {}
  ) {
    this.performanceTier = performanceTier;
    this.performanceMode = performanceMode;
    
    this.configuration = {
      adaptiveQuality: true,
      performanceThreshold: 45, // Target 45+ FPS
      cullingEnabled: true,
      distanceCullingEnabled: true,
      levels: this.createDefaultLODLevels(),
      ...config
    };

    this.currentLODLevel = this.selectInitialLODLevel();
  }

  /**
   * Get appropriate LOD level for current zoom
   */
  public getLODForZoom(zoomLevel: number): LODLevel {
    // Find the most appropriate LOD level for the zoom
    const suitableLevels = this.configuration.levels.filter(
      level => zoomLevel >= level.minZoom && zoomLevel <= level.maxZoom
    );

    if (suitableLevels.length === 0) {
      // Fallback to closest level
      return this.getClosestLODLevel(zoomLevel);
    }

    // Select the highest quality level that fits performance constraints
    const sortedLevels = suitableLevels.sort((a, b) => 
      this.getLODComplexityScore(b) - this.getLODComplexityScore(a)
    );

    for (const level of sortedLevels) {
      if (this.canHandleLODLevel(level)) {
        return level;
      }
    }

    // Fallback to lowest complexity level
    return sortedLevels[sortedLevels.length - 1];
  }

  /**
   * Update LOD based on current performance
   */
  public updateLOD(zoomLevel: number, currentFPS: number): LODLevel {
    this.lastFrameRate = currentFPS;

    // Check if adaptive quality adjustment is needed
    if (this.configuration.adaptiveQuality && this.adaptiveAdjustmentCooldown <= 0) {
      const targetLOD = this.getLODForZoom(zoomLevel);
      
      if (currentFPS < this.configuration.performanceThreshold) {
        // Performance is poor, try to reduce quality
        const lowerLOD = this.getLowerQualityLOD(targetLOD);
        if (lowerLOD && lowerLOD !== targetLOD) {
          this.currentLODLevel = lowerLOD;
          this.adaptiveAdjustmentCooldown = 60; // Wait 60 frames before next adjustment
          console.log(`LOD reduced due to performance: ${currentFPS.toFixed(1)} FPS`);
          return this.currentLODLevel;
        }
      } else if (currentFPS > this.configuration.performanceThreshold + 10) {
        // Performance is good, try to increase quality
        const higherLOD = this.getHigherQualityLOD(targetLOD);
        if (higherLOD && higherLOD !== targetLOD && this.canHandleLODLevel(higherLOD)) {
          this.currentLODLevel = higherLOD;
          this.adaptiveAdjustmentCooldown = 60;
          console.log(`LOD increased due to good performance: ${currentFPS.toFixed(1)} FPS`);
          return this.currentLODLevel;
        }
      }
    }

    // Decrement cooldown
    if (this.adaptiveAdjustmentCooldown > 0) {
      this.adaptiveAdjustmentCooldown--;
    }

    // Use zoom-based LOD if no adaptive adjustment was made
    const zoomBasedLOD = this.getLODForZoom(zoomLevel);
    if (zoomBasedLOD !== this.currentLODLevel) {
      this.currentLODLevel = zoomBasedLOD;
    }

    return this.currentLODLevel;
  }

  /**
   * Perform frustum culling on cloud cells
   */
  public performCulling(
    cloudCells: Array<{ id: string; bounds: MapBounds; distance: number }>,
    viewportBounds: MapBounds,
    cameraPosition: [number, number]
  ): CullingResult {
    if (!this.configuration.cullingEnabled) {
      return {
        visibleCells: cloudCells.map(cell => cell.id),
        culledCells: [],
        totalCells: cloudCells.length,
        cullingReason: 'none'
      };
    }

    const visibleCells: string[] = [];
    const culledCells: string[] = [];

    for (const cell of cloudCells) {
      let shouldCull = false;
      let cullingReason: CullingResult['cullingReason'] = 'none';

      // Frustum culling - check if cell is within viewport
      if (!this.isInViewport(cell.bounds, viewportBounds)) {
        shouldCull = true;
        cullingReason = 'frustum';
      }

      // Distance culling - check if cell is too far away
      if (!shouldCull && this.configuration.distanceCullingEnabled) {
        const maxDistance = this.currentLODLevel.cullingDistance;
        if (cell.distance > maxDistance) {
          shouldCull = true;
          cullingReason = 'distance';
        }
      }

      // Performance culling - limit number of visible cells
      if (!shouldCull && visibleCells.length >= this.currentLODLevel.maxVisibleCells) {
        shouldCull = true;
        cullingReason = 'performance';
      }

      if (shouldCull) {
        culledCells.push(cell.id);
      } else {
        visibleCells.push(cell.id);
      }
    }

    return {
      visibleCells,
      culledCells,
      totalCells: cloudCells.length,
      cullingReason: culledCells.length > 0 ? 'frustum' : 'none'
    };
  }

  /**
   * Get texture resolution for current LOD
   */
  public getTextureResolution(): number {
    return this.currentLODLevel.textureResolution;
  }

  /**
   * Get cloud cell size for current LOD
   */
  public getCloudCellSize(): number {
    return this.currentLODLevel.cloudCellSize;
  }

  /**
   * Get maximum visible cells for current LOD
   */
  public getMaxVisibleCells(): number {
    return this.currentLODLevel.maxVisibleCells;
  }

  /**
   * Get animation quality for current LOD
   */
  public getAnimationQuality(): 'low' | 'medium' | 'high' {
    return this.currentLODLevel.animationQuality;
  }

  /**
   * Get shader complexity for current LOD
   */
  public getShaderComplexity(): 'simple' | 'standard' | 'advanced' {
    return this.currentLODLevel.shaderComplexity;
  }

  /**
   * Get current LOD level
   */
  public getCurrentLODLevel(): LODLevel {
    return this.currentLODLevel;
  }

  /**
   * Set performance tier and update LOD accordingly
   */
  public setPerformanceTier(tier: PerformanceTier): void {
    this.performanceTier = tier;
    this.updateLODConfiguration();
  }

  /**
   * Set performance mode and update LOD accordingly
   */
  public setPerformanceMode(mode: PerformanceMode): void {
    this.performanceMode = mode;
    this.updateLODConfiguration();
  }

  /**
   * Get LOD statistics for debugging
   */
  public getStatistics(): {
    currentLevel: string;
    textureResolution: number;
    maxCells: number;
    cullingDistance: number;
    lastFrameRate: number;
    adaptiveCooldown: number;
  } {
    return {
      currentLevel: this.currentLODLevel.name,
      textureResolution: this.currentLODLevel.textureResolution,
      maxCells: this.currentLODLevel.maxVisibleCells,
      cullingDistance: this.currentLODLevel.cullingDistance,
      lastFrameRate: this.lastFrameRate,
      adaptiveCooldown: this.adaptiveAdjustmentCooldown
    };
  }

  /**
   * Create default LOD levels based on zoom ranges
   */
  private createDefaultLODLevels(): LODLevel[] {
    const baseTextureRes = this.performanceTier.textureResolution;
    const baseCellCount = this.performanceTier.maxCloudCells;

    return [
      {
        name: 'ultra-low',
        minZoom: 0,
        maxZoom: 8,
        cloudCellSize: 2000, // 2km cells for very low zoom
        textureResolution: Math.max(128, baseTextureRes / 4),
        maxVisibleCells: Math.max(10, Math.floor(baseCellCount * 0.2)),
        cullingDistance: 10000, // 10km
        animationQuality: 'low',
        shaderComplexity: 'simple'
      },
      {
        name: 'low',
        minZoom: 8,
        maxZoom: 12,
        cloudCellSize: 1000, // 1km cells
        textureResolution: Math.max(256, baseTextureRes / 2),
        maxVisibleCells: Math.max(25, Math.floor(baseCellCount * 0.5)),
        cullingDistance: 5000, // 5km
        animationQuality: 'low',
        shaderComplexity: 'simple'
      },
      {
        name: 'medium',
        minZoom: 12,
        maxZoom: 16,
        cloudCellSize: 500, // 500m cells
        textureResolution: baseTextureRes,
        maxVisibleCells: baseCellCount,
        cullingDistance: 2500, // 2.5km
        animationQuality: this.performanceTier.animationQuality,
        shaderComplexity: this.performanceTier.shaderComplexity
      },
      {
        name: 'high',
        minZoom: 16,
        maxZoom: 20,
        cloudCellSize: 250, // 250m cells
        textureResolution: Math.min(2048, baseTextureRes * 1.5),
        maxVisibleCells: Math.floor(baseCellCount * 1.5),
        cullingDistance: 1000, // 1km
        animationQuality: this.performanceTier.animationQuality,
        shaderComplexity: this.performanceTier.shaderComplexity
      },
      {
        name: 'ultra-high',
        minZoom: 20,
        maxZoom: 25,
        cloudCellSize: 100, // 100m cells for very high zoom
        textureResolution: Math.min(4096, baseTextureRes * 2),
        maxVisibleCells: Math.floor(baseCellCount * 2),
        cullingDistance: 500, // 500m
        animationQuality: 'high',
        shaderComplexity: 'advanced'
      }
    ];
  }

  /**
   * Select initial LOD level based on performance tier
   */
  private selectInitialLODLevel(): LODLevel {
    const levels = this.configuration.levels;
    
    // Start with medium level as default
    const mediumLevel = levels.find(level => level.name === 'medium');
    if (mediumLevel) return mediumLevel;
    
    // Fallback to first available level
    return levels[0];
  }

  /**
   * Check if device can handle a specific LOD level
   */
  private canHandleLODLevel(level: LODLevel): boolean {
    // Check texture resolution limits
    if (level.textureResolution > this.performanceTier.textureResolution * 2) {
      return false;
    }

    // Check cell count limits
    if (level.maxVisibleCells > this.performanceTier.maxCloudCells * 2) {
      return false;
    }

    // Check performance mode compatibility
    const modeQualityMap: Record<PerformanceMode, string[]> = {
      low: ['low'],
      medium: ['low', 'medium'],
      high: ['low', 'medium', 'high']
    };

    if (!modeQualityMap[this.performanceMode].includes(level.animationQuality)) {
      return false;
    }

    return true;
  }

  /**
   * Get LOD complexity score for comparison
   */
  private getLODComplexityScore(level: LODLevel): number {
    const qualityWeights = { low: 1, medium: 2, high: 3 };
    const complexityWeights = { simple: 1, standard: 2, advanced: 3 };
    
    return (
      level.textureResolution * 0.001 +
      level.maxVisibleCells * 0.1 +
      qualityWeights[level.animationQuality] * 10 +
      complexityWeights[level.shaderComplexity] * 5 +
      (1000 / level.cloudCellSize) * 2 // Smaller cells = higher complexity
    );
  }

  /**
   * Get closest LOD level for zoom when no exact match
   */
  private getClosestLODLevel(zoomLevel: number): LODLevel {
    const levels = this.configuration.levels;
    let closest = levels[0];
    let minDistance = Math.abs(zoomLevel - (closest.minZoom + closest.maxZoom) / 2);

    for (const level of levels) {
      const levelCenter = (level.minZoom + level.maxZoom) / 2;
      const distance = Math.abs(zoomLevel - levelCenter);
      
      if (distance < minDistance) {
        minDistance = distance;
        closest = level;
      }
    }

    return closest;
  }

  /**
   * Get lower quality LOD level
   */
  private getLowerQualityLOD(currentLOD: LODLevel): LODLevel | null {
    const levels = this.configuration.levels;
    const currentIndex = levels.findIndex(level => level.name === currentLOD.name);
    
    if (currentIndex <= 0) return null;
    
    // Find a lower complexity level
    for (let i = currentIndex - 1; i >= 0; i--) {
      const level = levels[i];
      if (this.getLODComplexityScore(level) < this.getLODComplexityScore(currentLOD)) {
        return level;
      }
    }
    
    return null;
  }

  /**
   * Get higher quality LOD level
   */
  private getHigherQualityLOD(currentLOD: LODLevel): LODLevel | null {
    const levels = this.configuration.levels;
    const currentIndex = levels.findIndex(level => level.name === currentLOD.name);
    
    if (currentIndex >= levels.length - 1) return null;
    
    // Find a higher complexity level
    for (let i = currentIndex + 1; i < levels.length; i++) {
      const level = levels[i];
      if (this.getLODComplexityScore(level) > this.getLODComplexityScore(currentLOD)) {
        return level;
      }
    }
    
    return null;
  }

  /**
   * Check if cell bounds intersect with viewport bounds
   */
  private isInViewport(cellBounds: MapBounds, viewportBounds: MapBounds): boolean {
    return !(
      cellBounds.east < viewportBounds.west ||
      cellBounds.west > viewportBounds.east ||
      cellBounds.north < viewportBounds.south ||
      cellBounds.south > viewportBounds.north
    );
  }

  /**
   * Update LOD configuration based on current performance settings
   */
  private updateLODConfiguration(): void {
    // Recreate LOD levels with updated performance tier
    this.configuration.levels = this.createDefaultLODLevels();
    
    // Reselect current LOD level
    this.currentLODLevel = this.selectInitialLODLevel();
  }
}