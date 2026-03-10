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
  maxCacheSize: number;
  maxCacheAge: number;
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

const OFFLINE_QUEUE_KEY = 'cartographer_offline_queue';
const CACHE_INDEX_KEY = 'cartographer_cache_index';
const CACHE_ITEM_PREFIX = 'cartographer_cache_item_';

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage ?? null;
};

const readStorageJSON = <T,>(key: string, fallback: T): T => {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed to read storage key ${key}:`, error);
    return fallback;
  }
};

const writeStorageJSON = (key: string, value: unknown): void => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to write storage key ${key}:`, error);
  }
};

export class OfflineService {
  private static instance: OfflineService | null = null;
  private networkState: NetworkState | null = null;
  private networkListeners: ((state: NetworkState) => void)[] = [];
  private offlineQueue: OfflineQueueItem[] = [];
  private cache: Map<string, CacheEntry> = new Map();
  private databaseService = getDatabaseService();
  private isProcessingQueue = false;
  private queueRetryTimeout: NodeJS.Timeout | null = null;
  private queueRetryAttempts = 0;
  private readonly queueRetryIntervalMs = 2000;
  private readonly maxQueueRetryAttempts = 30;

  private config: CacheConfig = {
    maxCacheSize: 50,
    maxCacheAge: 7 * 24 * 60 * 60 * 1000,
    enableMapTileCache: false,
    enableDataCache: true,
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

  private async initializeOfflineService(): Promise<void> {
    this.loadOfflineQueue();
    this.loadCacheIndex();
    await this.initializeNetworkState();
    this.startNetworkMonitoring();
    await this.attemptProcessOfflineQueue('startup');
  }

  private startNetworkMonitoring(): void {
    if (typeof window === 'undefined') return;

    const updateState = () => {
      const state: NetworkState = {
        isConnected: navigator.onLine,
        isInternetReachable: navigator.onLine,
        type: 'web',
        details: null,
      };

      const wasOffline = this.networkState && !this.networkState.isConnected;
      const isNowOnline = state.isConnected;

      this.networkState = state;
      this.networkListeners.forEach(listener => listener(state));

      if (wasOffline && isNowOnline) {
        this.attemptProcessOfflineQueue('online');
      }
    };

    window.addEventListener('online', updateState);
    window.addEventListener('offline', updateState);
  }

  private async initializeNetworkState(): Promise<void> {
    if (typeof navigator === 'undefined') {
      this.networkState = {
        isConnected: true,
        isInternetReachable: true,
        type: 'unknown',
        details: null,
      };
      return;
    }

    this.networkState = {
      isConnected: navigator.onLine,
      isInternetReachable: navigator.onLine,
      type: 'web',
      details: null,
    };
  }

  private async attemptProcessOfflineQueue(context: string): Promise<void> {
    if (this.offlineQueue.length === 0) {
      this.queueRetryAttempts = 0;
      return;
    }

    if (!this.isOnline()) {
      return;
    }

    if (!this.databaseService.isReady()) {
      this.scheduleQueueRetry(`database_not_ready_${context}`);
      return;
    }

    await this.processOfflineQueue();
    this.queueRetryAttempts = 0;
  }

  private scheduleQueueRetry(reason: string): void {
    if (this.queueRetryTimeout || this.offlineQueue.length === 0) {
      return;
    }

    if (this.queueRetryAttempts >= this.maxQueueRetryAttempts) {
      console.warn(`Offline queue retry limit reached (${reason})`);
      return;
    }

    this.queueRetryAttempts += 1;
    this.queueRetryTimeout = setTimeout(() => {
      this.queueRetryTimeout = null;
      this.attemptProcessOfflineQueue(`retry_${this.queueRetryAttempts}`).catch(error => {
        console.error('Retrying offline queue processing failed:', error);
      });
    }, this.queueRetryIntervalMs);
  }

  getNetworkState(): NetworkState | null {
    return this.networkState;
  }

  isOnline(): boolean {
    return this.networkState?.isConnected ?? true;
  }

  isOffline(): boolean {
    return !this.isOnline();
  }

  addNetworkListener(listener: (state: NetworkState) => void): () => void {
    this.networkListeners.push(listener);
    return () => {
      const index = this.networkListeners.indexOf(listener);
      if (index > -1) {
        this.networkListeners.splice(index, 1);
      }
    };
  }

  async addToOfflineQueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const queueItem: OfflineQueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      ...item,
    };

