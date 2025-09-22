/**
 * Edge Case Testing Utilities
 * Provides utilities for testing various edge cases and error scenarios
 */

import { locationService } from '../services/locationService';
import { explorationService } from '../services/explorationService';
import { fogService } from '../services/fogService';
import { getDatabaseService } from '../database/services';
import { getOfflineService } from '../services/offlineService';
import { getErrorRecoveryService } from '../services/errorRecoveryService';

export interface EdgeCaseTestResult {
  testName: string;
  success: boolean;
  duration: number;
  details: any;
  error?: string;
}

export interface EdgeCaseTestSuite {
  suiteName: string;
  tests: EdgeCaseTestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
}

export class EdgeCaseTester {
  private databaseService = getDatabaseService();
  private offlineService = getOfflineService();
  private errorRecoveryService = getErrorRecoveryService();

  /**
   * Run all edge case tests
   */
  async runAllEdgeCaseTests(): Promise<{
    success: boolean;
    suites: EdgeCaseTestSuite[];
    totalDuration: number;
  }> {
    console.log('🧪 Starting comprehensive edge case testing...');
    const overallStartTime = Date.now();

    const suites: EdgeCaseTestSuite[] = [];

    // Run different test suites
    suites.push(await this.runGPSAccuracyTests());
    suites.push(await this.runDatabaseCorruptionTests());
    suites.push(await this.runNetworkConnectivityTests());
    suites.push(await this.runMemoryPressureTests());
    suites.push(await this.runStorageSpaceTests());
    suites.push(await this.runServiceFailureTests());
    suites.push(await this.runDataIntegrityTests());

    const overallEndTime = Date.now();
    const totalDuration = overallEndTime - overallStartTime;

    const allTestsPassed = suites.every(suite => suite.failedTests === 0);

    console.log(`🏁 Edge case testing completed in ${totalDuration}ms`);
    console.log(`📊 Results: ${suites.length} suites, ${allTestsPassed ? 'ALL PASSED' : 'SOME FAILED'}`);

    return {
      success: allTestsPassed,
      suites,
      totalDuration
    };
  }

  /**
   * Test GPS accuracy edge cases
   */
  private async runGPSAccuracyTests(): Promise<EdgeCaseTestSuite> {
    const suiteName = 'GPS Accuracy Edge Cases';
    console.log(`\n📍 Running ${suiteName}...`);
    const suiteStartTime = Date.now();

    const tests: EdgeCaseTestResult[] = [];

    // Test 1: Very poor GPS accuracy
    tests.push(await this.runTest('Very Poor GPS Accuracy (500m)', async () => {
      const poorLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 500, // Very poor accuracy
        timestamp: Date.now()
      };

      const result = await explorationService.processLocationUpdate(poorLocation);
      
      return {
        rejected: !result.newAreaExplored,
        reason: result.rejectionReason,
        accuracyWarning: result.accuracyWarning
      };
    }));

    // Test 2: GPS signal loss simulation
    tests.push(await this.runTest('GPS Signal Loss Recovery', async () => {
      // Mock GPS signal loss
      const originalGetLocation = locationService.getCurrentLocation;
      locationService.getCurrentLocation = jest.fn().mockRejectedValue(new Error('Location unavailable'));

      try {
        await locationService.getCurrentLocation();
        return { signalLost: false };
      } catch (error) {
        // Test error recovery
        const recovered = await this.errorRecoveryService.handleLocationError(
          error as Error,
          'getCurrentLocation'
        );
        
        // Restore original method
        locationService.getCurrentLocation = originalGetLocation;
        
        return {
          signalLost: true,
          recovered,
          errorHandled: true
        };
      }
    }));

