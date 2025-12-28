import { Skia, SkPath, BlurStyle, BlendMode, PathOp } from '@shopify/react-native-skia';
import { GenericExploredArea } from '../../../types/fog';
import { SkiaFogViewport } from '../../../types/skiaFog';

/**
 * Manages the creation and caching of Skia paths for explored areas masking
 */
export class ExplorationMaskManager {
  private cachedPath: SkPath | null = null;
  private lastAreasHash: string = '';
  private lastViewportHash: string = '';

  /**
   * Convert explored areas to a unified Skia Path with memoization
   */
  public getExploredAreasPath(
    exploredAreas: GenericExploredArea[],
    viewport: SkiaFogViewport
  ): SkPath {
    const areasHash = this.hashExploredAreas(exploredAreas);
    const viewportHash = this.hashViewport(viewport);

    // Return cached path if nothing changed
    if (this.cachedPath &&
      areasHash === this.lastAreasHash &&
      viewportHash === this.lastViewportHash) {
      return this.cachedPath;
    }

    // Generate new path
    const path = this.createPathFromAreas(exploredAreas, viewport);

    // Cache the result
    this.cachedPath = path;
    this.lastAreasHash = areasHash;
    this.lastViewportHash = viewportHash;

    return path;
  }

  /**
   * Create a Skia Path from explored areas with efficient union operations
   */
  private createPathFromAreas(
    exploredAreas: GenericExploredArea[],
    viewport: SkiaFogViewport
  ): SkPath {
    const path = Skia.Path.Make();

    if (exploredAreas.length === 0) {
      return path;
    }

    // Convert each explored area to screen coordinates and add to path
    for (const area of exploredAreas) {
      const screenCoords = this.convertToScreenCoordinates(area, viewport);
      if (screenCoords) {
        const circlePath = Skia.Path.Make();
        circlePath.addCircle(screenCoords.x, screenCoords.y, screenCoords.radius);

        // Union with main path for efficient combining
        path.op(circlePath, PathOp.Union);
      }
    }

    return path;
  }

  /**
   * Convert geographic coordinates to screen coordinates
   */
  private convertToScreenCoordinates(
    area: GenericExploredArea,
    viewport: SkiaFogViewport
  ): { x: number; y: number; radius: number } | null {
    // Extract coordinates from different possible formats
    let lat: number, lng: number;

    if (area.center) {
      [lng, lat] = area.center; // GeoJSON format [lng, lat]
    } else if (area.latitude !== undefined && area.longitude !== undefined) {
      lat = area.latitude;
      lng = area.longitude;
    } else {
      console.warn('ExplorationMaskManager: Invalid area coordinates', area);
      return null;
    }

    // Check if area is within viewport bounds
    if (!this.isWithinViewport(lat, lng, viewport)) {
      return null;
    }

    // Convert to screen coordinates
    const x = this.longitudeToScreenX(lng, viewport);
    const y = this.latitudeToScreenY(lat, viewport);

    // Convert radius from meters to screen pixels
    const radiusInPixels = this.metersToScreenPixels(area.radius, lat, viewport);

    return { x, y, radius: radiusInPixels };
  }

  /**
   * Check if coordinates are within viewport bounds
   */
  private isWithinViewport(lat: number, lng: number, viewport: SkiaFogViewport): boolean {
    const { bounds } = viewport;
    return lat >= bounds.south &&
      lat <= bounds.north &&
      lng >= bounds.west &&
      lng <= bounds.east;
  }

  /**
   * Convert longitude to screen X coordinate
   */
  private longitudeToScreenX(lng: number, viewport: SkiaFogViewport): number {
    const { bounds, width } = viewport;
    const lngRange = bounds.east - bounds.west;
    const normalizedX = (lng - bounds.west) / lngRange;
    return normalizedX * width;
  }

  /**
   * Convert latitude to screen Y coordinate
   */
  private latitudeToScreenY(lat: number, viewport: SkiaFogViewport): number {
    const { bounds, height } = viewport;
    const latRange = bounds.north - bounds.south;
    const normalizedY = (bounds.north - lat) / latRange; // Flip Y axis
    return normalizedY * height;
  }

  /**
   * Convert meters to screen pixels based on latitude and viewport
   */
  private metersToScreenPixels(meters: number, lat: number, viewport: SkiaFogViewport): number {
    // Approximate conversion: 1 degree latitude ≈ 111,320 meters
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = metersPerDegreeLat * Math.cos(lat * Math.PI / 180);

    // Convert meters to degrees
    const radiusInDegreesLat = meters / metersPerDegreeLat;
    const radiusInDegreesLng = meters / metersPerDegreeLng;

    // Use the smaller of the two to maintain circular appearance
    const radiusInDegrees = Math.min(radiusInDegreesLat, radiusInDegreesLng);

    // Convert to screen pixels
    const { bounds, height } = viewport;
    const latRange = bounds.north - bounds.south;
    const pixelsPerDegree = height / latRange;

    return radiusInDegrees * pixelsPerDegree;
  }

  /**
   * Create hash for explored areas to detect changes
   */
  private hashExploredAreas(areas: GenericExploredArea[]): string {
    if (areas.length === 0) return 'empty';

    // Create a simple hash based on area count and first/last area properties
    const firstArea = areas[0];
    const lastArea = areas[areas.length - 1];

    const firstCoords = firstArea.center || [firstArea.longitude, firstArea.latitude];
    const lastCoords = lastArea.center || [lastArea.longitude, lastArea.latitude];

    return `${areas.length}_${firstCoords?.[0]}_${firstCoords?.[1]}_${firstArea.radius}_${lastCoords?.[0]}_${lastCoords?.[1]}_${lastArea.radius}`;
  }

  /**
   * Create hash for viewport to detect changes
   */
  private hashViewport(viewport: SkiaFogViewport): string {
    const { bounds, width, height } = viewport;
    return `${width}_${height}_${bounds.north}_${bounds.south}_${bounds.east}_${bounds.west}`;
  }

  /**
   * Clear cached path (useful for memory management)
   */
  public clearCache(): void {
    this.cachedPath = null;
    this.lastAreasHash = '';
    this.lastViewportHash = '';
  }

  /**
   * Get cache statistics for debugging
   */
  public getCacheStats(): { hasCachedPath: boolean; lastAreasHash: string; lastViewportHash: string } {
    return {
      hasCachedPath: this.cachedPath !== null,
      lastAreasHash: this.lastAreasHash,
      lastViewportHash: this.lastViewportHash
    };
  }
}