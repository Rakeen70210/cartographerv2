import { ExploredArea } from '../database/services';
import { FogGeometry, FogFeature, GeographicArea, SpatialGrid, GridCell, BoundingBox } from '../types/fog';
import { getPerformanceMonitorService, LevelOfDetailSettings } from './performanceMonitorService';
import { getMemoryManagementService } from './memoryManagementService';

export class FogService {
  private spatialGrid: SpatialGrid;
  private readonly CELL_SIZE = 0.01; // ~1km at equator
  private readonly DEFAULT_EXPLORATION_RADIUS = 100; // meters
  private performanceMonitorService = getPerformanceMonitorService();
  private memoryManagementService = getMemoryManagementService();
  private fogGeometryCache: Map<string, { geometry: FogGeometry; timestamp: number; zoomLevel: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds

  constructor() {
    this.spatialGrid = {
      cellSize: this.CELL_SIZE,
      cells: new Map()
    };
  }

  /**
   * Generate fog geometry based on explored areas with performance optimizations
   */
  generateFogGeometry(exploredAreas: ExploredArea[], zoomLevel: number = 10, bounds?: BoundingBox): FogGeometry {
    const startTime = performance.now();
    
    console.log('🌫️ FogService.generateFogGeometry called:', {
      exploredAreasCount: exploredAreas.length,
      zoomLevel,
      hasBounds: !!bounds
    });
    
    // Check cache first
    const cacheKey = this.generateCacheKey(exploredAreas, zoomLevel, bounds);
    const cached = this.fogGeometryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      const endTime = performance.now();
      this.performanceMonitorService.recordFogGenerationMetrics(endTime - startTime, cached.geometry.features.length);
      console.log('🌫️ Returning cached fog geometry with', cached.geometry.features.length, 'features');
      return cached.geometry;
    }

    // Get level of detail settings for current zoom
    const lodSettings = this.performanceMonitorService.getLODSettings(zoomLevel);
    
    // Update spatial grid with explored areas using LOD
    this.updateSpatialGridWithLOD(exploredAreas, lodSettings, bounds);

    // Generate fog features based on unexplored grid cells
    let fogFeatures = this.generateFogFeaturesWithLOD(lodSettings, bounds);

    // If no fog features were generated (e.g., no unexplored areas), create a default fog area
    if (fogFeatures.length === 0) {
      console.log('🌫️ No fog features generated, creating default fog coverage');
      fogFeatures = this.generateDefaultFogCoverage(bounds);
    }

    const geometry: FogGeometry = {
      type: 'FeatureCollection',
      features: fogFeatures
    };

    // Cache the result
    this.fogGeometryCache.set(cacheKey, {
      geometry,
      timestamp: Date.now(),
      zoomLevel
    });

    // Clean old cache entries
    this.cleanFogGeometryCache();

    // Record performance metrics
    const endTime = performance.now();
    const generationDuration = endTime - startTime;
    this.performanceMonitorService.recordFogGenerationMetrics(generationDuration, fogFeatures.length);
    
    console.log(`🌫️ Fog geometry generated in ${generationDuration.toFixed(2)}ms for zoom ${zoomLevel} with ${fogFeatures.length} features`);

    return geometry;
  }

  /**
   * Update spatial grid with explored areas using level of detail
   */
  private updateSpatialGridWithLOD(exploredAreas: ExploredArea[], lodSettings: LevelOfDetailSettings, bounds?: BoundingBox): void {
    // Use adaptive cell size based on zoom level
    const adaptiveCellSize = lodSettings.fogCellSize;
    
    // Clear existing explored status only for cells in bounds
    if (bounds) {
      this.clearCellsInBounds(bounds);
    } else {
      this.spatialGrid.cells.forEach(cell => {
        cell.explored = false;
        cell.fogOpacity = 1.0;
      });
    }

    // Mark cells as explored based on areas, but only process areas in bounds
    const relevantAreas = bounds ? 
      exploredAreas.filter(area => this.isAreaInBounds(area, bounds)) : 
      exploredAreas;

    relevantAreas.forEach(area => {
      const affectedCells = this.getCellsInRadiusWithLOD(
        area.latitude,
        area.longitude,
        area.radius || this.DEFAULT_EXPLORATION_RADIUS,
        adaptiveCellSize
      );

      affectedCells.forEach(cellId => {
        let cell = this.spatialGrid.cells.get(cellId);
        if (!cell) {
          cell = this.createGridCellWithSize(cellId, adaptiveCellSize);
          this.spatialGrid.cells.set(cellId, cell);
        }
        
        cell.explored = true;
        cell.exploredAt = new Date(area.explored_at);
        cell.fogOpacity = 0.0;
      });
    });
  }