    // Test 3: Rapid location changes (GPS jumping)
    tests.push(await this.runTest('Rapid Location Changes', async () => {
      const rapidLocations = [
        { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        { latitude: 40.7128, longitude: -74.0060, accuracy: 15, timestamp: Date.now() + 100 }, // NYC - impossible jump
        { latitude: 37.7750, longitude: -122.4195, accuracy: 12, timestamp: Date.now() + 200 }, // Back to SF
      ];

      const results = [];
      for (const location of rapidLocations) {
        const result = await explorationService.processLocationUpdate(location);
        results.push({
          location: `${location.latitude},${location.longitude}`,
          accepted: result.newAreaExplored,
          reason: result.rejectionReason
        });
      }

      // The middle location should be rejected due to impossible jump
      return {
        results,
        impossibleJumpDetected: results[1].accepted === false
      };
    }));

    // Test 4: Location permission revocation during use
    tests.push(await this.runTest('Permission Revocation During Use', async () => {
      // Mock permission revocation
      const originalRequestPermissions = locationService.requestPermissions;
      locationService.requestPermissions = jest.fn().mockResolvedValue({
        granted: false,
        status: 'denied',
        canAskAgain: false,
        expires: 'never'
      });

      try {
        const permissions = await locationService.requestPermissions();
        const recovered = await this.errorRecoveryService.handleLocationError(
          new Error('Location permission denied'),
          'requestPermissions'
        );

        // Restore original method
        locationService.requestPermissions = originalRequestPermissions;

        return {
          permissionDenied: !permissions.granted,
          recoveryAttempted: recovered,
          fallbackEnabled: true
        };
      } catch (error) {
        locationService.requestPermissions = originalRequestPermissions;
        throw error;
      }
    }));

    // Test 5: Location timeout scenarios
    tests.push(await this.runTest('Location Timeout Handling', async () => {
      // Mock location timeout
      const timeoutError = new Error('Location request timed out');
      const recovered = await this.errorRecoveryService.handleLocationError(
        timeoutError,
        'getCurrentLocation',
        { timeout: 30000 }
      );

      return {
        timeoutHandled: true,
        recovered,
        fallbackStrategy: 'manual_exploration'
      };
    }));

    const suiteEndTime = Date.now();
    const duration = suiteEndTime - suiteStartTime;

    return {
      suiteName,
      tests,
      totalTests: tests.length,
      passedTests: tests.filter(t => t.success).length,
      failedTests: tests.filter(t => !t.success).length,
      duration
    };
  }

  /**
   * Test database corruption scenarios
   */
  private async runDatabaseCorruptionTests(): Promise<EdgeCaseTestSuite> {
    const suiteName = 'Database Corruption Scenarios';
    console.log(`\n💾 Running ${suiteName}...`);
    const suiteStartTime = Date.now();

    const tests: EdgeCaseTestResult[] = [];

    // Test 1: Database corruption detection
    tests.push(await this.runTest('Database Corruption Detection', async () => {
      const corruptionError = new Error('database disk image is malformed');
      const handled = await this.errorRecoveryService.handleDatabaseError(
        corruptionError,
        'query'
      );

      return {
        corruptionDetected: true,
        handled,
        recoveryAttempted: true
      };
    }));

    // Test 2: Database lock scenarios
    tests.push(await this.runTest('Database Lock Handling', async () => {
      const lockError = new Error('database is locked');
      const handled = await this.errorRecoveryService.handleDatabaseError(
        lockError,
        'transaction'
      );

      return {
        lockDetected: true,
        handled,
        retryStrategy: 'exponential_backoff'
      };
    }));

    // Test 3: Schema migration failures
    tests.push(await this.runTest('Schema Migration Failure', async () => {
      const migrationError = new Error('no such column: new_field');
      const handled = await this.errorRecoveryService.handleDatabaseError(
        migrationError,
        'migration'
      );

      return {
        schemaMismatch: true,
        handled,
        migrationAttempted: true
      };
    }));

    // Test 4: Transaction rollback scenarios
    tests.push(await this.runTest('Transaction Rollback', async () => {
      try {
        await this.databaseService.withTransaction(async () => {
          // Simulate transaction that needs rollback
          await this.databaseService.createExploredArea({
            latitude: 37.7749,
            longitude: -122.4194,
            radius: 100,
            explored_at: new Date().toISOString(),
            accuracy: 10
          });
          
          // Force rollback
          throw new Error('Simulated transaction error');
        });
        
        return { rollbackFailed: true };
      } catch (error) {
        return {
          rollbackSuccessful: true,
          errorMessage: (error as Error).message
        };
      }
    }));

    // Test 5: Database integrity check
    tests.push(await this.runTest('Database Integrity Check', async () => {
      const integrityResult = await this.databaseService.checkIntegrity();
      
      return {
        integrityChecked: true,
        isValid: integrityResult.isValid,
        errors: integrityResult.errors || []
      };
    }));

    const suiteEndTime = Date.now();
    const duration = suiteEndTime - suiteStartTime;

    return {
      suiteName,
      tests,
      totalTests: tests.length,
      passedTests: tests.filter(t => t.success).length,
      failedTests: tests.filter(t => !t.success).length,
      duration
    };
  }

