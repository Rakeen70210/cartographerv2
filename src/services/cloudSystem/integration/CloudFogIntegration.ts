/**
 * CloudFogIntegration - Main integration bridge between cloud system and exploration service
 * Connects the cloud rendering system with existing exploration mechanics
 */

import { ExplorationService, ExplorationResult } from '../../explorationService';
import { getFogService } from '../../fogService';
import { fogLocationIntegrationService } from '../../fogLocationIntegrationService';
import { ICloudRenderingEngine } from '../interfaces';
import { CloudState, CloudGeographicArea, MapBounds } from '../../../types/cloud';
import { getMockCloudRenderingEngine } from '../MockCloudRenderingEngine';
import { ExploredArea } from '../../../database/services';
import { LocationUpdate } from '../../../types';
import { store } from '../../../store';
import { 
  setCloudSystemEnabled,
  setCloudSystemError,
  updateCloudState 
} from '../../../store/slices/fogSlice';

export interface CloudFogIntegrationConfig {
  enableCloudSystem: boolean;
  fallbackToTraditionalFog: boolean;
  syncInterval: number; // ms
  maxRetryAttempts: number;
  debugMode: boolean;
}

export interface CloudSystemStatus {
  isInitialized: boolean;
  isActive: boolean;
  hasError: boolean;
  errorMessage?: string;
  lastSyncTime: number;
  exploredAreasCount: number;
  cloudPatchesCount: number;
}

/**
 * Main integration bridge that connects cloud system with exploration mechanics
 */
export class CloudFogIntegration {
  private static instance: CloudFogIntegration;
  private explorationService: ExplorationService;
  private fogService: ReturnType<typeof getFogService>;
  private cloudRenderingEngine: ICloudRenderingEngine | null = null;
  private config: CloudFogIntegrationConfig;
  private status: CloudSystemStatus;
  private syncTimer: NodeJS.Timeout | null = null;
  private retryCount = 0;

  private constructor() {
    this.explorationService = ExplorationService.getInstance();
    this.fogService = getFogService();
    
    this.config = {
      enableCloudSystem: true,
      fallbackToTraditionalFog: true,
      syncInterval: 5000, // 5 seconds
      maxRetryAttempts: 3,
      debugMode: false
    };

    this.status = {
      isInitialized: false,
      isActive: false,
      hasError: false,
      lastSyncTime: 0,
      exploredAreasCount: 0,
      cloudPatchesCount: 0
    };

    this.initializeIntegration();
  }

  public static getInstance(): CloudFogIntegration {
    if (!CloudFogIntegration.instance) {
      CloudFogIntegration.instance = new CloudFogIntegration();
    }
    return CloudFogIntegration.instance;
  }

  /**
   * Initialize the integration between cloud system and exploration service
   */
  private async initializeIntegration(): Promise<void> {
    try {
      this.log('Initializing CloudFogIntegration...');

      // Set up exploration event listeners
      this.explorationService.addExplorationListener(this.handleExplorationResult.bind(this));

      // Initialize backward compatibility with existing fog system
      await this.initializeBackwardCompatibility();

      // Set up mock cloud rendering engine for development immediately
      this.log('Setting up mock cloud rendering engine for development...');
      this.cloudRenderingEngine = getMockCloudRenderingEngine();

      this.status.isInitialized = true;
      this.log('CloudFogIntegration initialized successfully');

    } catch (error) {
      console.error('Failed to initialize CloudFogIntegration:', error);
      this.handleError(error as Error, 'initialization');
    }
  }

  /**
   * Initialize backward compatibility with existing fog overlay system
   */
  private async initializeBackwardCompatibility(): Promise<void> {
    try {
      // Ensure fog location integration service is running
      const integrationStatus = await fogLocationIntegrationService.getStatus();
      
      if (!integrationStatus.isActive) {
        this.log('Starting fog location integration service for backward compatibility');
        await fogLocationIntegrationService.start();
      }

      // Sync initial state
      await this.syncExplorationState();

      this.log('Backward compatibility initialized');
    } catch (error) {
      console.error('Failed to initialize backward compatibility:', error);
      throw error;
    }
  }

  /**
   * Set the cloud rendering engine instance
   */
  public setCloudRenderingEngine(engine: ICloudRenderingEngine): void {
    this.cloudRenderingEngine = engine;
    this.log('Cloud rendering engine set');
    
    if (this.config.enableCloudSystem) {
      this.startCloudSystem();
    }
  }

