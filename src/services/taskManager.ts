import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationUpdate } from '../types';
import { getDatabaseService } from '../database/services';

const BACKGROUND_LOCATION_TASK = 'background-location-task';
const BACKGROUND_LOCATIONS_KEY = 'background_locations';
const BACKGROUND_QUEUE_KEY = 'background_queue';
const BACKGROUND_SYNC_STATUS_KEY = 'background_sync_status';

// Queue management interfaces
interface QueuedLocationUpdate extends LocationUpdate {
  id: string;
  processed: boolean;
  retryCount: number;
  queuedAt: number;
}

interface BackgroundSyncStatus {
  lastSyncAt: number;
  pendingCount: number;
  failedCount: number;
  totalProcessed: number;
}

// Background location task handler with enhanced queue management
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    await updateSyncStatus({ failedCount: 1 });
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    
    try {
      // Process each location update
      const locationUpdates: LocationUpdate[] = locations
        .map((location) => ({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy || 0,
          timestamp: location.timestamp || Date.now(),
        }))
        .filter(location => validateLocationUpdate(location));

      if (locationUpdates.length === 0) {
        console.log('No valid location updates to process');
        return;
      }

      // Add to processing queue
      await addToLocationQueue(locationUpdates);
      
      // Attempt immediate processing if possible
      await processLocationQueue();
      
      console.log(`Queued ${locationUpdates.length} background location updates`);
      
    } catch (processingError) {
      console.error('Error processing background locations:', processingError);
      await updateSyncStatus({ failedCount: 1 });
    }
  }
});

// Enhanced queue management functions
async function addToLocationQueue(locations: LocationUpdate[]): Promise<void> {
  try {
    const existingQueue = await getLocationQueue();
    
    const queuedLocations: QueuedLocationUpdate[] = locations.map(location => ({
      ...location,
      id: `${location.timestamp}_${Math.random().toString(36).substr(2, 9)}`,
      processed: false,
      retryCount: 0,
      queuedAt: Date.now(),
    }));

    const updatedQueue = [...existingQueue, ...queuedLocations];
    
    // Keep queue size manageable (max 500 items)
    const trimmedQueue = updatedQueue.slice(-500);
    
    await AsyncStorage.setItem(BACKGROUND_QUEUE_KEY, JSON.stringify(trimmedQueue));
    
    // Update sync status
    await updateSyncStatus({ 
      pendingCount: trimmedQueue.filter(item => !item.processed).length 
    });
    
  } catch (error) {
    console.error('Error adding to location queue:', error);
    throw error;
  }
}

async function getLocationQueue(): Promise<QueuedLocationUpdate[]> {
  try {
    const stored = await AsyncStorage.getItem(BACKGROUND_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error getting location queue:', error);
    return [];
  }
}

async function processLocationQueue(): Promise<void> {
  try {
    const queue = await getLocationQueue();
    const unprocessedItems = queue.filter(item => !item.processed && item.retryCount < 3);
    
    if (unprocessedItems.length === 0) {
      return;
    }

    const databaseService = getDatabaseService();
    let processedCount = 0;
    let failedCount = 0;

    // Process items in batches to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < unprocessedItems.length; i += batchSize) {
      const batch = unprocessedItems.slice(i, i + batchSize);
      
      for (const item of batch) {
        try {
          // Check if this location is significantly different from recent ones
          const shouldProcess = await shouldProcessLocation(item, databaseService);
          
          if (shouldProcess) {
            // Create explored area in database
            await databaseService.createExploredArea({
              latitude: item.latitude,
              longitude: item.longitude,
              radius: Math.max(item.accuracy, 50), // Minimum 50m radius
              explored_at: new Date(item.timestamp).toISOString(),
              accuracy: item.accuracy,
            });
          }
          
          // Mark as processed
          item.processed = true;
          processedCount++;
          
        } catch (error) {
          console.error(`Error processing queued location ${item.id}:`, error);
          item.retryCount++;
          failedCount++;
        }
      }
    }

    // Update queue with processed items
    await AsyncStorage.setItem(BACKGROUND_QUEUE_KEY, JSON.stringify(queue));
    
    // Update sync status
    await updateSyncStatus({
      lastSyncAt: Date.now(),
      pendingCount: queue.filter(item => !item.processed).length,
      failedCount,
      totalProcessed: processedCount,
    });
    
    console.log(`Background queue processing: ${processedCount} processed, ${failedCount} failed`);
    
  } catch (error) {
    console.error('Error processing location queue:', error);
    await updateSyncStatus({ failedCount: 1 });
  }
}

async function shouldProcessLocation(
  location: QueuedLocationUpdate, 
  databaseService: any
): Promise<boolean> {
  try {
    // Skip if accuracy is too poor (> 200m)
    if (location.accuracy > 200) {
      return false;
    }

    // Check if we already have a recent location nearby
    const nearbyAreas = await databaseService.findNearbyExploredAreas({
      latitude: location.latitude,
      longitude: location.longitude,
      radius: 0.1, // 100m radius
    });

    // If we have a recent area within 100m, skip this location
    const recentThreshold = Date.now() - (30 * 60 * 1000); // 30 minutes
    const hasRecentNearby = nearbyAreas.some((area: any) => 
      new Date(area.explored_at).getTime() > recentThreshold
    );

    return !hasRecentNearby;
    
  } catch (error) {
    console.error('Error checking if location should be processed:', error);
    // Default to processing if we can't determine
    return true;
  }
}

