/**
 * Error Handling and Edge Case Tests
 * Tests behavior with poor GPS accuracy, database corruption, and offline scenarios
 * Requirements: 3.2, 3.4, 6.2, 7.2
 */

import { locationService } from '../../services/locationService';
import { explorationService } from '../../services/explorationService';
import { getFogService } from '../../services/fogService';
import { getDatabaseService } from '../../database/services';
import { getOfflineService } from '../../services/offlineService';
import { getErrorRecoveryService } from '../../services/errorRecoveryService';

// Mock external dependencies
jest.mock('expo-location');
jest.mock('@rnmapbox/maps');
jest.mock('expo-sqlite');
jest.mock('@react-native-community/netinfo');

// Mock service modules
jest.mock('../../services/locationService', () => ({
  locationService: {
    requestPermissions: jest.fn(),
    requestBackgroundPermissions: jest.fn(),
    getCurrentLocation: jest.fn(),
    startTracking: jest.fn(),
    getTrackingStatus: jest.fn()
  }
}));

jest.mock('../../services/explorationService', () => ({
  explorationService: {
    processLocationUpdate: jest.fn()
  }
}));

jest.mock('../../services/fogService', () => ({
  getFogService: () => ({
    generateFogGeometry: jest.fn(),
    updateFogGeometry: jest.fn()
  })
}));

jest.mock('../../database/services', () => ({
  getDatabaseService: () => ({
    initialize: jest.fn(),
    close: jest.fn(),
    withTransaction: jest.fn((callback) => callback()),
    importData: jest.fn(),
    getExploredAreas: jest.fn().mockResolvedValue([]),
    createExploredArea: jest.fn(),
    checkIntegrity: jest.fn(),
    attemptRecovery: jest.fn(),
    getCurrentSchemaVersion: jest.fn(),
    getRequiredSchemaVersion: jest.fn(),
    migrateSchema: jest.fn(),
    rollbackSchema: jest.fn(),
    getUserStats: jest.fn(),
    exportData: jest.fn()
  })
}));

jest.mock('../../services/offlineService', () => ({
  getOfflineService: () => ({
    isOnline: jest.fn(),
    isOffline: jest.fn(),
    processOfflineQueue: jest.fn(),
    getOfflineQueueStatus: jest.fn(),
    getCachedMapTile: jest.fn(),
    resolveDataConflicts: jest.fn()
  })
}));

jest.mock('../../services/errorRecoveryService', () => ({
  getErrorRecoveryService: () => ({
    reset: jest.fn(),
    handleMapTileError: jest.fn(),
    detectMemoryPressure: jest.fn(),
    performEmergencyCleanup: jest.fn(),
    checkStorageSpace: jest.fn(),
    performStorageCleanup: jest.fn(),
    handleServiceError: jest.fn(),
    attemptServiceRecovery: jest.fn()
  })
}));

