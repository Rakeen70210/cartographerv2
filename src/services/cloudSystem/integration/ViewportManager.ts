/**
 * Viewport Management for Cloud System
 * Handles map viewport transformations and zoom level adaptations
 */

import { MapBounds } from '../../../types/cloud';
import { CoordinateConverter, ViewportTransform } from './CoordinateConverter';

export interface ViewportState {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  bounds: MapBounds;
  screenSize: {
    width: number;
    height: number;
  };
}

export interface ZoomLevelConfig {
  minZoom: number;
  maxZoom: number;
  cloudDetailLevels: {
    [key: number]: {
      cellSize: number; // meters
      textureResolution: number;
      maxClouds: number;
    };
  };
}

/**
 * Manages viewport state and transformations for cloud rendering
 */
export class ViewportManager {
  private coordinateConverter: CoordinateConverter;
  private currentViewport: ViewportState | null = null;
  private zoomConfig: ZoomLevelConfig;
  
  // Viewport change callbacks
  private viewportChangeCallbacks: Array<(viewport: ViewportState) => void> = [];
  private zoomChangeCallbacks: Array<(zoom: number, previousZoom: number) => void> = [];

  constructor(zoomConfig?: Partial<ZoomLevelConfig>) {
    this.coordinateConverter = new CoordinateConverter();
    
    // Default zoom configuration
    this.zoomConfig = {
      minZoom: 0,
      maxZoom: 22,
      cloudDetailLevels: {
        0: { cellSize: 10000, textureResolution: 256, maxClouds: 100 },
        5: { cellSize: 5000, textureResolution: 512, maxClouds: 200 },
        10: { cellSize: 1000, textureResolution: 1024, maxClouds: 500 },
        15: { cellSize: 500, textureResolution: 1024, maxClouds: 1000 },
        20: { cellSize: 100, textureResolution: 512, maxClouds: 2000 },
        ...zoomConfig?.cloudDetailLevels
      },
      ...zoomConfig
    };
  }

  /**
   * Update viewport state from map
   */
  updateViewport(
    center: [number, number],
    zoom: number,
    bearing: number = 0,
    pitch: number = 0,
    screenWidth: number,
    screenHeight: number
  ): void {
    const previousZoom = this.currentViewport?.zoom;
    
    // Calculate bounds for current viewport
    const bounds = this.calculateViewportBounds(center, zoom, screenWidth, screenHeight);
    
    const newViewport: ViewportState = {
      center,
      zoom,
      bearing,
      pitch,
      bounds,
      screenSize: {
        width: screenWidth,
        height: screenHeight
      }
    };

    // Update coordinate converter
    const transform: ViewportTransform = {
      center,
      zoom,
      bearing,
      pitch,
      bounds
    };
    
    this.coordinateConverter.updateViewport(transform);
    
    // Store new viewport
    this.currentViewport = newViewport;
    
    // Notify callbacks
    this.notifyViewportChange(newViewport);
    
    if (previousZoom !== undefined && previousZoom !== zoom) {
      this.notifyZoomChange(zoom, previousZoom);
    }
  }

  /**
   * Get current viewport state
   */
  getCurrentViewport(): ViewportState | null {
    return this.currentViewport;
  }

  /**
   * Get coordinate converter instance
   */
  getCoordinateConverter(): CoordinateConverter {
    return this.coordinateConverter;
  }

  /**
   * Calculate appropriate cloud detail level for current zoom
   */
  getCloudDetailLevel(zoom: number): {
    cellSize: number;
    textureResolution: number;
    maxClouds: number;
  } {
    // Find the closest zoom level configuration
    const zoomLevels = Object.keys(this.zoomConfig.cloudDetailLevels)
      .map(Number)
      .sort((a, b) => a - b);
    
    let selectedLevel = zoomLevels[0];
    
    for (const level of zoomLevels) {
      if (zoom >= level) {
        selectedLevel = level;
      } else {
        break;
      }
    }
    
    return this.zoomConfig.cloudDetailLevels[selectedLevel];
  }

