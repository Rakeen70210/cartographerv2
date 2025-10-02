// Services barrel export
export { LocationService, locationService, getLocationService } from './locationService';
export { ExplorationService, explorationService } from './explorationService';
export { 
  BACKGROUND_LOCATION_TASK, 
  processBackgroundLocations,
  getBackgroundQueueStatus,
  forceProcessBackgroundQueue,
  clearBackgroundQueue 
} from './taskManager';
export { BackgroundLocationService, backgroundLocationService } from './backgroundLocationService';
export { FogService, getFogService } from './fogService';
export { FogLocationIntegrationService, fogLocationIntegrationService } from './fogLocationIntegrationService';
export { FogDissipationService, fogDissipationService } from './fogDissipationService';
export { StatisticsService, getStatisticsService } from './statisticsService';
export { AchievementsService, getAchievementsService } from './achievementsService';
export { BackupService, getBackupService } from './backupService';
export { OfflineService, getOfflineService } from './offlineService';
export { MapboxOfflineService, getMapboxOfflineService } from './mapboxOfflineService';
export { DeviceCapabilityService, getDeviceCapabilityService } from './deviceCapabilityService';
export { PerformanceMonitorService, getPerformanceMonitorService } from './performanceMonitorService';
export { MemoryManagementService, getMemoryManagementService } from './memoryManagementService';
export { ErrorRecoveryService, getErrorRecoveryService } from './errorRecoveryService';

// Initialize cross-service dependencies to avoid circular imports
export const initializeServices = () => {
  try {
    // Import the services dynamically to avoid circular dependency issues
    const { getErrorRecoveryService } = require('./errorRecoveryService');
    const { locationService } = require('./locationService');
    const errorRecoverySvc = getErrorRecoveryService();
    
    // Set up the dependency after both services are created
    locationService.setErrorRecoveryService(errorRecoverySvc);
    
    console.log('Services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
  }
};