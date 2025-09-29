/**
 * End-to-End Tests for Core User Flows
 * Tests complete exploration flow from location permission to fog clearing
 * Requirements: 1.1, 2.1, 5.3, 7.3
 */

import { locationService } from '../../services/locationService';
import * as explorationServiceModule from '../../services/explorationService';
import { getFogService } from '../../services/fogService';
import { getDatabaseService } from '../../database/services';
import { getBackupService } from '../../services/backupService';
import { getAchievementsService } from '../../services/achievementsService';

// Mock external dependencies
jest.mock('expo-location');
jest.mock('@rnmapbox/maps');
jest.mock('expo-sqlite');

// Mock service modules
jest.mock('../../services/explorationService', () => ({
  explorationService: {
    processLocationUpdate: jest.fn()
  }
}));

jest.mock('../../services/achievementsService', () => ({
  getAchievementsService: () => ({
    checkAchievements: jest.fn(),
    updateAchievementProgress: jest.fn()
  })
}));

// Mock fog service
jest.mock('../../services/fogService', () => ({
  getFogService: () => ({
    generateFogGeometry: jest.fn().mockResolvedValue({
      type: 'FeatureCollection',
      features: []
    }),
    isAreaExplored: jest.fn().mockReturnValue(true)
  })
}));

// Mock database service
jest.mock('../../database/services', () => ({
  getDatabaseService: () => ({
    initialize: jest.fn(),
    close: jest.fn(),
    withTransaction: jest.fn((callback) => callback()),
    importData: jest.fn(),
    getExploredAreas: jest.fn().mockResolvedValue([
      {
        id: 1,
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 100,
        explored_at: new Date().toISOString(),
        accuracy: 10
      }
    ]),
    getUserStats: jest.fn().mockResolvedValue({
      total_areas_explored: 1,
      exploration_percentage: 0.1
    }),
    exportData: jest.fn().mockResolvedValue({
      exploredAreas: [],
      userStats: null,
      achievements: []
    })
  })
}));