  /**
   * Check if viewport bounds intersect with given bounds
   */
  intersectsViewport(bounds: MapBounds): boolean {
    if (!this.currentViewport) {
      return false;
    }

    const viewportBounds = this.currentViewport.bounds;
    
    return !(
      bounds.east < viewportBounds.west ||
      bounds.west > viewportBounds.east ||
      bounds.north < viewportBounds.south ||
      bounds.south > viewportBounds.north
    );
  }

  /**
   * Calculate distance from viewport center to a point
   */
  distanceFromCenter(longitude: number, latitude: number): number {
    if (!this.currentViewport) {
      return Infinity;
    }

    const [centerLng, centerLat] = this.currentViewport.center;
    
    // Simple distance calculation (not accounting for Earth curvature)
    const deltaLng = longitude - centerLng;
    const deltaLat = latitude - centerLat;
    
    return Math.sqrt(deltaLng * deltaLng + deltaLat * deltaLat);
  }

  /**
   * Get visible area in square meters
   */
  getVisibleAreaMeters(): number {
    if (!this.currentViewport) {
      return 0;
    }

    const { bounds, center } = this.currentViewport;
    
    // Calculate width and height in meters
    const widthMeters = this.coordinateConverter.pixelsToMeters(
      this.currentViewport.screenSize.width,
      center[1],
      this.currentViewport.zoom
    );
    
    const heightMeters = this.coordinateConverter.pixelsToMeters(
      this.currentViewport.screenSize.height,
      center[1],
      this.currentViewport.zoom
    );
    
    return widthMeters * heightMeters;
  }

  /**
   * Convert geographic bounds to screen bounds
   */
  boundsToScreen(bounds: MapBounds): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null {
    if (!this.currentViewport) {
      return null;
    }

    const { width, height } = this.currentViewport.screenSize;
    
    return this.coordinateConverter.transformBoundsToScreen(bounds, width, height);
  }

  /**
   * Register callback for viewport changes
   */
  onViewportChange(callback: (viewport: ViewportState) => void): () => void {
    this.viewportChangeCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.viewportChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.viewportChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for zoom changes
   */
  onZoomChange(callback: (zoom: number, previousZoom: number) => void): () => void {
    this.zoomChangeCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.zoomChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.zoomChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Create projection matrix for current viewport
   */
  createProjectionMatrix(): Float32Array | null {
    if (!this.currentViewport) {
      return null;
    }

    const { width, height } = this.currentViewport.screenSize;
    return this.coordinateConverter.createProjectionMatrix(width, height);
  }

  /**
   * Calculate optimal cloud grid size for current zoom
   */
  getOptimalCloudGridSize(): number {
    if (!this.currentViewport) {
      return 1000; // Default 1km grid
    }

    const detailLevel = this.getCloudDetailLevel(this.currentViewport.zoom);
    return detailLevel.cellSize;
  }

  // Private helper methods

  /**
   * Calculate viewport bounds based on center, zoom, and screen size
   */
  private calculateViewportBounds(
    center: [number, number],
    zoom: number,
    screenWidth: number,
    screenHeight: number
  ): MapBounds {
    // Create temporary viewport transform for calculation
    const tempTransform: ViewportTransform = {
      center,
      zoom,
      bearing: 0,
      pitch: 0,
      bounds: { north: 90, south: -90, east: 180, west: -180 } // Placeholder
    };
    
    // Temporarily update coordinate converter
    this.coordinateConverter.updateViewport(tempTransform);
    
    // Calculate bounds using coordinate converter
    return this.coordinateConverter.calculateVisibleBounds(screenWidth, screenHeight);
  }

  /**
   * Notify viewport change callbacks
   */
  private notifyViewportChange(viewport: ViewportState): void {
    for (const callback of this.viewportChangeCallbacks) {
      try {
        callback(viewport);
      } catch (error) {
        console.error('Error in viewport change callback:', error);
      }
    }
  }

  /**
   * Notify zoom change callbacks
   */
  private notifyZoomChange(zoom: number, previousZoom: number): void {
    for (const callback of this.zoomChangeCallbacks) {
      try {
        callback(zoom, previousZoom);
      } catch (error) {
        console.error('Error in zoom change callback:', error);
      }
    }
  }
}