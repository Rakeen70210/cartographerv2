import { LocationUpdate } from '../types';
import { getDatabaseService, ExploredArea } from '../database/services';
import { locationService } from './locationService';
import { processBackgroundLocations } from './taskManager';
import { calculateDistance, createLocationKey, metersToMiles } from '../utils/spatial';
import { EXPLORATION_TILE_ZOOM } from '../config';
import { tilesForCircle } from '../utils/tiles';
import {
  DEFAULT_EXPLORATION_CONFIG,
  evaluateExplorationCandidate,
  ExplorationConfig,
} from './explorationEngine';

export interface ExplorationResult {
  isNewArea: boolean;
  exploredArea?: ExploredArea;
  overlappingAreas: ExploredArea[];
  explorationRadius: number;
  source?: string;
  rejectionReason?: string;
  discoveredTileCount?: number;
}

export interface LocationProcessingResult {
  newAreaExplored: boolean;
  rejectionReason?: string;
  exploredArea?: ExploredArea;
  source?: string;
  warnings?: string[];
  explorationRadius?: number;
  discoveredTileCount?: number;
}

interface PendingLocationRecord {
  location: LocationUpdate;
  firstSeenAt: number;
  lastSeenAt: number;
}

export class ExplorationService {
  private static instance: ExplorationService;
  private databaseService = getDatabaseService();
  private config: ExplorationConfig;
  private pendingLocations: Map<string, PendingLocationRecord> = new Map();
  private isProcessing: boolean = false;
  private lastValidLocation: LocationUpdate | null = null;

  private constructor() {
    this.config = { ...DEFAULT_EXPLORATION_CONFIG };

    // Set up location listener
    locationService.addLocationListener(this.handleLocationUpdate.bind(this));
  }

  public static getInstance(): ExplorationService {
    if (!ExplorationService.instance) {
      ExplorationService.instance = new ExplorationService();
    }
    return ExplorationService.instance;
  }

