import { AppState, AppStateStatus } from 'react-native';
import { locationService } from './locationService';
import { getDatabaseService } from '../database/services';
import { LocationUpdate } from '../types';

export interface BackgroundLocationConfig {
  autoProcessOnForeground: boolean;
  maxQueueSize: number;
  processingInterval: number; // milliseconds
  minAccuracy: number; // meters
  minDistance: number; // meters between locations
}

export interface BackgroundLocationStats {
  totalProcessed: number;
  totalFailed: number;
  lastProcessedAt: number;
  queueSize: number;
  isProcessing: boolean;
}

export class BackgroundLocationService {
  private static instance: BackgroundLocationService;
  private config: BackgroundLocationConfig;
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private appStateSubscription: any = null;
  private stats: BackgroundLocationStats;

  private constructor() {
    this.config = {
      autoProcessOnForeground: true,
      maxQueueSize: 500,
      processingInterval: 60000, // 1 minute
      minAccuracy: 200, // 200 meters
      minDistance: 50, // 50 meters
    };

    this.stats = {
      totalProcessed: 0,
      totalFailed: 0,
      lastProcessedAt: 0,
      queueSize: 0,
      isProcessing: false,
    };

    this.setupAppStateListener();
  }

  public static getInstance(): BackgroundLocationService {
    if (!BackgroundLocationService.instance) {
      BackgroundLocationService.instance = new BackgroundLocationService();
    }
    return BackgroundLocationService.instance;
  }

  /**
   * Configure the background location service
   */
  public configure(config: Partial<BackgroundLocationConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart processing interval if it changed
    if (config.processingInterval && this.processingInterval) {
      this.stopPeriodicProcessing();
      this.startPeriodicProcessing();
    }
  }

  /**
   * Start background location processing
   */
  public async start(): Promise<boolean> {
    try {
      console.log('Starting background location service...');
      
      // Start background location tracking
      const trackingStarted = await locationService.startBackgroundTracking();
      if (!trackingStarted) {
        console.error('Failed to start background location tracking');
        return false;
      }

      // Start periodic processing
      this.startPeriodicProcessing();

      // Process any existing queued locations
      await this.processQueuedLocations();

      console.log('Background location service started successfully');
      return true;
    } catch (error) {
      console.error('Error starting background location service:', error);
      return false;
    }
  }

  /**
   * Stop background location processing
   */
  public async stop(): Promise<void> {
    try {
      console.log('Stopping background location service...');
      
      // Stop periodic processing
      this.stopPeriodicProcessing();

      // Stop background location tracking
      await locationService.stopBackgroundTracking();

      console.log('Background location service stopped');
    } catch (error) {
      console.error('Error stopping background location service:', error);
    }
  }

  /**
   * Process queued background locations
   */
  public async processQueuedLocations(): Promise<{
    processed: number;
    failed: number;
    skipped: number;
  }> {
    if (this.isProcessing) {
      console.log('Background location processing already in progress');
      return { processed: 0, failed: 0, skipped: 0 };
    }

    this.isProcessing = true;
    this.stats.isProcessing = true;

    try {
      console.log('Processing queued background locations...');
      
      // Get background locations from task manager
      const result = await locationService.processBackgroundLocations();
      const { processed: locations, status } = result;

      if (locations.length === 0) {
        console.log('No background locations to process');
        return { processed: 0, failed: 0, skipped: 0 };
      }

      const databaseService = getDatabaseService();
      let processedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      // Process locations in batches
      const batchSize = 20;
      for (let i = 0; i < locations.length; i += batchSize) {
        const batch = locations.slice(i, i + batchSize);
        
        for (const location of batch) {
          try {
            // Validate location quality
            if (!this.isLocationValid(location)) {
              skippedCount++;
              continue;
            }

            // Check if we should process this location
            const shouldProcess = await this.shouldProcessLocation(location, databaseService);
            if (!shouldProcess) {
              skippedCount++;
              continue;
            }

            // Create explored area
            await databaseService.createExploredArea({
              latitude: location.latitude,
              longitude: location.longitude,
              radius: Math.max(location.accuracy, this.config.minDistance),
              explored_at: new Date(location.timestamp).toISOString(),
              accuracy: location.accuracy,
            });

            processedCount++;
            
          } catch (error) {
            console.error('Error processing background location:', error);
            failedCount++;
          }
        }

        // Small delay between batches to avoid overwhelming the database
        if (i + batchSize < locations.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Update statistics
      this.stats.totalProcessed += processedCount;
      this.stats.totalFailed += failedCount;
      this.stats.lastProcessedAt = Date.now();

      console.log(`Background location processing complete: ${processedCount} processed, ${failedCount} failed, ${skippedCount} skipped`);
      
      return { processed: processedCount, failed: failedCount, skipped: skippedCount };
      
    } catch (error) {
      console.error('Error processing queued locations:', error);
      this.stats.totalFailed++;
      return { processed: 0, failed: 1, skipped: 0 };
    } finally {
      this.isProcessing = false;
      this.stats.isProcessing = false;
    }
  }

  /**
   * Get current statistics
   */
  public async getStats(): Promise<BackgroundLocationStats> {
    try {
      const queueStatus = await locationService.getBackgroundQueueStatus();
      return {
        ...this.stats,
        queueSize: queueStatus.queueSize,
      };
    } catch (error) {
      console.error('Error getting background location stats:', error);
      return this.stats;
    }
  }

  /**
   * Force immediate processing of background queue
   */
  public async forceProcess(): Promise<boolean> {
    try {
      const result = await this.processQueuedLocations();
      return result.processed > 0 || result.failed === 0;
    } catch (error) {
      console.error('Error forcing background location processing:', error);
      return false;
    }
  }

  // Private methods

  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  private async handleAppStateChange(nextAppState: AppStateStatus): Promise<void> {
    if (nextAppState === 'active' && this.config.autoProcessOnForeground) {
      console.log('App became active, processing background locations...');
      
      // Small delay to ensure the app is fully active
      setTimeout(() => {
        this.processQueuedLocations().catch(error => {
          console.error('Error processing locations on app foreground:', error);
        });
      }, 1000);
    }
  }

  private startPeriodicProcessing(): void {
    if (this.processingInterval) {
      return;
    }

    this.processingInterval = setInterval(() => {
      this.processQueuedLocations().catch(error => {
        console.error('Error in periodic background location processing:', error);
      });
    }, this.config.processingInterval);

    console.log(`Started periodic background location processing (${this.config.processingInterval}ms interval)`);
  }

  private stopPeriodicProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('Stopped periodic background location processing');
    }
  }

  private isLocationValid(location: LocationUpdate): boolean {
    return (
      location.accuracy > 0 &&
      location.accuracy <= this.config.minAccuracy &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      location.longitude >= -180 &&
      location.longitude <= 180 &&
      !isNaN(location.latitude) &&
      !isNaN(location.longitude)
    );
  }

  private async shouldProcessLocation(
    location: LocationUpdate,
    databaseService: any
  ): Promise<boolean> {
    try {
      // Check for nearby recent locations
      const nearbyAreas = await databaseService.findNearbyExploredAreas({
        latitude: location.latitude,
        longitude: location.longitude,
        radius: this.config.minDistance / 1000, // Convert to km
      });

      // If we have a location within the minimum distance, skip
      if (nearbyAreas.length > 0) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking if location should be processed:', error);
      // Default to processing if we can't determine
      return true;
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopPeriodicProcessing();
    
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

// Export singleton instance
export const backgroundLocationService = BackgroundLocationService.getInstance();