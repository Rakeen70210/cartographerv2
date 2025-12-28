/**
 * ExplorationStateSynchronizer - Handles synchronization between exploration data and cloud system
 * Ensures data consistency between different exploration tracking systems
 */

import { ExplorationService } from '../../explorationService';
import { getFogService } from '../../fogService';
import { ExploredArea } from '../../../database/services';
import { ExplorationArea } from '../../../types/exploration';
import { store } from '../../../store';
import {
  setExploredAreas,
  addExploredArea,
  updateExplorationStats
} from '../../../store/slices/explorationSlice';

export interface SynchronizationConfig {
  autoSync: boolean;
  syncInterval: number; // ms
  batchSize: number;
  enableConflictResolution: boolean;
  debugMode: boolean;
}

export interface SynchronizationResult {
  success: boolean;
  syncedCount: number;
  conflictsResolved: number;
  errors: string[];
  timestamp: number;
}

export interface ExplorationDataConflict {
  id: string;
  databaseArea: ExploredArea;
  reduxArea: ExplorationArea;
  conflictType: 'position' | 'radius' | 'timestamp' | 'missing';
  resolution: 'database' | 'redux' | 'merge';
}

/**
 * Synchronizes exploration state between database, Redux store, and cloud system
 */
export class ExplorationStateSynchronizer {
  private static instance: ExplorationStateSynchronizer;
  private explorationService: ExplorationService;
  private fogService: ReturnType<typeof getFogService>;
  private config: SynchronizationConfig;
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private lastSyncTime = 0;

  private constructor() {
    this.explorationService = ExplorationService.getInstance();
    this.fogService = getFogService();

    this.config = {
      autoSync: true,
      syncInterval: 60000, // 60 seconds (reduced frequency for better performance)
      batchSize: 50,
      enableConflictResolution: true,
      debugMode: false
    };
  }

  public static getInstance(): ExplorationStateSynchronizer {
    if (!ExplorationStateSynchronizer.instance) {
      ExplorationStateSynchronizer.instance = new ExplorationStateSynchronizer();
    }
    return ExplorationStateSynchronizer.instance;
  }

  /**
   * Start automatic synchronization
   */
  public startAutoSync(): void {
    if (this.syncTimer) {
      this.stopAutoSync();
    }

    if (this.config.autoSync) {
      this.syncTimer = setInterval(() => {
        this.performFullSync().catch(error => {
          console.error('Auto-sync error:', error);
        });
      }, this.config.syncInterval);

      this.log('Auto-sync started');
    }
  }

