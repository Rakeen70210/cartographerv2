import MapboxGL from '@rnmapbox/maps';
import { getOfflineService } from './offlineService';

export interface OfflineRegion {
  id: string;
  name: string;
  bounds: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  minZoom: number;
  maxZoom: number;
  styleURL: string;
  downloadState: 'inactive' | 'active' | 'complete' | 'error';
  downloadProgress: number;
  estimatedTileCount?: number;
  downloadedTileCount?: number;
  downloadedBytes?: number;
}

export interface OfflineRegionStatus {
  downloadState: string;
  downloadProgress: number;
  completedResourceCount: number;
  completedResourceSize: number;
  completedTileCount: number;
  completedTileSize: number;
  requiredResourceCount: number;
}

export class MapboxOfflineService {
  private static instance: MapboxOfflineService | null = null;
  private offlineService = getOfflineService();
  private offlineRegions: Map<string, OfflineRegion> = new Map();
  private downloadListeners: Map<string, (progress: number, state: string) => void> = new Map();

  private constructor() {
    this.initializeOfflineManager();
  }

  static getInstance(): MapboxOfflineService {
    if (!MapboxOfflineService.instance) {
      MapboxOfflineService.instance = new MapboxOfflineService();
    }
    return MapboxOfflineService.instance;
  }

  /**
   * Initialize offline manager
   */
  private async initializeOfflineManager(): Promise<void> {
    try {
      // Load existing offline regions
      await this.loadOfflineRegions();
      console.log('Mapbox offline service initialized');
    } catch (error) {
      console.error('Failed to initialize Mapbox offline service:', error);
    }
  }

  /**
   * Load existing offline regions
   */
  private async loadOfflineRegions(): Promise<void> {
    try {
      const offlinePacks = await MapboxGL.offlineManager.getPacks();
      
      for (const pack of offlinePacks) {
        const metadata = pack.metadata ? JSON.parse(pack.metadata) : {};
        const status = await MapboxGL.offlineManager.getPackStatus(pack.name);
        
        const region: OfflineRegion = {
          id: pack.name,
          name: metadata.name || pack.name,
          bounds: metadata.bounds || [0, 0, 0, 0],
          minZoom: metadata.minZoom || 0,
          maxZoom: metadata.maxZoom || 16,
          styleURL: metadata.styleURL || MapboxGL.StyleURL.Street,
          downloadState: this.mapDownloadState(status.state),
          downloadProgress: status.percentage,
          estimatedTileCount: metadata.estimatedTileCount,
          downloadedTileCount: status.completedTileCount,
          downloadedBytes: status.completedTileSize
        };

        this.offlineRegions.set(region.id, region);
      }

      console.log(`Loaded ${this.offlineRegions.size} offline regions`);
    } catch (error) {
      console.error('Failed to load offline regions:', error);
    }
  }

  /**
   * Create offline region for map area
   */
  async createOfflineRegion(
    name: string,
    bounds: [number, number, number, number],
    minZoom: number = 0,
    maxZoom: number = 16,
    styleURL: string = MapboxGL.StyleURL.Street
  ): Promise<string> {
    try {
      const regionId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const metadata = {
        name,
        bounds,
        minZoom,
        maxZoom,
        styleURL,
        createdAt: new Date().toISOString()
      };

      // Create offline pack
      const progressListener = (offlineRegion: any, status: OfflineRegionStatus) => {
        this.handleDownloadProgress(regionId, status);
      };

      const errorListener = (offlineRegion: any, error: any) => {
        this.handleDownloadError(regionId, error);
      };

      await MapboxGL.offlineManager.createPack({
        name: regionId,
        styleURL,
        bounds,
        minZoom,
        maxZoom,
        metadata: JSON.stringify(metadata)
      }, progressListener, errorListener);

      // Create region object
      const region: OfflineRegion = {
        id: regionId,
        name,
        bounds,
        minZoom,
        maxZoom,
        styleURL,
        downloadState: 'active',
        downloadProgress: 0
      };

      this.offlineRegions.set(regionId, region);
      
      console.log(`Created offline region: ${name}`);
      return regionId;
    } catch (error) {
      console.error('Failed to create offline region:', error);
      throw new Error(`Failed to create offline region: ${error}`);
    }
  }

