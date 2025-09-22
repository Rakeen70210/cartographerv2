/**
 * Coordinate System Integration
 * Handles conversion between geographic coordinates and WebGL/screen coordinates
 * Supports different map projections and zoom levels
 */

import { MapBounds } from '../../../types/cloud';

export interface ProjectionMatrix {
  matrix: Float32Array;
  viewport: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ViewportTransform {
  center: [number, number]; // [longitude, latitude]
  zoom: number;
  bearing: number;
  pitch: number;
  bounds: MapBounds;
}

/**
 * Coordinate conversion utilities for cloud system integration
 */
export class CoordinateConverter {
  private static readonly EARTH_RADIUS = 6378137; // Earth radius in meters (WGS84)
  private static readonly EARTH_CIRCUMFERENCE = 2 * Math.PI * CoordinateConverter.EARTH_RADIUS;
  
  // Projection cache for performance
  private projectionCache = new Map<string, [number, number]>();
  private inverseCache = new Map<string, [number, number]>();
  private maxCacheSize = 2000;
  
  // Current viewport state
  private currentTransform: ViewportTransform | null = null;
  private projectionMatrix: ProjectionMatrix | null = null;

  /**
   * Update viewport transformation parameters
   */
  updateViewport(transform: ViewportTransform): void {
    this.currentTransform = transform;
    
    // Clear caches when viewport changes significantly
    if (this.shouldClearCache(transform)) {
      this.clearCaches();
    }
    
    // Update projection matrix
    this.updateProjectionMatrix(transform);
  }

  /**
   * Convert geographic coordinates to Web Mercator projection
   */
  geographicToWebMercator(longitude: number, latitude: number): [number, number] {
    const cacheKey = `${longitude.toFixed(6)},${latitude.toFixed(6)}`;
    
    if (this.projectionCache.has(cacheKey)) {
      return this.projectionCache.get(cacheKey)!;
    }

    // Clamp latitude to valid Web Mercator range
    const clampedLat = Math.max(-85.0511, Math.min(85.0511, latitude));
    
    // Convert to Web Mercator
    const x = (longitude + 180) / 360;
    const latRad = clampedLat * Math.PI / 180;
    const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
    
    const result: [number, number] = [x, y];
    this.cacheProjection(cacheKey, result);
    
    return result;
  }

