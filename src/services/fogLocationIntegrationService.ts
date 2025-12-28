import { store } from '../store';
import { locationService } from './locationService';
import { explorationService, ExplorationResult } from './explorationService';
import { getFogService } from './fogService';
import { spatialCacheService } from './spatialCacheService';
// Note: fogAnimationService removed - animations now handled by SkiaFogOverlay
import {
  updateLocation,
  setLocationError
} from '../store/slices/locationSlice';
import {
  addExploredArea,
  setExploredAreas,
  setProcessingLocation,
  setExplorationError
} from '../store/slices/explorationSlice';
import {
  updateFogForExploration,
  startFogClearingAnimation,
  completeFogClearingAnimation
} from '../store/slices/fogSlice';
import { LocationUpdate } from '../types';

export interface FogLocationConfig {
  enableRealTimeClearing: boolean;
  animationEnabled: boolean;
  debounceInterval: number; // ms
  maxConcurrentAnimations: number;
}

export class FogLocationIntegrationService {
  private static instance: FogLocationIntegrationService;
  private fogService = getFogService();
  // Animation service removed - animations now handled by SkiaFogOverlay
  private config: FogLocationConfig;
  private lastProcessedLocation: LocationUpdate | null = null;
  private processingTimeout: NodeJS.Timeout | null = null;
  private activeAnimationCount = 0;

  private constructor() {
    this.config = {
      enableRealTimeClearing: true,
      animationEnabled: true,
      debounceInterval: 1000, // 1 second debounce
      maxConcurrentAnimations: 3,
    };

    this.initializeIntegration();
  }

  public static getInstance(): FogLocationIntegrationService {
    if (!FogLocationIntegrationService.instance) {
      FogLocationIntegrationService.instance = new FogLocationIntegrationService();
    }
    return FogLocationIntegrationService.instance;
  }

  /**
   * Initialize the integration between location updates and fog clearing
   */
  private initializeIntegration(): void {
    // Listen to location updates from location service
    locationService.addLocationListener(this.handleLocationUpdate.bind(this));

    // Listen to exploration events from exploration service
    explorationService.addExplorationListener(this.handleExplorationResult.bind(this));

    // Animation callbacks removed - animations now handled by SkiaFogOverlay

    console.log('Fog-Location integration initialized');
  }

  /**
   * Handle incoming location updates
   */
  private async handleLocationUpdate(location: LocationUpdate): Promise<void> {
    try {
      // Check if location has changed significantly to prevent excessive updates
      if (this.lastProcessedLocation && this.isLocationSimilar(location, this.lastProcessedLocation)) {
        return; // Skip processing if location hasn't changed significantly
      }

      // Update Redux location state only if location changed significantly
      store.dispatch(updateLocation({
        coordinates: [location.longitude, location.latitude],
        accuracy: location.accuracy,
      }));

      // Debounce location processing to avoid excessive fog updates
      if (this.processingTimeout) {
        clearTimeout(this.processingTimeout);
      }

      this.processingTimeout = setTimeout(() => {
        this.processLocationForFog(location);
      }, this.config.debounceInterval);

    } catch (error) {
      console.error('Error handling location update:', error);
      store.dispatch(setLocationError(`Location processing error: ${error}`));
    }
  }

  /**
   * Process location for fog clearing (debounced)
   */
  private async processLocationForFog(location: LocationUpdate): Promise<void> {
    if (!this.config.enableRealTimeClearing) {
      return;
    }

    try {
      store.dispatch(setProcessingLocation(true));

      // Check if location has changed significantly
      if (this.lastProcessedLocation && this.isLocationSimilar(location, this.lastProcessedLocation)) {
        store.dispatch(setProcessingLocation(false));
        return;
      }

      this.lastProcessedLocation = location;

      // Update fog geometry based on current explored areas
      await this.updateFogGeometry();

    } catch (error) {
      console.error('Error processing location for fog:', error);
      store.dispatch(setExplorationError(`Fog processing error: ${error}`));
    } finally {
      store.dispatch(setProcessingLocation(false));
    }
  }

  /**
   * Handle exploration results (new areas discovered)
   */
  private async handleExplorationResult(result: ExplorationResult): Promise<void> {
    try {
      if (!result.isNewArea || !result.exploredArea) {
        return;
      }

      console.log('New area explored, updating fog:', result.exploredArea);

      // Add to spatial cache for consistent querying
      spatialCacheService.add(result.exploredArea);

      // Add explored area to Redux state
      store.dispatch(addExploredArea({
        id: result.exploredArea.id?.toString() ?? `area_${Date.now()}`,
        center: [result.exploredArea.longitude, result.exploredArea.latitude],
        radius: result.exploredArea.radius,
        exploredAt: new Date(result.exploredArea.explored_at).getTime(),
        accuracy: result.exploredArea.accuracy,
      }));

      // Trigger fog clearing animation if enabled (now handled by Redux state)
      if (this.config.animationEnabled && this.activeAnimationCount < this.config.maxConcurrentAnimations) {
        await this.triggerFogClearingAnimation(result);
      }

      // Update fog geometry
      await this.updateFogGeometry();

    } catch (error) {
      console.error('Error handling exploration result:', error);
      store.dispatch(setExplorationError(`Exploration processing error: ${error}`));
    }
  }