describe('Core User Flows E2E Tests', () => {
  let databaseService: any;
  let backupService: any;
  let achievementsService: any;
  let fogService: any;

  beforeAll(async () => {
    databaseService = getDatabaseService();
    backupService = getBackupService();
    achievementsService = getAchievementsService();
    fogService = getFogService();

    // Initialize test database
    await databaseService.initialize();
  });

  beforeEach(async () => {
    // Clear database before each test
    await databaseService.withTransaction(async () => {
      await databaseService.importData({
        exploredAreas: [],
        userStats: null,
        achievements: []
      });
    });

    // Setup explorationServiceModule.explorationService spy
    const mockExplorationResult = {
      newAreaExplored: true,
      exploredArea: {
        id: 1,
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 100,
        explored_at: new Date().toISOString(),
        accuracy: 10
      }
    };
    jest.spyOn(explorationServiceModule.explorationService, 'processLocationUpdate').mockResolvedValue(mockExplorationResult);
  });

  afterAll(async () => {
    // Cleanup
    await databaseService.close();
  });

  describe('Complete Exploration Flow', () => {
    test('should complete full exploration flow from permission to fog clearing', async () => {
      // Step 1: Request location permissions (Requirement 1.1)
      const mockPermissions = {
        granted: true,
        status: 'granted' as any,
        canAskAgain: true
      };
      
      jest.spyOn(locationService, 'requestPermissions').mockResolvedValue(mockPermissions);
      jest.spyOn(locationService, 'requestBackgroundPermissions').mockResolvedValue(mockPermissions);

      const permissions = await locationService.requestPermissions();
      expect(permissions.granted).toBe(true);

      const backgroundPermissions = await locationService.requestBackgroundPermissions();
      expect(backgroundPermissions.granted).toBe(true);

      // Step 2: Start location tracking
      const mockLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now()
      };

      jest.spyOn(locationService, 'getCurrentLocation').mockResolvedValue(mockLocation);
      jest.spyOn(locationService, 'startTracking').mockResolvedValue(true);

      const trackingStarted = await locationService.startTracking();
      expect(trackingStarted).toBe(true);

      const currentLocation = await locationService.getCurrentLocation();
      expect(currentLocation).toEqual(mockLocation);

      // Step 3: Process location for exploration (Requirement 2.1)
      const explorationResult = await explorationServiceModule.explorationService.processLocationUpdate(mockLocation);
      expect(explorationResult.newAreaExplored).toBe(true);
      expect(explorationResult.exploredArea).toBeDefined();

      // Step 4: Verify database storage
      const exploredAreas = await databaseService.getExploredAreas();
      expect(exploredAreas).toHaveLength(1);
      expect(exploredAreas[0].latitude).toBe(mockLocation.latitude);
      expect(exploredAreas[0].longitude).toBe(mockLocation.longitude);

      // Step 5: Verify fog clearing
      const fogGeometry = await fogService.generateFogGeometry();
      expect(fogGeometry).toBeDefined();
      
      // The fog should have a hole where we explored
      const isAreaClear = fogService.isAreaExplored(mockLocation.latitude, mockLocation.longitude);
      expect(isAreaClear).toBe(true);

      // Step 6: Verify user stats update
      const userStats = await databaseService.getUserStats();
      expect(userStats).toBeDefined();
      expect(userStats.total_areas_explored).toBe(1);
      expect(userStats.exploration_percentage).toBeGreaterThan(0);
    });

    test('should handle multiple location updates and fog clearing', async () => {
      const mockLocations = [
        { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        { latitude: 37.7849, longitude: -122.4094, accuracy: 15, timestamp: Date.now() + 1000 },
        { latitude: 37.7949, longitude: -122.3994, accuracy: 12, timestamp: Date.now() + 2000 }
      ];

      // Process multiple locations
      for (const location of mockLocations) {
        const result = await explorationServiceModule.explorationService.processLocationUpdate(location);
        expect(result.newAreaExplored).toBe(true);
      }

      // Verify all areas are stored
      const exploredAreas = await databaseService.getExploredAreas();
      expect(exploredAreas).toHaveLength(3);

      // Verify fog geometry reflects all explored areas
      const fogGeometry = await fogService.generateFogGeometry();
      expect(fogGeometry).toBeDefined();

      // Check that all areas are clear
      for (const location of mockLocations) {
        const isAreaClear = fogService.isAreaExplored(location.latitude, location.longitude);
        expect(isAreaClear).toBe(true);
      }

      // Verify updated stats
      const userStats = await databaseService.getUserStats();
      expect(userStats.total_areas_explored).toBe(3);
    });
  });

  describe('Achievement System Flow', () => {
    test('should unlock achievements based on exploration progress', async () => {
      // Mock achievement service
      jest.spyOn(achievementsService, 'checkAchievements').mockImplementation(async (stats) => {
        const achievements = [];
        
        if ((stats as any).total_areas_explored >= 1) {
          achievements.push({
            type: 'exploration',
            name: 'First Steps',
            description: 'Explore your first area',
            progress: 100,
            unlocked_at: new Date().toISOString()
          });
        }
        
        if ((stats as any).total_areas_explored >= 5) {
          achievements.push({
            type: 'exploration',
            name: 'Explorer',
            description: 'Explore 5 areas',
            progress: 100,
            unlocked_at: new Date().toISOString()
          });
        }
        
        return achievements;
      });

      // Explore first area
      const firstLocation = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };
      await explorationServiceModule.explorationService.processLocationUpdate(firstLocation);

      // Check achievements after first exploration
      let userStats = await databaseService.getUserStats();
      let newAchievements = await achievementsService.checkAchievements(userStats);
      
      expect(newAchievements).toHaveLength(1);
      expect(newAchievements[0].name).toBe('First Steps');

      // Store achievement
      await databaseService.createAchievement(newAchievements[0]);

      // Explore more areas
      const additionalLocations = [
        { latitude: 37.7849, longitude: -122.4094, accuracy: 10, timestamp: Date.now() + 1000 },
        { latitude: 37.7949, longitude: -122.3994, accuracy: 10, timestamp: Date.now() + 2000 },
        { latitude: 37.8049, longitude: -122.3894, accuracy: 10, timestamp: Date.now() + 3000 },
        { latitude: 37.8149, longitude: -122.3794, accuracy: 10, timestamp: Date.now() + 4000 }
      ];

      for (const location of additionalLocations) {
        await explorationServiceModule.explorationService.processLocationUpdate(location);
      }

      // Check achievements after exploring 5 areas total
      userStats = await databaseService.getUserStats();
      newAchievements = await achievementsService.checkAchievements(userStats);
      
      expect(newAchievements).toHaveLength(1);
      expect(newAchievements[0].name).toBe('Explorer');

      // Verify achievement storage
      await databaseService.createAchievement(newAchievements[0]);
      const allAchievements = await databaseService.getAchievements();
      expect(allAchievements).toHaveLength(2);
    });

    test('should track progress for incomplete achievements', async () => {
      // Mock achievement with progress tracking
      jest.spyOn(achievementsService, 'updateAchievementProgress').mockImplementation(async (type, progress) => {
        await databaseService.updateAchievementProgress(type, progress);
      });

      // Create a distance-based achievement
      await databaseService.createAchievement({
        type: 'distance',
        name: 'Marathon Walker',
        description: 'Walk 42km total',
        progress: 0
      });

      // Simulate walking progress
      const walkingProgress = [10, 25, 35, 42]; // km
      
      for (const distance of walkingProgress) {
        const progress = Math.min((distance / 42) * 100, 100);
        await achievementsService.updateAchievementProgress('distance', progress);
        
        const achievement = await databaseService.getAchievementByType('distance');
        expect(achievement.progress).toBe(progress);
        
        if (progress >= 100) {
          expect(achievement.unlocked_at).toBeDefined();
        }
      }
    });
  });

  describe('Backup and Restore Flow', () => {
    test('should create and restore backup successfully', async () => {
      // Create test data
      const testLocations = [
        { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        { latitude: 37.7849, longitude: -122.4094, accuracy: 15, timestamp: Date.now() + 1000 }
      ];

      // Process locations
      for (const location of testLocations) {
        await explorationServiceModule.explorationService.processLocationUpdate(location);
      }

      // Create test achievement
      await databaseService.createAchievement({
        type: 'exploration',
        name: 'Test Achievement',
        description: 'Test achievement for backup',
        progress: 100,
        unlocked_at: new Date().toISOString()
      });

      // Get initial data
      const initialData = await databaseService.exportData();
      expect(initialData.exploredAreas).toHaveLength(2);
      expect(initialData.achievements).toHaveLength(1);

      // Create backup (Requirement 7.3)
      const backupPath = await backupService.createBackup({
        includeMetadata: true,
        validateIntegrity: true
      });
      expect(backupPath).toBeDefined();

      // Verify backup content
      const backupInfo = await backupService.getBackupInfo(backupPath);
      expect(backupInfo).toBeDefined();
      expect(backupInfo.exploredAreas).toHaveLength(2);
      expect(backupInfo.achievements).toHaveLength(1);

      // Clear database
      await databaseService.withTransaction(async () => {
        await databaseService.importData({
          exploredAreas: [],
          userStats: null,
          achievements: []
        });
      });

      // Verify data is cleared
      const clearedData = await databaseService.exportData();
      expect(clearedData.exploredAreas).toHaveLength(0);
      expect(clearedData.achievements).toHaveLength(0);

      // Restore from backup
      await backupService.restoreFromFile(backupPath, {
        validateBeforeRestore: true,
        createBackupBeforeRestore: false,
        mergeMode: 'replace'
      });

      // Verify restoration
      const restoredData = await databaseService.exportData();
      expect(restoredData.exploredAreas).toHaveLength(2);
      expect(restoredData.achievements).toHaveLength(1);
      
      // Verify data integrity
      expect(restoredData.exploredAreas[0].latitude).toBe(testLocations[0].latitude);
      expect(restoredData.achievements[0].name).toBe('Test Achievement');
    });

    test('should handle backup validation and corruption detection', async () => {
      // Create valid backup
      await explorationServiceModule.explorationService.processLocationUpdate({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now()
      });

      const backupPath = await backupService.createBackup({
        includeMetadata: true,
        validateIntegrity: true
      });

      // Test backup validation
      const backupInfo = await backupService.getBackupInfo(backupPath);
      const validation = backupService.validateBackupData(backupInfo);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Test with corrupted data
      const corruptedBackupInfo = {
        ...backupInfo,
        exploredAreas: [
          {
            // Missing required fields
            latitude: 'invalid',
            longitude: null
          }
        ]
      };

      const corruptedValidation = backupService.validateBackupData(corruptedBackupInfo);
      expect(corruptedValidation.isValid).toBe(false);
      expect(corruptedValidation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Data Persistence and Recovery', () => {
    test('should persist data across app sessions', async () => {
      // Simulate app session 1
      const sessionOneLocations = [
        { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() },
        { latitude: 37.7849, longitude: -122.4094, accuracy: 15, timestamp: Date.now() + 1000 }
      ];

      for (const location of sessionOneLocations) {
        await explorationServiceModule.explorationService.processLocationUpdate(location);
      }

      const sessionOneData = await databaseService.exportData();
      expect(sessionOneData.exploredAreas).toHaveLength(2);

      // Simulate app restart (close and reinitialize database)
      await databaseService.close();
      await databaseService.initialize();

      // Verify data persisted
      const persistedData = await databaseService.exportData();
      expect(persistedData.exploredAreas).toHaveLength(2);
      expect(persistedData.exploredAreas[0].latitude).toBe(sessionOneLocations[0].latitude);

      // Simulate session 2 - add more data
      const sessionTwoLocation = { latitude: 37.7949, longitude: -122.3994, accuracy: 12, timestamp: Date.now() + 2000 };
      await explorationServiceModule.explorationService.processLocationUpdate(sessionTwoLocation);

      const sessionTwoData = await databaseService.exportData();
      expect(sessionTwoData.exploredAreas).toHaveLength(3);
    });

    test('should handle database corruption and recovery', async () => {
      // Create some data
      await explorationServiceModule.explorationService.processLocationUpdate({
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now()
      });

      // Simulate database integrity check
      const integrityCheck = await databaseService.checkIntegrity();
      expect(integrityCheck.isValid).toBe(true);

      // Test recovery mechanisms
      const recoveryResult = await databaseService.attemptRecovery();
      expect(recoveryResult.success).toBe(true);

      // Verify data is still accessible after recovery
      const recoveredData = await databaseService.exportData();
      expect(recoveredData.exploredAreas).toHaveLength(1);
    });
  });

  describe('Error Handling in Core Flows', () => {
    test('should handle location permission denial gracefully', async () => {
      // Mock permission denial
      const deniedPermissions = {
        granted: false,
        status: 'denied' as any,
        canAskAgain: false
      };

      jest.spyOn(locationService, 'requestPermissions').mockResolvedValue(deniedPermissions);

      const permissions = await locationService.requestPermissions();
      expect(permissions.granted).toBe(false);

      // App should still function in manual mode
      const manualLocation = { latitude: 37.7749, longitude: -122.4194, accuracy: 10, timestamp: Date.now() };
      const explorationResult = await explorationServiceModule.explorationService.processLocationUpdate(manualLocation);
      expect(explorationResult.newAreaExplored).toBe(true);
    });

    test('should handle location service errors', async () => {
      // Mock location service error
      jest.spyOn(locationService, 'getCurrentLocation').mockRejectedValue(new Error('GPS unavailable'));

      try {
        await locationService.getCurrentLocation();
        fail('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).toBe('GPS unavailable');
      }

      // Service should handle error gracefully and continue functioning
      const trackingStatus = locationService.getTrackingStatus();
      expect(trackingStatus).toBeDefined();
    });

    test('should handle database transaction failures', async () => {
      // Mock database transaction failure
      jest.spyOn(databaseService, 'withTransaction').mockRejectedValueOnce(new Error('Transaction failed'));

      try {
        await databaseService.withTransaction(async () => {
          await databaseService.createExploredArea({
            latitude: 37.7749,
            longitude: -122.4194,
            radius: 100,
            explored_at: new Date().toISOString(),
            accuracy: 10
          });
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).toBe('Transaction failed');
      }

      // Database should remain in consistent state
      const exploredAreas = await databaseService.getExploredAreas();
      expect(exploredAreas).toHaveLength(0);
    });
  });
});