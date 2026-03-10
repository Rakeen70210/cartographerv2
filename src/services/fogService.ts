import { ExploredArea } from '../database/services';
import { FogGeometry, FogFeature, GeographicArea, SpatialGrid, GridCell, BoundingBox, GenericExploredArea } from '../types/fog';
import { getPerformanceMonitorService, LevelOfDetailSettings } from './performanceMonitorService';
import { getMemoryManagementService } from './memoryManagementService';
import { debugLog } from '../utils/logger';
import * as turf from '@turf/turf';
import { Feature, MultiPolygon, Polygon } from 'geojson';

type FogInputArea = ExploredArea | GenericExploredArea;

export class FogService {
  private spatialGrid: SpatialGrid;
  private readonly CELL_SIZE = 0.01; // ~1km at equator
  private readonly DEFAULT_EXPLORATION_RADIUS = 100; // meters
  private readonly MAX_BOOLEAN_OPERATION_AREAS = 250;
  private readonly MAX_BOOLEAN_OPERATION_TIME_MS = 80;
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
  generateFogGeometry(exploredAreas: FogInputArea[], zoomLevel: number = 10, bounds?: BoundingBox): FogGeometry {
    const startTime = performance.now();
    const normalizedAreas = this.normalizeExploredAreas(exploredAreas);

    debugLog('FogService', 'generateFogGeometry called', {
      exploredAreasCount: normalizedAreas.length,
      zoomLevel,
      hasBounds: !!bounds
    });

    // Check cache first
    const cacheKey = this.generateCacheKey(normalizedAreas, zoomLevel, bounds);
    const cached = this.fogGeometryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      this.performanceMonitorService.recordFrame();
      debugLog('FogService', `Returning cached fog geometry with ${cached.geometry.features.length} features`);
      return cached.geometry;
    }

    // Get level of detail settings for current zoom
    const lodSettings = this.performanceMonitorService.getLODSettings(zoomLevel);

    let fogFeatures: FogFeature[] = [];
    if (zoomLevel <= 3.5) {
      // At globe-level zoom, render continuous fog to avoid visible tile checkerboarding.
      fogFeatures = this.generateDefaultFogCoverage(bounds);
    } else if (normalizedAreas.length === 0) {
      // Render a continuous fog field when nothing has been explored yet.
      fogFeatures = this.generateDefaultFogCoverage(bounds);
    } else if (bounds) {
      const mergedFogFeatures = this.generateMergedFogFeatures(normalizedAreas, zoomLevel, bounds);
      if (mergedFogFeatures) {
        fogFeatures = mergedFogFeatures;
      } else {
        // Fall back to the legacy cell-based approach when polygon boolean ops are too expensive.
        this.updateSpatialGridWithLOD(normalizedAreas, lodSettings, bounds);
        fogFeatures = this.generateFogFeaturesWithLOD(lodSettings, bounds);
      }
    } else {
      // Update spatial grid with explored areas using LOD
      this.updateSpatialGridWithLOD(normalizedAreas, lodSettings, bounds);
      // Generate fog features based on unexplored grid cells
      fogFeatures = this.generateFogFeaturesWithLOD(lodSettings, bounds);
    }

    // If no fog features were generated (e.g., no unexplored areas), create a default fog area
    if (fogFeatures.length === 0) {
      debugLog('FogService', 'No fog features generated, creating default fog coverage');
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
    this.performanceMonitorService.recordFrame();

    debugLog('FogService', `Fog geometry generated in ${(endTime - startTime).toFixed(2)}ms for zoom ${zoomLevel} with ${fogFeatures.length} features`);

    return geometry;
  }