  /**
   * Update spatial grid with explored areas (legacy method for compatibility)
   */
  private updateSpatialGrid(exploredAreas: ExploredArea[]): void {
    const defaultLOD: LevelOfDetailSettings = {
      zoomLevel: 10,
      fogCellSize: this.CELL_SIZE,
      maxFogFeatures: 1000,
      cloudComplexity: 0.7,
      particleQuality: 'medium',
      enableAnimations: true
    };
    
    this.updateSpatialGridWithLOD(exploredAreas, defaultLOD);
  }

  /**
   * Get grid cells within radius of a point
   */
  private getCellsInRadius(lat: number, lng: number, radiusMeters: number): string[] {
    const radiusDegrees = radiusMeters / 111320; // Convert meters to degrees (approximate)
    const cellIds: string[] = [];

    const minLat = lat - radiusDegrees;
    const maxLat = lat + radiusDegrees;
    const minLng = lng - radiusDegrees;
    const maxLng = lng + radiusDegrees;

    // Iterate through grid cells in the bounding box
    for (let cellLat = Math.floor(minLat / this.CELL_SIZE) * this.CELL_SIZE; 
         cellLat <= maxLat; 
         cellLat += this.CELL_SIZE) {
      for (let cellLng = Math.floor(minLng / this.CELL_SIZE) * this.CELL_SIZE; 
           cellLng <= maxLng; 
           cellLng += this.CELL_SIZE) {
        
        // Check if cell center is within radius
        const distance = this.calculateDistance(lat, lng, cellLat, cellLng);
        if (distance <= radiusMeters) {
          const cellId = this.getCellId(cellLat, cellLng);
          cellIds.push(cellId);
        }
      }
    }

    return cellIds;
  }

  /**
   * Calculate distance between two points in meters
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Create a grid cell for the given coordinates
   */
  private createGridCell(cellId: string): GridCell {
    const [latStr, lngStr] = cellId.split('_');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    return {
      id: cellId,
      bounds: {
        north: lat + this.CELL_SIZE / 2,
        south: lat - this.CELL_SIZE / 2,
        east: lng + this.CELL_SIZE / 2,
        west: lng - this.CELL_SIZE / 2
      },
      explored: false,
      fogOpacity: 1.0
    };
  }

  /**
   * Get cell ID for coordinates
   */
  private getCellId(lat: number, lng: number): string {
    const cellLat = Math.floor(lat / this.CELL_SIZE) * this.CELL_SIZE;
    const cellLng = Math.floor(lng / this.CELL_SIZE) * this.CELL_SIZE;
    return `${cellLat.toFixed(6)}_${cellLng.toFixed(6)}`;
  }

  /**
   * Generate fog features from spatial grid with level of detail optimization
   */
  private generateFogFeaturesWithLOD(lodSettings: LevelOfDetailSettings, bounds?: BoundingBox): FogFeature[] {
    const features: FogFeature[] = [];

    // Get unexplored cells, filtered by bounds if provided
    let unexploredCells = Array.from(this.spatialGrid.cells.values())
      .filter(cell => !cell.explored);

    if (bounds) {
      unexploredCells = unexploredCells.filter(cell => this.isCellInBounds(cell, bounds));
    }

    // Limit features based on LOD settings
    if (unexploredCells.length > lodSettings.maxFogFeatures) {
      // Use spatial sampling to reduce feature count while maintaining coverage
      unexploredCells = this.spatialSampleCells(unexploredCells, lodSettings.maxFogFeatures);
    }

    // Group adjacent cells into larger polygons for better performance
    const mergedPolygons = this.mergeAdjacentCells(unexploredCells);

    mergedPolygons.forEach(polygon => {
      // Validate polygon coordinates before creating feature
      if (polygon.coordinates && polygon.coordinates.length >= 4) {
        const feature: FogFeature = {
          type: 'Feature',
          properties: {
            opacity: polygon.opacity,
            type: 'fog',
            cellCount: polygon.cellCount
          },
          geometry: {
            type: 'Polygon',
            coordinates: [polygon.coordinates] // Array of coordinate rings
          }
        };
        features.push(feature);
      } else {
        console.warn('🌫️ Skipping invalid polygon with insufficient coordinates:', polygon.coordinates?.length);
      }
    });

    return features;
  }

  /**
   * Generate fog features from spatial grid (legacy method for compatibility)
   */
  private generateFogFeatures(): FogFeature[] {
    const defaultLOD: LevelOfDetailSettings = {
      zoomLevel: 10,
      fogCellSize: this.CELL_SIZE,
      maxFogFeatures: 1000,
      cloudComplexity: 0.7,
      particleQuality: 'medium',
      enableAnimations: true
    };
    
    return this.generateFogFeaturesWithLOD(defaultLOD);
  }