  /**
   * Start the cloud system
   */
  public async startCloudSystem(): Promise<boolean> {
    try {
      // Ensure we have a cloud rendering engine (set up mock if needed)
      if (!this.cloudRenderingEngine) {
        this.log('No cloud rendering engine set, using mock engine for development...');
        this.cloudRenderingEngine = getMockCloudRenderingEngine();
      }

      this.log('Starting cloud system...');

      // Initialize cloud rendering engine
      await this.cloudRenderingEngine.initialize();

      // Start synchronization
      this.startSynchronization();

      // Update status
      this.status.isActive = true;
      this.status.hasError = false;
      this.status.errorMessage = undefined;

      // Update Redux state
      store.dispatch(setCloudSystemEnabled(true));

      this.log('Cloud system started successfully');
      return true;

    } catch (error) {
      console.error('Failed to start cloud system:', error);
      this.handleError(error as Error, 'startup');
      
      // Fallback to traditional fog if enabled
      if (this.config.fallbackToTraditionalFog) {
        this.log('Falling back to traditional fog system');
        return this.fallbackToTraditionalFog();
      }
      
      return false;
    }
  }

  /**
   * Stop the cloud system
   */
  public async stopCloudSystem(): Promise<void> {
    try {
      this.log('Stopping cloud system...');

      // Stop synchronization
      this.stopSynchronization();

      // Dispose cloud rendering engine
      if (this.cloudRenderingEngine) {
        this.cloudRenderingEngine.dispose();
      }

      // Update status
      this.status.isActive = false;

      // Update Redux state
      store.dispatch(setCloudSystemEnabled(false));

      this.log('Cloud system stopped');

    } catch (error) {
      console.error('Error stopping cloud system:', error);
      this.handleError(error as Error, 'shutdown');
    }
  }

  /**
   * Handle exploration results from exploration service
   */
  private async handleExplorationResult(result: ExplorationResult): Promise<void> {
    try {
      if (!result.isNewArea || !result.exploredArea) {
        return;
      }

      this.log(`New area explored: ${result.exploredArea.id}`);

      // Update cloud system if active
      if (this.status.isActive && this.cloudRenderingEngine) {
        const area: CloudGeographicArea = {
          center: [result.exploredArea.longitude, result.exploredArea.latitude],
          radius: result.exploredArea.radius,
          bounds: {
            north: result.exploredArea.latitude + (result.exploredArea.radius / 111320),
            south: result.exploredArea.latitude - (result.exploredArea.radius / 111320),
            east: result.exploredArea.longitude + (result.exploredArea.radius / 111320),
            west: result.exploredArea.longitude - (result.exploredArea.radius / 111320)
          }
        };

        // Trigger cloud dissipation animation
        await this.cloudRenderingEngine.animateCloudDissipation(area);
      }

      // Always update traditional fog system for backward compatibility
      await this.updateTraditionalFogSystem();

      // Update status
      this.status.exploredAreasCount++;
      this.status.lastSyncTime = Date.now();

    } catch (error) {
      console.error('Error handling exploration result:', error);
      this.handleError(error as Error, 'exploration_handling');
    }
  }

  /**
   * Synchronize exploration state between systems
   */
  public async syncExplorationState(): Promise<void> {
    try {
      this.log('Synchronizing exploration state...');

      // Get all explored areas from exploration service
      const exploredAreas = await this.explorationService.getAllExploredAreas();

      // Update cloud system if active
      if (this.status.isActive && this.cloudRenderingEngine) {
        // Convert to exploration areas format expected by cloud system
        const explorationAreas = exploredAreas.map(area => ({
          id: area.id?.toString() || `area_${Date.now()}`,
          center: [area.longitude, area.latitude] as [number, number],
          radius: area.radius,
          exploredAt: new Date(area.explored_at).getTime(),
          accuracy: area.accuracy
        }));

        this.cloudRenderingEngine.updateClouds(explorationAreas);
      }

      // Update traditional fog system
      await this.updateTraditionalFogSystem();

      // Update status
      this.status.exploredAreasCount = exploredAreas.length;
      this.status.lastSyncTime = Date.now();

      this.log(`Synchronized ${exploredAreas.length} explored areas`);

    } catch (error) {
      console.error('Error synchronizing exploration state:', error);
      this.handleError(error as Error, 'synchronization');
    }
  }

  /**
   * Update traditional fog system for backward compatibility
   */
  private async updateTraditionalFogSystem(): Promise<void> {
    try {
      // Refresh fog geometry through fog location integration service
      await fogLocationIntegrationService.refreshFogGeometry();
    } catch (error) {
      console.error('Error updating traditional fog system:', error);
      // Don't throw - this is for backward compatibility
    }
  }