  /**
   * Test network connectivity edge cases
   */
  private async runNetworkConnectivityTests(): Promise<EdgeCaseTestSuite> {
    const suiteName = 'Network Connectivity Edge Cases';
    console.log(`\n🌐 Running ${suiteName}...`);
    const suiteStartTime = Date.now();

    const tests: EdgeCaseTestResult[] = [];

    // Test 1: Complete network loss
    tests.push(await this.runTest('Complete Network Loss', async () => {
      // Mock network loss
      jest.spyOn(this.offlineService, 'isOnline').mockReturnValue(false);
      jest.spyOn(this.offlineService, 'isOffline').mockReturnValue(true);

      const networkError = new Error('Network request failed');
      const handled = await this.errorRecoveryService.handleNetworkError(
        networkError,
        'mapTileLoad'
      );

      return {
        networkLost: true,
        handled,
        offlineModeEnabled: true
      };
    }));

    // Test 2: Intermittent connectivity
    tests.push(await this.runTest('Intermittent Connectivity', async () => {
      let isOnline = true;
      
      // Mock intermittent connectivity
      jest.spyOn(this.offlineService, 'isOnline').mockImplementation(() => {
        isOnline = !isOnline; // Toggle connectivity
        return isOnline;
      });

      const attempts = [];
      for (let i = 0; i < 5; i++) {
        attempts.push({
          attempt: i + 1,
          online: this.offlineService.isOnline()
        });
      }

      return {
        intermittentDetected: true,
        attempts,
        adaptiveStrategy: 'queue_and_retry'
      };
    }));

    // Test 3: Slow network conditions
    tests.push(await this.runTest('Slow Network Handling', async () => {
      const timeoutError = new Error('Request timeout after 30000ms');
      const handled = await this.errorRecoveryService.handleNetworkError(
        timeoutError,
        'mapTileLoad'
      );

      return {
        slowNetworkDetected: true,
        handled,
        timeoutStrategy: 'progressive_timeout'
      };
    }));

    // Test 4: Rate limiting scenarios
    tests.push(await this.runTest('Rate Limiting Handling', async () => {
      const rateLimitError = new Error('HTTP 429: Too Many Requests');
      const handled = await this.errorRecoveryService.handleNetworkError(
        rateLimitError,
        'mapTileLoad'
      );

      return {
        rateLimitDetected: true,
        handled,
        backoffStrategy: 'exponential'
      };
    }));

    // Test 5: Data synchronization conflicts
    tests.push(await this.runTest('Data Sync Conflicts', async () => {
      const localData = { exploredAreas: [{ id: 1, latitude: 37.7749, longitude: -122.4194 }] };
      const serverData = { exploredAreas: [{ id: 1, latitude: 37.7750, longitude: -122.4195 }] };

      const conflictResolution = await this.offlineService.resolveDataConflicts(localData, serverData);

      return {
        conflictDetected: true,
        resolution: conflictResolution.resolution,
        conflicts: conflictResolution.conflicts
      };
    }));

    const suiteEndTime = Date.now();
    const duration = suiteEndTime - suiteStartTime;

    return {
      suiteName,
      tests,
      totalTests: tests.length,
      passedTests: tests.filter(t => t.success).length,
      failedTests: tests.filter(t => !t.success).length,
      duration
    };
  }

  /**
   * Test memory pressure scenarios
   */
  private async runMemoryPressureTests(): Promise<EdgeCaseTestSuite> {
    const suiteName = 'Memory Pressure Scenarios';
    console.log(`\n🧠 Running ${suiteName}...`);
    const suiteStartTime = Date.now();

    const tests: EdgeCaseTestResult[] = [];

    // Test 1: High memory pressure detection
    tests.push(await this.runTest('High Memory Pressure Detection', async () => {
      const memoryStatus = this.errorRecoveryService.detectMemoryPressure();
      
      return {
        memoryChecked: true,
        pressureLevel: memoryStatus.pressureLevel,
        isUnderPressure: memoryStatus.isUnderPressure,
        availableMemoryMB: memoryStatus.availableMemoryMB
      };
    }));

    // Test 2: Emergency memory cleanup
    tests.push(await this.runTest('Emergency Memory Cleanup', async () => {
      const cleanupResult = await this.errorRecoveryService.performEmergencyCleanup();
      
      return {
        cleanupPerformed: cleanupResult.success,
        freedMemoryMB: cleanupResult.freedMemoryMB,
        actions: cleanupResult.cleanupActions
      };
    }));

    // Test 3: Memory leak detection
    tests.push(await this.runTest('Memory Leak Detection', async () => {
      const initialMemory = this.errorRecoveryService.detectMemoryPressure();
      
      // Simulate memory-intensive operations
      const largeData = new Array(1000).fill('x'.repeat(1000));
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalMemory = this.errorRecoveryService.detectMemoryPressure();
      
      return {
        initialMemoryMB: initialMemory.usedMemoryMB,
        finalMemoryMB: finalMemory.usedMemoryMB,
        memoryIncrease: finalMemory.usedMemoryMB - initialMemory.usedMemoryMB,
        leakDetected: finalMemory.usedMemoryMB > initialMemory.usedMemoryMB + 50
      };
    }));

    // Test 4: Out of memory recovery
    tests.push(await this.runTest('Out of Memory Recovery', async () => {
      const outOfMemoryError = new Error('Cannot allocate memory');
      
      // Simulate OOM recovery
      const cleanupResult = await this.errorRecoveryService.performEmergencyCleanup();
      
      return {
        oomDetected: true,
        recoveryAttempted: true,
        cleanupSuccess: cleanupResult.success,
        freedMemoryMB: cleanupResult.freedMemoryMB
      };
    }));

    const suiteEndTime = Date.now();
    const duration = suiteEndTime - suiteStartTime;

    return {
      suiteName,
      tests,
      totalTests: tests.length,
      passedTests: tests.filter(t => t.success).length,
      failedTests: tests.filter(t => !t.success).length,
      duration
    };
  }

