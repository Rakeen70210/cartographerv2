import * as Location from 'expo-location';
import { LocationManagerConfig, LocationUpdate } from '../types';
import { 
  BACKGROUND_LOCATION_TASK, 
  processBackgroundLocations,
  getBackgroundQueueStatus,
  forceProcessBackgroundQueue 
} from './taskManager';

export class LocationService {
  private static instance: LocationService;
  private config: LocationManagerConfig;
  private isTracking: boolean = false;
  private locationSubscription: Location.LocationSubscription | null = null;
  private backgroundSubscription: Location.LocationSubscription | null = null;
  private listeners: ((location: LocationUpdate) => void)[] = [];
  private errorRecoveryService: any = null; // Will be set later to avoid circular dependency
  private retryCount = 0;
  private maxRetries = 3;

  private constructor() {
    this.config = {
      accuracy: 'high',
      distanceInterval: 10, // meters
      timeInterval: 5000, // 5 seconds
      backgroundMode: false
    };
  }

  public static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * Set error recovery service to avoid circular dependency
   */
  public setErrorRecoveryService(errorRecoveryService: any): void {
    this.errorRecoveryService = errorRecoveryService;
  }

  /**
   * Request location permissions with proper error handling
   */
  public async requestPermissions(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
    status: Location.PermissionStatus;
  }> {
    try {
      // Check current permission status
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      
      if (existingStatus === 'granted') {
        return {
          granted: true,
          canAskAgain: true,
          status: existingStatus
        };
      }

      // Request foreground permissions
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      
      return {
        granted: status === 'granted',
        canAskAgain,
        status
      };
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      
      // Handle error through recovery service
      let recovered = false;
      if (this.errorRecoveryService) {
        recovered = await this.errorRecoveryService.handleLocationError(
          error as Error,
          'requestPermissions'
        );
      }
      
      if (!recovered) {
        return {
          granted: false,
          canAskAgain: false,
          status: Location.PermissionStatus.DENIED
        };
      }
      
      // Retry after recovery
      try {
        const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
        return {
          granted: status === 'granted',
          canAskAgain,
          status
        };
      } catch (retryError) {
        return {
          granted: false,
          canAskAgain: false,
          status: Location.PermissionStatus.DENIED
        };
      }
    }
  }

  /**
   * Request background location permissions
   */
  public async requestBackgroundPermissions(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
    status: Location.PermissionStatus;
  }> {
    try {
      // First ensure we have foreground permissions
      const foregroundResult = await this.requestPermissions();
      if (!foregroundResult.granted) {
        return foregroundResult;
      }

      // Check current background permission status
      const { status: existingStatus } = await Location.getBackgroundPermissionsAsync();
      
      if (existingStatus === 'granted') {
        return {
          granted: true,
          canAskAgain: true,
          status: existingStatus
        };
      }

      // Request background permissions
      const { status, canAskAgain } = await Location.requestBackgroundPermissionsAsync();
      
      return {
        granted: status === 'granted',
        canAskAgain,
        status
      };
    } catch (error) {
      console.error('Error requesting background location permissions:', error);
      return {
        granted: false,
        canAskAgain: false,
        status: Location.PermissionStatus.DENIED
      };
    }
  }

  /**
   * Configure location service settings
   */
  public configure(config: Partial<LocationManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update configuration for error recovery scenarios
   */
  public async updateConfig(config: Partial<LocationManagerConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };
    
    // If tracking is active and accuracy changed, restart tracking
    if (this.isTracking && oldConfig.accuracy !== this.config.accuracy) {
      try {
        await this.stopTracking();
        await this.startTracking();
        console.log('Location tracking restarted with new configuration');
      } catch (error) {
        console.error('Failed to restart tracking with new config:', error);
        // Revert to old config if restart fails
        this.config = oldConfig;
      }
    }
  }

