import { LocationUpdate } from '../types';
import { getDatabaseService, ExploredArea } from '../database/services';
import { locationService } from './locationService';
import { processBackgroundLocations } from './taskManager';
import { calculateDistance, createLocationKey, calculateCircleOverlap, Circle } from '../utils/spatial';

export interface ExplorationConfig {
  minExplorationRadius: number; // meters
  maxExplorationRadius: number; // meters
  minAccuracyThreshold: number; // meters
  overlapThreshold: number; // percentage (0-1)
  minDwellTime: number; // milliseconds
}

export interface ExplorationResult {
  isNewArea: boolean;
  exploredArea?: ExploredArea;
  overlappingAreas: ExploredArea[];
  explorationRadius: number;
}

export class ExplorationService {
  private static instance: ExplorationService;
  private databaseService = getDatabaseService();
  private config: ExplorationConfig;
  private pendingLocations: Map<string, { location: LocationUpdate; timestamp: number }> = new Map();
  private isProcessing: boolean = false;

  private constructor() {
    this.config = {
      minExplorationRadius: 50, // 50 meters minimum
      maxExplorationRadius: 200, // 200 meters maximum
      minAccuracyThreshold: 100, // Only process locations with accuracy better than 100m
      overlapThreshold: 0.7, // 70% overlap threshold for deduplication
      minDwellTime: 30000, // 30 seconds minimum dwell time
    };

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
        // Update timestamp but keep original location
        existing.timestamp = Date.now();
        return;
      }

      // Add to pending locations
      this.pendingLocations.set(locationKey, {
        location,
        timestamp: Date.now()
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

      // Check if location is still recent enough
      const timeSinceUpdate = Date.now() - pendingLocation.timestamp;
      if (timeSinceUpdate < this.config.minDwellTime) {
        return; // Not enough dwell time yet
      }

      this.isProcessing = true;
      
      const result = await this.detectExploration(pendingLocation.location);
      
      if (result.isNewArea && result.exploredArea) {
        console.log('New area explored:', result.exploredArea);
        // Notify listeners about new exploration
        this.notifyExplorationListeners(result);
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
      // Calculate exploration radius based on accuracy
      const explorationRadius = this.calculateExplorationRadius(location.accuracy);

      // Find nearby explored areas
      const nearbyAreas = await this.databaseService.findNearbyExploredAreas({
        latitude: location.latitude,
        longitude: location.longitude,
        radius: explorationRadius / 1000 // Convert to kilometers
      });

      // Check for overlaps
      const overlappingAreas = this.findOverlappingAreas(
        location,
        explorationRadius,
        nearbyAreas
      );

      // Determine if this is a new area
      const isNewArea = !this.hasSignificantOverlap(
        location,
        explorationRadius,
        overlappingAreas
      );

      let exploredArea: ExploredArea | undefined;

      if (isNewArea) {
        // Create new explored area
        exploredArea = await this.createExploredArea(location, explorationRadius);
      }

      return {
        isNewArea,
        exploredArea,
        overlappingAreas,
        explorationRadius
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
   * Find areas that overlap with the current location
   */
  private findOverlappingAreas(
    location: LocationUpdate,
    radius: number,
    nearbyAreas: ExploredArea[]
  ): ExploredArea[] {
    return nearbyAreas.filter(area => {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        area.latitude,
        area.longitude
      );
      
      // Check if circles overlap
      return distance < (radius + area.radius);
    });
  }

  /**
   * Check if there's significant overlap with existing areas
   */
  private hasSignificantOverlap(
    location: LocationUpdate,
    radius: number,
    overlappingAreas: ExploredArea[]
  ): boolean {
    for (const area of overlappingAreas) {
      const circle1: Circle = {
        center: { latitude: location.latitude, longitude: location.longitude },
        radius: radius
      };
      const circle2: Circle = {
        center: { latitude: area.latitude, longitude: area.longitude },
        radius: area.radius
      };
      
      const overlapPercentage = calculateCircleOverlap(circle1, circle2);

      if (overlapPercentage >= this.config.overlapThreshold) {
        return true;
      }
    }
    return false;
  }

  /*
*
   * Create a new explored area in the database
   */
  private async createExploredArea(
    location: LocationUpdate,
    radius: number
  ): Promise<ExploredArea> {
    try {
      const exploredArea: Omit<ExploredArea, 'id' | 'created_at'> = {
        latitude: location.latitude,
        longitude: location.longitude,
        radius: radius,
        explored_at: new Date(location.timestamp).toISOString(),
        accuracy: location.accuracy
      };

      const id = await this.databaseService.createExploredArea(exploredArea);
      
      return {
        id,
        ...exploredArea
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

      return {
        totalAreas: allAreas.length,
        totalDistance: Math.round(totalDistance),
        explorationPercentage,
        recentAreas
      };
    } catch (error) {
      console.error('Error getting exploration stats:', error);
      throw new Error(`Failed to get exploration stats: ${error}`);
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
      const backgroundLocations = await processBackgroundLocations();
      
      if (backgroundLocations.length > 0) {
        console.log(`Processing ${backgroundLocations.length} background locations`);
        
        // Process each background location
        for (const location of backgroundLocations) {
          await this.handleLocationUpdate(location);
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
  public getExplorationStatus(): {
    isActive: boolean;
    pendingLocations: number;
    hasPermissions: boolean;
  } {
    const locationStatus = locationService.getTrackingStatus();
    
    return {
      isActive: locationStatus.isTracking,
      pendingLocations: this.pendingLocations.size,
      hasPermissions: locationStatus.hasPermissions
    };
  }
}

// Export singleton instance
export const explorationService = ExplorationService.getInstance();