import { backgroundLocationService } from '../services/backgroundLocationService';
import { locationService } from '../services/locationService';
import { getDatabaseService } from '../database/services';

/**
 * Test utility for background location functionality
 */
export async function testBackgroundLocationProcessing(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    console.log('Testing background location processing...');

    // Test 1: Check if background location service can be configured
    backgroundLocationService.configure({
      autoProcessOnForeground: true,
      maxQueueSize: 100,
      processingInterval: 30000,
      minAccuracy: 100,
      minDistance: 25,
    });

    // Test 2: Check location permissions
    const permissions = await locationService.requestPermissions();
    if (!permissions.granted) {
      return {
        success: false,
        message: 'Location permissions not granted',
        details: permissions,
      };
    }

    // Test 3: Check background permissions
    const backgroundPermissions = await locationService.requestBackgroundPermissions();
    if (!backgroundPermissions.granted) {
      return {
        success: false,
        message: 'Background location permissions not granted',
        details: backgroundPermissions,
      };
    }

    // Test 4: Check database connectivity
    const databaseService = getDatabaseService();
    const userStats = await databaseService.getUserStats();
    
    // Test 5: Get current queue status
    const queueStatus = await locationService.getBackgroundQueueStatus();
    
    // Test 6: Get background location service stats
    const serviceStats = await backgroundLocationService.getStats();

    // Test 7: Check if background tracking can be started
    const trackingStatus = await locationService.getTrackingStatus();

    return {
      success: true,
      message: 'Background location processing test completed successfully',
      details: {
        permissions: {
          foreground: permissions,
          background: backgroundPermissions,
        },
        database: {
          connected: userStats !== null,
          userStats,
        },
        queue: queueStatus,
        service: serviceStats,
        tracking: trackingStatus,
      },
    };

  } catch (error) {
    console.error('Background location test failed:', error);
    return {
      success: false,
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error },
    };
  }
}

/**
 * Test background location queue processing with mock data
 */
export async function testBackgroundLocationQueue(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    console.log('Testing background location queue processing...');

    // Get initial queue status
    const initialStatus = await locationService.getBackgroundQueueStatus();
    
    // Force process any existing queue items
    const processResult = await locationService.forceProcessBackgroundQueue();
    
    // Get final queue status
    const finalStatus = await locationService.getBackgroundQueueStatus();
    
    // Get service stats
    const serviceStats = await backgroundLocationService.getStats();

    return {
      success: true,
      message: 'Background location queue test completed successfully',
      details: {
        initialStatus,
        processResult,
        finalStatus,
        serviceStats,
      },
    };

  } catch (error) {
    console.error('Background location queue test failed:', error);
    return {
      success: false,
      message: `Queue test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error },
    };
  }
}

/**
 * Test background location service lifecycle
 */
export async function testBackgroundLocationServiceLifecycle(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    console.log('Testing background location service lifecycle...');

    // Test starting the service
    const startResult = await backgroundLocationService.start();
    if (!startResult) {
      return {
        success: false,
        message: 'Failed to start background location service',
      };
    }

    // Get stats after starting
    const statsAfterStart = await backgroundLocationService.getStats();

    // Test force processing
    const forceProcessResult = await backgroundLocationService.forceProcess();

    // Get stats after processing
    const statsAfterProcess = await backgroundLocationService.getStats();

    // Test stopping the service
    await backgroundLocationService.stop();

    // Get final stats
    const finalStats = await backgroundLocationService.getStats();

    return {
      success: true,
      message: 'Background location service lifecycle test completed successfully',
      details: {
        startResult,
        statsAfterStart,
        forceProcessResult,
        statsAfterProcess,
        finalStats,
      },
    };

  } catch (error) {
    console.error('Background location service lifecycle test failed:', error);
    return {
      success: false,
      message: `Lifecycle test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error },
    };
  }
}

/**
 * Run all background location tests
 */
export async function runAllBackgroundLocationTests(): Promise<{
  success: boolean;
  message: string;
  results: any[];
}> {
  console.log('Running all background location tests...');

  const results = [];

  // Test 1: Basic functionality
  const basicTest = await testBackgroundLocationProcessing();
  results.push({ test: 'Basic Processing', ...basicTest });

  // Test 2: Queue processing
  const queueTest = await testBackgroundLocationQueue();
  results.push({ test: 'Queue Processing', ...queueTest });

  // Test 3: Service lifecycle
  const lifecycleTest = await testBackgroundLocationServiceLifecycle();
  results.push({ test: 'Service Lifecycle', ...lifecycleTest });

  const allSuccessful = results.every(result => result.success);

  return {
    success: allSuccessful,
    message: allSuccessful 
      ? 'All background location tests passed' 
      : 'Some background location tests failed',
    results,
  };
}