async function updateSyncStatus(updates: Partial<BackgroundSyncStatus>): Promise<void> {
  try {
    const currentStatus = await getSyncStatus();
    const updatedStatus: BackgroundSyncStatus = {
      ...currentStatus,
      ...updates,
      // Accumulate counts rather than overwrite
      failedCount: currentStatus.failedCount + (updates.failedCount || 0),
      totalProcessed: currentStatus.totalProcessed + (updates.totalProcessed || 0),
    };
    
    await AsyncStorage.setItem(BACKGROUND_SYNC_STATUS_KEY, JSON.stringify(updatedStatus));
  } catch (error) {
    console.error('Error updating sync status:', error);
  }
}

async function getSyncStatus(): Promise<BackgroundSyncStatus> {
  try {
    const stored = await AsyncStorage.getItem(BACKGROUND_SYNC_STATUS_KEY);
    return stored ? JSON.parse(stored) : {
      lastSyncAt: 0,
      pendingCount: 0,
      failedCount: 0,
      totalProcessed: 0,
    };
  } catch (error) {
    console.error('Error getting sync status:', error);
    return {
      lastSyncAt: 0,
      pendingCount: 0,
      failedCount: 0,
      totalProcessed: 0,
    };
  }
}

function validateLocationUpdate(location: LocationUpdate): boolean {
  return (
    typeof location.latitude === 'number' &&
    typeof location.longitude === 'number' &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180 &&
    !isNaN(location.latitude) &&
    !isNaN(location.longitude) &&
    location.accuracy > 0 &&
    location.accuracy < 1000 // Reject locations with accuracy worse than 1km
  );
}

// Legacy function for backward compatibility - now processes queue
async function getStoredBackgroundLocations(): Promise<LocationUpdate[]> {
  try {
    const stored = await AsyncStorage.getItem(BACKGROUND_LOCATIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error getting stored background locations:', error);
    return [];
  }
}

// Enhanced function to retrieve and process background locations
export async function processBackgroundLocations(): Promise<{
  processed: LocationUpdate[];
  status: BackgroundSyncStatus;
}> {
  try {
    // Process any pending items in the queue
    await processLocationQueue();
    
    // Get legacy stored locations for backward compatibility
    const legacyLocations = await getStoredBackgroundLocations();
    if (legacyLocations.length > 0) {
      await addToLocationQueue(legacyLocations);
      await AsyncStorage.removeItem(BACKGROUND_LOCATIONS_KEY);
      await processLocationQueue();
    }
    
    // Get processed locations from queue
    const queue = await getLocationQueue();
    const processedLocations = queue
      .filter(item => item.processed)
      .map(item => ({
        latitude: item.latitude,
        longitude: item.longitude,
        accuracy: item.accuracy,
        timestamp: item.timestamp,
      }));
    
    // Clean up old processed items (keep last 50)
    const cleanedQueue = queue
      .filter(item => !item.processed || queue.indexOf(item) >= queue.length - 50);
    await AsyncStorage.setItem(BACKGROUND_QUEUE_KEY, JSON.stringify(cleanedQueue));
    
    const status = await getSyncStatus();
    
    console.log(`Retrieved ${processedLocations.length} processed background locations`);
    
    return {
      processed: processedLocations,
      status,
    };
    
  } catch (error) {
    console.error('Error processing background locations:', error);
    return {
      processed: [],
      status: await getSyncStatus(),
    };
  }
}

// New function to get queue status for monitoring
export async function getBackgroundQueueStatus(): Promise<{
  queueSize: number;
  pendingCount: number;
  processedCount: number;
  failedCount: number;
  syncStatus: BackgroundSyncStatus;
}> {
  try {
    const queue = await getLocationQueue();
    const syncStatus = await getSyncStatus();
    
    return {
      queueSize: queue.length,
      pendingCount: queue.filter(item => !item.processed).length,
      processedCount: queue.filter(item => item.processed).length,
      failedCount: queue.filter(item => item.retryCount > 0).length,
      syncStatus,
    };
  } catch (error) {
    console.error('Error getting background queue status:', error);
    return {
      queueSize: 0,
      pendingCount: 0,
      processedCount: 0,
      failedCount: 0,
      syncStatus: await getSyncStatus(),
    };
  }
}

// Function to manually trigger queue processing
export async function forceProcessBackgroundQueue(): Promise<boolean> {
  try {
    await processLocationQueue();
    return true;
  } catch (error) {
    console.error('Error forcing background queue processing:', error);
    return false;
  }
}

// Function to clear the background queue (for debugging/reset)
export async function clearBackgroundQueue(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      BACKGROUND_QUEUE_KEY,
      BACKGROUND_LOCATIONS_KEY,
      BACKGROUND_SYNC_STATUS_KEY,
    ]);
    console.log('Background queue cleared');
  } catch (error) {
    console.error('Error clearing background queue:', error);
  }
}

export { BACKGROUND_LOCATION_TASK };