  /**
   * Get current location with accuracy validation and error recovery
   */
  public async getCurrentLocation(): Promise<LocationUpdate | null> {
    try {
      const permissionResult = await this.requestPermissions();
      if (!permissionResult.granted) {
        throw new Error('Location permissions not granted');
      }

      // Check if location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        throw new Error('Location services disabled');
      }

      const accuracy = this.getLocationAccuracy();
      const location = await Location.getCurrentPositionAsync({
        accuracy,
        // maximumAge is not supported in this version
        // timeout: 15000, // timeout is also not supported
      });

      // Validate location accuracy
      const locationUpdate = this.validateAndFormatLocation(location);
      if (!locationUpdate) {
        throw new Error('Location accuracy too low or invalid coordinates');
      }
      
      // Reset retry count on success
      this.retryCount = 0;
      return locationUpdate;
    } catch (error) {
      console.error('Error getting current location:', error);
      
      // Handle error through recovery service
      let recovered = false;
      if (this.errorRecoveryService) {
        recovered = await this.errorRecoveryService.handleLocationError(
          error as Error,
          'getCurrentLocation',
          { retryCount: this.retryCount, accuracy: this.config.accuracy }
        );
      }
      
      if (recovered && this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying getCurrentLocation (attempt ${this.retryCount})`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000 * this.retryCount));
        return this.getCurrentLocation();
      }
      
      this.retryCount = 0;
      return null;
    }
  }

  /**
   * Start foreground location tracking with error recovery
   */
  public async startTracking(): Promise<boolean> {
    try {
      if (this.isTracking) {
        console.warn('Location tracking is already active');
        return true;
      }

      const permissionResult = await this.requestPermissions();
      if (!permissionResult.granted) {
        throw new Error('Location permissions not granted');
      }

      // Check if location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        throw new Error('Location services disabled');
      }

      const accuracy = this.getLocationAccuracy();
      
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy,
          timeInterval: this.config.timeInterval,
          distanceInterval: this.config.distanceInterval,
        },
        (location) => {
          try {
            const locationUpdate = this.validateAndFormatLocation(location);
            if (locationUpdate) {
              this.notifyListeners(locationUpdate);
            } else {
              console.warn('Received invalid location update');
            }
          } catch (error) {
            console.error('Error processing location update:', error);
            // Handle location processing errors
            if (this.errorRecoveryService) {
              this.errorRecoveryService.handleLocationError(
                error as Error,
                'locationUpdate',
                { location }
              );
            }
          }
        }
      );

      this.isTracking = true;
      this.retryCount = 0; // Reset retry count on success
      console.log('Foreground location tracking started');
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      
      // Handle error through recovery service
      let recovered = false;
      if (this.errorRecoveryService) {
        recovered = await this.errorRecoveryService.handleLocationError(
          error as Error,
          'startTracking',
          { retryCount: this.retryCount, config: this.config }
        );
      }
      
      if (recovered && this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying startTracking (attempt ${this.retryCount})`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 3000 * this.retryCount));
        return this.startTracking();
      }
      
      this.retryCount = 0;
      return false;
    }
  }

  /**
   * Start background location tracking
   */
  public async startBackgroundTracking(): Promise<boolean> {
    try {
      // Check if background task is already registered
      const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (isRegistered) {
        console.warn('Background location tracking is already active');
        return true;
      }

      const backgroundPermissionResult = await this.requestBackgroundPermissions();
      if (!backgroundPermissionResult.granted) {
        throw new Error('Background location permissions not granted');
      }

      // Start background location updates with optimized settings
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: Math.max(this.config.timeInterval * 3, 30000), // At least 30 seconds in background
        distanceInterval: Math.max(this.config.distanceInterval * 2, 50), // At least 50m in background
        deferredUpdatesInterval: 60000, // Batch updates every minute
        foregroundService: {
          notificationTitle: 'Cartographer is tracking your exploration',
          notificationBody: 'Discovering new areas as you travel',
          notificationColor: '#4A90E2',
        },
        pausesUpdatesAutomatically: true, // Pause when stationary
        showsBackgroundLocationIndicator: true, // iOS requirement
      });

      console.log('Background location tracking started with enhanced settings');
      return true;
    } catch (error) {
      console.error('Error starting background location tracking:', error);
      return false;
    }
  }

  /**
   * Stop location tracking
   */
  public async stopTracking(): Promise<void> {
    try {
      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }

      // Check if background tracking is active before stopping
      const isBackgroundActive = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (isBackgroundActive) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        console.log('Background location tracking stopped');
      }

      this.isTracking = false;
      console.log('Location tracking stopped');
    } catch (error) {
      console.error('Error stopping location tracking:', error);
    }
  }

  /**
   * Stop only background location tracking
   */
  public async stopBackgroundTracking(): Promise<void> {
    try {
      const isBackgroundActive = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (isBackgroundActive) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        console.log('Background location tracking stopped');
      }
    } catch (error) {
      console.error('Error stopping background location tracking:', error);
    }
  }

  /**
   * Check if background location tracking is active
   */
  public async isBackgroundTrackingActive(): Promise<boolean> {
    try {
      return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch (error) {
      console.error('Error checking background tracking status:', error);
      return false;
    }
  }

  /**
   * Process any pending background locations
   */
  public async processBackgroundLocations(): Promise<{
    processed: LocationUpdate[];
    status: any;
  }> {
    try {
      return await processBackgroundLocations();
    } catch (error) {
      console.error('Error processing background locations:', error);
      return {
        processed: [],
        status: {
          lastSyncAt: 0,
          pendingCount: 0,
          failedCount: 0,
          totalProcessed: 0,
        },
      };
    }
  }

  /**
   * Get background queue status for monitoring
   */
  public async getBackgroundQueueStatus(): Promise<{
    queueSize: number;
    pendingCount: number;
    processedCount: number;
    failedCount: number;
    syncStatus: any;
  }> {
    try {
      return await getBackgroundQueueStatus();
    } catch (error) {
      console.error('Error getting background queue status:', error);
      return {
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
      };
    }
  }

  /**
   * Force processing of background queue
   */
  public async forceProcessBackgroundQueue(): Promise<boolean> {
    try {
      return await forceProcessBackgroundQueue();
    } catch (error) {
      console.error('Error forcing background queue processing:', error);
      return false;
    }
  }

  /**
   * Add location update listener
   */
  public addLocationListener(callback: (location: LocationUpdate) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Remove location update listener
   */
  public removeLocationListener(callback: (location: LocationUpdate) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Check if location services are enabled
   */
  public async isLocationEnabled(): Promise<boolean> {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch (error) {
      console.error('Error checking location services:', error);
      return false;
    }
  }

  /**
   * Get current tracking status
   */
  public async getTrackingStatus(): Promise<{
    isTracking: boolean;
    hasPermissions: boolean;
    backgroundEnabled: boolean;
    backgroundActive: boolean;
  }> {
    const backgroundActive = await this.isBackgroundTrackingActive();
    
    return {
      isTracking: this.isTracking,
      hasPermissions: this.locationSubscription !== null,
      backgroundEnabled: this.config.backgroundMode,
      backgroundActive,
    };
  }

  // Private helper methods

  private getLocationAccuracy(): Location.Accuracy {
    switch (this.config.accuracy) {
      case 'high':
        return Location.Accuracy.High;
      case 'balanced':
        return Location.Accuracy.Balanced;
      case 'low':
        return Location.Accuracy.Low;
      default:
        return Location.Accuracy.Balanced;
    }
  }

  private validateAndFormatLocation(location: Location.LocationObject): LocationUpdate | null {
    try {
      const { coords, timestamp } = location;
      
      // Validate accuracy - reject if accuracy is worse than 100 meters
      if (coords.accuracy && coords.accuracy > 100) {
        console.warn(`Location accuracy too low: ${coords.accuracy}m`);
        return null;
      }

      // Validate coordinates
      if (!this.isValidCoordinate(coords.latitude, coords.longitude)) {
        console.warn('Invalid coordinates received');
        return null;
      }

      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy || 0,
        timestamp: timestamp || Date.now(),
      };
    } catch (error) {
      console.error('Error validating location:', error);
      return null;
    }
  }

  private isValidCoordinate(latitude: number, longitude: number): boolean {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180 &&
      !isNaN(latitude) &&
      !isNaN(longitude)
    );
  }

  private notifyListeners(location: LocationUpdate): void {
    this.listeners.forEach(callback => {
      try {
        callback(location);
      } catch (error) {
        console.error('Error in location listener callback:', error);
      }
    });
  }
}

// Export singleton instance
export const locationService = LocationService.getInstance();

// Export getter function for consistency with other services
export const getLocationService = (): LocationService => {
  return LocationService.getInstance();
};