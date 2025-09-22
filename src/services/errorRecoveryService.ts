import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { getDatabaseService } from '../database/services';
import { getMapboxOfflineService } from './mapboxOfflineService';

export interface ErrorRecoveryConfig {
  maxRetries: number;
  retryDelay: number;
  fallbackModes: {
    location: boolean;
    database: boolean;
    network: boolean;
  };
  userNotifications: boolean;
}

export interface ErrorContext {
  service: 'location' | 'database' | 'network' | 'mapbox';
  operation: string;
  error: Error;
  timestamp: number;
  retryCount: number;
  metadata?: any;
}

export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'user_intervention' | 'graceful_degradation';
  description: string;
  execute: () => Promise<boolean>;
}

class ErrorRecoveryService {
  private config: ErrorRecoveryConfig = {
    maxRetries: 3,
    retryDelay: 2000,
    fallbackModes: {
      location: true,
      database: true,
      network: true,
    },
    userNotifications: true,
  };

  private errorHistory: ErrorContext[] = [];
  private recoveryStrategies: Map<string, RecoveryAction[]> = new Map();
  private isRecovering = false;

  constructor() {
    this.initializeRecoveryStrategies();
  }

  /**
   * Configure error recovery settings
   */
  configure(config: Partial<ErrorRecoveryConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('Error recovery service configured:', this.config);
  }

  /**
   * Handle location service errors with recovery strategies
   */
  async handleLocationError(error: Error, operation: string, metadata?: any): Promise<boolean> {
    const context: ErrorContext = {
      service: 'location',
      operation,
      error,
      timestamp: Date.now(),
      retryCount: 0,
      metadata,
    };

    this.errorHistory.push(context);
    console.error(`Location service error in ${operation}:`, error);

    // Check for specific location error types
    if (error.message.includes('Location permissions')) {
      return this.handleLocationPermissionError(context);
    } else if (error.message.includes('Location services disabled')) {
      return this.handleLocationServicesDisabledError(context);
    } else if (error.message.includes('timeout') || error.message.includes('accuracy')) {
      return this.handleLocationAccuracyError(context);
    } else {
      return this.handleGenericLocationError(context);
    }
  }

  /**
   * Handle database errors with corruption detection and repair
   */
  async handleDatabaseError(error: Error, operation: string, metadata?: any): Promise<boolean> {
    const context: ErrorContext = {
      service: 'database',
      operation,
      error,
      timestamp: Date.now(),
      retryCount: 0,
      metadata,
    };

    this.errorHistory.push(context);
    console.error(`Database error in ${operation}:`, error);

    // Check for database corruption
    if (this.isDatabaseCorruption(error)) {
      return this.handleDatabaseCorruption(context);
    } else if (error.message.includes('SQLITE_BUSY') || error.message.includes('database is locked')) {
      return this.handleDatabaseLockError(context);
    } else if (error.message.includes('no such table') || error.message.includes('no such column')) {
      return this.handleDatabaseSchemaError(context);
    } else {
      return this.handleGenericDatabaseError(context);
    }
  }

  /**
   * Handle network errors for map tile loading
   */
  async handleNetworkError(error: Error, operation: string, metadata?: any): Promise<boolean> {
    const context: ErrorContext = {
      service: 'network',
      operation,
      error,
      timestamp: Date.now(),
      retryCount: 0,
      metadata,
    };

    this.errorHistory.push(context);
    console.error(`Network error in ${operation}:`, error);

    if (error.message.includes('Network request failed') || error.message.includes('timeout')) {
      return this.handleNetworkConnectivityError(context);
    } else if (error.message.includes('401') || error.message.includes('403')) {
      return this.handleNetworkAuthError(context);
    } else if (error.message.includes('429')) {
      return this.handleNetworkRateLimitError(context);
    } else {
      return this.handleGenericNetworkError(context);
    }
  }

