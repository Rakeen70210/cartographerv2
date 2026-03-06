import { LocationUpdate } from '../types';

export const BACKGROUND_LOCATION_TASK = 'background-location-task';

interface BackgroundSyncStatus {
  lastSyncAt: number;
  pendingCount: number;
  failedCount: number;
  totalProcessed: number;
}

const emptyStatus: BackgroundSyncStatus = {
  lastSyncAt: 0,
  pendingCount: 0,
  failedCount: 0,
  totalProcessed: 0,
};

export async function processBackgroundLocations(): Promise<{
  processed: LocationUpdate[];
  status: BackgroundSyncStatus;
}> {
  return {
    processed: [],
    status: { ...emptyStatus },
  };
}

export async function getBackgroundQueueStatus(): Promise<{
  queueSize: number;
  pendingCount: number;
  processedCount: number;
  failedCount: number;
  syncStatus: BackgroundSyncStatus;
}> {
  return {
    queueSize: 0,
    pendingCount: 0,
    processedCount: 0,
    failedCount: 0,
    syncStatus: { ...emptyStatus },
  };
}

export async function forceProcessBackgroundQueue(): Promise<boolean> {
  return true;
}

export async function clearBackgroundQueue(): Promise<void> {
  return;
}
