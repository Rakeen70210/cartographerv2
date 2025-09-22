import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import { getDatabaseService } from '../database/services';

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
  details: any;
}

export interface OfflineQueueItem {
  id: string;
  type: 'exploration' | 'achievement' | 'stats';
  data: any;
  timestamp: number;
  retryCount: number;
}

export interface CacheConfig {
  maxCacheSize: number; // in MB
  maxCacheAge: number; // in milliseconds
  enableMapTileCache: boolean;
  enableDataCache: boolean;
}

export interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  size: number;
  expiresAt?: number;
}

export class OfflineService {
  private static instance: OfflineService | null = null;
  private networkState: NetworkState | null = null;
  private networkListeners: ((state: NetworkState) => void)[] = [];
  private offlineQueue: OfflineQueueItem[] = [];
  private cache: Map<string, CacheEntry> = new Map();
  private databaseService = getDatabaseService();
  
  private readonly CACHE_DIR = `${FileSystem.documentDirectory}cache/`;
  private readonly OFFLINE_QUEUE_FILE = `${FileSystem.documentDirectory}offline_queue.json`;
  private readonly CACHE_INDEX_FILE = `${this.CACHE_DIR}index.json`;
  
  private config: CacheConfig = {
    maxCacheSize: 100, // 100MB
    maxCacheAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    enableMapTileCache: true,
    enableDataCache: true
  };

  private constructor() {
    this.initializeOfflineService();
  }

