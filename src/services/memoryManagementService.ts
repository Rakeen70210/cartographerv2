import { getPerformanceMonitorService } from './performanceMonitorService';
import { getDeviceCapabilityService } from './deviceCapabilityService';

export interface MemoryPool {
  id: string;
  maxSize: number;
  currentSize: number;
  entries: Map<string, MemoryEntry>;
  priority: number;
}

export interface MemoryEntry {
  key: string;
  data: any;
  size: number;
  lastAccessed: number;
  accessCount: number;
  priority: number;
  poolId: string;
}

export interface MemoryStats {
  totalAllocated: number;
  totalUsed: number;
  poolCount: number;
  entryCount: number;
  hitRate: number;
  cleanupCount: number;
}

class MemoryManagementService {
  private pools: Map<string, MemoryPool> = new Map();
  private globalStats: MemoryStats = {
    totalAllocated: 0,
    totalUsed: 0,
    poolCount: 0,
    entryCount: 0,
    hitRate: 0,
    cleanupCount: 0
  };
  
  private accessHistory: { key: string; timestamp: number }[] = [];
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private performanceMonitorService = getPerformanceMonitorService();
  private deviceCapabilityService = getDeviceCapabilityService();

  // Memory pool configurations for different data types
  private poolConfigs = {
    fogGeometry: { maxSize: 20 * 1024 * 1024, priority: 3 }, // 20MB for fog geometry
    cloudTextures: { maxSize: 15 * 1024 * 1024, priority: 2 }, // 15MB for cloud textures
    mapTiles: { maxSize: 30 * 1024 * 1024, priority: 4 }, // 30MB for map tiles
    animations: { maxSize: 10 * 1024 * 1024, priority: 1 }, // 10MB for animation data
    userData: { maxSize: 5 * 1024 * 1024, priority: 5 }, // 5MB for user data (highest priority)
  };

  /**
   * Initialize memory management service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.deviceCapabilityService.initialize();
      const capabilities = this.deviceCapabilityService.getCapabilities();
      
      if (capabilities) {
        // Adjust pool sizes based on device memory
        this.adjustPoolSizesForDevice(capabilities.memoryGB);
      }

      // Create memory pools
      Object.entries(this.poolConfigs).forEach(([poolId, config]) => {
        this.createPool(poolId, config.maxSize, config.priority);
      });

      // Start cleanup interval
      this.startCleanupInterval();
      
      this.isInitialized = true;
      console.log('Memory management service initialized with pools:', Array.from(this.pools.keys()));
    } catch (error) {
      console.error('Failed to initialize memory management service:', error);
      throw error;
    }
  }

  /**
   * Store data in a memory pool
   */
  store(poolId: string, key: string, data: any, priority: number = 1): boolean {
    const pool = this.pools.get(poolId);
    if (!pool) {
      console.warn(`Memory pool '${poolId}' not found`);
      return false;
    }

    const dataSize = this.calculateDataSize(data);
    
    // Check if we need to make space
    if (pool.currentSize + dataSize > pool.maxSize) {
      const spaceFreed = this.freeSpace(pool, dataSize);
      if (spaceFreed < dataSize) {
        console.warn(`Not enough space in pool '${poolId}' for key '${key}'`);
        return false;
      }
    }

    // Remove existing entry if it exists
    const existingEntry = pool.entries.get(key);
    if (existingEntry) {
      pool.currentSize -= existingEntry.size;
      this.globalStats.entryCount--;
    }

    // Create new entry
    const entry: MemoryEntry = {
      key,
      data,
      size: dataSize,
      lastAccessed: Date.now(),
      accessCount: 1,
      priority,
      poolId
    };

    pool.entries.set(key, entry);
    pool.currentSize += dataSize;
    this.globalStats.entryCount++;
    this.globalStats.totalUsed += dataSize;

    // Track access
    this.trackAccess(key);

    return true;
  }

  /**
   * Retrieve data from memory pool
   */
  retrieve(poolId: string, key: string): any | null {
    const pool = this.pools.get(poolId);
    if (!pool) return null;

    const entry = pool.entries.get(key);
    if (!entry) return null;

    // Update access statistics
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.trackAccess(key);

    return entry.data;
  }

  /**
   * Remove data from memory pool
   */
  remove(poolId: string, key: string): boolean {
    const pool = this.pools.get(poolId);
    if (!pool) return false;

    const entry = pool.entries.get(key);
    if (!entry) return false;

    pool.entries.delete(key);
    pool.currentSize -= entry.size;
    this.globalStats.entryCount--;
    this.globalStats.totalUsed -= entry.size;

    return true;
  }

  /**
   * Clear all data from a memory pool
   */
  clearPool(poolId: string): boolean {
    const pool = this.pools.get(poolId);
    if (!pool) return false;

    this.globalStats.entryCount -= pool.entries.size;
    this.globalStats.totalUsed -= pool.currentSize;
    
    pool.entries.clear();
    pool.currentSize = 0;

    console.log(`Cleared memory pool '${poolId}'`);
    return true;
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    // Update hit rate calculation
    const totalAccesses = this.accessHistory.length;
    const uniqueKeys = new Set(this.accessHistory.map(h => h.key)).size;
    this.globalStats.hitRate = totalAccesses > 0 ? (totalAccesses - uniqueKeys) / totalAccesses : 0;
    this.globalStats.poolCount = this.pools.size;

    return { ...this.globalStats };
  }

  /**
   * Get pool statistics
   */
  getPoolStats(poolId: string): { size: number; maxSize: number; entryCount: number; utilization: number } | null {
    const pool = this.pools.get(poolId);
    if (!pool) return null;

    return {
      size: pool.currentSize,
      maxSize: pool.maxSize,
      entryCount: pool.entries.size,
      utilization: pool.currentSize / pool.maxSize
    };
  }