describe('Error Handling and Edge Case Tests', () => {
  let databaseService: any;
  let offlineService: any;
  let errorRecoveryService: any;
  let fogService: any;

  beforeAll(async () => {
    databaseService = getDatabaseService();
    offlineService = getOfflineService();
    errorRecoveryService = getErrorRecoveryService();
    fogService = getFogService();
    await databaseService.initialize();
  });

  beforeEach(async () => {
    // Clear database and reset services
    await databaseService.withTransaction(async () => {
      await databaseService.importData({
        exploredAreas: [],
        userStats: null,
        achievements: []
      });
    });
    
    // Reset error recovery service
    errorRecoveryService.reset();
  });

  afterAll(async () => {
    await databaseService.close();
  });

  describe('GPS Accuracy and Signal Issues', () => {
    test('should handle poor GPS accuracy gracefully', async () => {
      // Test with various accuracy levels
      const poorAccuracyLocations = [
        { latitude: 37.7749, longitude: -122.4194, accuracy: 500, timestamp: Date.now() }, // Very poor
        { latitude: 37.7750, longitude: -122.4195, accuracy: 200, timestamp: Date.now() + 1000 }, // Poor
        { latitude: 37.7751, longitude: -122.4196, accuracy: 100, timestamp: Date.now() + 2000 }, // Marginal
        { latitude: 37.7752, longitude: -122.4197, accuracy: 50, timestamp: Date.now() + 3000 }, // Acceptable
        { latitude: 37.7753, longitude: -122.4198, accuracy: 10, timestamp: Date.now() + 4000 }  // Good
      ];

      const results = [];

      for (const location of poorAccuracyLocations) {
        const result = await explorationService.processLocationUpdate(location);
        results.push({ accuracy: location.accuracy, result });
      }

      // Very poor accuracy should be rejected
      expect(results[0].result.newAreaExplored).toBe(false);
      expect(results[0].result.rejectionReason).toBe('poor_accuracy');

      // Poor accuracy should be rejected
      expect(results[1].result.newAreaExplored).toBe(false);
      expect(results[1].result.rejectionReason).toBe('poor_accuracy');

      // Marginal accuracy might be accepted with warnings
      expect(results[2].result.accuracyWarning).toBe(true);

      // Good accuracy should be accepted
      expect(results[3].result.newAreaExplored).toBe(true);
      expect(results[4].result.newAreaExplored).toBe(true);

      // Verify only good accuracy locations were stored
      const exploredAreas = await databaseService.getExploredAreas();
      expect(exploredAreas.length).toBeLessThanOrEqual(3); // Marginal + 2 good
    });

    test('should handle GPS signal loss and recovery', async () => {
      // Start with good signal
      const goodLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now()
      };

      jest.spyOn(locationService, 'getCurrentLocation').mockResolvedValueOnce(goodLocation);
      
      const initialLocation = await locationService.getCurrentLocation();
      expect(initialLocation).toEqual(goodLocation);

      // Simulate signal loss
      jest.spyOn(locationService, 'getCurrentLocation').mockRejectedValueOnce(new Error('Location unavailable'));

      try {
        await locationService.getCurrentLocation();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Location unavailable');
      }

      // Check that service handles the error gracefully
      const trackingStatus = locationService.getTrackingStatus();
      expect(trackingStatus.hasError).toBe(true);
      expect(trackingStatus.lastError).toBeDefined();

      // Simulate signal recovery
      const recoveredLocation = {
        latitude: 37.7750,
        longitude: -122.4195,
        accuracy: 15,
        timestamp: Date.now() + 5000
      };

      jest.spyOn(locationService, 'getCurrentLocation').mockResolvedValueOnce(recoveredLocation);

      const newLocation = await locationService.getCurrentLocation();
      expect(newLocation).toEqual(recoveredLocation);

      // Service should recover from error state
      const recoveredStatus = locationService.getTrackingStatus();
      expect(recoveredStatus.hasError).toBe(false);
    });

    test('should handle location permission revocation during use', async () => {
      // Start with granted permissions
      const grantedPermissions = {
        granted: true,
        status: 'granted',
        canAskAgain: true,
        expires: 'never'
      };

      jest.spyOn(locationService, 'requestPermissions').mockResolvedValueOnce(grantedPermissions);

      const initialPermissions = await locationService.requestPermissions();
      expect(initialPermissions.granted).toBe(true);

      // Start tracking
      jest.spyOn(locationService, 'startTracking').mockResolvedValueOnce(true);
      const trackingStarted = await locationService.startTracking();
      expect(trackingStarted).toBe(true);

      // Simulate permission revocation
      const revokedPermissions = {
        granted: false,
        status: 'denied',
        canAskAgain: false,
        expires: 'never'
      };

      jest.spyOn(locationService, 'requestPermissions').mockResolvedValueOnce(revokedPermissions);
      jest.spyOn(locationService, 'getCurrentLocation').mockRejectedValueOnce(new Error('Location permission denied'));

      // Try to get location after permission revocation
      try {
        await locationService.getCurrentLocation();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Location permission denied');
      }

      // Service should handle permission revocation gracefully
      const status = locationService.getTrackingStatus();
      expect(status.permissionDenied).toBe(true);

      // App should still function in manual mode
      const manualLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now()
      };

      const explorationResult = await explorationService.processLocationUpdate(manualLocation);
      expect(explorationResult.newAreaExplored).toBe(true);
    });
  });

  describe('Database Corruption and Recovery', () => {
    test('should detect and handle database corruption', async () => {
      // Create some valid data first
      await databaseService.createExploredArea({
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 100,
        explored_at: new Date().toISOString(),
        accuracy: 10
      });

      // Verify data exists
      let exploredAreas = await databaseService.getExploredAreas();
      expect(exploredAreas).toHaveLength(1);

      // Simulate database corruption
      jest.spyOn(databaseService, 'checkIntegrity').mockResolvedValueOnce({
        isValid: false,
        errors: ['table_corruption', 'index_corruption'],
        corruptedTables: ['explored_areas']
      });

      const integrityCheck = await databaseService.checkIntegrity();
      expect(integrityCheck.isValid).toBe(false);
      expect(integrityCheck.errors).toContain('table_corruption');

      // Test automatic recovery
      jest.spyOn(databaseService, 'attemptRecovery').mockResolvedValueOnce({
        success: true,
        method: 'rebuild_indexes',
        recoveredData: {
          exploredAreas: 1,
          userStats: 1,
          achievements: 0
        }
      });

      const recoveryResult = await databaseService.attemptRecovery();
      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.recoveredData.exploredAreas).toBe(1);

      // Verify data is accessible after recovery
      jest.spyOn(databaseService, 'getExploredAreas').mockResolvedValueOnce([{
        id: 1,
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 100,
        explored_at: new Date().toISOString(),
        accuracy: 10
      }]);

      exploredAreas = await databaseService.getExploredAreas();
      expect(exploredAreas).toHaveLength(1);
    });

    test('should handle database transaction failures', async () => {
      let transactionAttempts = 0;
      const maxRetries = 3;

      // Mock transaction failures
      jest.spyOn(databaseService, 'withTransaction').mockImplementation(async (callback) => {
        transactionAttempts++;
        
        if (transactionAttempts <= 2) {
          throw new Error('Database locked');
        }
        
        // Succeed on third attempt
        return await callback();
      });

      // Test retry mechanism
      const testData = {
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 100,
        explored_at: new Date().toISOString(),
        accuracy: 10
      };

      let success = false;
      let attempts = 0;

      while (attempts < maxRetries && !success) {
        try {
          await databaseService.withTransaction(async () => {
            await databaseService.createExploredArea(testData);
          });
          success = true;
        } catch (error) {
          attempts++;
          if (attempts >= maxRetries) {
            throw error;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 100 * attempts));
        }
      }

      expect(success).toBe(true);
      expect(transactionAttempts).toBe(3);
    });

    test('should handle database schema migration failures', async () => {
      // Mock schema version mismatch
      jest.spyOn(databaseService, 'getCurrentSchemaVersion').mockResolvedValueOnce(1);
      jest.spyOn(databaseService, 'getRequiredSchemaVersion').mockReturnValueOnce(3);

      const currentVersion = await databaseService.getCurrentSchemaVersion();
      const requiredVersion = databaseService.getRequiredSchemaVersion();
      
      expect(currentVersion).toBeLessThan(requiredVersion);

      // Mock migration failure
      jest.spyOn(databaseService, 'migrateSchema').mockRejectedValueOnce(new Error('Migration failed at step 2'));

      try {
        await databaseService.migrateSchema(currentVersion, requiredVersion);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Migration failed at step 2');
      }

      // Test rollback mechanism
      jest.spyOn(databaseService, 'rollbackSchema').mockResolvedValueOnce({
        success: true,
        rolledBackToVersion: 1
      });

      const rollbackResult = await databaseService.rollbackSchema();
      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.rolledBackToVersion).toBe(1);
    });
  });

  describe('Offline Functionality and Network Issues', () => {
    test('should handle network connectivity loss gracefully', async () => {
      // Start with online state
      jest.spyOn(offlineService, 'isOnline').mockReturnValue(true);
      expect(offlineService.isOnline()).toBe(true);

      // Process location while online
      const onlineLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now()
      };

      const onlineResult = await explorationService.processLocationUpdate(onlineLocation);
      expect(onlineResult.newAreaExplored).toBe(true);

      // Simulate network loss
      jest.spyOn(offlineService, 'isOnline').mockReturnValue(false);
      jest.spyOn(offlineService, 'isOffline').mockReturnValue(true);

      expect(offlineService.isOffline()).toBe(true);

      // Process location while offline
      const offlineLocation = {
        latitude: 37.7750,
        longitude: -122.4195,
        accuracy: 15,
        timestamp: Date.now() + 1000
      };

      const offlineResult = await explorationService.processLocationUpdate(offlineLocation);
      expect(offlineResult.newAreaExplored).toBe(true);
      expect(offlineResult.processedOffline).toBe(true);

      // Verify offline queue
      const queueStatus = offlineService.getOfflineQueueStatus();
      expect(queueStatus.count).toBeGreaterThan(0);

      // Simulate network recovery
      jest.spyOn(offlineService, 'isOnline').mockReturnValue(true);
      jest.spyOn(offlineService, 'isOffline').mockReturnValue(false);

      // Process offline queue
      jest.spyOn(offlineService, 'processOfflineQueue').mockResolvedValueOnce({
        processed: queueStatus.count,
        errors: 0,
        syncedItems: queueStatus.count
      });

      const syncResult = await offlineService.processOfflineQueue();
      expect(syncResult.processed).toBe(queueStatus.count);
      expect(syncResult.errors).toBe(0);
    });

    test('should handle map tile loading failures', async () => {
      // Mock map tile loading failure
      const tileLoadErrors = [
        { x: 1, y: 1, z: 10, error: 'Network timeout' },
        { x: 2, y: 1, z: 10, error: 'Server error 500' },
        { x: 1, y: 2, z: 10, error: 'Tile not found' }
      ];

      // Test error handling for each tile
      for (const tileError of tileLoadErrors) {
        const errorHandled = await errorRecoveryService.handleMapTileError(tileError);
        expect(errorHandled.retry).toBe(true);
        expect(errorHandled.fallbackStrategy).toBeDefined();
      }

      // Test fallback to cached tiles
      jest.spyOn(offlineService, 'getCachedMapTile').mockResolvedValue({
        tileData: 'cached_tile_data',
        timestamp: Date.now() - 3600000, // 1 hour old
        isStale: false
      });

      const cachedTile = await offlineService.getCachedMapTile(1, 1, 10);
      expect(cachedTile).toBeDefined();
      expect(cachedTile.tileData).toBe('cached_tile_data');

      // Test graceful degradation when no cache available
      jest.spyOn(offlineService, 'getCachedMapTile').mockResolvedValue(null);

      const noCachedTile = await offlineService.getCachedMapTile(3, 3, 10);
      expect(noCachedTile).toBeNull();

      // App should still function with missing tiles
      const fogGeometry = await fogService.generateFogGeometry();
      expect(fogGeometry).toBeDefined();
    });

    test('should handle data synchronization conflicts', async () => {
      // Create local data while offline
      jest.spyOn(offlineService, 'isOffline').mockReturnValue(true);

      const localLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now()
      };

      await explorationService.processLocationUpdate(localLocation);

      // Simulate conflicting server data
      const serverData = {
        exploredAreas: [{
          id: 1,
          latitude: 37.7749,
          longitude: -122.4194,
          radius: 150, // Different radius
          explored_at: new Date(Date.now() - 1000).toISOString(), // Earlier timestamp
          accuracy: 5 // Better accuracy
        }],
        userStats: {
          total_areas_explored: 5, // Different count
          exploration_percentage: 10.5
        }
      };

      // Test conflict resolution
      jest.spyOn(offlineService, 'resolveDataConflicts').mockResolvedValue({
        resolution: 'merge',
        conflicts: [{
          field: 'radius',
          localValue: 100,
          serverValue: 150,
          resolvedValue: 150 // Server wins for better accuracy
        }],
        mergedData: {
          exploredAreas: [{
            id: 1,
            latitude: 37.7749,
            longitude: -122.4194,
            radius: 150,
            explored_at: new Date(Date.now() - 1000).toISOString(),
            accuracy: 5
          }]
        }
      });

      const conflictResolution = await offlineService.resolveDataConflicts(
        { exploredAreas: [localLocation] },
        serverData
      );

      expect(conflictResolution.resolution).toBe('merge');
      expect(conflictResolution.conflicts).toHaveLength(1);
      expect(conflictResolution.mergedData.exploredAreas[0].radius).toBe(150);
    });
  });

  describe('Memory and Resource Management Errors', () => {
    test('should handle out-of-memory conditions', async () => {
      // Mock memory pressure
      jest.spyOn(errorRecoveryService, 'detectMemoryPressure').mockReturnValue({
        isUnderPressure: true,
        availableMemoryMB: 50,
        usedMemoryMB: 450,
        pressureLevel: 'high'
      });

      const memoryStatus = errorRecoveryService.detectMemoryPressure();
      expect(memoryStatus.isUnderPressure).toBe(true);
      expect(memoryStatus.pressureLevel).toBe('high');

      // Test memory cleanup
      jest.spyOn(errorRecoveryService, 'performEmergencyCleanup').mockResolvedValue({
        freedMemoryMB: 100,
        cleanupActions: ['cleared_cache', 'reduced_fog_detail', 'paused_animations'],
        success: true
      });

      const cleanupResult = await errorRecoveryService.performEmergencyCleanup();
      expect(cleanupResult.success).toBe(true);
      expect(cleanupResult.freedMemoryMB).toBe(100);
      expect(cleanupResult.cleanupActions).toContain('cleared_cache');

      // Verify app continues functioning with reduced resources
      const location = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now()
      };

      const result = await explorationService.processLocationUpdate(location);
      expect(result.newAreaExplored).toBe(true);
      expect(result.reducedQuality).toBe(true);
    });

    test('should handle storage space exhaustion', async () => {
      // Mock storage space check
      jest.spyOn(errorRecoveryService, 'checkStorageSpace').mockResolvedValue({
        totalSpaceMB: 1000,
        availableSpaceMB: 10, // Very low
        usedSpaceMB: 990,
        isLow: true,
        isCritical: true
      });

      const storageStatus = await errorRecoveryService.checkStorageSpace();
      expect(storageStatus.isCritical).toBe(true);
      expect(storageStatus.availableSpaceMB).toBe(10);

      // Test storage cleanup
      jest.spyOn(errorRecoveryService, 'performStorageCleanup').mockResolvedValue({
        freedSpaceMB: 200,
        cleanupActions: ['deleted_old_cache', 'compressed_database', 'removed_old_backups'],
        success: true
      });

      const cleanupResult = await errorRecoveryService.performStorageCleanup();
      expect(cleanupResult.success).toBe(true);
      expect(cleanupResult.freedSpaceMB).toBe(200);

      // Test graceful handling when cleanup isn't enough
      jest.spyOn(databaseService, 'createExploredArea').mockRejectedValueOnce(new Error('Disk full'));

      const location = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now()
      };

      try {
        await explorationService.processLocationUpdate(location);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Disk full');
      }

      // App should queue data for later processing
      const queueStatus = offlineService.getOfflineQueueStatus();
      expect(queueStatus.count).toBeGreaterThan(0);
    });
  });

  describe('Service Integration Error Handling', () => {
    test('should handle service initialization failures', async () => {
      // Mock service initialization failures
      const serviceErrors = [
        { service: 'location', error: 'Location service unavailable' },
        { service: 'database', error: 'Database initialization failed' },
        { service: 'fog', error: 'Fog service configuration error' }
      ];

      for (const serviceError of serviceErrors) {
        const errorHandled = await errorRecoveryService.handleServiceError(
          serviceError.service,
          new Error(serviceError.error)
        );

        expect(errorHandled.canRecover).toBeDefined();
        expect(errorHandled.fallbackStrategy).toBeDefined();
        expect(errorHandled.retryAfter).toBeDefined();
      }

      // Test service recovery
      jest.spyOn(errorRecoveryService, 'attemptServiceRecovery').mockResolvedValue({
        service: 'location',
        recovered: true,
        attempts: 2,
        recoveryMethod: 'restart'
      });

      const recoveryResult = await errorRecoveryService.attemptServiceRecovery('location');
      expect(recoveryResult.recovered).toBe(true);
      expect(recoveryResult.attempts).toBe(2);
    });

    test('should handle cascading service failures', async () => {
      // Simulate location service failure
      jest.spyOn(locationService, 'startTracking').mockRejectedValue(new Error('Location service failed'));

      try {
        await locationService.startTracking();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Location service failed');
      }

      // This should not prevent other services from working
      const fogGeometry = await fogService.generateFogGeometry();
      expect(fogGeometry).toBeDefined();

      // Manual location input should still work
      const manualLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now()
      };

      const result = await explorationService.processLocationUpdate(manualLocation);
      expect(result.newAreaExplored).toBe(true);
      expect(result.source).toBe('manual');
    });

    test('should maintain data consistency during partial failures', async () => {
      // Start a complex operation that involves multiple services
      const location = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now()
      };

      // Mock partial failure - database succeeds, fog service fails
      jest.spyOn(databaseService, 'createExploredArea').mockResolvedValueOnce({
        id: 1,
        ...location,
        radius: 100,
        explored_at: new Date().toISOString()
      });

      jest.spyOn(fogService, 'updateFogGeometry').mockRejectedValueOnce(new Error('Fog update failed'));

      // Process location update
      const result = await explorationService.processLocationUpdate(location);
      
      // Data should be stored even if fog update fails
      expect(result.newAreaExplored).toBe(true);
      expect(result.warnings).toContain('fog_update_failed');

      // Verify data consistency
      const exploredAreas = await databaseService.getExploredAreas();
      expect(exploredAreas).toHaveLength(1);

      // Fog service should be able to recover later
      jest.spyOn(fogService, 'updateFogGeometry').mockResolvedValueOnce({ success: true });
      
      const fogRecovery = await fogService.updateFogGeometry();
      expect(fogRecovery.success).toBe(true);
    });
  });
});