  static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }

  /**
   * Initialize offline service
   */
  private async initializeOfflineService(): Promise<void> {
    try {
      // Create cache directory
      await this.ensureCacheDirectory();
      
      // Load offline queue
      await this.loadOfflineQueue();
      
      // Load cache index
      await this.loadCacheIndex();
      
      // Start network monitoring
      this.startNetworkMonitoring();
      
      console.log('Offline service initialized');
    } catch (error) {
      console.error('Failed to initialize offline service:', error);
    }
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureCacheDirectory(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.CACHE_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  /**
   * Start monitoring network connectivity
   */
  private startNetworkMonitoring(): void {
    NetInfo.addEventListener((state: NetInfoState) => {
      const networkState: NetworkState = {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        details: state.details
      };

      const wasOffline = this.networkState && !this.networkState.isConnected;
      const isNowOnline = networkState.isConnected;

      this.networkState = networkState;

      // Notify listeners
      this.networkListeners.forEach(listener => listener(networkState));

      // Process offline queue when coming back online
      if (wasOffline && isNowOnline) {
        this.processOfflineQueue();
      }

      console.log('Network state changed:', networkState);
    });
  }

  /**
   * Get current network state
   */
  getNetworkState(): NetworkState | null {
    return this.networkState;
  }

  /**
   * Check if device is online
   */
  isOnline(): boolean {
    return this.networkState?.isConnected ?? false;
  }

  /**
   * Check if device is offline
   */
  isOffline(): boolean {
    return !this.isOnline();
  }

  /**
   * Add network state listener
   */
  addNetworkListener(listener: (state: NetworkState) => void): () => void {
    this.networkListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.networkListeners.indexOf(listener);
      if (index > -1) {
        this.networkListeners.splice(index, 1);
      }
    };
  }

  /**
   * Add item to offline queue
   */
  async addToOfflineQueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    try {
      const queueItem: OfflineQueueItem = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0,
        ...item
      };

      this.offlineQueue.push(queueItem);
      await this.saveOfflineQueue();
      
      console.log(`Added item to offline queue: ${queueItem.type}`);
    } catch (error) {
      console.error('Failed to add item to offline queue:', error);
    }
  }

  /**
   * Process offline queue when online
   */
  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) {
      return;
    }

    console.log(`Processing ${this.offlineQueue.length} items from offline queue`);

    const itemsToProcess = [...this.offlineQueue];
    const processedItems: string[] = [];

    for (const item of itemsToProcess) {
      try {
        await this.processOfflineQueueItem(item);
        processedItems.push(item.id);
        console.log(`Processed offline queue item: ${item.type}`);
      } catch (error) {
        console.error(`Failed to process offline queue item ${item.id}:`, error);
        
        // Increment retry count
        item.retryCount++;
        
        // Remove item if max retries reached
        if (item.retryCount >= 3) {
          processedItems.push(item.id);
          console.log(`Removing failed offline queue item after max retries: ${item.id}`);
        }
      }
    }

    // Remove processed items from queue
    this.offlineQueue = this.offlineQueue.filter(item => !processedItems.includes(item.id));
    await this.saveOfflineQueue();
  }

  /**
   * Process individual offline queue item
   */
  private async processOfflineQueueItem(item: OfflineQueueItem): Promise<void> {
    switch (item.type) {
      case 'exploration':
        await this.databaseService.createExploredArea(item.data);
        break;
      case 'achievement':
        await this.databaseService.createAchievement(item.data);
        break;
      case 'stats':
        await this.databaseService.updateUserStats(item.data);
        break;
      default:
        throw new Error(`Unknown offline queue item type: ${item.type}`);
    }
  }

  /**
   * Get offline queue status
   */
  getOfflineQueueStatus(): { count: number; items: OfflineQueueItem[] } {
    return {
      count: this.offlineQueue.length,
      items: [...this.offlineQueue]
    };
  }

  /**
   * Clear offline queue
   */
  async clearOfflineQueue(): Promise<void> {
    this.offlineQueue = [];
    await this.saveOfflineQueue();
  }

  /**
   * Save offline queue to file
   */
  private async saveOfflineQueue(): Promise<void> {
    try {
      await FileSystem.writeAsStringAsync(
        this.OFFLINE_QUEUE_FILE,
        JSON.stringify(this.offlineQueue),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  /**
   * Load offline queue from file
   */
  private async loadOfflineQueue(): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(this.OFFLINE_QUEUE_FILE);
      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(this.OFFLINE_QUEUE_FILE);
        this.offlineQueue = JSON.parse(content) || [];
        console.log(`Loaded ${this.offlineQueue.length} items from offline queue`);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      this.offlineQueue = [];
    }
  }

  /**
   * Cache data with expiration
   */
  async cacheData(key: string, data: any, expirationMs?: number): Promise<void> {
    if (!this.config.enableDataCache) {
      return;
    }

    try {
      const serializedData = JSON.stringify(data);
      const size = new Blob([serializedData]).size;
      
      const cacheEntry: CacheEntry = {
        key,
        data,
        timestamp: Date.now(),
        size,
        expiresAt: expirationMs ? Date.now() + expirationMs : undefined
      };

      // Check cache size limits
      await this.ensureCacheSpace(size);
      
      // Store in memory cache
      this.cache.set(key, cacheEntry);
      
      // Store in file cache
      const filePath = `${this.CACHE_DIR}${this.sanitizeKey(key)}.json`;
      await FileSystem.writeAsStringAsync(filePath, serializedData);
      
      // Update cache index
      await this.updateCacheIndex();
      
      console.log(`Cached data for key: ${key}`);
    } catch (error) {
      console.error(`Failed to cache data for key ${key}:`, error);
    }
  }

  /**
   * Get cached data
   */
  async getCachedData(key: string): Promise<any | null> {
    if (!this.config.enableDataCache) {
      return null;
    }

    try {
      // Check memory cache first
      let cacheEntry = this.cache.get(key);
      
      // If not in memory, try file cache
      if (!cacheEntry) {
        const filePath = `${this.CACHE_DIR}${this.sanitizeKey(key)}.json`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        
        if (fileInfo.exists) {
          const content = await FileSystem.readAsStringAsync(filePath);
          const data = JSON.parse(content);
          
          cacheEntry = {
            key,
            data,
            timestamp: fileInfo.modificationTime || Date.now(),
            size: fileInfo.size || 0
          };
          
          // Add to memory cache
          this.cache.set(key, cacheEntry);
        }
      }

      if (!cacheEntry) {
        return null;
      }

      // Check expiration
      if (cacheEntry.expiresAt && Date.now() > cacheEntry.expiresAt) {
        await this.removeCachedData(key);
        return null;
      }

      // Check age
      const age = Date.now() - cacheEntry.timestamp;
      if (age > this.config.maxCacheAge) {
        await this.removeCachedData(key);
        return null;
      }

      return cacheEntry.data;
    } catch (error) {
      console.error(`Failed to get cached data for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove cached data
   */
  async removeCachedData(key: string): Promise<void> {
    try {
      // Remove from memory cache
      this.cache.delete(key);
      
      // Remove from file cache
      const filePath = `${this.CACHE_DIR}${this.sanitizeKey(key)}.json`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath);
      }
      
      // Update cache index
      await this.updateCacheIndex();
      
      console.log(`Removed cached data for key: ${key}`);
    } catch (error) {
      console.error(`Failed to remove cached data for key ${key}:`, error);
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    try {
      // Clear memory cache
      this.cache.clear();
      
      // Clear file cache
      const dirInfo = await FileSystem.getInfoAsync(this.CACHE_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(this.CACHE_DIR);
        await this.ensureCacheDirectory();
      }
      
      console.log('Cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalSize: number;
    itemCount: number;
    oldestItem: number | null;
    newestItem: number | null;
  }> {
    let totalSize = 0;
    let oldestItem: number | null = null;
    let newestItem: number | null = null;

    for (const entry of this.cache.values()) {
      totalSize += entry.size;
      
      if (oldestItem === null || entry.timestamp < oldestItem) {
        oldestItem = entry.timestamp;
      }
      
      if (newestItem === null || entry.timestamp > newestItem) {
        newestItem = entry.timestamp;
      }
    }

    return {
      totalSize,
      itemCount: this.cache.size,
      oldestItem,
      newestItem
    };
  }

  /**
   * Ensure cache space by removing old entries
   */
  private async ensureCacheSpace(requiredSize: number): Promise<void> {
    const maxSizeBytes = this.config.maxCacheSize * 1024 * 1024; // Convert MB to bytes
    const stats = await this.getCacheStats();
    
    if (stats.totalSize + requiredSize <= maxSizeBytes) {
      return;
    }

    // Sort cache entries by timestamp (oldest first)
    const sortedEntries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    // Remove oldest entries until we have enough space
    for (const [key] of sortedEntries) {
      await this.removeCachedData(key);
      
      const newStats = await this.getCacheStats();
      if (newStats.totalSize + requiredSize <= maxSizeBytes) {
        break;
      }
    }
  }

  /**
   * Sanitize cache key for file system
   */
  private sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * Update cache index file
   */
  private async updateCacheIndex(): Promise<void> {
    try {
      const index = Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        timestamp: entry.timestamp,
        size: entry.size,
        expiresAt: entry.expiresAt
      }));

      await FileSystem.writeAsStringAsync(
        this.CACHE_INDEX_FILE,
        JSON.stringify(index),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
    } catch (error) {
      console.error('Failed to update cache index:', error);
    }
  }

  /**
   * Load cache index from file
   */
  private async loadCacheIndex(): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(this.CACHE_INDEX_FILE);
      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(this.CACHE_INDEX_FILE);
        const index = JSON.parse(content);
        
        // Rebuild memory cache index (data will be loaded on demand)
        for (const item of index) {
          this.cache.set(item.key, {
            key: item.key,
            data: null, // Will be loaded on demand
            timestamp: item.timestamp,
            size: item.size,
            expiresAt: item.expiresAt
          });
        }
        
        console.log(`Loaded cache index with ${index.length} entries`);
      }
    } catch (error) {
      console.error('Failed to load cache index:', error);
    }
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Cache configuration updated:', this.config);
  }

  /**
   * Get current cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const getOfflineService = (): OfflineService => {
  return OfflineService.getInstance();
};