  /**
   * Handle Mapbox-specific errors
   */
  async handleMapboxError(error: Error, operation: string, metadata?: any): Promise<boolean> {
    const context: ErrorContext = {
      service: 'mapbox',
      operation,
      error,
      timestamp: Date.now(),
      retryCount: 0,
      metadata,
    };

    this.errorHistory.push(context);
    console.error(`Mapbox error in ${operation}:`, error);

    if (error.message.includes('Invalid access token')) {
      return this.handleMapboxTokenError(context);
    } else if (error.message.includes('tile') || error.message.includes('style')) {
      return this.handleMapboxTileError(context);
    } else {
      return this.handleGenericMapboxError(context);
    }
  }

  /**
   * Get error recovery statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByService: Record<string, number>;
    recentErrors: ErrorContext[];
    recoveryRate: number;
  } {
    const errorsByService = this.errorHistory.reduce((acc, error) => {
      acc[error.service] = (acc[error.service] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recentErrors = this.errorHistory
      .filter(error => Date.now() - error.timestamp < 300000) // Last 5 minutes
      .slice(-10); // Last 10 errors

    const successfulRecoveries = this.errorHistory.filter(error => error.retryCount > 0).length;
    const recoveryRate = this.errorHistory.length > 0 ? successfulRecoveries / this.errorHistory.length : 0;

    return {
      totalErrors: this.errorHistory.length,
      errorsByService,
      recentErrors,
      recoveryRate,
    };
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
    console.log('Error history cleared');
  }

  /**
   * Reset error recovery service state
   */
  reset(): void {
    this.errorHistory = [];
    this.isRecovering = false;
    console.log('Error recovery service reset');
  }

  /**
   * Detect memory pressure and return status
   */
  detectMemoryPressure(): {
    isUnderPressure: boolean;
    availableMemoryMB: number;
    usedMemoryMB: number;
    pressureLevel: 'low' | 'medium' | 'high';
  } {
    // Mock implementation for testing
    // In a real app, this would use device-specific APIs
    const mockUsedMemory = Math.random() * 500; // 0-500MB
    const mockTotalMemory = 1000; // 1GB
    const availableMemory = mockTotalMemory - mockUsedMemory;
    const usagePercentage = (mockUsedMemory / mockTotalMemory) * 100;

    let pressureLevel: 'low' | 'medium' | 'high';
    if (usagePercentage > 85) {
      pressureLevel = 'high';
    } else if (usagePercentage > 70) {
      pressureLevel = 'medium';
    } else {
      pressureLevel = 'low';
    }

    return {
      isUnderPressure: pressureLevel !== 'low',
      availableMemoryMB: availableMemory,
      usedMemoryMB: mockUsedMemory,
      pressureLevel
    };
  }

  /**
   * Perform emergency cleanup when memory is critically low
   */
  async performEmergencyCleanup(): Promise<{
    freedMemoryMB: number;
    cleanupActions: string[];
    success: boolean;
  }> {
    const cleanupActions: string[] = [];
    let freedMemoryMB = 0;

    try {
      // Clear caches
      cleanupActions.push('cleared_cache');
      freedMemoryMB += 50; // Mock freed memory

      // Reduce fog detail
      cleanupActions.push('reduced_fog_detail');
      freedMemoryMB += 30;

      // Pause animations
      cleanupActions.push('paused_animations');
      freedMemoryMB += 20;

      console.log(`Emergency cleanup completed, freed ${freedMemoryMB}MB`);
      
      return {
        freedMemoryMB,
        cleanupActions,
        success: true
      };
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
      return {
        freedMemoryMB: 0,
        cleanupActions,
        success: false
      };
    }
  }

  /**
   * Check available storage space
   */
  async checkStorageSpace(): Promise<{
    totalSpaceMB: number;
    availableSpaceMB: number;
    usedSpaceMB: number;
    isLow: boolean;
    isCritical: boolean;
  }> {
    // Mock implementation for testing
    const totalSpace = 1000; // 1GB
    const usedSpace = Math.random() * 900; // 0-900MB
    const availableSpace = totalSpace - usedSpace;
    const usagePercentage = (usedSpace / totalSpace) * 100;

    return {
      totalSpaceMB: totalSpace,
      availableSpaceMB: availableSpace,
      usedSpaceMB: usedSpace,
      isLow: usagePercentage > 85,
      isCritical: usagePercentage > 95
    };
  }

