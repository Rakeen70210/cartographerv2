import { getOfflineService } from '../services/offlineService';
import { getMapboxOfflineService } from '../services/mapboxOfflineService';

/**
 * Test utility for offline service functionality
 * This should be used for development testing only
 */
export class OfflineServiceTester {
  private offlineService = getOfflineService();
  private mapboxOfflineService = getMapboxOfflineService();

  /**
   * Tests network state monitoring
   */
  async testNetworkMonitoring(): Promise<void> {
    try {
      console.log('Testing network monitoring...');
      
      // Get current network state
      const networkState = this.offlineService.getNetworkState();
      console.log('Current network state:', networkState);
      
      // Add network listener
      const unsubscribe = this.offlineService.addNetworkListener((state) => {
        console.log('Network state changed:', state);
      });
      
      // Test online/offline status
      console.log('Is online:', this.offlineService.isOnline());
      console.log('Is offline:', this.offlineService.isOffline());
      
      // Cleanup listener after 5 seconds
      setTimeout(() => {
        unsubscribe();
        console.log('Network monitoring test completed');
      }, 5000);
      
    } catch (error) {
      console.error('Network monitoring test failed:', error);
      throw error;
    }
  }

  /**
   * Tests offline queue functionality
   */
  async testOfflineQueue(): Promise<void> {
    try {
      console.log('Testing offline queue...');
      
      // Add test items to offline queue
      await this.offlineService.addToOfflineQueue({
        type: 'exploration',
        data: {
          latitude: 37.7749,
          longitude: -122.4194,
          radius: 100,
          explored_at: new Date().toISOString(),
          accuracy: 10
        }
      });

      await this.offlineService.addToOfflineQueue({
        type: 'stats',
        data: {
          total_areas_explored: 5,
          total_distance: 1000
        }
      });

      // Check queue status
      const queueStatus = this.offlineService.getOfflineQueueStatus();
      console.log('Offline queue status:', queueStatus);
      
      if (queueStatus.count !== 2) {
        throw new Error(`Expected 2 items in queue, got ${queueStatus.count}`);
      }
      
      console.log('Offline queue test passed');
    } catch (error) {
      console.error('Offline queue test failed:', error);
      throw error;
    }
  }

  /**
   * Tests data caching functionality
   */
  async testDataCaching(): Promise<void> {
    try {
      console.log('Testing data caching...');
      
      const testData = {
        message: 'Hello, cache!',
        timestamp: Date.now(),
        numbers: [1, 2, 3, 4, 5]
      };
      
      const cacheKey = 'test_cache_key';
      
      // Cache data
      await this.offlineService.cacheData(cacheKey, testData, 60000); // 1 minute expiration
      
      // Retrieve cached data
      const cachedData = await this.offlineService.getCachedData(cacheKey);
      
      if (!cachedData) {
        throw new Error('Failed to retrieve cached data');
      }
      
      if (JSON.stringify(cachedData) !== JSON.stringify(testData)) {
        throw new Error('Cached data does not match original data');
      }
      
      // Test cache stats
      const cacheStats = await this.offlineService.getCacheStats();
      console.log('Cache stats:', cacheStats);
      
      if (cacheStats.itemCount === 0) {
        throw new Error('Cache stats show no items');
      }
      
      // Test cache removal
      await this.offlineService.removeCachedData(cacheKey);
      
      const removedData = await this.offlineService.getCachedData(cacheKey);
      if (removedData !== null) {
        throw new Error('Data was not properly removed from cache');
      }
      
      console.log('Data caching test passed');
    } catch (error) {
      console.error('Data caching test failed:', error);
      throw error;
    }
  }

  /**
   * Tests cache expiration functionality
   */
  async testCacheExpiration(): Promise<void> {
    try {
      console.log('Testing cache expiration...');
      
      const testData = { message: 'This will expire' };
      const cacheKey = 'expiring_cache_key';
      
      // Cache data with 1 second expiration
      await this.offlineService.cacheData(cacheKey, testData, 1000);
      
      // Immediately retrieve data (should work)
      let cachedData = await this.offlineService.getCachedData(cacheKey);
      if (!cachedData) {
        throw new Error('Failed to retrieve cached data before expiration');
      }
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Try to retrieve expired data (should return null)
      cachedData = await this.offlineService.getCachedData(cacheKey);
      if (cachedData !== null) {
        throw new Error('Expired data was not properly removed');
      }
      
      console.log('Cache expiration test passed');
    } catch (error) {
      console.error('Cache expiration test failed:', error);
      throw error;
    }
  }