  /**
   * Trigger fog clearing animation for newly explored area
   * Note: Animation logic moved to SkiaFogOverlay, this now just updates Redux state
   */
  private async triggerFogClearingAnimation(result: ExplorationResult): Promise<void> {
    if (!result.exploredArea) return;

    const area = this.fogService.getGeographicArea(
      result.exploredArea.latitude,
      result.exploredArea.longitude,
      result.exploredArea.radius
    );

    const animationId = `anim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.activeAnimationCount++;

    // Update Redux state - SkiaFogOverlay will handle the actual animation
    store.dispatch(startFogClearingAnimation({
      animationId,
      area: {
        center: [result.exploredArea.longitude, result.exploredArea.latitude],
        radius: result.exploredArea.radius,
        bounds: area.bounds,
      },
    }));

    // Simulate animation completion after a delay (SkiaFogOverlay will handle the real timing)
    setTimeout(() => {
      this.activeAnimationCount--;
      store.dispatch(completeFogClearingAnimation(animationId));
      console.log('Fog clearing animation completed:', animationId);
    }, 2500); // Match SkiaFogOverlay animation duration

    console.log('Fog clearing animation started:', animationId);
  }

  /**
   * Update fog geometry based on current explored areas
   */
  private async updateFogGeometry(): Promise<void> {
    try {
      // Get all explored areas from exploration service (database)
      const exploredAreas = await explorationService.getAllExploredAreas();

      // Initialize spatial cache with explored areas
      await spatialCacheService.initialize();

      // Convert to Redux-compatible format and update exploration state
      const explorationStateAreas = exploredAreas.map(area => ({
        id: area.id?.toString() ?? `area_${area.latitude}_${area.longitude}`,
        center: [area.longitude, area.latitude] as [number, number],
        radius: area.radius,
        exploredAt: new Date(area.explored_at).getTime(),
        accuracy: area.accuracy,
      }));

      // CRITICAL: Update exploration slice with areas from database
      // This is what SkiaFogOverlay reads via MapContainer
      store.dispatch(setExploredAreas(explorationStateAreas));

      // Generate updated fog geometry
      const fogGeometry = this.fogService.generateFogGeometry(exploredAreas);

      // Update fog slice state
      store.dispatch(updateFogForExploration({
        geometry: fogGeometry,
        animate: false, // Don't animate for regular updates
      }));

      console.log(`Fog geometry updated and Redux synced with ${exploredAreas.length} explored areas`);

    } catch (error) {
      console.error('Error updating fog geometry:', error);
      throw error;
    }
  }

  /**
   * Handle animation updates (legacy method - animations now handled by SkiaFogOverlay)
   */
  private handleAnimationUpdate(animations: any[]): void {
    // Legacy method - kept for compatibility but no longer used
    // SkiaFogOverlay now handles all animation logic internally
  }

  /**
   * Check if two locations are similar (to avoid excessive processing)
   */
  private isLocationSimilar(loc1: LocationUpdate, loc2: LocationUpdate): boolean {
    const distance = this.calculateDistance(
      loc1.latitude, loc1.longitude,
      loc2.latitude, loc2.longitude
    );

    // Consider locations similar if they're within 10 meters AND accuracy hasn't improved significantly
    const accuracyImprovement = Math.abs(loc1.accuracy - loc2.accuracy);
    return distance < 10 && accuracyImprovement < 5;
  }

  /**
   * Calculate distance between two points in meters
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Configure the integration service
   */
  public configure(config: Partial<FogLocationConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('Fog-Location integration configured:', this.config);
  }

  /**
   * Start the integration (begin listening to location updates)
   */
  public async start(): Promise<boolean> {
    try {
      console.log('Starting fog-location integration...');

      // Start exploration service (which will start location tracking)
      const success = await explorationService.startExploration();

      if (success) {
        // Load initial fog geometry
        await this.updateFogGeometry();
        console.log('Fog-location integration started successfully');
      }

      return success;
    } catch (error) {
      console.error('Error starting fog-location integration:', error);
      return false;
    }
  }

  /**
   * Stop the integration
   */
  public async stop(): Promise<void> {
    try {
      console.log('Stopping fog-location integration...');

      // Clear any pending timeouts
      if (this.processingTimeout) {
        clearTimeout(this.processingTimeout);
        this.processingTimeout = null;
      }

      // Reset animation counter (actual animations handled by SkiaFogOverlay)
      this.activeAnimationCount = 0;

      // Stop exploration service
      await explorationService.stopExploration();

      console.log('Fog-location integration stopped');
    } catch (error) {
      console.error('Error stopping fog-location integration:', error);
    }
  }

  /**
   * Force refresh fog geometry (useful for manual updates)
   */
  public async refreshFogGeometry(): Promise<void> {
    await this.updateFogGeometry();
  }

  /**
   * Get current integration status
   */
  public async getStatus(): Promise<{
    isActive: boolean;
    activeAnimations: number;
    lastProcessedLocation: LocationUpdate | null;
    config: FogLocationConfig;
  }> {
    const explorationStatus = await explorationService.getExplorationStatus();

    return {
      isActive: explorationStatus.isActive,
      activeAnimations: this.activeAnimationCount,
      lastProcessedLocation: this.lastProcessedLocation,
      config: this.config,
    };
  }

  /**
   * Manually trigger fog clearing at a specific location (for testing)
   */
  public async manualFogClear(
    latitude: number,
    longitude: number,
    radius: number = 100
  ): Promise<void> {
    try {
      // Process manual exploration
      const result = await explorationService.processManualLocation(latitude, longitude, 10);

      if (result.isNewArea) {
        await this.handleExplorationResult(result);
      }
    } catch (error) {
      console.error('Error with manual fog clear:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const fogLocationIntegrationService = FogLocationIntegrationService.getInstance();