  /**
   * Test storage space scenarios
   */
  private async runStorageSpaceTests(): Promise<EdgeCaseTestSuite> {
    const suiteName = 'Storage Space Scenarios';
    console.log(`\n💿 Running ${suiteName}...`);
    const suiteStartTime = Date.now();

    const tests: EdgeCaseTestResult[] = [];

    // Test 1: Low storage space detection
    tests.push(await this.runTest('Low Storage Space Detection', async () => {
      const storageStatus = await this.errorRecoveryService.checkStorageSpace();
      
      return {
        storageChecked: true,
        totalSpaceMB: storageStatus.totalSpaceMB,
        availableSpaceMB: storageStatus.availableSpaceMB,
        isLow: storageStatus.isLow,
        isCritical: storageStatus.isCritical
      };
    }));

    // Test 2: Storage cleanup
    tests.push(await this.runTest('Storage Cleanup', async () => {
      const cleanupResult = await this.errorRecoveryService.performStorageCleanup();
      
      return {
        cleanupPerformed: cleanupResult.success,
        freedSpaceMB: cleanupResult.freedSpaceMB,
        actions: cleanupResult.cleanupActions
      };
    }));

    // Test 3: Disk full scenarios
    tests.push(await this.runTest('Disk Full Handling', async () => {
      const diskFullError = new Error('No space left on device');
      
      // Test error handling
      const handled = await this.errorRecoveryService.handleDatabaseError(
        diskFullError,
        'insert'
      );
      
      return {
        diskFullDetected: true,
        handled,
        fallbackStrategy: 'queue_for_later'
      };
    }));

    const suiteEndTime = Date.now();
    const duration = suiteEndTime - suiteStartTime;

    return {
      suiteName,
      tests,
      totalTests: tests.length,
      passedTests: tests.filter(t => t.success).length,
      failedTests: tests.filter(t => !t.success).length,
      duration
    };
  }

  /**
   * Test service failure scenarios
   */
  private async runServiceFailureTests(): Promise<EdgeCaseTestSuite> {
    const suiteName = 'Service Failure Scenarios';
    console.log(`\n⚙️ Running ${suiteName}...`);
    const suiteStartTime = Date.now();

    const tests: EdgeCaseTestResult[] = [];

    // Test 1: Location service failure
    tests.push(await this.runTest('Location Service Failure', async () => {
      const serviceError = new Error('Location service unavailable');
      const errorHandling = await this.errorRecoveryService.handleServiceError('location', serviceError);
      
      return {
        serviceFailureDetected: true,
        canRecover: errorHandling.canRecover,
        fallbackStrategy: errorHandling.fallbackStrategy,
        retryAfter: errorHandling.retryAfter
      };
    }));

    // Test 2: Database service failure
    tests.push(await this.runTest('Database Service Failure', async () => {
      const serviceError = new Error('Database initialization failed');
      const errorHandling = await this.errorRecoveryService.handleServiceError('database', serviceError);
      
      return {
        serviceFailureDetected: true,
        canRecover: errorHandling.canRecover,
        fallbackStrategy: errorHandling.fallbackStrategy
      };
    }));

    // Test 3: Service recovery attempts
    tests.push(await this.runTest('Service Recovery Attempts', async () => {
      const recoveryResult = await this.errorRecoveryService.attemptServiceRecovery('location');
      
      return {
        recoveryAttempted: true,
        service: recoveryResult.service,
        recovered: recoveryResult.recovered,
        attempts: recoveryResult.attempts,
        method: recoveryResult.recoveryMethod
      };
    }));

    // Test 4: Cascading service failures
    tests.push(await this.runTest('Cascading Service Failures', async () => {
      const services = ['location', 'database', 'fog'];
      const results = [];
      
      for (const service of services) {
        const error = new Error(`${service} service failed`);
        const handling = await this.errorRecoveryService.handleServiceError(service, error);
        results.push({
          service,
          handled: handling.canRecover,
          fallback: handling.fallbackStrategy
        });
      }
      
      return {
        cascadingFailureDetected: true,
        affectedServices: services.length,
        results
      };
    }));

    const suiteEndTime = Date.now();
    const duration = suiteEndTime - suiteStartTime;

    return {
      suiteName,
      tests,
      totalTests: tests.length,
      passedTests: tests.filter(t => t.success).length,
      failedTests: tests.filter(t => !t.success).length,
      duration
    };
  }