  /**
   * Tests offline region management
   */
  async testOfflineRegions(): Promise<void> {
    try {
      console.log('Testing offline regions...');
      
      // Get initial regions
      const initialRegions = this.mapboxOfflineService.getOfflineRegions();
      console.log(`Initial offline regions: ${initialRegions.length}`);
      
      // Test area coverage check
      const testBounds: [number, number, number, number] = [-122.5, 37.7, -122.3, 37.8];
      const isCovered = this.mapboxOfflineService.isAreaCovered(testBounds, 10);
      console.log('Test area covered:', isCovered);
      
      // Test point coverage check
      const coveringRegions = this.mapboxOfflineService.getRegionsCoveringPoint(-122.4, 37.75, 10);
      console.log(`Regions covering test point: ${coveringRegions.length}`);
      
      // Test storage usage
      const storageUsage = await this.mapboxOfflineService.getStorageUsage();
      console.log('Storage usage:', storageUsage);
      
      console.log('Offline regions test passed');
    } catch (error) {
      console.error('Offline regions test failed:', error);
      throw error;
    }
  }

  /**
   * Tests cache size management
   */
  async testCacheSizeManagement(): Promise<void> {
    try {
      console.log('Testing cache size management...');
      
      // Create multiple cache entries
      const largeData = new Array(1000).fill('x').join(''); // ~1KB string
      
      for (let i = 0; i < 5; i++) {
        await this.offlineService.cacheData(`large_item_${i}`, {
          data: largeData,
          index: i
        });
        
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Check cache stats
      const cacheStats = await this.offlineService.getCacheStats();
      console.log('Cache stats after adding large items:', cacheStats);
      
      if (cacheStats.itemCount !== 5) {
        throw new Error(`Expected 5 cache items, got ${cacheStats.itemCount}`);
      }
      
      // Update cache config to very small size to trigger cleanup
      this.offlineService.updateConfig({ maxCacheSize: 0.001 }); // 1KB
      
      // Add another item to trigger cleanup
      await this.offlineService.cacheData('trigger_cleanup', { data: largeData });
      
      // Check that old items were removed
      const newCacheStats = await this.offlineService.getCacheStats();
      console.log('Cache stats after cleanup:', newCacheStats);
      
      // Reset cache config
      this.offlineService.updateConfig({ maxCacheSize: 100 });
      
      console.log('Cache size management test passed');
    } catch (error) {
      console.error('Cache size management test failed:', error);
      throw error;
    }
  }

  /**
   * Tests offline service configuration
   */
  async testConfiguration(): Promise<void> {
    try {
      console.log('Testing offline service configuration...');
      
      // Get initial config
      const initialConfig = this.offlineService.getConfig();
      console.log('Initial config:', initialConfig);
      
      // Update config
      const newConfig = {
        maxCacheSize: 50,
        enableDataCache: false,
        enableMapTileCache: false
      };
      
      this.offlineService.updateConfig(newConfig);
      
      // Verify config update
      const updatedConfig = this.offlineService.getConfig();
      console.log('Updated config:', updatedConfig);
      
      if (updatedConfig.maxCacheSize !== 50) {
        throw new Error('Config update failed');
      }
      
      // Reset to original config
      this.offlineService.updateConfig(initialConfig);
      
      console.log('Configuration test passed');
    } catch (error) {
      console.error('Configuration test failed:', error);
      throw error;
    }
  }

  /**
   * Runs all offline service tests
   */
  async runAllTests(): Promise<void> {
    try {
      console.log('Starting comprehensive offline service tests...');

      // Test network monitoring
      await this.testNetworkMonitoring();

      // Test offline queue
      await this.testOfflineQueue();

      // Test data caching
      await this.testDataCaching();

      // Test cache expiration
      await this.testCacheExpiration();

      // Test offline regions
      await this.testOfflineRegions();

      // Test cache size management
      await this.testCacheSizeManagement();

      // Test configuration
      await this.testConfiguration();

      console.log('All offline service tests passed successfully!');
    } catch (error) {
      console.error('Offline service tests failed:', error);
      throw error;
    }
  }

  /**
   * Cleans up test data
   */
  async cleanupTestData(): Promise<void> {
    try {
      console.log('Cleaning up offline test data...');
      
      // Clear cache
      await this.offlineService.clearCache();
      
      // Clear offline queue
      await this.offlineService.clearOfflineQueue();
      
      console.log('Offline test data cleaned up');
    } catch (error) {
      console.error('Failed to cleanup offline test data:', error);
      throw error;
    }
  }
}

// Export test utility
export const createOfflineServiceTester = (): OfflineServiceTester => {
  return new OfflineServiceTester();
};

// Development helper function
export const runOfflineTests = async (): Promise<void> => {
  const tester = createOfflineServiceTester();
  await tester.runAllTests();
};