import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { backgroundLocationService, BackgroundLocationStats } from '../services/backgroundLocationService';

export interface UseBackgroundLocationReturn {
  isActive: boolean;
  stats: BackgroundLocationStats;
  isProcessing: boolean;
  error: string | null;
  start: () => Promise<boolean>;
  stop: () => Promise<void>;
  forceProcess: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useBackgroundLocation(): UseBackgroundLocationReturn {
  const [isActive, setIsActive] = useState(false);
  const [stats, setStats] = useState<BackgroundLocationStats>({
    totalProcessed: 0,
    totalFailed: 0,
    lastProcessedAt: 0,
    queueSize: 0,
    isProcessing: false,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh stats from the service
  const refreshStats = useCallback(async () => {
    try {
      const currentStats = await backgroundLocationService.getStats();
      setStats(currentStats);
      setIsProcessing(currentStats.isProcessing);
      setError(null);
    } catch (err) {
      console.error('Error refreshing background location stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  // Start background location service
  const start = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      const success = await backgroundLocationService.start();
      setIsActive(success);
      
      if (success) {
        await refreshStats();
      } else {
        setError('Failed to start background location service');
      }
      
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error starting background location service:', err);
      return false;
    }
  }, [refreshStats]);

  // Stop background location service
  const stop = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await backgroundLocationService.stop();
      setIsActive(false);
      await refreshStats();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error stopping background location service:', err);
    }
  }, [refreshStats]);

  // Force process background queue
  const forceProcess = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      setIsProcessing(true);
      
      const success = await backgroundLocationService.forceProcess();
      
      if (!success) {
        setError('Failed to process background locations');
      }
      
      await refreshStats();
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error forcing background location processing:', err);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [refreshStats]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Refresh stats when app becomes active
        refreshStats();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [refreshStats]);

  // Initial stats load and periodic refresh
  useEffect(() => {
    refreshStats();
    
    // Set up periodic refresh every 30 seconds when component is mounted
    const interval = setInterval(refreshStats, 30000);
    
    return () => {
      clearInterval(interval);
    };
  }, [refreshStats]);

  return {
    isActive,
    stats,
    isProcessing,
    error,
    start,
    stop,
    forceProcess,
    refresh: refreshStats,
  };
}

// Hook for monitoring background location queue status
export function useBackgroundLocationQueue() {
  const [queueStatus, setQueueStatus] = useState({
    queueSize: 0,
    pendingCount: 0,
    processedCount: 0,
    failedCount: 0,
    syncStatus: {
      lastSyncAt: 0,
      pendingCount: 0,
      failedCount: 0,
      totalProcessed: 0,
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshQueueStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const status = await backgroundLocationService.getStats();
      setQueueStatus(prev => ({
        ...prev,
        queueSize: status.queueSize,
        pendingCount: status.queueSize, // Simplified for this hook
        processedCount: status.totalProcessed,
        failedCount: status.totalFailed,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error refreshing queue status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshQueueStatus();
    
    // Refresh every 15 seconds
    const interval = setInterval(refreshQueueStatus, 15000);
    
    return () => {
      clearInterval(interval);
    };
  }, [refreshQueueStatus]);

  return {
    queueStatus,
    isLoading,
    error,
    refresh: refreshQueueStatus,
  };
}