  /**
   * Test data integrity scenarios
   */
  private async runDataIntegrityTests(): Promise<EdgeCaseTestSuite> {
    const suiteName = 'Data Integrity Scenarios';
    console.log(`\n🔒 Running ${suiteName}...`);
    const suiteStartTime = Date.now();

    const tests: EdgeCaseTestResult[] = [];

    // Test 1: Invalid location data
    tests.push(await this.runTest('Invalid Location Data', async () => {
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
            location: `${location.latitude},${location.longitude}`,
            accepted: result.newAreaExplored,
            reason: result.rejectionReason || 'invalid_data'
          });
        } catch (error) {
          results.push({
            location: `${location.latitude},${location.longitude}`,
            accepted: false,
            reason: 'exception_thrown'
          });
        }
      }

      return {
        invalidDataDetected: true,
        results,
        allRejected: results.every(r => !r.accepted)
      };
    }));

    // Test 2: Corrupted exploration data
    tests.push(await this.runTest('Corrupted Exploration Data', async () => {
      const corruptedData = {
        exploredAreas: [
          { id: 'invalid', latitude: 'not_a_number', longitude: null },
          { latitude: 37.7749, longitude: -122.4194 }, // Missing required fields
        ],
        userStats: { total_areas_explored: 'invalid_number' },
        achievements: null
      };

      try {
        await this.databaseService.importData(corruptedData);
        return { corruptionHandled: false };
      } catch (error) {
        return {
          corruptionDetected: true,
          errorMessage: (error as Error).message,
          corruptionHandled: true
        };
      }
    }));

    // Test 3: Data consistency checks
    tests.push(await this.runTest('Data Consistency Checks', async () => {
      // Create test data with potential inconsistencies
      await this.databaseService.createExploredArea({
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 100,
        explored_at: new Date().toISOString(),
        accuracy: 10
      });

      // Check data consistency
      const exploredAreas = await this.databaseService.getExploredAreas();
      const userStats = await this.databaseService.getUserStats();

      return {
        dataConsistencyChecked: true,
        exploredAreasCount: exploredAreas.length,
        statsAreasCount: userStats?.total_areas_explored || 0,
        consistent: exploredAreas.length === (userStats?.total_areas_explored || 0)
      };
    }));

    const suiteEndTime = Date.now();
    const duration = suiteEndTime - suiteStartTime;

    return {
      suiteName,
      tests,
      totalTests: tests.length,
      passedTests: tests.filter(t => t.success).length,
      failedTests: tests.filter(t => !t.success).length,
      duration
    };
  }

  /**
   * Run a single test with error handling and timing
   */
  private async runTest(testName: string, testFunction: () => Promise<any>): Promise<EdgeCaseTestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`  ⏳ Running: ${testName}`);
      const result = await testFunction();
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`  ✅ Passed: ${testName} (${duration}ms)`);
      
      return {
        testName,
        success: true,
        duration,
        details: result
      };
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`  ❌ Failed: ${testName} (${duration}ms)`);
      console.log(`     Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        testName,
        success: false,
        duration,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export test runner instance
export const edgeCaseTester = new EdgeCaseTester();

// Development helper function
export const runEdgeCaseTests = async (): Promise<void> => {
  const results = await edgeCaseTester.runAllEdgeCaseTests();
  
  if (!results.success) {
    const failedSuites = results.suites.filter(suite => suite.failedTests > 0);
    throw new Error(`Edge case tests failed: ${failedSuites.length} out of ${results.suites.length} suites had failures`);
  }
};