  /**
   * Configure exploration detection parameters
   */
  public configure(config: Partial<ExplorationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Handle incoming location updates
   */
  private async handleLocationUpdate(location: LocationUpdate): Promise<void> {
    try {
      // Validate location accuracy
      if (location.accuracy > this.config.minAccuracyThreshold) {
        console.log(`Skipping location with poor accuracy: ${location.accuracy}m`);
        return;
      }

      // Create location key for deduplication
      const locationKey = createLocationKey(location.latitude, location.longitude);
      
      // Check if we already have a pending location for this area
      const existing = this.pendingLocations.get(locationKey);
      if (existing) {
        existing.location = location;
        existing.lastSeenAt = Date.now();
        return;
      }

      // Add to pending locations
      this.pendingLocations.set(locationKey, {
        location,
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
      });

      // Process location after dwell time
      setTimeout(() => {
        this.processLocationForExploration(locationKey);
      }, this.config.minDwellTime);

    } catch (error) {
      console.error('Error handling location update:', error);
    }
  }

  /**
   * Process a location for exploration detection
   */
  private async processLocationForExploration(locationKey: string): Promise<void> {
    try {
      if (this.isProcessing) {
        return; // Avoid concurrent processing
      }

      const pendingLocation = this.pendingLocations.get(locationKey);
      if (!pendingLocation) {
        return; // Location was removed or processed
      }

      this.isProcessing = true;

      const processResult = await this.processLocationUpdate(
        pendingLocation.location,
        'foreground',
        { firstSeenAt: pendingLocation.firstSeenAt }
      );

      if (processResult.newAreaExplored && processResult.exploredArea) {
        console.log('New area explored:', processResult.exploredArea);
      }

      // Remove processed location
      this.pendingLocations.delete(locationKey);

    } catch (error) {
      console.error('Error processing location for exploration:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Detect if a location represents a new exploration area
   */
  public async detectExploration(location: LocationUpdate): Promise<ExplorationResult> {
    try {
      const locationResult = await this.processLocationUpdate(
        location,
        'manual',
        { enforceDwell: false }
      );

      return {
        isNewArea: locationResult.newAreaExplored,
        exploredArea: locationResult.exploredArea,
        overlappingAreas: [],
        explorationRadius: locationResult.explorationRadius ?? this.calculateExplorationRadius(location.accuracy),
        source: locationResult.source,
        rejectionReason: locationResult.rejectionReason,
        discoveredTileCount: locationResult.discoveredTileCount,
      };

    } catch (error) {
      console.error('Error detecting exploration:', error);
      throw new Error(`Failed to detect exploration: ${error}`);
    }
  }

  /**
   * Calculate exploration radius based on GPS accuracy
   */
  private calculateExplorationRadius(accuracy: number): number {
    // Base radius on GPS accuracy, with min/max bounds
    const baseRadius = Math.max(accuracy * 1.5, this.config.minExplorationRadius);
    return Math.min(baseRadius, this.config.maxExplorationRadius);
  }

  /**
   * Create a new explored area in the database
   */
  private async createExploredArea(
    location: LocationUpdate,
    radius: number
  ): Promise<{ exploredArea: ExploredArea; discoveredTileCount: number }> {
    try {
      const exploredArea: Omit<ExploredArea, 'id' | 'created_at'> = {
        latitude: location.latitude,
        longitude: location.longitude,
        radius: radius,
        explored_at: new Date(location.timestamp).toISOString(),
        accuracy: location.accuracy
      };
      const tiles = tilesForCircle(location.latitude, location.longitude, radius, EXPLORATION_TILE_ZOOM)
        .map(tile => ({ ...tile, explored_at: exploredArea.explored_at }));
      const id = await this.databaseService.persistExplorationRecord({
        area: exploredArea,
        tiles,
      });

      this.refreshDerivedStats().catch((statsError) => {
        console.warn('Failed to refresh derived stats after exploration:', statsError);
      });

      return {
        exploredArea: {
          id,
          ...exploredArea,
        },
        discoveredTileCount: tiles.length,
      };
    } catch (error) {
      console.error('Error creating explored area:', error);

      throw new Error(`Failed to create explored area: ${error}`);
    }
  }



  /**
   * Get all explored areas from database
   */
  public async getAllExploredAreas(): Promise<ExploredArea[]> {
    try {
      return await this.databaseService.getAllExploredAreas();
    } catch (error) {
      console.error('Error getting explored areas:', error);
      throw new Error(`Failed to get explored areas: ${error}`);
    }
  }

  /**
   * Get explored areas within map bounds
   */
  public async getExploredAreasInBounds(
    northEast: { lat: number; lng: number },
    southWest: { lat: number; lng: number }
  ): Promise<ExploredArea[]> {
    try {
      return await this.databaseService.getExploredAreasInBounds(northEast, southWest);
    } catch (error) {
      console.error('Error getting explored areas in bounds:', error);
      throw new Error(`Failed to get explored areas in bounds: ${error}`);
    }
  }

  /**
   * Get exploration statistics
   */
  public async getExplorationStats(): Promise<{
    totalAreas: number;
    totalDistance: number;
    explorationPercentage: number;
    recentAreas: ExploredArea[];
  }> {
    try {
      const allAreas = await this.getAllExploredAreas();
      const userStats = await this.databaseService.getUserStats();
      
      // Calculate total distance traveled (approximate)
      let totalDistance = 0;
      if (allAreas.length > 1) {
        const sortedAreas = allAreas.sort((a, b) => 
          new Date(a.explored_at).getTime() - new Date(b.explored_at).getTime()
        );
        
        for (let i = 1; i < sortedAreas.length; i++) {
          const prev = sortedAreas[i - 1];
          const curr = sortedAreas[i];
          totalDistance += calculateDistance(
            prev.latitude,
            prev.longitude,
            curr.latitude,
            curr.longitude
          );
        }
      }

      // Get recent areas (last 10)
      const recentAreas = allAreas
        .sort((a, b) => new Date(b.explored_at).getTime() - new Date(a.explored_at).getTime())
        .slice(0, 10);

      // Calculate exploration percentage (simplified - could be more sophisticated)
      const explorationPercentage = userStats?.exploration_percentage || 0;

      const totalDistanceMiles = metersToMiles(totalDistance);

      return {
        totalAreas: allAreas.length,
        totalDistance: Math.round(totalDistanceMiles * 100) / 100,
        explorationPercentage,
        recentAreas
      };
    } catch (error) {
      console.error('Error getting exploration stats:', error);
      throw new Error(`Failed to get exploration stats: ${error}`);
    }
  }

  public async processLocationUpdate(
    location: LocationUpdate,
    source: 'manual' | 'foreground' | 'background' = 'manual',
    options: { firstSeenAt?: number; enforceDwell?: boolean } = {}
  ): Promise<LocationProcessingResult> {
    try {
      // Validate location data
      if (!this.isLocationValid(location)) {
        return {
          newAreaExplored: false,
          rejectionReason: 'invalid_data'
        };
      }

      // Check for impossible jumps if we have previous location
      if (this.lastValidLocation && this.isImpossibleJump(this.lastValidLocation, location)) {
        return {
          newAreaExplored: false,
          rejectionReason: 'impossible_jump'
        };
      }

      const explorationRadius = this.calculateExplorationRadius(location.accuracy);
      const nearbyAreas = await this.databaseService.findNearbyExploredAreas({
        latitude: location.latitude,
        longitude: location.longitude,
        radius: explorationRadius / 1000,
      });
      const shouldEnforceDwell = options.enforceDwell ?? source !== 'manual';
      const effectiveFirstSeenAt = !shouldEnforceDwell
        ? location.timestamp - this.config.minDwellTime
        : (options.firstSeenAt ?? location.timestamp);
      const decision = evaluateExplorationCandidate({
        location,
        nearbyAreas,
        now: Date.now(),
        firstSeenAt: effectiveFirstSeenAt,
        config: this.config,
      });

      if (decision.status === 'pending' || decision.status === 'rejected') {
        return {
          newAreaExplored: false,
          rejectionReason: decision.reason,
          source,
          explorationRadius: decision.explorationRadius,
        };
      }

      const persisted = await this.createExploredArea(location, decision.explorationRadius);
      const explorationResult: ExplorationResult = {
        isNewArea: true,
        exploredArea: persisted.exploredArea,
        overlappingAreas: decision.overlappingAreas,
        explorationRadius: decision.explorationRadius,
        source,
        discoveredTileCount: persisted.discoveredTileCount,
      };

      if (explorationResult.isNewArea) {
        this.lastValidLocation = location;
        this.notifyExplorationListeners(explorationResult);
      }

      return {
        newAreaExplored: true,
        exploredArea: explorationResult.exploredArea,
        source,
        explorationRadius: decision.explorationRadius,
        discoveredTileCount: persisted.discoveredTileCount,
      };
    } catch (error) {
      console.error('Error processing location update:', error);
      return {
        newAreaExplored: false,
        rejectionReason: 'processing_error'
      };
    }
  }

  /**
   * Force process a manual location (for testing or manual exploration)
   */
  public async processManualLocation(
    latitude: number,
    longitude: number,
    accuracy: number = 10
  ): Promise<ExplorationResult> {
    const location: LocationUpdate = {
      latitude,
      longitude,
      accuracy,
      timestamp: Date.now()
    };

    return await this.detectExploration(location);
  }

  /**
   * Clear exploration data (for testing or reset)
   */
  public async clearExplorationData(): Promise<void> {
    try {
      // This would need to be implemented in the database service
      // For now, we'll just clear pending locations
      this.pendingLocations.clear();
      console.log('Exploration data cleared');
    } catch (error) {
      console.error('Error clearing exploration data:', error);
      throw new Error(`Failed to clear exploration data: ${error}`);
    }
  }

  // Event handling for exploration updates
  private explorationListeners: ((result: ExplorationResult) => void)[] = [];

  /**
   * Add listener for exploration events
   */
  public addExplorationListener(callback: (result: ExplorationResult) => void): void {
    this.explorationListeners.push(callback);
  }

  /**
   * Remove exploration event listener
   */
  public removeExplorationListener(callback: (result: ExplorationResult) => void): void {
    const index = this.explorationListeners.indexOf(callback);
    if (index > -1) {
      this.explorationListeners.splice(index, 1);
    }
  }

  /**
   * Notify listeners about new exploration
   */
  private notifyExplorationListeners(result: ExplorationResult): void {
    this.explorationListeners.forEach(callback => {
      try {
        callback(result);
      } catch (error) {
        console.error('Error in exploration listener callback:', error);
      }
    });
  }

  /**
   * Start exploration detection
   */
  public async startExploration(): Promise<boolean> {
    try {
      // Process any background locations first
      await this.processBackgroundLocations();
      
      const success = await locationService.startTracking();
      if (success) {
        console.log('Exploration detection started');
      }
      return success;
    } catch (error) {
      console.error('Error starting exploration:', error);
      return false;
    }
  }

  /**
   * Process background locations when app becomes active
   */
  public async processBackgroundLocations(): Promise<void> {
    try {
      const backgroundResult = await processBackgroundLocations();
      const backgroundLocations = backgroundResult.processed;
      
      if (backgroundLocations.length > 0) {
        console.log(`Processing ${backgroundLocations.length} background locations`);
        
        // Process each background location
        for (const location of backgroundLocations) {
          await this.processLocationUpdate(location, 'background', {
            firstSeenAt: location.timestamp,
          });
        }
        
        console.log('Background locations processed');
      }
    } catch (error) {
      console.error('Error processing background locations:', error);
    }
  }

  /**
   * Stop exploration detection
   */
  public async stopExploration(): Promise<void> {
    try {
      await locationService.stopTracking();
      this.pendingLocations.clear();
      console.log('Exploration detection stopped');
    } catch (error) {
      console.error('Error stopping exploration:', error);
    }
  }

  /**
   * Get current exploration status
   */
  public async getExplorationStatus(): Promise<{
    isActive: boolean;
    pendingLocations: number;
    hasPermissions: boolean;
  }> {
    const locationStatus = await locationService.getTrackingStatus();
    
    return {
      isActive: locationStatus.isTracking,
      pendingLocations: this.pendingLocations.size,
      hasPermissions: locationStatus.hasPermissions
    };
  }

  /**
   * Validate location data
   */
  private isLocationValid(location: LocationUpdate): boolean {
    // Check for valid latitude (-90 to 90)
    if (location.latitude < -90 || location.latitude > 90 || isNaN(location.latitude)) {
      return false;
    }

    // Check for valid longitude (-180 to 180)
    if (location.longitude < -180 || location.longitude > 180 || isNaN(location.longitude)) {
      return false;
    }

    // Check for valid accuracy (must be positive)
    if (location.accuracy < 0 || isNaN(location.accuracy)) {
      return false;
    }

    // Check for valid timestamp
    if (!location.timestamp || location.timestamp <= 0) {
      return false;
    }

    return true;
  }

  /**
   * Check if location jump is impossible (teleportation detection)
   */
  private isImpossibleJump(previousLocation: LocationUpdate, currentLocation: LocationUpdate): boolean {
    const distance = calculateDistance(
      previousLocation.latitude,
      previousLocation.longitude,
      currentLocation.latitude,
      currentLocation.longitude
    );

    const timeDiff = Math.abs(currentLocation.timestamp - previousLocation.timestamp) / 1000; // seconds
    const maxPossibleSpeed = 100; // 100 m/s (~360 km/h, very generous for any reasonable travel)

    // If distance is greater than what's possible at max speed, it's impossible
    return distance > (maxPossibleSpeed * timeDiff);
  }

  private async refreshDerivedStats(): Promise<void> {
    const { getStatisticsService } = await import('./statisticsService');
    const statisticsService = getStatisticsService();
    await statisticsService.updateCalculatedStats();
  }
}

// Export singleton instance
export const explorationService = ExplorationService.getInstance();
