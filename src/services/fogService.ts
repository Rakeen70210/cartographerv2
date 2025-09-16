import { ExploredArea } from '../database/services';
import { FogGeometry, FogFeature, GeographicArea, SpatialGrid, GridCell, BoundingBox } from '../types/fog';

export class FogService {
  private spatialGrid: SpatialGrid;
  private readonly CELL_SIZE = 0.01; // ~1km at equator
  private readonly DEFAULT_EXPLORATION_RADIUS = 100; // meters

  constructor() {
    this.spatialGrid = {
      cellSize: this.CELL_SIZE,
      cells: new Map()
    };
  }

  /**
   * Generate fog geometry based on explored areas
   */
  generateFogGeometry(exploredAreas: ExploredArea[]): FogGeometry {
    // Update spatial grid with explored areas
    this.updateSpatialGrid(exploredAreas);

    // Generate fog features based on unexplored grid cells
    const fogFeatures = this.generateFogFeatures();

    return {
      type: 'FeatureCollection',
      features: fogFeatures
    };
  }

  /**
   * Update spatial grid with explored areas
   */
  private updateSpatialGrid(exploredAreas: ExploredArea[]): void {
    // Clear existing explored status
    this.spatialGrid.cells.forEach(cell => {
      cell.explored = false;
      cell.fogOpacity = 1.0;
    });

    // Mark cells as explored based on areas
    exploredAreas.forEach(area => {
      const affectedCells = this.getCellsInRadius(
        area.latitude,
        area.longitude,
        area.radius || this.DEFAULT_EXPLORATION_RADIUS
      );

      affectedCells.forEach(cellId => {
        let cell = this.spatialGrid.cells.get(cellId);
        if (!cell) {
          cell = this.createGridCell(cellId);
          this.spatialGrid.cells.set(cellId, cell);
        }
        
        cell.explored = true;
        cell.exploredAt = new Date(area.explored_at);
        cell.fogOpacity = 0.0;
      });
    });
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
   * Generate fog features from spatial grid
   */
  private generateFogFeatures(): FogFeature[] {
    const features: FogFeature[] = [];

    // Group unexplored cells into larger polygons for performance
    const unexploredCells = Array.from(this.spatialGrid.cells.values())
      .filter(cell => !cell.explored);

    // For now, create individual rectangles for each unexplored cell
    // In production, you might want to merge adjacent cells for better performance
    unexploredCells.forEach(cell => {
      const feature: FogFeature = {
        type: 'Feature',
        properties: {
          opacity: cell.fogOpacity,
          type: 'fog'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [cell.bounds.west, cell.bounds.south],
            [cell.bounds.east, cell.bounds.south],
            [cell.bounds.east, cell.bounds.north],
            [cell.bounds.west, cell.bounds.north],
            [cell.bounds.west, cell.bounds.south]
          ]]
        }
      };
      features.push(feature);
    });

    return features;
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
}

// Singleton instance
let fogService: FogService | null = null;

export const getFogService = (): FogService => {
  if (!fogService) {
    fogService = new FogService();
  }
  return fogService;
};