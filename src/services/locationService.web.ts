import { LocationManagerConfig, LocationUpdate } from '../types';
import {
  BACKGROUND_LOCATION_TASK,
  processBackgroundLocations,
  getBackgroundQueueStatus,
  forceProcessBackgroundQueue,
} from './taskManager';
import { debugLog } from '../utils/logger';

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export class LocationService {
  private static instance: LocationService;
  private config: LocationManagerConfig;
  private isTracking = false;
  private watchId: number | null = null;
  private listeners: ((location: LocationUpdate) => void)[] = [];
  private errorRecoveryService: any = null;
  private lastUpdateTime = 0;
  private lastLocation: LocationUpdate | null = null;
  private hasPermissions = false;

  private constructor() {
    this.config = {
      accuracy: 'high',
      distanceInterval: 10,
      timeInterval: 5000,
      backgroundMode: false,
    };
  }

  public static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  public setErrorRecoveryService(errorRecoveryService: any): void {
    this.errorRecoveryService = errorRecoveryService;
  }

  public async requestPermissions(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
    status: PermissionStatus;
  }> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return {
        granted: false,
        canAskAgain: false,
        status: 'denied',
      };
    }

    try {
      if ('permissions' in navigator && (navigator as any).permissions?.query) {
        const status = await (navigator as any).permissions.query({ name: 'geolocation' });
        const state = status?.state as PermissionStatus | undefined;
        return {
          granted: state === 'granted',
          canAskAgain: state !== 'denied',
          status: state ?? 'undetermined',
        };
      }
    } catch (error) {
      console.warn('Permission query failed, falling back to prompt:', error);
    }

    return {
      granted: true,
      canAskAgain: true,
      status: 'undetermined',
    };
  }

  public async requestBackgroundPermissions(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
    status: PermissionStatus;
  }> {
    const result = await this.requestPermissions();
    return {
      ...result,
      granted: false,
      status: result.status === 'denied' ? 'denied' : 'undetermined',
    };
  }

  public configure(config: Partial<LocationManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public async updateConfig(config: Partial<LocationManagerConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };

    if (this.isTracking && oldConfig.accuracy !== this.config.accuracy) {
      try {
        await this.stopTracking();
        await this.startTracking();
      } catch (error) {
        console.error('Failed to restart tracking with new config:', error);
        this.config = oldConfig;
      }
    }
  }

  public async getCurrentLocation(): Promise<LocationUpdate | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return null;
    }

    const permissionResult = await this.requestPermissions();
    if (!permissionResult.granted && permissionResult.status === 'denied') {
      return null;
    }

    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        position => {
          const location = this.formatLocation(position);
          if (location) {
            this.hasPermissions = true;
          }
          resolve(location);
        },
        error => {
          // Timeouts are expected on desktop browsers without GPS
          debugLog('Location', `Error getting current location: ${error.message}`);
          if (this.errorRecoveryService) {
            this.errorRecoveryService.handleLocationError(error, 'getCurrentLocation', {
              config: this.config,
            });
          }
          resolve(null);
        },
        {
          enableHighAccuracy: this.config.accuracy === 'high',
          maximumAge: Math.max(this.config.timeInterval, 0),
          timeout: 15000,
        }
      );
    });
  }

  public async startTracking(): Promise<boolean> {
    if (this.isTracking) {
      return true;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      console.warn('Geolocation is not available in this environment.');
      return false;
    }

    const permissionResult = await this.requestPermissions();
    if (!permissionResult.granted && permissionResult.status === 'denied') {
      return false;
    }

    this.watchId = navigator.geolocation.watchPosition(
      position => {
        const now = Date.now();
        if (now - this.lastUpdateTime < this.config.timeInterval) {
          return;
        }

        const location = this.formatLocation(position);
        if (!location) return;

        if (this.lastLocation) {
          const distance = this.calculateDistance(this.lastLocation, location);
          if (distance < this.config.distanceInterval) {
            return;
          }
        }

        this.lastUpdateTime = now;
        this.lastLocation = location;
        this.hasPermissions = true;
        this.notifyListeners(location);
      },
      error => {
        // Timeouts are expected on desktop browsers without GPS
        debugLog('Location', `Error watching location: ${error.message}`);
        if (this.errorRecoveryService) {
          this.errorRecoveryService.handleLocationError(error, 'startTracking', {
            config: this.config,
          });
        }
      },
      {
        enableHighAccuracy: this.config.accuracy === 'high',
        maximumAge: Math.max(this.config.timeInterval, 0),
        timeout: 20000,
      }
    );

    this.isTracking = true;
    return true;
  }

  public async startBackgroundTracking(): Promise<boolean> {
    console.warn('Background location tracking is not supported on web.');
    return false;
  }

  public async stopTracking(): Promise<void> {
    if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
  }

  public async stopBackgroundTracking(): Promise<void> {
    return;
  }

  public async isBackgroundTrackingActive(): Promise<boolean> {
    return false;
  }

  public async processBackgroundLocations(): Promise<{
    processed: LocationUpdate[];
    status: any;
  }> {
    return await processBackgroundLocations();
  }

  public async getBackgroundQueueStatus(): Promise<{
    queueSize: number;
    pendingCount: number;
    processedCount: number;
    failedCount: number;
    syncStatus: any;
  }> {
    return await getBackgroundQueueStatus();
  }

  public async forceProcessBackgroundQueue(): Promise<boolean> {
    return await forceProcessBackgroundQueue();
  }

  public addLocationListener(callback: (location: LocationUpdate) => void): void {
    this.listeners.push(callback);
  }

  public removeLocationListener(callback: (location: LocationUpdate) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  public async isLocationEnabled(): Promise<boolean> {
    return typeof navigator !== 'undefined' && !!navigator.geolocation;
  }

  public async getTrackingStatus(): Promise<{
    isTracking: boolean;
    hasPermissions: boolean;
    backgroundEnabled: boolean;
    backgroundActive: boolean;
  }> {
    return {
      isTracking: this.isTracking,
      hasPermissions: this.hasPermissions,
      backgroundEnabled: this.config.backgroundMode,
      backgroundActive: false,
    };
  }

  private formatLocation(position: GeolocationPosition): LocationUpdate | null {
    const { coords, timestamp } = position;
    if (!this.isValidCoordinate(coords.latitude, coords.longitude)) {
      return null;
    }

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy ?? 0,
      timestamp: timestamp || Date.now(),
    };
  }

  private isValidCoordinate(latitude: number, longitude: number): boolean {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180 &&
      !Number.isNaN(latitude) &&
      !Number.isNaN(longitude)
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

  private calculateDistance(a: LocationUpdate, b: LocationUpdate): number {
    const R = 6371000;
    const dLat = (b.latitude - a.latitude) * Math.PI / 180;
    const dLng = (b.longitude - a.longitude) * Math.PI / 180;
    const lat1 = a.latitude * Math.PI / 180;
    const lat2 = b.latitude * Math.PI / 180;

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const aVal = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
    return R * c;
  }
}

export const locationService = LocationService.getInstance();

export const getLocationService = (): LocationService => {
  return LocationService.getInstance();
};
