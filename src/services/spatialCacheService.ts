/**
 * Spatial Cache Service
 * Provides an in-memory spatial index (R-Tree) for fast querying of explored areas.
 */

import RBush from 'rbush';
import { getDatabaseService, ExploredArea } from '../database/services';

interface CacheItem {
  minX: number; // Corresponds to min Longitude
  minY: number; // Corresponds to min Latitude
  maxX: number; // Corresponds to max Longitude
  maxY: number; // Corresponds to max Latitude
  id: number;
}

class SpatialCacheService {
  private tree = new RBush<CacheItem>();
  private dbService = getDatabaseService();
  private isInitialized = false;

  /**
   * Initializes the spatial cache by loading all explored areas from the database.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('Initializing spatial cache...');
    const allAreas = await this.dbService.getAllExploredAreas();
    const cacheItems: CacheItem[] = allAreas.map(area => this.areaToCacheItem(area));
    
    this.tree.load(cacheItems);
    this.isInitialized = true;
    console.log(`Spatial cache initialized with ${this.tree.all().length} items.`);
  }

  /**
   * Searches the cache for areas within the given bounding box.
   * @param bounds The bounding box to search within.
   * @returns An array of ExploredArea IDs.
   */
  search(bounds: { minX: number, minY: number, maxX: number, maxY: number }): number[] {
    if (!this.isInitialized) {
      console.warn('Spatial cache not initialized. Search may return empty results.');
      return [];
    }

    const results = this.tree.search(bounds);
    return results.map(item => item.id);
  }

  /**
   * Adds a new explored area to the cache.
   * @param area The ExploredArea to add.
   */
  add(area: ExploredArea): void {
    if (!this.isInitialized || !area.id) {
      return;
    }
    const item = this.areaToCacheItem(area);
    this.tree.insert(item);
  }

  /**
   * Removes an explored area from the cache.
   * @param area The ExploredArea to remove.
   */
  remove(area: ExploredArea): void {
    if (!this.isInitialized || !area.id) {
      return;
    }
    const item = this.areaToCacheItem(area);
    this.tree.remove(item, (a, b) => a.id === b.id);
  }

  /**
   * Clears the entire spatial cache.
   */
  clear(): void {
    this.tree.clear();
    this.isInitialized = false;
    console.log('Spatial cache cleared.');
  }

  /**
   * Converts an ExploredArea to a format compatible with the RBush tree.
   */
  private areaToCacheItem(area: ExploredArea): CacheItem {
    const radiusInDegrees = area.radius / 111320; // Approximate conversion from meters to degrees
    return {
      minX: area.longitude - radiusInDegrees,
      minY: area.latitude - radiusInDegrees,
      maxX: area.longitude + radiusInDegrees,
      maxY: area.latitude + radiusInDegrees,
      id: area.id!,
    };
  }
}

export const spatialCacheService = new SpatialCacheService();