  /**
   * Start periodic synchronization
   */
  private startSynchronization(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.syncExplorationState().catch(error => {
        console.error('Error in periodic sync:', error);
      });
    }, this.config.syncInterval);

    this.log('Synchronization started');
  }

  /**
   * Stop periodic synchronization
   */
  private stopSynchronization(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    this.log('Synchronization stopped');
  }

  /**
   * Fallback to traditional fog system
   */
  private async fallbackToTraditionalFog(): Promise<boolean> {
    try {
      this.log('Activating traditional fog fallback...');

      // Ensure fog location integration is running
      const integrationStatus = await fogLocationIntegrationService.getStatus();
      
      if (!integrationStatus.isActive) {
        await fogLocationIntegrationService.start();
      }

      // Update fog geometry
      await fogLocationIntegrationService.refreshFogGeometry();

      this.log('Traditional fog fallback activated');
      return true;

    } catch (error) {
      console.error('Failed to activate traditional fog fallback:', error);
      return false;
    }
  }

  /**
   * Handle errors with retry logic
   */
  private handleError(error: Error, context: string): void {
    this.status.hasError = true;
    this.status.errorMessage = `${context}: ${error.message}`;

    // Update Redux state
    store.dispatch(setCloudSystemError(this.status.errorMessage));

    this.log(`Error in ${context}: ${error.message}`);

    // Implement retry logic for certain contexts
    if (this.shouldRetry(context) && this.retryCount < this.config.maxRetryAttempts) {
      this.retryCount++;
      this.log(`Retrying ${context} (attempt ${this.retryCount}/${this.config.maxRetryAttempts})`);
      
      setTimeout(() => {
        this.retryOperation(context);
      }, 1000 * this.retryCount); // Exponential backoff
    } else {
      // Max retries reached or non-retryable error
      if (this.config.fallbackToTraditionalFog) {
        this.fallbackToTraditionalFog();
      }
    }
  }

  /**
   * Check if operation should be retried
   */
  private shouldRetry(context: string): boolean {
    const retryableContexts = ['startup', 'synchronization', 'exploration_handling'];
    return retryableContexts.includes(context);
  }

  /**
   * Retry failed operation
   */
  private async retryOperation(context: string): Promise<void> {
    try {
      switch (context) {
        case 'startup':
          await this.startCloudSystem();
          break;
        case 'synchronization':
          await this.syncExplorationState();
          break;
        case 'exploration_handling':
          // This would be handled by the next exploration event
          break;
      }
      
      // Reset retry count on success
      this.retryCount = 0;
      this.status.hasError = false;
      this.status.errorMessage = undefined;
      
    } catch (error) {
      this.handleError(error as Error, context);
    }
  }

  /**
   * Update map bounds for cloud system
   */
  public updateMapBounds(bounds: MapBounds): void {
    if (this.status.isActive && this.cloudRenderingEngine) {
      this.cloudRenderingEngine.updateMapBounds(bounds);
    }
  }

  /**
   * Update zoom level for cloud system
   */
  public setZoomLevel(zoom: number): void {
    if (this.status.isActive && this.cloudRenderingEngine) {
      this.cloudRenderingEngine.setZoomLevel(zoom);
    }
  }

  /**
   * Configure the integration
   */
  public configure(config: Partial<CloudFogIntegrationConfig>): void {
    this.config = { ...this.config, ...config };
    this.log('Configuration updated:', this.config);
  }

  /**
   * Get current status
   */
  public getStatus(): CloudSystemStatus {
    return { ...this.status };
  }

  /**
   * Check if the integration is ready to start the cloud system
   */
  public isReady(): boolean {
    return this.status.isInitialized && !!this.cloudRenderingEngine;
  }

  /**
   * Get current cloud state
   */
  public getCloudState(): CloudState | null {
    if (this.status.isActive && this.cloudRenderingEngine) {
      return this.cloudRenderingEngine.getState();
    }
    return null;
  }

  /**
   * Manual trigger for cloud dissipation (for testing)
   */
  public async triggerCloudDissipation(
    latitude: number,
    longitude: number,
    radius: number = 100
  ): Promise<void> {
    if (!this.status.isActive || !this.cloudRenderingEngine) {
      throw new Error('Cloud system not active');
    }

    const area: CloudGeographicArea = {
      center: [longitude, latitude],
      radius,
      bounds: {
        north: latitude + (radius / 111320),
        south: latitude - (radius / 111320),
        east: longitude + (radius / 111320),
        west: longitude - (radius / 111320)
      }
    };

    await this.cloudRenderingEngine.animateCloudDissipation(area);
  }

  /**
   * Debug logging
   */
  private log(message: string, data?: any): void {
    if (this.config.debugMode) {
      console.log(`[CloudFogIntegration] ${message}`, data || '');
    }
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.stopSynchronization();
    
    if (this.cloudRenderingEngine) {
      this.cloudRenderingEngine.dispose();
    }

    this.log('CloudFogIntegration disposed');
  }
}

// Export singleton instance
export const cloudFogIntegration = CloudFogIntegration.getInstance();