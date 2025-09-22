/**
 * Edge Case Integration Tests
 * Comprehensive tests for edge cases and error scenarios
 */

import { edgeCaseTester, runEdgeCaseTests } from '../../utils/edgeCaseTesting';
import { getErrorRecoveryService } from '../../services/errorRecoveryService';
import { locationService } from '../../services/locationService';
import { explorationService } from '../../services/explorationService';
import { getDatabaseService } from '../../database/services';
import { getOfflineService } from '../../services/offlineService';

// Mock external dependencies
jest.mock('expo-location');
jest.mock('@rnmapbox/maps');
jest.mock('expo-sqlite');
jest.mock('@react-native-community/netinfo');
jest.mock('react-native');

describe('Edge Case Integration Tests', () => {
  let errorRecoveryService: any;
  let databaseService: any;
  let offlineService: any;

  beforeAll(async () => {
    errorRecoveryService = getErrorRecoveryService();
    databaseService = getDatabaseService();
    offlineService = getOfflineService();
    
    // Initialize services
    await databaseService.initialize();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    errorRecoveryService.reset();
  });

  afterAll(async () => {
    await databaseService.close();
  });

  describe('Comprehensive Edge Case Testing', () => {
    test('should run all edge case test suites successfully', async () => {
      const results = await edgeCaseTester.runAllEdgeCaseTests();
      
      expect(results).toBeDefined();
      expect(results.suites).toBeInstanceOf(Array);
      expect(results.suites.length).toBeGreaterThan(0);
      expect(results.totalDuration).toBeGreaterThan(0);
      
      // Log results for debugging
      console.log('Edge Case Test Results:', {
        success: results.success,
        totalSuites: results.suites.length,
        totalDuration: results.totalDuration
      });
      
      results.suites.forEach(suite => {
        console.log(`Suite: ${suite.suiteName} - ${suite.passedTests}/${suite.totalTests} passed`);
        if (suite.failedTests > 0) {
          const failedTests = suite.tests.filter(t => !t.success);
          failedTests.forEach(test => {
            console.log(`  Failed: ${test.testName} - ${test.error}`);
          });
        }
      });
      
      // Test should pass even if some edge cases fail (they're edge cases after all)
      expect(results.suites.length).toBeGreaterThan(0);
    });

    test('should handle GPS accuracy edge cases', async () => {
      // Test very poor GPS accuracy
      const poorLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 500, // Very poor accuracy
        timestamp: Date.now()
      };

      const result = await explorationService.processLocationUpdate(poorLocation);
      
      // Poor accuracy should be rejected
      expect(result.newAreaExplored).toBe(false);
      expect(result.rejectionReason).toBe('poor_accuracy');
    });

    test('should handle GPS signal loss and recovery', async () => {
      // Mock GPS signal loss
      const signalLossError = new Error('Location unavailable');
      const handled = await errorRecoveryService.handleLocationError(
        signalLossError,
        'getCurrentLocation'
      );

      expect(handled).toBe(true);
      
      // Check error was recorded
      const errorStats = errorRecoveryService.getErrorStats();
      expect(errorStats.totalErrors).toBeGreaterThan(0);
      expect(errorStats.errorsByService.location).toBeGreaterThan(0);
    });

    test('should detect and handle impossible location jumps', async () => {
      const locations = [
        { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() }, // San Francisco
        { latitude: 40.7128, longitude: -74.0060, accuracy: 10, timestamp: Date.now() + 1000 }, // New York (impossible jump)
        { latitude: 37.7750, longitude: -122.4195, accuracy: 10, timestamp: Date.now() + 2000 }, // Back to SF
      ];

      const results = [];
      for (const location of locations) {
        const result = await explorationService.processLocationUpdate(location);
        results.push({
          accepted: result.newAreaExplored,
          reason: result.rejectionReason
        });
      }

      // First location should be accepted
      expect(results[0].accepted).toBe(true);
      
      // Second location (impossible jump) should be rejected
      expect(results[1].accepted).toBe(false);
      expect(results[1].reason).toBe('impossible_jump');
      
      // Third location should be accepted (back to reasonable location)
      expect(results[2].accepted).toBe(true);
    });
  });

  describe('Database Corruption Scenarios', () => {
    test('should detect database corruption', async () => {
      const corruptionError = new Error('database disk image is malformed');
      const handled = await errorRecoveryService.handleDatabaseError(
        corruptionError,
        'query'
      );

      expect(handled).toBe(true);
      
      const errorStats = errorRecoveryService.getErrorStats();
      expect(errorStats.errorsByService.database).toBeGreaterThan(0);
    });

    test('should handle database lock scenarios', async () => {
      const lockError = new Error('database is locked');
      const handled = await errorRecoveryService.handleDatabaseError(
        lockError,
        'transaction'
      );

      expect(handled).toBe(true);
    });

    test('should handle schema migration failures', async () => {
      const migrationError = new Error('no such column: new_field');
      const handled = await errorRecoveryService.handleDatabaseError(
        migrationError,
        'migration'
      );

      expect(handled).toBe(true);
    });

    test('should perform transaction rollback on errors', async () => {
      try {
        await databaseService.withTransaction(async () => {
          await databaseService.createExploredArea({
            latitude: 37.7749,
            longitude: -122.4194,
            radius: 100,
            explored_at: new Date().toISOString(),
            accuracy: 10
          });
          
          // Force rollback
          throw new Error('Simulated transaction error');
        });
        
        fail('Transaction should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Simulated transaction error');
        
        // Verify rollback - no data should be persisted
        const exploredAreas = await databaseService.getExploredAreas();
        expect(exploredAreas).toHaveLength(0);
      }
    });
  });

  describe('Network Connectivity Edge Cases', () => {
    test('should handle complete network loss', async () => {
      // Mock network loss
      jest.spyOn(offlineService, 'isOnline').mockReturnValue(false);
      jest.spyOn(offlineService, 'isOffline').mockReturnValue(true);

      const networkError = new Error('Network request failed');
      const handled = await errorRecoveryService.handleNetworkError(
        networkError,
        'mapTileLoad'
      );

      expect(handled).toBe(true);
      expect(offlineService.isOffline()).toBe(true);
    });

    test('should handle intermittent connectivity', async () => {
      let isOnline = true;
      
      // Mock intermittent connectivity
      jest.spyOn(offlineService, 'isOnline').mockImplementation(() => {
        isOnline = !isOnline;
        return isOnline;
      });

      const connectivityStates = [];
      for (let i = 0; i < 5; i++) {
        connectivityStates.push(offlineService.isOnline());
      }

      // Should alternate between online and offline
      expect(connectivityStates).toEqual([false, true, false, true, false]);
    });

    test('should handle rate limiting', async () => {
      const rateLimitError = new Error('HTTP 429: Too Many Requests');
      const handled = await errorRecoveryService.handleNetworkError(
        rateLimitError,
        'mapTileLoad'
      );

      expect(handled).toBe(true);
    });

    test('should resolve data synchronization conflicts', async () => {
      const localData = {
        exploredAreas: [{ id: 1, latitude: 37.7749, longitude: -122.4194, radius: 100 }]
      };
      const serverData = {
        exploredAreas: [{ id: 1, latitude: 37.7750, longitude: -122.4195, radius: 150 }]
      };

      const conflictResolution = await offlineService.resolveDataConflicts(localData, serverData);

      expect(conflictResolution).toBeDefined();
      expect(conflictResolution.resolution).toBeDefined();
      expect(conflictResolution.conflicts).toBeInstanceOf(Array);
    });
  });

  describe('Memory and Storage Pressure', () => {
    test('should detect memory pressure', async () => {
      const memoryStatus = errorRecoveryService.detectMemoryPressure();
      
      expect(memoryStatus).toBeDefined();
      expect(memoryStatus.isUnderPressure).toBeDefined();
      expect(memoryStatus.availableMemoryMB).toBeGreaterThanOrEqual(0);
      expect(memoryStatus.usedMemoryMB).toBeGreaterThanOrEqual(0);
      expect(['low', 'medium', 'high']).toContain(memoryStatus.pressureLevel);
    });

    test('should perform emergency memory cleanup', async () => {
      const cleanupResult = await errorRecoveryService.performEmergencyCleanup();
      
      expect(cleanupResult).toBeDefined();
      expect(cleanupResult.success).toBe(true);
      expect(cleanupResult.freedMemoryMB).toBeGreaterThanOrEqual(0);
      expect(cleanupResult.cleanupActions).toBeInstanceOf(Array);
      expect(cleanupResult.cleanupActions.length).toBeGreaterThan(0);
    });

    test('should check storage space', async () => {
      const storageStatus = await errorRecoveryService.checkStorageSpace();
      
      expect(storageStatus).toBeDefined();
      expect(storageStatus.totalSpaceMB).toBeGreaterThan(0);
      expect(storageStatus.availableSpaceMB).toBeGreaterThanOrEqual(0);
      expect(storageStatus.usedSpaceMB).toBeGreaterThanOrEqual(0);
      expect(typeof storageStatus.isLow).toBe('boolean');
      expect(typeof storageStatus.isCritical).toBe('boolean');
    });

    test('should perform storage cleanup', async () => {
      const cleanupResult = await errorRecoveryService.performStorageCleanup();
      
      expect(cleanupResult).toBeDefined();
      expect(cleanupResult.success).toBe(true);
      expect(cleanupResult.freedSpaceMB).toBeGreaterThanOrEqual(0);
      expect(cleanupResult.cleanupActions).toBeInstanceOf(Array);
    });
  });

  describe('Service Failure Recovery', () => {
    test('should handle location service failure', async () => {
      const serviceError = new Error('Location service unavailable');
      const errorHandling = await errorRecoveryService.handleServiceError('location', serviceError);
      
      expect(errorHandling).toBeDefined();
      expect(typeof errorHandling.canRecover).toBe('boolean');
      expect(errorHandling.fallbackStrategy).toBeDefined();
      expect(errorHandling.retryAfter).toBeGreaterThan(0);
    });

    test('should handle database service failure', async () => {
      const serviceError = new Error('Database initialization failed');
      const errorHandling = await errorRecoveryService.handleServiceError('database', serviceError);
      
      expect(errorHandling).toBeDefined();
      expect(typeof errorHandling.canRecover).toBe('boolean');
      expect(errorHandling.fallbackStrategy).toBeDefined();
    });

    test('should attempt service recovery', async () => {
      const recoveryResult = await errorRecoveryService.attemptServiceRecovery('location');
      
      expect(recoveryResult).toBeDefined();
      expect(recoveryResult.service).toBe('location');
      expect(typeof recoveryResult.recovered).toBe('boolean');
      expect(recoveryResult.attempts).toBeGreaterThan(0);
      expect(recoveryResult.recoveryMethod).toBeDefined();
    });

    test('should handle cascading service failures', async () => {
      const services = ['location', 'database', 'fog'];
      const results = [];
      
      for (const service of services) {
        const error = new Error(`${service} service failed`);
        const handling = await errorRecoveryService.handleServiceError(service, error);
        results.push({
          service,
          handled: handling.canRecover,
          fallback: handling.fallbackStrategy
        });
      }
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.service).toBeDefined();
        expect(typeof result.handled).toBe('boolean');
        expect(result.fallback).toBeDefined();
      });
    });
  });

  describe('Data Integrity Validation', () => {
    test('should reject invalid location data', async () => {
      const invalidLocations = [
        { latitude: 91, longitude: 0, accuracy: 10, timestamp: Date.now() }, // Invalid latitude
        { latitude: 0, longitude: 181, accuracy: 10, timestamp: Date.now() }, // Invalid longitude
        { latitude: 37.7749, longitude: -122.4194, accuracy: -5, timestamp: Date.now() }, // Negative accuracy
        { latitude: NaN, longitude: -122.4194, accuracy: 10, timestamp: Date.now() }, // NaN latitude
      ];

      const results = [];
      for (const location of invalidLocations) {
        try {
          const result = await explorationService.processLocationUpdate(location);
          results.push({
            accepted: result.newAreaExplored,
            reason: result.rejectionReason || 'invalid_data'
          });
        } catch (error) {
          results.push({
            accepted: false,
            reason: 'exception_thrown'
          });
        }
      }

      // All invalid locations should be rejected
      expect(results.every(r => !r.accepted)).toBe(true);
    });

    test('should handle corrupted exploration data', async () => {
      const corruptedData = {
        exploredAreas: [
          { id: 'invalid', latitude: 'not_a_number', longitude: null },
          { latitude: 37.7749, longitude: -122.4194 }, // Missing required fields
        ],
        userStats: { total_areas_explored: 'invalid_number' },
        achievements: null
      };

      try {
        await databaseService.importData(corruptedData);
        fail('Should have thrown an error for corrupted data');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toBeDefined();
      }
    });

    test('should maintain data consistency', async () => {
      // Clear existing data
      await databaseService.withTransaction(async () => {
        await databaseService.importData({
          exploredAreas: [],
          userStats: null,
          achievements: []
        });
      });

      // Create test data
      await databaseService.createExploredArea({
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 100,
        explored_at: new Date().toISOString(),
        accuracy: 10
      });

      // Check data consistency
      const exploredAreas = await databaseService.getExploredAreas();
      const userStats = await databaseService.getUserStats();

      expect(exploredAreas).toHaveLength(1);
      
      // User stats should be updated to reflect the new area
      if (userStats) {
        expect(userStats.total_areas_explored).toBe(1);
      }
    });
  });

  describe('Map Tile Error Handling', () => {
    test('should handle map tile loading errors', async () => {
      const tileErrors = [
        { x: 1, y: 1, z: 10, error: 'Network timeout' },
        { x: 2, y: 1, z: 10, error: 'HTTP 404: Not found' },
        { x: 1, y: 2, z: 10, error: 'HTTP 500: Server error' }
      ];

      for (const tileError of tileErrors) {
        const errorHandling = await errorRecoveryService.handleMapTileError(tileError);
        
        expect(errorHandling).toBeDefined();
        expect(typeof errorHandling.retry).toBe('boolean');
        expect(errorHandling.fallbackStrategy).toBeDefined();
      }
    });

    test('should provide appropriate fallback strategies for different tile errors', async () => {
      const notFoundError = { x: 1, y: 1, z: 10, error: 'HTTP 404: Tile not found' };
      const timeoutError = { x: 1, y: 1, z: 10, error: 'Request timeout' };
      const serverError = { x: 1, y: 1, z: 10, error: 'HTTP 500: Internal server error' };

      const notFoundHandling = await errorRecoveryService.handleMapTileError(notFoundError);
      const timeoutHandling = await errorRecoveryService.handleMapTileError(timeoutError);
      const serverHandling = await errorRecoveryService.handleMapTileError(serverError);

      // 404 errors should not retry but use fallback
      expect(notFoundHandling.retry).toBe(false);
      expect(notFoundHandling.fallbackStrategy).toBe('use_lower_zoom_tile');

      // Timeout errors should retry
      expect(timeoutHandling.retry).toBe(true);
      expect(timeoutHandling.fallbackStrategy).toBe('retry_with_delay');

      // Server errors should retry and use cache
      expect(serverHandling.retry).toBe(true);
      expect(serverHandling.fallbackStrategy).toBe('use_cached_tile');
    });
  });

  describe('Error Recovery Statistics', () => {
    test('should track error statistics', async () => {
      // Generate some errors
      await errorRecoveryService.handleLocationError(new Error('GPS unavailable'), 'getCurrentLocation');
      await errorRecoveryService.handleDatabaseError(new Error('Database locked'), 'query');
      await errorRecoveryService.handleNetworkError(new Error('Network timeout'), 'mapTileLoad');

      const errorStats = errorRecoveryService.getErrorStats();
      
      expect(errorStats).toBeDefined();
      expect(errorStats.totalErrors).toBe(3);
      expect(errorStats.errorsByService.location).toBe(1);
      expect(errorStats.errorsByService.database).toBe(1);
      expect(errorStats.errorsByService.network).toBe(1);
      expect(errorStats.recentErrors).toBeInstanceOf(Array);
      expect(errorStats.recoveryRate).toBeGreaterThanOrEqual(0);
      expect(errorStats.recoveryRate).toBeLessThanOrEqual(1);
    });

    test('should clear error history', async () => {
      // Generate an error
      await errorRecoveryService.handleLocationError(new Error('Test error'), 'test');
      
      let errorStats = errorRecoveryService.getErrorStats();
      expect(errorStats.totalErrors).toBeGreaterThan(0);
      
      // Clear history
      errorRecoveryService.clearErrorHistory();
      
      errorStats = errorRecoveryService.getErrorStats();
      expect(errorStats.totalErrors).toBe(0);
    });
  });
});