    this.offlineQueue.push(queueItem);
    this.saveOfflineQueue();
  }

  getOfflineQueueStatus(): { count: number; items: OfflineQueueItem[] } {
    return {
      count: this.offlineQueue.length,
      items: [...this.offlineQueue],
    };
  }

  async clearOfflineQueue(): Promise<void> {
    this.offlineQueue = [];
    this.saveOfflineQueue();
  }

  private saveOfflineQueue(): void {
    writeStorageJSON(OFFLINE_QUEUE_KEY, this.offlineQueue);
  }

  private loadOfflineQueue(): void {
    this.offlineQueue = readStorageJSON<OfflineQueueItem[]>(OFFLINE_QUEUE_KEY, []);
  }

  private async processOfflineQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    if (!this.databaseService.isReady()) return;

    this.isProcessingQueue = true;

    try {
      if (this.offlineQueue.length === 0) return;

      const itemsToProcess = [...this.offlineQueue];
      const processedItems: string[] = [];

      for (const item of itemsToProcess) {
        try {
          await this.processOfflineQueueItem(item);
          processedItems.push(item.id);
        } catch (error) {
          console.error(`Failed to process offline queue item ${item.id}:`, error);
          item.retryCount += 1;
          if (item.retryCount >= 3) {
            processedItems.push(item.id);
          }
        }
      }

      this.offlineQueue = this.offlineQueue.filter(item => !processedItems.includes(item.id));
      this.saveOfflineQueue();
    } finally {
      this.isProcessingQueue = false;
    }
  }

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

  async cacheData(key: string, data: any, expirationMs?: number): Promise<void> {
    if (!this.config.enableDataCache) return;

    const serialized = JSON.stringify(data);
    const size = serialized.length;

    const cacheEntry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      size,
      expiresAt: expirationMs ? Date.now() + expirationMs : undefined,
    };

    await this.ensureCacheSpace(size);
    this.cache.set(key, cacheEntry);
    writeStorageJSON(`${CACHE_ITEM_PREFIX}${key}`, cacheEntry);
    this.updateCacheIndex();
  }

  async getCachedData(key: string): Promise<any | null> {
    if (!this.config.enableDataCache) return null;

    let entry = this.cache.get(key);
    if (!entry) {
      entry = readStorageJSON<CacheEntry | null>(`${CACHE_ITEM_PREFIX}${key}`, null);
      if (entry) {
        this.cache.set(key, entry);
      }
    }

    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      await this.removeCachedData(key);
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > this.config.maxCacheAge) {
      await this.removeCachedData(key);
      return null;
    }

    return entry.data ?? null;
  }

  async removeCachedData(key: string): Promise<void> {
    this.cache.delete(key);
    const storage = getStorage();
    if (storage) {
      storage.removeItem(`${CACHE_ITEM_PREFIX}${key}`);
    }
    this.updateCacheIndex();
  }

  async clearCache(): Promise<void> {
    this.cache.clear();
    const storage = getStorage();
    if (storage) {
      Object.keys(storage).forEach(itemKey => {
        if (itemKey.startsWith(CACHE_ITEM_PREFIX)) {
          storage.removeItem(itemKey);
        }
      });
      storage.removeItem(CACHE_INDEX_KEY);
    }
  }

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
      if (oldestItem === null || entry.timestamp < oldestItem) oldestItem = entry.timestamp;
      if (newestItem === null || entry.timestamp > newestItem) newestItem = entry.timestamp;
    }

    return {
      totalSize,
      itemCount: this.cache.size,
      oldestItem,
      newestItem,
    };
  }

  private async ensureCacheSpace(requiredSize: number): Promise<void> {
    const maxSizeBytes = this.config.maxCacheSize * 1024 * 1024;
    const stats = await this.getCacheStats();
    if (stats.totalSize + requiredSize <= maxSizeBytes) return;

    const sortedEntries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    for (const [key] of sortedEntries) {
      await this.removeCachedData(key);
      const newStats = await this.getCacheStats();
      if (newStats.totalSize + requiredSize <= maxSizeBytes) break;
    }
  }

  private updateCacheIndex(): void {
    const index = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      timestamp: entry.timestamp,
      size: entry.size,
      expiresAt: entry.expiresAt,
    }));
    writeStorageJSON(CACHE_INDEX_KEY, index);
  }

  private loadCacheIndex(): void {
    const index = readStorageJSON<Array<{ key: string; timestamp: number; size: number; expiresAt?: number }>>(
      CACHE_INDEX_KEY,
      []
    );

    index.forEach(item => {
      this.cache.set(item.key, {
        key: item.key,
        data: null,
        timestamp: item.timestamp,
        size: item.size,
        expiresAt: item.expiresAt,
      });
    });
  }

  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }
}

export const getOfflineService = (): OfflineService => {
  return OfflineService.getInstance();
};
