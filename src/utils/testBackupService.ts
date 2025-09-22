import { getBackupService } from '../services/backupService';
import { getDatabaseService } from '../database/services';

/**
 * Test utility for backup service functionality
 * This should be used for development testing only
 */
export class BackupServiceTester {
  private backupService = getBackupService();
  private databaseService = getDatabaseService();

  /**
   * Creates test data for backup testing
   */
  async createTestData(): Promise<void> {
    try {
      console.log('Creating test data for backup testing...');

      // Create test explored areas
      const testAreas = [
        {
          latitude: 37.7749,
          longitude: -122.4194,
          radius: 100,
          explored_at: new Date('2024-01-01').toISOString(),
          accuracy: 10
        },
        {
          latitude: 40.7128,
          longitude: -74.0060,
          radius: 150,
          explored_at: new Date('2024-01-15').toISOString(),
          accuracy: 15
        },
        {
          latitude: 51.5074,
          longitude: -0.1278,
          radius: 200,
          explored_at: new Date('2024-02-01').toISOString(),
          accuracy: 20
        }
      ];

      for (const area of testAreas) {
        await this.databaseService.createExploredArea(area);
      }

      // Update user stats
      await this.databaseService.updateUserStats({
        total_areas_explored: testAreas.length,
        total_distance: 5000,
        exploration_percentage: 15.5,
        current_streak: 7,
        longest_streak: 14
      });

      // Create test achievements
      const testAchievements = [
        {
          type: 'exploration',
          name: 'First Steps',
          description: 'Explore your first area',
          progress: 100,
          unlocked_at: new Date('2024-01-01').toISOString()
        },
        {
          type: 'distance',
          name: 'Marathon Walker',
          description: 'Walk 42km total',
          progress: 75,
        },
        {
          type: 'streak',
          name: 'Weekly Explorer',
          description: 'Explore for 7 consecutive days',
          progress: 100,
          unlocked_at: new Date('2024-01-07').toISOString()
        }
      ];

      for (const achievement of testAchievements) {
        await this.databaseService.createAchievement(achievement);
      }

      console.log('Test data created successfully');
    } catch (error) {
      console.error('Failed to create test data:', error);
      throw error;
    }
  }

  /**
   * Tests backup creation functionality
   */
  async testBackupCreation(): Promise<string> {
    try {
      console.log('Testing backup creation...');
      
      const backupPath = await this.backupService.createBackup({
        includeMetadata: true,
        validateIntegrity: true
      });

      console.log(`Backup created successfully at: ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error('Backup creation test failed:', error);
      throw error;
    }
  }

  /**
   * Tests backup validation functionality
   */
  async testBackupValidation(backupPath: string): Promise<void> {
    try {
      console.log('Testing backup validation...');
      
      const backupInfo = await this.backupService.getBackupInfo(backupPath);
      if (!backupInfo) {
        throw new Error('Failed to read backup file');
      }

      const validation = this.backupService.validateBackupData(backupInfo);
      
      console.log('Validation result:', {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings
      });

      if (!validation.isValid) {
        throw new Error(`Backup validation failed: ${validation.errors.join(', ')}`);
      }

      console.log('Backup validation test passed');
    } catch (error) {
      console.error('Backup validation test failed:', error);
      throw error;
    }
  }

  /**
   * Tests backup restore functionality
   */
  async testBackupRestore(backupPath: string): Promise<void> {
    try {
      console.log('Testing backup restore...');
      
      // Get current data count for comparison
      const beforeData = await this.databaseService.exportData();
      console.log('Data before restore:', {
        exploredAreas: beforeData.exploredAreas.length,
        achievements: beforeData.achievements.length
      });

      // Clear some data to test restore
      await this.databaseService.withTransaction(async () => {
        // Delete one explored area
        if (beforeData.exploredAreas.length > 0) {
          const firstArea = beforeData.exploredAreas[0];
          if (firstArea.id) {
            await this.databaseService.deleteExploredArea(firstArea.id);
          }
        }
      });

      // Restore from backup
      await this.backupService.restoreFromFile(backupPath, {
        validateBeforeRestore: true,
        createBackupBeforeRestore: false, // Skip to avoid infinite loop in test
        mergeMode: 'replace'
      });

      // Verify restore
      const afterData = await this.databaseService.exportData();
      console.log('Data after restore:', {
        exploredAreas: afterData.exploredAreas.length,
        achievements: afterData.achievements.length
      });

      if (afterData.exploredAreas.length !== beforeData.exploredAreas.length) {
        throw new Error('Restore did not properly restore explored areas');
      }

      console.log('Backup restore test passed');
    } catch (error) {
      console.error('Backup restore test failed:', error);
      throw error;
    }
  }

  /**
   * Tests backup file management
   */
  async testBackupFileManagement(): Promise<void> {
    try {
      console.log('Testing backup file management...');
      
      // List backup files
      const backupFiles = await this.backupService.listBackupFiles();
      console.log(`Found ${backupFiles.length} backup files`);

      if (backupFiles.length === 0) {
        console.log('No backup files to test management with');
        return;
      }

      // Test getting backup info
      const firstBackup = backupFiles[0];
      const backupInfo = await this.backupService.getBackupInfo(firstBackup.path);
      
      if (!backupInfo) {
        throw new Error('Failed to get backup info');
      }

      console.log('Backup info retrieved:', {
        version: backupInfo.version,
        timestamp: backupInfo.timestamp,
        exploredAreas: backupInfo.exploredAreas.length,
        achievements: backupInfo.achievements.length
      });

      console.log('Backup file management test passed');
    } catch (error) {
      console.error('Backup file management test failed:', error);
      throw error;
    }
  }

  /**
   * Runs all backup tests
   */
  async runAllTests(): Promise<void> {
    try {
      console.log('Starting comprehensive backup service tests...');

      // Create test data
      await this.createTestData();

      // Test backup creation
      const backupPath = await this.testBackupCreation();

      // Test backup validation
      await this.testBackupValidation(backupPath);

      // Test backup restore
      await this.testBackupRestore(backupPath);

      // Test file management
      await this.testBackupFileManagement();

      console.log('All backup service tests passed successfully!');
    } catch (error) {
      console.error('Backup service tests failed:', error);
      throw error;
    }
  }

  /**
   * Cleans up test data
   */
  async cleanupTestData(): Promise<void> {
    try {
      console.log('Cleaning up test data...');
      
      await this.databaseService.withTransaction(async () => {
        // Clear all data
        await this.databaseService.importData({
          exploredAreas: [],
          userStats: null,
          achievements: []
        });
      });

      console.log('Test data cleaned up');
    } catch (error) {
      console.error('Failed to cleanup test data:', error);
      throw error;
    }
  }
}

// Export test utility
export const createBackupServiceTester = (): BackupServiceTester => {
  return new BackupServiceTester();
};

// Development helper function
export const runBackupTests = async (): Promise<void> => {
  const tester = createBackupServiceTester();
  await tester.runAllTests();
};