  /**
   * Delete offline region
   */
  async deleteOfflineRegion(regionId: string): Promise<void> {
    try {
      await MapboxGL.offlineManager.deletePack(regionId);
      this.offlineRegions.delete(regionId);
      this.downloadListeners.delete(regionId);
      
      console.log(`Deleted offline region: ${regionId}`);
    } catch (error) {
      console.error('Failed to delete offline region:', error);
      throw new Error(`Failed to delete offline region: ${error}`);
    }
  }

  /**
   * Get all offline regions
   */
  getOfflineRegions(): OfflineRegion[] {
    return Array.from(this.offlineRegions.values());
  }

  /**
   * Get offline region by ID
   */
  getOfflineRegion(regionId: string): OfflineRegion | null {
    return this.offlineRegions.get(regionId) || null;
  }

  /**
   * Check if area is covered by offline regions
   */
  isAreaCovered(bounds: [number, number, number, number], zoom: number): boolean {
    const [minLng, minLat, maxLng, maxLat] = bounds;
    
    for (const region of this.offlineRegions.values()) {
      if (region.downloadState !== 'complete') {
        continue;
      }

      const [regionMinLng, regionMinLat, regionMaxLng, regionMaxLat] = region.bounds;
      
      // Check if bounds are within region bounds
      const boundsWithin = minLng >= regionMinLng && 
                          minLat >= regionMinLat && 
                          maxLng <= regionMaxLng && 
                          maxLat <= regionMaxLat;
      
      // Check if zoom level is supported
      const zoomSupported = zoom >= region.minZoom && zoom <= region.maxZoom;
      
      if (boundsWithin && zoomSupported) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get offline regions covering a specific point
   */
  getRegionsCoveringPoint(longitude: number, latitude: number, zoom: number): OfflineRegion[] {
    const coveringRegions: OfflineRegion[] = [];
    
    for (const region of this.offlineRegions.values()) {
      if (region.downloadState !== 'complete') {
        continue;
      }

      const [minLng, minLat, maxLng, maxLat] = region.bounds;
      
      // Check if point is within region bounds
      const pointWithin = longitude >= minLng && 
                         longitude <= maxLng && 
                         latitude >= minLat && 
                         latitude <= maxLat;
      
      // Check if zoom level is supported
      const zoomSupported = zoom >= region.minZoom && zoom <= region.maxZoom;
      
      if (pointWithin && zoomSupported) {
        coveringRegions.push(region);
      }
    }
    
    return coveringRegions;
  }

  /**
   * Resume download for offline region
   */
  async resumeDownload(regionId: string): Promise<void> {
    try {
      await MapboxGL.offlineManager.resumePackDownload(regionId);
      
      const region = this.offlineRegions.get(regionId);
      if (region) {
        region.downloadState = 'active';
      }
      
      console.log(`Resumed download for region: ${regionId}`);
    } catch (error) {
      console.error('Failed to resume download:', error);
      throw new Error(`Failed to resume download: ${error}`);
    }
  }

  /**
   * Pause download for offline region
   */
  async pauseDownload(regionId: string): Promise<void> {
    try {
      await MapboxGL.offlineManager.pausePackDownload(regionId);
      
      const region = this.offlineRegions.get(regionId);
      if (region) {
        region.downloadState = 'inactive';
      }
      
      console.log(`Paused download for region: ${regionId}`);
    } catch (error) {
      console.error('Failed to pause download:', error);
      throw new Error(`Failed to pause download: ${error}`);
    }
  }

  /**
   * Get download status for offline region
   */
  async getDownloadStatus(regionId: string): Promise<OfflineRegionStatus | null> {
    try {
      const status = await MapboxGL.offlineManager.getPackStatus(regionId);
      return {
        downloadState: status.state,
        downloadProgress: status.percentage,
        completedResourceCount: status.completedResourceCount,
        completedResourceSize: status.completedResourceSize,
        completedTileCount: status.completedTileCount,
        completedTileSize: status.completedTileSize,
        requiredResourceCount: status.requiredResourceCount
      };
    } catch (error) {
      console.error('Failed to get download status:', error);
      return null;
    }
  }

  /**
   * Add download progress listener
   */
  addDownloadListener(regionId: string, listener: (progress: number, state: string) => void): () => void {
    this.downloadListeners.set(regionId, listener);
    
    // Return unsubscribe function
    return () => {
      this.downloadListeners.delete(regionId);
    };
  }

  /**
   * Handle download progress updates
   */
  private handleDownloadProgress(regionId: string, status: OfflineRegionStatus): void {
    const region = this.offlineRegions.get(regionId);
    if (region) {
      region.downloadProgress = status.downloadProgress;
      region.downloadState = this.mapDownloadState(status.downloadState);
      region.downloadedTileCount = status.completedTileCount;
      region.downloadedBytes = status.completedTileSize;
    }

    const listener = this.downloadListeners.get(regionId);
    if (listener) {
      listener(status.downloadProgress, status.downloadState);
    }

    console.log(`Download progress for ${regionId}: ${status.downloadProgress}%`);
  }

  /**
   * Handle download errors
   */
  private handleDownloadError(regionId: string, error: any): void {
    const region = this.offlineRegions.get(regionId);
    if (region) {
      region.downloadState = 'error';
    }

    console.error(`Download error for region ${regionId}:`, error);
  }

  /**
   * Map download state from Mapbox to our enum
   */
  private mapDownloadState(state: string): 'inactive' | 'active' | 'complete' | 'error' {
    switch (state) {
      case 'inactive':
        return 'inactive';
      case 'active':
        return 'active';
      case 'complete':
        return 'complete';
      case 'error':
        return 'error';
      default:
        return 'inactive';
    }
  }

  /**
   * Get total offline storage usage
   */
  async getStorageUsage(): Promise<{
    totalSize: number;
    regionCount: number;
    completedRegions: number;
  }> {
    let totalSize = 0;
    let completedRegions = 0;

    for (const region of this.offlineRegions.values()) {
      if (region.downloadedBytes) {
        totalSize += region.downloadedBytes;
      }
      if (region.downloadState === 'complete') {
        completedRegions++;
      }
    }

    return {
      totalSize,
      regionCount: this.offlineRegions.size,
      completedRegions
    };
  }

  /**
   * Clear all offline data
   */
  async clearAllOfflineData(): Promise<void> {
    try {
      const regionIds = Array.from(this.offlineRegions.keys());
      
      for (const regionId of regionIds) {
        await this.deleteOfflineRegion(regionId);
      }
      
      console.log('Cleared all offline data');
    } catch (error) {
      console.error('Failed to clear offline data:', error);
      throw new Error(`Failed to clear offline data: ${error}`);
    }
  }

  /**
   * Create offline region for user's explored areas
   */
  async createOfflineRegionForExploredAreas(
    name: string = 'My Explored Areas',
    padding: number = 0.01 // degrees
  ): Promise<string | null> {
    try {
      // Get all explored areas from database
      const databaseService = await import('../database/services').then(m => m.getDatabaseService());
      const exploredAreas = await databaseService.getAllExploredAreas();
      
      if (exploredAreas.length === 0) {
        console.log('No explored areas to create offline region for');
        return null;
      }

      // Calculate bounding box for all explored areas
      let minLat = exploredAreas[0].latitude;
      let maxLat = exploredAreas[0].latitude;
      let minLng = exploredAreas[0].longitude;
      let maxLng = exploredAreas[0].longitude;

      for (const area of exploredAreas) {
        minLat = Math.min(minLat, area.latitude);
        maxLat = Math.max(maxLat, area.latitude);
        minLng = Math.min(minLng, area.longitude);
        maxLng = Math.max(maxLng, area.longitude);
      }

      // Add padding
      const bounds: [number, number, number, number] = [
        minLng - padding,
        minLat - padding,
        maxLng + padding,
        maxLat + padding
      ];

      return await this.createOfflineRegion(name, bounds, 0, 16);
    } catch (error) {
      console.error('Failed to create offline region for explored areas:', error);
      throw new Error(`Failed to create offline region for explored areas: ${error}`);
    }
  }
}

// Export singleton instance
export const getMapboxOfflineService = (): MapboxOfflineService => {
  return MapboxOfflineService.getInstance();
};