  /**
   * Convert Web Mercator coordinates back to geographic
   */
  webMercatorToGeographic(x: number, y: number): [number, number] {
    const cacheKey = `${x.toFixed(6)},${y.toFixed(6)}`;
    
    if (this.inverseCache.has(cacheKey)) {
      return this.inverseCache.get(cacheKey)!;
    }

    const longitude = x * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y)));
    const latitude = latRad * 180 / Math.PI;
    
    const result: [number, number] = [longitude, latitude];
    this.cacheInverseProjection(cacheKey, result);
    
    return result;
  }

  /**
   * Convert geographic coordinates to screen/WebGL coordinates
   */
  geographicToScreen(longitude: number, latitude: number, screenWidth: number, screenHeight: number): [number, number] {
    if (!this.currentTransform) {
      throw new Error('Viewport transform not set');
    }

    // First convert to Web Mercator
    const [mercX, mercY] = this.geographicToWebMercator(longitude, latitude);
    
    // Then convert to screen coordinates based on current viewport
    const screenCoords = this.mercatorToScreen(mercX, mercY, screenWidth, screenHeight);
    
    return screenCoords;
  }

  /**
   * Convert screen coordinates back to geographic
   */
  screenToGeographic(screenX: number, screenY: number, screenWidth: number, screenHeight: number): [number, number] {
    if (!this.currentTransform) {
      throw new Error('Viewport transform not set');
    }

    // Convert screen to Web Mercator
    const [mercX, mercY] = this.screenToMercator(screenX, screenY, screenWidth, screenHeight);
    
    // Convert Web Mercator to geographic
    return this.webMercatorToGeographic(mercX, mercY);
  }

  /**
   * Calculate zoom-based scale factor for cloud detail
   */
  getZoomScaleFactor(zoom: number): number {
    // Scale factor increases exponentially with zoom
    // At zoom 0: scale = 1, at zoom 10: scale = 1024, etc.
    return Math.pow(2, zoom);
  }

  /**
   * Calculate meters per pixel at given latitude and zoom level
   */
  getMetersPerPixel(latitude: number, zoom: number): number {
    const latRad = latitude * Math.PI / 180;
    const metersPerPixel = CoordinateConverter.EARTH_CIRCUMFERENCE * Math.cos(latRad) / Math.pow(2, zoom + 8);
    return metersPerPixel;
  }

  /**
   * Convert geographic distance to screen pixels
   */
  metersToPixels(meters: number, latitude: number, zoom: number): number {
    const metersPerPixel = this.getMetersPerPixel(latitude, zoom);
    return meters / metersPerPixel;
  }

  /**
   * Convert screen pixels to geographic distance
   */
  pixelsToMeters(pixels: number, latitude: number, zoom: number): number {
    const metersPerPixel = this.getMetersPerPixel(latitude, zoom);
    return pixels * metersPerPixel;
  }

  /**
   * Calculate visible bounds for cloud culling
   */
  calculateVisibleBounds(screenWidth: number, screenHeight: number, padding = 0.1): MapBounds {
    if (!this.currentTransform) {
      throw new Error('Viewport transform not set');
    }

    // Add padding to ensure clouds just outside viewport are rendered
    const paddedWidth = screenWidth * (1 + padding * 2);
    const paddedHeight = screenHeight * (1 + padding * 2);
    const offsetX = screenWidth * padding;
    const offsetY = screenHeight * padding;

    // Calculate corner coordinates
    const [westLng, northLat] = this.screenToGeographic(-offsetX, -offsetY, screenWidth, screenHeight);
    const [eastLng, southLat] = this.screenToGeographic(paddedWidth - offsetX, paddedHeight - offsetY, screenWidth, screenHeight);

    return {
      north: Math.max(northLat, southLat),
      south: Math.min(northLat, southLat),
      east: Math.max(westLng, eastLng),
      west: Math.min(westLng, eastLng)
    };
  }

  /**
   * Create projection matrix for WebGL rendering
   */
  createProjectionMatrix(screenWidth: number, screenHeight: number): Float32Array {
    if (!this.currentTransform) {
      throw new Error('Viewport transform not set');
    }

    // Create orthographic projection matrix for 2D rendering
    const left = 0;
    const right = screenWidth;
    const bottom = screenHeight;
    const top = 0;
    const near = -1;
    const far = 1;

    const matrix = new Float32Array(16);
    
    // Orthographic projection matrix
    matrix[0] = 2 / (right - left);
    matrix[1] = 0;
    matrix[2] = 0;
    matrix[3] = 0;
    
    matrix[4] = 0;
    matrix[5] = 2 / (top - bottom);
    matrix[6] = 0;
    matrix[7] = 0;
    
    matrix[8] = 0;
    matrix[9] = 0;
    matrix[10] = -2 / (far - near);
    matrix[11] = 0;
    
    matrix[12] = -(right + left) / (right - left);
    matrix[13] = -(top + bottom) / (top - bottom);
    matrix[14] = -(far + near) / (far - near);
    matrix[15] = 1;

    return matrix;
  }

  /**
   * Transform geographic bounds to screen bounds
   */
  transformBoundsToScreen(bounds: MapBounds, screenWidth: number, screenHeight: number): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    // Transform all four corners
    const [minX1, maxY1] = this.geographicToScreen(bounds.west, bounds.north, screenWidth, screenHeight);
    const [maxX1, maxY2] = this.geographicToScreen(bounds.east, bounds.north, screenWidth, screenHeight);
    const [minX2, minY1] = this.geographicToScreen(bounds.west, bounds.south, screenWidth, screenHeight);
    const [maxX2, minY2] = this.geographicToScreen(bounds.east, bounds.south, screenWidth, screenHeight);

    return {
      minX: Math.min(minX1, minX2),
      minY: Math.min(minY1, minY2),
      maxX: Math.max(maxX1, maxX2),
      maxY: Math.max(maxY1, maxY2)
    };
  }

  // Private helper methods

  /**
   * Convert Web Mercator to screen coordinates
   */
  private mercatorToScreen(mercX: number, mercY: number, screenWidth: number, screenHeight: number): [number, number] {
    if (!this.currentTransform) {
      throw new Error('Viewport transform not set');
    }

    const { center, zoom } = this.currentTransform;
    const [centerMercX, centerMercY] = this.geographicToWebMercator(center[0], center[1]);
    
    // Calculate scale based on zoom level
    const scale = Math.pow(2, zoom);
    
    // Calculate offset from center
    const offsetX = (mercX - centerMercX) * scale * screenWidth;
    const offsetY = (mercY - centerMercY) * scale * screenHeight;
    
    // Convert to screen coordinates
    const screenX = screenWidth / 2 + offsetX;
    const screenY = screenHeight / 2 + offsetY;
    
    return [screenX, screenY];
  }

  /**
   * Convert screen coordinates to Web Mercator
   */
  private screenToMercator(screenX: number, screenY: number, screenWidth: number, screenHeight: number): [number, number] {
    if (!this.currentTransform) {
      throw new Error('Viewport transform not set');
    }

    const { center, zoom } = this.currentTransform;
    const [centerMercX, centerMercY] = this.geographicToWebMercator(center[0], center[1]);
    
    // Calculate scale based on zoom level
    const scale = Math.pow(2, zoom);
    
    // Calculate offset from screen center
    const offsetX = (screenX - screenWidth / 2) / (scale * screenWidth);
    const offsetY = (screenY - screenHeight / 2) / (scale * screenHeight);
    
    // Convert to Web Mercator coordinates
    const mercX = centerMercX + offsetX;
    const mercY = centerMercY + offsetY;
    
    return [mercX, mercY];
  }

  /**
   * Update projection matrix based on viewport transform
   */
  private updateProjectionMatrix(transform: ViewportTransform): void {
    // This will be used for more complex 3D projections in the future
    // For now, we store the transform for use in coordinate conversions
    this.projectionMatrix = {
      matrix: new Float32Array(16), // Identity matrix for now
      viewport: {
        x: 0,
        y: 0,
        width: 1024, // Default values, will be updated when screen size is known
        height: 1024
      }
    };
  }

  /**
   * Check if cache should be cleared due to significant viewport change
   */
  private shouldClearCache(newTransform: ViewportTransform): boolean {
    if (!this.currentTransform) {
      return true;
    }

    const oldTransform = this.currentTransform;
    
    // Clear cache if zoom changed significantly
    if (Math.abs(newTransform.zoom - oldTransform.zoom) > 1) {
      return true;
    }
    
    // Clear cache if center moved significantly
    const centerDistance = Math.sqrt(
      Math.pow(newTransform.center[0] - oldTransform.center[0], 2) +
      Math.pow(newTransform.center[1] - oldTransform.center[1], 2)
    );
    
    if (centerDistance > 0.01) { // ~1km at equator
      return true;
    }
    
    return false;
  }

  /**
   * Clear all coordinate caches
   */
  private clearCaches(): void {
    this.projectionCache.clear();
    this.inverseCache.clear();
  }

  /**
   * Cache projection result with LRU-like behavior
   */
  private cacheProjection(key: string, coords: [number, number]): void {
    if (this.projectionCache.size >= this.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.projectionCache.entries());
      const keepCount = Math.floor(this.maxCacheSize * 0.7);
      
      this.projectionCache.clear();
      
      for (let i = entries.length - keepCount; i < entries.length; i++) {
        this.projectionCache.set(entries[i][0], entries[i][1]);
      }
    }
    
    this.projectionCache.set(key, coords);
  }

  /**
   * Cache inverse projection result
   */
  private cacheInverseProjection(key: string, coords: [number, number]): void {
    if (this.inverseCache.size >= this.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.inverseCache.entries());
      const keepCount = Math.floor(this.maxCacheSize * 0.7);
      
      this.inverseCache.clear();
      
      for (let i = entries.length - keepCount; i < entries.length; i++) {
        this.inverseCache.set(entries[i][0], entries[i][1]);
      }
    }
    
    this.inverseCache.set(key, coords);
  }
}