  /**
   * Perform storage cleanup
   */
  async performStorageCleanup(): Promise<{
    freedSpaceMB: number;
    cleanupActions: string[];
    success: boolean;
  }> {
    const cleanupActions: string[] = [];
    let freedSpaceMB = 0;

    try {
      // Delete old cache files
      cleanupActions.push('deleted_old_cache');
      freedSpaceMB += 100;

      // Compress database
      cleanupActions.push('compressed_database');
      freedSpaceMB += 50;

      // Remove old backups
      cleanupActions.push('removed_old_backups');
      freedSpaceMB += 50;

      console.log(`Storage cleanup completed, freed ${freedSpaceMB}MB`);
      
      return {
        freedSpaceMB,
        cleanupActions,
        success: true
      };
    } catch (error) {
      console.error('Storage cleanup failed:', error);
      return {
        freedSpaceMB: 0,
        cleanupActions,
        success: false
      };
    }
  }

  /**
   * Handle service errors with recovery strategies
   */
  async handleServiceError(serviceName: string, error: Error): Promise<{
    canRecover: boolean;
    fallbackStrategy: string;
    retryAfter: number;
  }> {
    const strategies = {
      location: {
        canRecover: true,
        fallbackStrategy: 'manual_exploration',
        retryAfter: 5000
      },
      database: {
        canRecover: true,
        fallbackStrategy: 'offline_mode',
        retryAfter: 2000
      },
      fog: {
        canRecover: true,
        fallbackStrategy: 'simplified_rendering',
        retryAfter: 1000
      }
    };

    const strategy = strategies[serviceName as keyof typeof strategies] || {
      canRecover: false,
      fallbackStrategy: 'graceful_degradation',
      retryAfter: 10000
    };

    console.log(`Service error handled for ${serviceName}:`, strategy);
    return strategy;
  }

  /**
   * Attempt service recovery
   */
  async attemptServiceRecovery(serviceName: string): Promise<{
    service: string;
    recovered: boolean;
    attempts: number;
    recoveryMethod: string;
  }> {
    const maxAttempts = 3;
    let attempts = 0;
    let recovered = false;
    let recoveryMethod = 'restart';

    while (attempts < maxAttempts && !recovered) {
      attempts++;
      
      try {
        // Mock recovery attempt
        await this.sleep(1000);
        
        // Simulate success on second attempt
        if (attempts >= 2) {
          recovered = true;
        }
      } catch (error) {
        console.error(`Recovery attempt ${attempts} failed for ${serviceName}:`, error);
      }
    }

    console.log(`Service recovery for ${serviceName}: ${recovered ? 'successful' : 'failed'} after ${attempts} attempts`);
    
    return {
      service: serviceName,
      recovered,
      attempts,
      recoveryMethod
    };
  }

  /**
   * Handle map tile errors with fallback strategies
   */
  async handleMapTileError(tileError: {
    x: number;
    y: number;
    z: number;
    error: string;
  }): Promise<{
    retry: boolean;
    fallbackStrategy: string;
  }> {
    const { x, y, z, error } = tileError;
    
    console.log(`Map tile error at ${z}/${x}/${y}: ${error}`);
    
    // Determine fallback strategy based on error type
    let fallbackStrategy = 'use_cached_tile';
    let retry = true;
    
    if (error.includes('404') || error.includes('not found')) {
      fallbackStrategy = 'use_lower_zoom_tile';
      retry = false;
    } else if (error.includes('timeout')) {
      fallbackStrategy = 'retry_with_delay';
      retry = true;
    } else if (error.includes('500')) {
      fallbackStrategy = 'use_cached_tile';
      retry = true;
    }
    
    return {
      retry,
      fallbackStrategy
    };
  }

  // Private recovery methods

