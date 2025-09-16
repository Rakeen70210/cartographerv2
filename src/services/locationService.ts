import * as Location from 'expo-location';
import { LocationManagerConfig, LocationUpdate } from '../types';
import { BACKGROUND_LOCATION_TASK } from './taskManager';

export class LocationService {
  private static instance: LocationService;
  private config: LocationManagerConfig;
  private isTracking: boolean = false;
  private locationSubscription: Location.LocationSubscription | null = null;
  private backgroundSubscription: Location.LocationSubscription | null = null;
  private listeners: ((location: LocationUpdate) => void)[] = [];

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
      return {
        granted: false,
        canAskAgain: false,
        status: Location.PermissionStatus.DENIED
      };
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
   * Get current location with accuracy validation
   */
  public async getCurrentLocation(): Promise<LocationUpdate | null> {
    try {
      const permissionResult = await this.requestPermissions();
      if (!permissionResult.granted) {
        throw new Error('Location permissions not granted');
      }

      const accuracy = this.getLocationAccuracy();
      const location = await Location.getCurrentPositionAsync({
        accuracy,
        // maximumAge is not supported in this version
        // timeout: 15000, // timeout is also not supported
      });

      // Validate location accuracy
      const locationUpdate = this.validateAndFormatLocation(location);
      return locationUpdate;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  /**
   * Start foreground location tracking
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

      const accuracy = this.getLocationAccuracy();
      
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy,
          timeInterval: this.config.timeInterval,
          distanceInterval: this.config.distanceInterval,
        },
        (location) => {
          const locationUpdate = this.validateAndFormatLocation(location);
          if (locationUpdate) {
            this.notifyListeners(locationUpdate);
          }
        }
      );

      this.isTracking = true;
      console.log('Foreground location tracking started');
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return false;
    }
  }

  /**
   * Start background location tracking
   */
  public async startBackgroundTracking(): Promise<boolean> {
    try {
      if (this.backgroundSubscription) {
        console.warn('Background location tracking is already active');
        return true;
      }

      const backgroundPermissionResult = await this.requestBackgroundPermissions();
      if (!backgroundPermissionResult.granted) {
        throw new Error('Background location permissions not granted');
      }

      // Start background location updates
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: this.config.timeInterval * 2, // Less frequent in background
        distanceInterval: this.config.distanceInterval * 2,
        foregroundService: {
          notificationTitle: 'Cartographer is tracking your exploration',
          notificationBody: 'Discovering new areas as you travel',
        },
      });

      console.log('Background location tracking started');
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

      if (this.backgroundSubscription) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        this.backgroundSubscription = null;
      }

      this.isTracking = false;
      console.log('Location tracking stopped');
    } catch (error) {
      console.error('Error stopping location tracking:', error);
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
  public getTrackingStatus(): {
    isTracking: boolean;
    hasPermissions: boolean;
    backgroundEnabled: boolean;
  } {
    return {
      isTracking: this.isTracking,
      hasPermissions: this.locationSubscription !== null,
      backgroundEnabled: this.backgroundSubscription !== null,
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