  /**
   * Update spatial grid with explored areas using level of detail
   */
  private updateSpatialGridWithLOD(exploredAreas: ExploredArea[], lodSettings: LevelOfDetailSettings, bounds?: BoundingBox): void {
    // Use adaptive cell size based on zoom level
    const adaptiveCellSize = lodSettings.fogCellSize;

    // First, populate the grid with ALL cells in the bounds as unexplored
    // This is crucial - we need unexplored cells to generate fog!
    if (bounds) {
      this.populateCellsInBounds(bounds, adaptiveCellSize);
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
   * Populate the grid with unexplored cells for the given bounds
   */
  private populateCellsInBounds(bounds: BoundingBox, cellSize: number): void {
    // Limit the number of cells to prevent memory issues
    const MAX_CELLS = 2000;
    const latRange = bounds.north - bounds.south;
    const lngRange = bounds.east - bounds.west;
    const estimatedCells = (latRange / cellSize) * (lngRange / cellSize);

    // If too many cells, increase cell size
    let effectiveCellSize = cellSize;
    if (estimatedCells > MAX_CELLS) {
      const scaleFactor = Math.sqrt(estimatedCells / MAX_CELLS);
      effectiveCellSize = cellSize * scaleFactor;
      debugLog('FogService', `Adjusted cell size to ${effectiveCellSize.toFixed(4)} to limit cells to ~${MAX_CELLS}`);
    }

    // Clear existing cells in bounds first
    this.clearCellsInBounds(bounds);

    // Populate with unexplored cells
    let cellCount = 0;
    for (let lat = bounds.south; lat < bounds.north && cellCount < MAX_CELLS; lat += effectiveCellSize) {
      for (let lng = bounds.west; lng < bounds.east && cellCount < MAX_CELLS; lng += effectiveCellSize) {
        // Use getCellIdWithSize to ensure cellId matches the effectiveCellSize
        const cellId = this.getCellIdWithSize(lat, lng, effectiveCellSize);
        if (!this.spatialGrid.cells.has(cellId)) {
          const cell = this.createGridCellWithSize(cellId, effectiveCellSize);
          cell.explored = false;
          cell.fogOpacity = 1.0;
          this.spatialGrid.cells.set(cellId, cell);
          cellCount++;
        }
      }
    }

    debugLog('FogService', `Populated ${cellCount} unexplored cells in bounds`);
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
      // Aggregate cells into coarser buckets instead of sparse sampling to avoid checkerboard artifacts.
      unexploredCells = this.aggregateCellsForLOD(unexploredCells, lodSettings.maxFogFeatures);
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
        debugLog('FogService', `Skipping invalid polygon with insufficient coordinates: ${polygon.coordinates?.length}`);
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

  private normalizeExploredAreas(exploredAreas: FogInputArea[]): ExploredArea[] {
    return exploredAreas
      .map((area): ExploredArea | null => {
        const center = 'center' in area ? area.center : undefined;
        const latitude = typeof area.latitude === 'number'
          ? area.latitude
          : Array.isArray(center)
            ? center[1]
            : NaN;
        const longitude = typeof area.longitude === 'number'
          ? area.longitude
          : Array.isArray(center)
            ? center[0]
            : NaN;
        const radius = Number.isFinite(area.radius) && area.radius > 0 ? area.radius : this.DEFAULT_EXPLORATION_RADIUS;

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        const exploredAt = typeof area.explored_at === 'string'
          ? area.explored_at
          : 'exploredAt' in area && typeof area.exploredAt === 'number'
            ? new Date(area.exploredAt).toISOString()
            : '1970-01-01T00:00:00.000Z';

        return {
          latitude,
          longitude,
          radius,
          explored_at: exploredAt,
          ...(typeof area.accuracy === 'number' ? { accuracy: area.accuracy } : {}),
        };
      })
      .filter((area): area is ExploredArea => area !== null);
  }

  private generateMergedFogFeatures(exploredAreas: ExploredArea[], zoomLevel: number, bounds: BoundingBox): FogFeature[] | null {
    const relevantAreas = exploredAreas.filter(area => this.isAreaNearBounds(area, bounds));
    if (relevantAreas.length === 0) {
      return this.generateDefaultFogCoverage(bounds);
    }

    if (relevantAreas.length > this.MAX_BOOLEAN_OPERATION_AREAS) {
      debugLog('FogService', `Skipping merged fog path (${relevantAreas.length} areas > ${this.MAX_BOOLEAN_OPERATION_AREAS})`);
      return null;
    }

    const steps = this.getCircleStepsForZoom(zoomLevel);
    const operationStartTime = performance.now();

    const exploredPolygons = relevantAreas.map((area): Feature<Polygon> => {
      const circle = turf.circle([area.longitude, area.latitude], area.radius / 1000, { steps, units: 'kilometers' });
      return (turf.rewind as any)(circle, { reverse: false }) as Feature<Polygon>;
    });

    let exploredUnion: Feature<Polygon | MultiPolygon> | null = null;
    for (const polygon of exploredPolygons) {
      if (performance.now() - operationStartTime > this.MAX_BOOLEAN_OPERATION_TIME_MS) {
        debugLog('FogService', `Merged fog path timed out after ${this.MAX_BOOLEAN_OPERATION_TIME_MS}ms`);
        return null;
      }

      if (!exploredUnion) {
        exploredUnion = polygon;
        continue;
      }

      try {
        const nextMerged = (turf.union as any)(exploredUnion, polygon) as Feature<Polygon | MultiPolygon> | null;
        if (nextMerged) {
          exploredUnion = nextMerged;
        }
      } catch (error) {
        debugLog('FogService', `Union failed for merged fog path: ${String(error)}`);
        return null;
      }
    }

    if (!exploredUnion) {
      return this.generateDefaultFogCoverage(bounds);
    }

    const outerPolygon = turf.polygon([[
      [bounds.west, bounds.south],
      [bounds.east, bounds.south],
      [bounds.east, bounds.north],
      [bounds.west, bounds.north],
      [bounds.west, bounds.south],
    ]]);

    const differenceFn = turf.difference as unknown as (...args: unknown[]) => Feature<Polygon | MultiPolygon> | null;
    let fogPolygon: Feature<Polygon | MultiPolygon> | null = null;

    try {
      fogPolygon = differenceFn(outerPolygon, exploredUnion);
      if (!fogPolygon) {
        fogPolygon = differenceFn(turf.featureCollection([outerPolygon, exploredUnion]));
      }
    } catch (firstError) {
      try {
        fogPolygon = differenceFn(turf.featureCollection([outerPolygon, exploredUnion]));
      } catch (secondError) {
        debugLog('FogService', `Difference failed for merged fog path: ${String(firstError)} / ${String(secondError)}`);
        return null;
      }
    }

    if (!fogPolygon) {
      return this.generateDefaultFogCoverage(bounds);
    }

    const rewoundFog = (turf.rewind as any)(fogPolygon, { reverse: false }) as Feature<Polygon | MultiPolygon>;
    return this.toFogFeatures(rewoundFog);
  }

  private toFogFeatures(geometry: Feature<Polygon | MultiPolygon>): FogFeature[] {
    const fogFeatures: FogFeature[] = [];

    if (geometry.geometry.type === 'Polygon') {
      fogFeatures.push({
        type: 'Feature',
        properties: {
          opacity: 1,
          type: 'fog',
        },
        geometry: {
          type: 'Polygon',
          coordinates: geometry.geometry.coordinates,
        },
      });
      return fogFeatures;
    }

    for (const polygonCoordinates of geometry.geometry.coordinates) {
      fogFeatures.push({
        type: 'Feature',
        properties: {
          opacity: 1,
          type: 'fog',
        },
        geometry: {
          type: 'Polygon',
          coordinates: polygonCoordinates,
        },
      });
    }

    return fogFeatures;
  }

  private getCircleStepsForZoom(zoomLevel: number): number {
    const steps = Math.round(12 + zoomLevel * 1.5);
    return Math.max(12, Math.min(48, steps));
  }

  private isAreaNearBounds(area: ExploredArea, bounds: BoundingBox): boolean {
    const radiusDegrees = (area.radius || this.DEFAULT_EXPLORATION_RADIUS) / 111320;
    return area.latitude + radiusDegrees >= bounds.south &&
      area.latitude - radiusDegrees <= bounds.north &&
      area.longitude + radiusDegrees >= bounds.west &&
      area.longitude - radiusDegrees <= bounds.east;
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
  calculateExplorationPercentage(exploredAreas: FogInputArea[]): number {
    const normalizedAreas = this.normalizeExploredAreas(exploredAreas);
    if (normalizedAreas.length === 0) return 0;

    const totalExploredCells = new Set<string>();

    normalizedAreas.forEach(area => {
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

    // Bounds should extend FROM the snapped position BY cellSize
    // (not centered at the snapped position)
    return {
      id: cellId,
      bounds: {
        north: lat + cellSize,
        south: lat,
        east: lng + cellSize,
        west: lng
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

    // Use PROPER spatial sampling to maintain even geographic coverage
    // Group cells into a grid and pick one from each grid cell

    // Find bounds of all cells
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const cell of cells) {
      const centerLat = (cell.bounds.north + cell.bounds.south) / 2;
      const centerLng = (cell.bounds.east + cell.bounds.west) / 2;
      minLat = Math.min(minLat, centerLat);
      maxLat = Math.max(maxLat, centerLat);
      minLng = Math.min(minLng, centerLng);
      maxLng = Math.max(maxLng, centerLng);
    }

    // Calculate grid dimensions for sampling
    const targetGridCells = Math.sqrt(maxCount);
    const latStep = (maxLat - minLat) / targetGridCells;
    const lngStep = (maxLng - minLng) / targetGridCells;

    // Create sampling grid
    const sampledMap = new Map<string, GridCell>();

    for (const cell of cells) {
      const centerLat = (cell.bounds.north + cell.bounds.south) / 2;
      const centerLng = (cell.bounds.east + cell.bounds.west) / 2;

      // Determine which grid bucket this cell belongs to
      const gridRow = Math.floor((centerLat - minLat) / (latStep || 1));
      const gridCol = Math.floor((centerLng - minLng) / (lngStep || 1));
      const gridKey = `${gridRow}_${gridCol}`;

      // Keep only one cell per grid bucket (first one found)
      if (!sampledMap.has(gridKey)) {
        sampledMap.set(gridKey, cell);
      }
    }

    const sampled = Array.from(sampledMap.values());

    // If we still have too many, take a simple subset
    if (sampled.length > maxCount) {
      return sampled.slice(0, maxCount);
    }

    return sampled;
  }

  private aggregateCellsForLOD(cells: GridCell[], maxCount: number): GridCell[] {
    if (cells.length <= maxCount) {
      return cells;
    }

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const cell of cells) {
      minLat = Math.min(minLat, cell.bounds.south);
      maxLat = Math.max(maxLat, cell.bounds.north);
      minLng = Math.min(minLng, cell.bounds.west);
      maxLng = Math.max(maxLng, cell.bounds.east);
    }

    const targetGridCells = Math.max(1, Math.floor(Math.sqrt(maxCount)));
    const latStep = Math.max((maxLat - minLat) / targetGridCells, this.CELL_SIZE);
    const lngStep = Math.max((maxLng - minLng) / targetGridCells, this.CELL_SIZE);

    const buckets = new Map<string, {
      south: number;
      west: number;
      north: number;
      east: number;
      opacitySum: number;
      count: number;
    }>();

    for (const cell of cells) {
      const centerLat = (cell.bounds.north + cell.bounds.south) / 2;
      const centerLng = (cell.bounds.east + cell.bounds.west) / 2;
      const row = Math.floor((centerLat - minLat) / latStep);
      const col = Math.floor((centerLng - minLng) / lngStep);
      const key = `${row}_${col}`;

      const existing = buckets.get(key);
      if (!existing) {
        buckets.set(key, {
          south: cell.bounds.south,
          west: cell.bounds.west,
          north: cell.bounds.north,
          east: cell.bounds.east,
          opacitySum: cell.fogOpacity,
          count: 1,
        });
        continue;
      }

      existing.south = Math.min(existing.south, cell.bounds.south);
      existing.west = Math.min(existing.west, cell.bounds.west);
      existing.north = Math.max(existing.north, cell.bounds.north);
      existing.east = Math.max(existing.east, cell.bounds.east);
      existing.opacitySum += cell.fogOpacity;
      existing.count += 1;
    }

    const aggregated: GridCell[] = [];
    buckets.forEach((bucket, index) => {
      aggregated.push({
        id: `agg_${index}`,
        bounds: {
          south: bucket.south,
          west: bucket.west,
          north: bucket.north,
          east: bucket.east,
        },
        explored: false,
        exploredAt: undefined,
        fogOpacity: bucket.opacitySum / bucket.count,
      });
    });

    return aggregated.slice(0, maxCount);
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
    debugLog('FogService', 'Generating default fog coverage');

    // Define default bounds if none provided (covers a reasonable area around current user location)
    const defaultBounds = bounds || {
      north: 37.45,   // Adjusted to be around Mountain View/Palo Alto area
      south: 37.35,
      east: -122.0,
      west: -122.15
    };

    const north = Math.max(defaultBounds.north, defaultBounds.south);
    const south = Math.min(defaultBounds.north, defaultBounds.south);
    const hasValidEastWest = Number.isFinite(defaultBounds.east) && Number.isFinite(defaultBounds.west) && defaultBounds.east > defaultBounds.west;
    const east = hasValidEastWest ? defaultBounds.east : 180;
    const west = hasValidEastWest ? defaultBounds.west : -180;

    const feature: FogFeature = {
      type: 'Feature',
      properties: {
        opacity: 1,
        type: 'fog'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south]
        ]]
      }
    };

    return [feature];
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