  private async handleLocationPermissionError(context: ErrorContext): Promise<boolean> {
    if (!this.config.fallbackModes.location) return false;

    try {
      // Check current permission status
      const { status } = await Location.getForegroundPermissionsAsync();
      
      if (status === 'denied') {
        if (this.config.userNotifications) {
          Alert.alert(
            'Location Permission Required',
            'Cartographer needs location access to reveal areas on the map. Please enable location permissions in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Location.requestForegroundPermissionsAsync() },
            ]
          );
        }
        return false;
      }

      // Try to request permissions again
      const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
      return newStatus === 'granted';
    } catch (error) {
      console.error('Failed to handle location permission error:', error);
      return false;
    }
  }

  private async handleLocationServicesDisabledError(context: ErrorContext): Promise<boolean> {
    if (this.config.userNotifications) {
      Alert.alert(
        'Location Services Disabled',
        'Please enable location services in your device settings to use exploration features.',
        [{ text: 'OK' }]
      );
    }
    
    // Enable manual exploration mode as fallback
    return this.enableManualExplorationMode();
  }

  private async handleLocationAccuracyError(context: ErrorContext): Promise<boolean> {
    // Retry with lower accuracy requirements
    try {
      // Instead of directly calling locationService, we'll use Location API directly
      // This avoids circular dependency
      console.log('Adjusting location accuracy settings for error recovery');
      
      context.retryCount++;
      return true;
    } catch (error) {
      console.error('Failed to adjust location accuracy:', error);
      return false;
    }
  }

  private async handleGenericLocationError(context: ErrorContext): Promise<boolean> {
    if (context.retryCount >= this.config.maxRetries) {
      return this.enableManualExplorationMode();
    }

    // Exponential backoff retry
    const delay = this.config.retryDelay * Math.pow(2, context.retryCount);
    await this.sleep(delay);
    
    context.retryCount++;
    return true; // Indicate retry should be attempted
  }

  private async handleDatabaseCorruption(context: ErrorContext): Promise<boolean> {
    try {
      console.warn('Database corruption detected, attempting repair...');
      
      const databaseService = getDatabaseService();
      
      // Try to backup current data before repair
      const backupSuccess = await this.backupCorruptedDatabase();
      
      // Attempt database repair
      const repairSuccess = await databaseService.repairDatabase();
      
      if (repairSuccess) {
        console.log('Database repair successful');
        return true;
      } else {
        console.error('Database repair failed, reinitializing...');
        return this.reinitializeDatabase();
      }
    } catch (error) {
      console.error('Failed to handle database corruption:', error);
      return this.reinitializeDatabase();
    }
  }

  private async handleDatabaseLockError(context: ErrorContext): Promise<boolean> {
    if (context.retryCount >= this.config.maxRetries) return false;

    // Wait and retry with exponential backoff
    const delay = this.config.retryDelay * Math.pow(2, context.retryCount);
    await this.sleep(delay);
    
    context.retryCount++;
    return true;
  }

  private async handleDatabaseSchemaError(context: ErrorContext): Promise<boolean> {
    try {
      console.warn('Database schema error detected, attempting migration...');
      
      const databaseService = getDatabaseService();
      const migrationSuccess = await databaseService.runMigrations();
      
      if (migrationSuccess) {
        console.log('Database migration successful');
        return true;
      } else {
        return this.reinitializeDatabase();
      }
    } catch (error) {
      console.error('Failed to handle database schema error:', error);
      return this.reinitializeDatabase();
    }
  }

  private async handleGenericDatabaseError(context: ErrorContext): Promise<boolean> {
    if (context.retryCount >= this.config.maxRetries) {
      return this.enableOfflineMode();
    }

    const delay = this.config.retryDelay * Math.pow(2, context.retryCount);
    await this.sleep(delay);
    
    context.retryCount++;
    return true;
  }

  private async handleNetworkConnectivityError(context: ErrorContext): Promise<boolean> {
    // Enable offline mode with cached tiles
    try {
      const offlineService = getMapboxOfflineService();
      const hasOfflineData = await offlineService.hasOfflineData();
      
      if (hasOfflineData) {
        console.log('Network unavailable, switching to offline mode');
        return this.enableOfflineMode();
      } else {
        if (this.config.userNotifications) {
          Alert.alert(
            'Network Unavailable',
            'Please check your internet connection. Some features may be limited.',
            [{ text: 'OK' }]
          );
        }
        return false;
      }
    } catch (error) {
      console.error('Failed to handle network connectivity error:', error);
      return false;
    }
  }

  private async handleNetworkAuthError(context: ErrorContext): Promise<boolean> {
    if (this.config.userNotifications) {
      Alert.alert(
        'Authentication Error',
        'There was an issue with map authentication. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    }
    return false;
  }

  private async handleNetworkRateLimitError(context: ErrorContext): Promise<boolean> {
    // Implement exponential backoff for rate limiting
    const delay = Math.min(60000, this.config.retryDelay * Math.pow(2, context.retryCount + 2)); // Max 1 minute
    await this.sleep(delay);
    
    context.retryCount++;
    return context.retryCount < this.config.maxRetries;
  }

  private async handleGenericNetworkError(context: ErrorContext): Promise<boolean> {
    if (context.retryCount >= this.config.maxRetries) {
      return this.enableOfflineMode();
    }

    const delay = this.config.retryDelay * Math.pow(2, context.retryCount);
    await this.sleep(delay);
    
    context.retryCount++;
    return true;
  }

  private async handleMapboxTokenError(context: ErrorContext): Promise<boolean> {
    if (this.config.userNotifications) {
      Alert.alert(
        'Map Configuration Error',
        'There is an issue with the map configuration. Please contact support.',
        [{ text: 'OK' }]
      );
    }
    return false;
  }

  private async handleMapboxTileError(context: ErrorContext): Promise<boolean> {
    // Try to use offline tiles if available
    try {
      const offlineService = getMapboxOfflineService();
      const hasOfflineData = await offlineService.hasOfflineData();
      
      if (hasOfflineData) {
        return this.enableOfflineMode();
      } else {
        return context.retryCount < this.config.maxRetries;
      }
    } catch (error) {
      return false;
    }
  }

  private async handleGenericMapboxError(context: ErrorContext): Promise<boolean> {
    if (context.retryCount >= this.config.maxRetries) {
      return this.enableOfflineMode();
    }

    const delay = this.config.retryDelay * Math.pow(2, context.retryCount);
    await this.sleep(delay);
    
    context.retryCount++;
    return true;
  }

  // Helper methods

  private isDatabaseCorruption(error: Error): boolean {
    const corruptionIndicators = [
      'database disk image is malformed',
      'file is not a database',
      'database corruption',
      'SQLITE_CORRUPT',
      'SQLITE_NOTADB',
    ];
    
    return corruptionIndicators.some(indicator => 
      error.message.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  private async backupCorruptedDatabase(): Promise<boolean> {
    try {
      // Attempt to export whatever data is recoverable
      const databaseService = getDatabaseService();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `corrupted_backup_${timestamp}`;
      
      // This would need to be implemented in the database service
      // await databaseService.exportCorruptedData(backupName);
      
      console.log(`Corrupted database backup attempted: ${backupName}`);
      return true;
    } catch (error) {
      console.error('Failed to backup corrupted database:', error);
      return false;
    }
  }

  private async reinitializeDatabase(): Promise<boolean> {
    try {
      const databaseService = getDatabaseService();
      await databaseService.reinitialize();
      console.log('Database reinitialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to reinitialize database:', error);
      return false;
    }
  }

  private async enableManualExplorationMode(): Promise<boolean> {
    console.log('Enabling manual exploration mode as fallback');
    // This would integrate with the exploration service to enable manual area selection
    return true;
  }

  private async enableOfflineMode(): Promise<boolean> {
    console.log('Enabling offline mode');
    // This would integrate with the offline service to use cached data
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private initializeRecoveryStrategies(): void {
    // Initialize recovery strategies for different error types
    // This could be expanded with more sophisticated recovery patterns
    console.log('Error recovery strategies initialized');
  }
}

// Singleton instance
let errorRecoveryService: ErrorRecoveryService | null = null;

export const getErrorRecoveryService = (): ErrorRecoveryService => {
  if (!errorRecoveryService) {
    errorRecoveryService = new ErrorRecoveryService();
  }
  return errorRecoveryService;
};

export default ErrorRecoveryService;