  /**
   * Stop automatic synchronization
   */
  public stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      this.log('Auto-sync stopped');
    }
  }

  /**
   * Perform full synchronization between all systems
   */
  public async performFullSync(): Promise<SynchronizationResult> {
    if (this.isSyncing) {
      this.log('Sync already in progress, skipping');
      return {
        success: false,
        syncedCount: 0,
        conflictsResolved: 0,
        errors: ['Sync already in progress'],
        timestamp: Date.now()
      };
    }

    this.isSyncing = true;
    const startTime = Date.now();
    const errors: string[] = [];
    let syncedCount = 0;
    let conflictsResolved = 0;

    try {
      this.log('Starting full synchronization...');

      // Step 1: Get data from all sources
      const [databaseAreas, reduxState] = await Promise.all([
        this.getDatabaseAreas(),
        this.getReduxAreas()
      ]);

      // Verbose log removed for performance

      // Step 2: Detect conflicts
      const conflicts = this.detectConflicts(databaseAreas, reduxState);
      // Verbose log removed for performance

      // Step 3: Resolve conflicts if enabled
      if (this.config.enableConflictResolution && conflicts.length > 0) {
        const resolved = await this.resolveConflicts(conflicts);
        conflictsResolved = resolved.length;
        // Verbose log removed for performance
      }

      // Step 4: Sync database to Redux
      const dbToReduxResult = await this.syncDatabaseToRedux(databaseAreas);
      syncedCount += dbToReduxResult.syncedCount;
      errors.push(...dbToReduxResult.errors);

      // Step 5: Update exploration statistics
      await this.updateExplorationStatistics(databaseAreas);

      this.lastSyncTime = Date.now();
      const duration = this.lastSyncTime - startTime;

      // Verbose log removed for performance

      return {
        success: errors.length === 0,
        syncedCount,
        conflictsResolved,
        errors,
        timestamp: this.lastSyncTime
      };

    } catch (error) {
      const errorMessage = `Full sync failed: ${error}`;
      console.error(errorMessage);
      errors.push(errorMessage);

      return {
        success: false,
        syncedCount,
        conflictsResolved,
        errors,
        timestamp: Date.now()
      };

    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync database areas to Redux store
   */
  private async syncDatabaseToRedux(databaseAreas: ExploredArea[]): Promise<{
    syncedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let syncedCount = 0;

    try {
      // Convert database areas to Redux format
      const explorationAreas: ExplorationArea[] = databaseAreas.map(area => ({
        id: area.id?.toString() || `area_${Date.now()}_${Math.random()}`,
        center: [area.longitude, area.latitude] as [number, number],
        radius: area.radius,
        exploredAt: new Date(area.explored_at).getTime(),
        accuracy: area.accuracy
      }));

      // Update Redux store in batches
      const batches = this.createBatches(explorationAreas, this.config.batchSize);

      for (const batch of batches) {
        try {
          // For the first batch, replace all areas; for subsequent batches, add them
          if (syncedCount === 0) {
            store.dispatch(setExploredAreas(batch));
          } else {
            batch.forEach(area => {
              store.dispatch(addExploredArea(area));
            });
          }

          syncedCount += batch.length;
          // Verbose log removed for performance

        } catch (error) {
          const errorMessage = `Failed to sync batch: ${error}`;
          console.error(errorMessage);
          errors.push(errorMessage);
        }
      }

    } catch (error) {
      const errorMessage = `Database to Redux sync failed: ${error}`;
      console.error(errorMessage);
      errors.push(errorMessage);
    }

    return { syncedCount, errors };
  }

  /**
   * Get explored areas from database
   */
  private async getDatabaseAreas(): Promise<ExploredArea[]> {
    try {
      // Dynamic import to check database readiness
      const { getDatabaseService } = await import('../../../database/services');
      const dbService = getDatabaseService();

      if (!dbService.isReady()) {
        this.log('Database not ready, returning empty areas');
        return [];
      }

      return await this.explorationService.getAllExploredAreas();
    } catch (error) {
      console.error('Failed to get database areas:', error);
      return [];
    }
  }

  /**
   * Get explored areas from Redux store
   */
  private getReduxAreas(): ExplorationArea[] {
    try {
      const state = store.getState();
      return state.exploration.exploredAreas || [];
    } catch (error) {
      console.error('Failed to get Redux areas:', error);
      return [];
    }
  }

  /**
   * Detect conflicts between database and Redux data
   */
  private detectConflicts(
    databaseAreas: ExploredArea[],
    reduxAreas: ExplorationArea[]
  ): ExplorationDataConflict[] {
    const conflicts: ExplorationDataConflict[] = [];

    // Create maps for efficient lookup
    const dbMap = new Map(databaseAreas.map(area => [area.id?.toString(), area]));
    const reduxMap = new Map(reduxAreas.map(area => [area.id, area]));

    // Check for conflicts in areas that exist in both systems
    for (const [id, dbArea] of dbMap) {
      if (!id) continue;

      const reduxArea = reduxMap.get(id);
      if (!reduxArea) {
        // Area exists in database but not in Redux
        continue; // This is normal - database is source of truth
      }

      // Check for position conflicts
      const dbLat = dbArea.latitude;
      const dbLng = dbArea.longitude;
      const reduxLat = reduxArea.center[1];
      const reduxLng = reduxArea.center[0];

      const positionDiff = Math.sqrt(
        Math.pow(dbLat - reduxLat, 2) + Math.pow(dbLng - reduxLng, 2)
      );

      if (positionDiff > 0.001) { // ~100m difference
        conflicts.push({
          id,
          databaseArea: dbArea,
          reduxArea,
          conflictType: 'position',
          resolution: 'database' // Database is source of truth
        });
      }

      // Check for radius conflicts
      if (Math.abs(dbArea.radius - reduxArea.radius) > 10) { // 10m difference
        conflicts.push({
          id,
          databaseArea: dbArea,
          reduxArea,
          conflictType: 'radius',
          resolution: 'database'
        });
      }

      // Check for timestamp conflicts
      const dbTime = new Date(dbArea.explored_at).getTime();
      const reduxTime = reduxArea.exploredAt;

      if (Math.abs(dbTime - reduxTime) > 60000) { // 1 minute difference
        conflicts.push({
          id,
          databaseArea: dbArea,
          reduxArea,
          conflictType: 'timestamp',
          resolution: 'database'
        });
      }
    }

    return conflicts;
  }

  /**
   * Resolve detected conflicts
   */
  private async resolveConflicts(conflicts: ExplorationDataConflict[]): Promise<ExplorationDataConflict[]> {
    const resolved: ExplorationDataConflict[] = [];

    for (const conflict of conflicts) {
      try {
        switch (conflict.resolution) {
          case 'database':
            // Update Redux with database data
            const correctedArea: ExplorationArea = {
              id: conflict.id,
              center: [conflict.databaseArea.longitude, conflict.databaseArea.latitude],
              radius: conflict.databaseArea.radius,
              exploredAt: new Date(conflict.databaseArea.explored_at).getTime(),
              accuracy: conflict.databaseArea.accuracy
            };

            store.dispatch(addExploredArea(correctedArea));
            resolved.push(conflict);
            break;

          case 'redux':
            // This would update database with Redux data (not implemented for safety)
            this.log(`Redux resolution not implemented for conflict ${conflict.id}`);
            break;

          case 'merge':
            // Merge data from both sources (not implemented - complex logic needed)
            this.log(`Merge resolution not implemented for conflict ${conflict.id}`);
            break;
        }

      } catch (error) {
        console.error(`Failed to resolve conflict ${conflict.id}:`, error);
      }
    }

    return resolved;
  }

  /**
   * Update exploration statistics in Redux
   */
  private async updateExplorationStatistics(areas: ExploredArea[]): Promise<void> {
    try {
      const stats = await this.explorationService.getExplorationStats();

      store.dispatch(updateExplorationStats({
        totalAreas: stats.totalAreas,
        totalDistance: stats.totalDistance,
        explorationPercentage: stats.explorationPercentage,
        lastExploredAt: areas.length > 0 ?
          Math.max(...areas.map(a => new Date(a.explored_at).getTime())) :
          0
      }));

    } catch (error) {
      console.error('Failed to update exploration statistics:', error);
    }
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Sync single exploration area
   */
  public async syncSingleArea(area: ExploredArea): Promise<boolean> {
    try {
      const explorationArea: ExplorationArea = {
        id: area.id?.toString() || `area_${Date.now()}`,
        center: [area.longitude, area.latitude],
        radius: area.radius,
        exploredAt: new Date(area.explored_at).getTime(),
        accuracy: area.accuracy
      };

      store.dispatch(addExploredArea(explorationArea));
      this.log(`Synced single area: ${explorationArea.id}`);
      return true;

    } catch (error) {
      console.error('Failed to sync single area:', error);
      return false;
    }
  }

  /**
   * Get synchronization status
   */
  public getStatus(): {
    isAutoSyncEnabled: boolean;
    isSyncing: boolean;
    lastSyncTime: number;
    config: SynchronizationConfig;
  } {
    return {
      isAutoSyncEnabled: this.config.autoSync && !!this.syncTimer,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      config: { ...this.config }
    };
  }

  /**
   * Configure synchronizer
   */
  public configure(config: Partial<SynchronizationConfig>): void {
    const oldAutoSync = this.config.autoSync;
    this.config = { ...this.config, ...config };

    // Restart auto-sync if configuration changed
    if (oldAutoSync !== this.config.autoSync || this.config.autoSync) {
      this.stopAutoSync();
      this.startAutoSync();
    }

    this.log('Configuration updated:', this.config);
  }

  /**
   * Force immediate sync
   */
  public async forcSync(): Promise<SynchronizationResult> {
    this.log('Force sync requested');
    return await this.performFullSync();
  }

  /**
   * Debug logging - DISABLED for performance
   */
  private log(message: string, data?: any): void {
    // Logging disabled for performance - uncomment below for debugging
    // if (this.config.debugMode) {
    //   console.log(`[ExplorationStateSynchronizer] ${message}`, data || '');
    // }
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.stopAutoSync();
    this.log('ExplorationStateSynchronizer disposed');
  }
}

// Export singleton instance
export const explorationStateSynchronizer = ExplorationStateSynchronizer.getInstance();