  /**
   * Force memory cleanup
   */
  forceCleanup(): void {
    let totalFreed = 0;
    
    this.pools.forEach((pool, poolId) => {
      const freed = this.cleanupPool(pool, true);
      totalFreed += freed;
      console.log(`Cleaned up ${freed} bytes from pool '${poolId}'`);
    });

    this.globalStats.cleanupCount++;
    console.log(`Force cleanup completed, freed ${totalFreed} bytes total`);
  }

  /**
   * Optimize memory usage based on current performance
   */
  async optimizeForPerformance(): Promise<void> {
    const performanceMetrics = await this.deviceCapabilityService.getPerformanceMetrics();
    
    if (performanceMetrics.memoryPressure === 'high') {
      console.log('High memory pressure detected, performing aggressive cleanup');
      this.forceCleanup();
      
      // Reduce pool sizes temporarily
      this.pools.forEach(pool => {
        pool.maxSize = Math.floor(pool.maxSize * 0.7);
      });
    } else if (performanceMetrics.memoryPressure === 'medium') {
      // Perform gentle cleanup
      this.pools.forEach(pool => {
        this.cleanupPool(pool, false);
      });
    }
  }

  /**
   * Shutdown memory management service
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all pools
    this.pools.forEach((_, poolId) => {
      this.clearPool(poolId);
    });

    this.pools.clear();
    this.accessHistory = [];
    this.isInitialized = false;

    console.log('Memory management service shutdown');
  }

  // Private methods

  private createPool(id: string, maxSize: number, priority: number): void {
    const pool: MemoryPool = {
      id,
      maxSize,
      currentSize: 0,
      entries: new Map(),
      priority
    };

    this.pools.set(id, pool);
    this.globalStats.totalAllocated += maxSize;
  }

  private adjustPoolSizesForDevice(memoryGB: number): void {
    const multiplier = memoryGB >= 6 ? 1.5 : memoryGB >= 4 ? 1.2 : memoryGB >= 3 ? 1.0 : 0.7;
    
    Object.keys(this.poolConfigs).forEach(poolId => {
      this.poolConfigs[poolId as keyof typeof this.poolConfigs].maxSize = 
        Math.floor(this.poolConfigs[poolId as keyof typeof this.poolConfigs].maxSize * multiplier);
    });

    console.log(`Adjusted pool sizes for ${memoryGB}GB device (multiplier: ${multiplier})`);
  }

  private calculateDataSize(data: any): number {
    try {
      if (data === null || data === undefined) return 0;
      
      if (typeof data === 'string') {
        return data.length * 2; // UTF-16 encoding
      }
      
      if (typeof data === 'number') {
        return 8; // 64-bit number
      }
      
      if (typeof data === 'boolean') {
        return 1;
      }
      
      if (data instanceof ArrayBuffer) {
        return data.byteLength;
      }
      
      // For objects, estimate size based on JSON serialization
      const jsonString = JSON.stringify(data);
      return jsonString.length * 2;
    } catch (error) {
      console.warn('Error calculating data size:', error);
      return 1024; // Default fallback size
    }
  }

  private freeSpace(pool: MemoryPool, requiredSpace: number): number {
    const entries = Array.from(pool.entries.values());
    
    // Sort by priority (lower first) and last accessed time (older first)
    entries.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.lastAccessed - b.lastAccessed;
    });

    let freedSpace = 0;
    const now = Date.now();
    
    for (const entry of entries) {
      if (freedSpace >= requiredSpace) break;
      
      // Don't remove recently accessed high-priority items
      const isRecent = now - entry.lastAccessed < 30000; // 30 seconds
      const isHighPriority = entry.priority >= 4;
      
      if (isRecent && isHighPriority) continue;
      
      pool.entries.delete(entry.key);
      pool.currentSize -= entry.size;
      freedSpace += entry.size;
      this.globalStats.entryCount--;
      this.globalStats.totalUsed -= entry.size;
    }

    return freedSpace;
  }

  private cleanupPool(pool: MemoryPool, aggressive: boolean): number {
    const entries = Array.from(pool.entries.values());
    const now = Date.now();
    let freedSpace = 0;
    
    // Different cleanup strategies based on aggressiveness
    const maxAge = aggressive ? 60000 : 300000; // 1 minute vs 5 minutes
    const utilizationThreshold = aggressive ? 0.5 : 0.8;
    
    if (pool.currentSize / pool.maxSize < utilizationThreshold && !aggressive) {
      return 0; // Pool is not over-utilized
    }

    entries.forEach(entry => {
      const age = now - entry.lastAccessed;
      const shouldRemove = aggressive ? 
        (age > maxAge || entry.priority < 3) :
        (age > maxAge && entry.accessCount < 2);
      
      if (shouldRemove) {
        pool.entries.delete(entry.key);
        pool.currentSize -= entry.size;
        freedSpace += entry.size;
        this.globalStats.entryCount--;
        this.globalStats.totalUsed -= entry.size;
      }
    });

    return freedSpace;
  }

  private trackAccess(key: string): void {
    this.accessHistory.push({ key, timestamp: Date.now() });
    
    // Keep only recent access history (last 1000 accesses)
    if (this.accessHistory.length > 1000) {
      this.accessHistory = this.accessHistory.slice(-1000);
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.pools.forEach(pool => {
        this.cleanupPool(pool, false);
      });
    }, 60000); // Cleanup every minute
  }
}

// Singleton instance
let memoryManagementService: MemoryManagementService | null = null;

export const getMemoryManagementService = (): MemoryManagementService => {
  if (!memoryManagementService) {
    memoryManagementService = new MemoryManagementService();
  }
  return memoryManagementService;
};

export default MemoryManagementService;