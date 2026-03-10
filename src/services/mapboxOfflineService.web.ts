export interface OfflineRegion {
  id: string;
  name: string;
  bounds: [number, number, number, number];
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

  static getInstance(): MapboxOfflineService {
    if (!MapboxOfflineService.instance) {
      MapboxOfflineService.instance = new MapboxOfflineService();
    }
    return MapboxOfflineService.instance;
  }

  private notSupported(): never {
    throw new Error('Mapbox offline packs are not supported on web.');
  }

  async createOfflineRegion(
    _name: string,
    _bounds: [number, number, number, number],
    _minZoom: number = 0,
    _maxZoom: number = 16,
    _styleURL: string = ''
  ): Promise<string> {
    return this.notSupported();
  }

  async deleteOfflineRegion(_regionId: string): Promise<void> {
    return;
  }

  getOfflineRegions(): OfflineRegion[] {
    return [];
  }

  getOfflineRegion(_regionId: string): OfflineRegion | null {
    return null;
  }

  async hasOfflineData(): Promise<boolean> {
    return false;
  }

  isAreaCovered(_bounds: [number, number, number, number], _zoom: number): boolean {
    return false;
  }

  getRegionsCoveringPoint(_longitude: number, _latitude: number, _zoom: number): OfflineRegion[] {
    return [];
  }

  async resumeDownload(_regionId: string): Promise<void> {
    return this.notSupported();
  }

  async pauseDownload(_regionId: string): Promise<void> {
    return this.notSupported();
  }

  async getDownloadStatus(_regionId: string): Promise<OfflineRegionStatus | null> {
    return null;
  }

  addDownloadListener(_regionId: string, _listener: (progress: number, state: string) => void): () => void {
    return () => undefined;
  }

  async getStorageUsage(): Promise<{
    totalSize: number;
    regionCount: number;
    completedRegions: number;
  }> {
    return {
      totalSize: 0,
      regionCount: 0,
      completedRegions: 0,
    };
  }

  async clearAllOfflineData(): Promise<void> {
    return;
  }

  async createOfflineRegionForExploredAreas(
    _name: string = 'My Explored Areas',
    _padding: number = 0.01
  ): Promise<string | null> {
    return null;
  }
}

export const getMapboxOfflineService = (): MapboxOfflineService => {
  return MapboxOfflineService.getInstance();
};