  /**
   * Check if a location is in an explored area
   */
  isLocationExplored(lat: number, lng: number): boolean {
    const cellId = this.getCellId(lat, lng);
    const cell = this.spatialGrid.cells.get(cellId);
    return cell?.explored || false;
  }

  /**
   * Get fog opacity at a specific location
   */
  getFogOpacityAtLocation(lat: number, lng: number): number {
    const cellId = this.getCellId(lat, lng);
    const cell = this.spatialGrid.cells.get(cellId);
    return cell?.fogOpacity || 1.0;
  }

  /**
   * Get geographic area from coordinates and radius
   */
  getGeographicArea(lat: number, lng: number, radiusMeters: number): GeographicArea {
    const radiusDegrees = radiusMeters / 111320;
    
    return {
      center: [lng, lat],
      radius: radiusMeters,
      bounds: {
        north: lat + radiusDegrees,
        south: lat - radiusDegrees,
        east: lng + radiusDegrees,
        west: lng - radiusDegrees
      }
    };
  }

  /**
   * Calculate exploration percentage
   */
  calculateExplorationPercentage(exploredAreas: ExploredArea[]): number {
    if (exploredAreas.length === 0) return 0;

    const totalExploredCells = new Set<string>();
    
    exploredAreas.forEach(area => {
      const cellsInArea = this.getCellsInRadius(
        area.latitude,
        area.longitude,
        area.radius || this.DEFAULT_EXPLORATION_RADIUS
      );
      cellsInArea.forEach(cellId => totalExploredCells.add(cellId));
    });

    // This is a simplified calculation - in reality you'd want to define
    // what constitutes "100%" exploration (e.g., all land areas, specific regions, etc.)
    const totalPossibleCells = 64800000; // Approximate number of 1km cells on Earth's surface
    return (totalExploredCells.size / totalPossibleCells) * 100;
  }

  /**
   * Optimize fog geometry for specific zoom level
   */
  optimizeGeometryForZoom(geometry: FogGeometry, zoomLevel: number): FogGeometry {
    const lodSettings = this.performanceMonitorService.getLODSettings(zoomLevel);
    
    if (geometry.features.length <= lodSettings.maxFogFeatures) {
      return geometry;
    }

    // Simplify geometry by reducing feature count
    const simplifiedFeatures = geometry.features.slice(0, lodSettings.maxFogFeatures);
    
    return {
      type: 'FeatureCollection',
      features: simplifiedFeatures
    };
  }

  /**
   * Calculate level of detail for zoom level
   */
  calculateLevelOfDetail(zoomLevel: number): number {
    if (zoomLevel <= 3) return 0.2;
    if (zoomLevel <= 6) return 0.4;
    if (zoomLevel <= 10) return 0.6;
    if (zoomLevel <= 14) return 0.8;
    return 1.0;
  }

  /**
   * Check if area is explored
   */
  isAreaExplored(lat: number, lng: number): boolean {
    return this.isLocationExplored(lat, lng);
  }

  /**
   * Update fog geometry (for external calls)
   */
  async updateFogGeometry(): Promise<{ success: boolean }> {
    try {
      // This would typically be called by the fog location integration service
      // For now, just return success
      return { success: true };
    } catch (error) {
      console.error('Failed to update fog geometry:', error);
      return { success: false };
    }
  }

  // New helper methods for performance optimization

  private generateCacheKey(exploredAreas: ExploredArea[], zoomLevel: number, bounds?: BoundingBox): string {
    const areasHash = exploredAreas.map(a => `${a.latitude},${a.longitude},${a.radius}`).join('|');
    const boundsStr = bounds ? `${bounds.north},${bounds.south},${bounds.east},${bounds.west}` : 'all';
    return `${areasHash}_${zoomLevel}_${boundsStr}`;
  }

  private cleanFogGeometryCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.fogGeometryCache.forEach((value, key) => {
      if (now - value.timestamp > this.CACHE_DURATION) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.fogGeometryCache.delete(key));
  }

  private clearCellsInBounds(bounds: BoundingBox): void {
    this.spatialGrid.cells.forEach((cell, cellId) => {
      if (this.isCellInBounds(cell, bounds)) {
        cell.explored = false;
        cell.fogOpacity = 1.0;
      }
    });
  }

  private isAreaInBounds(area: ExploredArea, bounds: BoundingBox): boolean {
    return area.latitude >= bounds.south && 
           area.latitude <= bounds.north && 
           area.longitude >= bounds.west && 
           area.longitude <= bounds.east;
  }

  private isCellInBounds(cell: GridCell, bounds: BoundingBox): boolean {
    return cell.bounds.north >= bounds.south && 
           cell.bounds.south <= bounds.north && 
           cell.bounds.east >= bounds.west && 
           cell.bounds.west <= bounds.east;
  }

  private getCellsInRadiusWithLOD(lat: number, lng: number, radiusMeters: number, cellSize: number): string[] {
    const radiusDegrees = radiusMeters / 111320;
    const cellIds: string[] = [];

    const minLat = lat - radiusDegrees;
    const maxLat = lat + radiusDegrees;
    const minLng = lng - radiusDegrees;
    const maxLng = lng + radiusDegrees;

    for (let cellLat = Math.floor(minLat / cellSize) * cellSize; 
         cellLat <= maxLat; 
         cellLat += cellSize) {
      for (let cellLng = Math.floor(minLng / cellSize) * cellSize; 
           cellLng <= maxLng; 
           cellLng += cellSize) {
        
        const distance = this.calculateDistance(lat, lng, cellLat, cellLng);
        if (distance <= radiusMeters) {
          const cellId = this.getCellIdWithSize(cellLat, cellLng, cellSize);
          cellIds.push(cellId);
        }
      }
    }

    return cellIds;
  }

  private createGridCellWithSize(cellId: string, cellSize: number): GridCell {
    const [latStr, lngStr] = cellId.split('_');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    return {
      id: cellId,
      bounds: {
        north: lat + cellSize / 2,
        south: lat - cellSize / 2,
        east: lng + cellSize / 2,
        west: lng - cellSize / 2
      },
      explored: false,
      fogOpacity: 1.0
    };
  }

  private getCellIdWithSize(lat: number, lng: number, cellSize: number): string {
    const cellLat = Math.floor(lat / cellSize) * cellSize;
    const cellLng = Math.floor(lng / cellSize) * cellSize;
    return `${cellLat.toFixed(6)}_${cellLng.toFixed(6)}`;
  }

  private spatialSampleCells(cells: GridCell[], maxCount: number): GridCell[] {
    if (cells.length <= maxCount) return cells;

    // Use spatial sampling to maintain good coverage
    const step = Math.ceil(cells.length / maxCount);
    const sampled: GridCell[] = [];
    
    for (let i = 0; i < cells.length; i += step) {
      sampled.push(cells[i]);
      if (sampled.length >= maxCount) break;
    }
    
    return sampled;
  }

  private mergeAdjacentCells(cells: GridCell[]): Array<{
    coordinates: number[][];
    opacity: number;
    cellCount: number;
  }> {
    // For now, return individual cell polygons
    // In a full implementation, you would merge adjacent cells into larger polygons
    return cells.map(cell => {
      // Ensure coordinates are properly formatted for Mapbox polygons
      const coordinates = [
        [cell.bounds.west, cell.bounds.south],   // Southwest corner
        [cell.bounds.east, cell.bounds.south],   // Southeast corner
        [cell.bounds.east, cell.bounds.north],   // Northeast corner
        [cell.bounds.west, cell.bounds.north],   // Northwest corner
        [cell.bounds.west, cell.bounds.south]    // Close the polygon
      ];

      return {
        coordinates,
        opacity: cell.fogOpacity,
        cellCount: 1
      };
    });
  }

  /**
   * Generate default fog coverage when no explored areas exist
   */
  private generateDefaultFogCoverage(bounds?: BoundingBox): FogFeature[] {
    console.log('🌫️ Generating default fog coverage');
    
    // Define default bounds if none provided (covers a reasonable area around current user location)
    const defaultBounds = bounds || {
      north: 37.45,   // Adjusted to be around Mountain View/Palo Alto area
      south: 37.35,
      east: -122.0,
      west: -122.15
    };

    // Create a grid of fog cells covering the bounds
    const features: FogFeature[] = [];
    const cellSize = this.CELL_SIZE;
    
    // Generate fog cells in a grid pattern
    for (let lat = defaultBounds.south; lat < defaultBounds.north; lat += cellSize) {
      for (let lng = defaultBounds.west; lng < defaultBounds.east; lng += cellSize) {
        // Ensure coordinates are properly formatted for Mapbox
        const coordinates = [
          [lng, lat],                    // Southwest corner
          [lng + cellSize, lat],         // Southeast corner
          [lng + cellSize, lat + cellSize], // Northeast corner
          [lng, lat + cellSize],         // Northwest corner
          [lng, lat]                     // Close the polygon (repeat first point)
        ];

        // Validate that we have at least 4 points and the polygon is closed
        if (coordinates.length >= 4) {
          const feature: FogFeature = {
            type: 'Feature',
            properties: {
              opacity: 0.8,
              type: 'fog'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [coordinates] // Note: coordinates is an array of rings
            }
          };
          features.push(feature);
        }
      }
    }

    console.log(`🌫️ Generated ${features.length} default fog features`);
    return features;
  }
}

// Singleton instance
let fogService: FogService | null = null;

export const getFogService = (): FogService => {
  if (!fogService) {
    fogService = new FogService();
  }
  return fogService;
};