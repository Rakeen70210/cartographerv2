import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDatabaseService, ExploredArea, UserStats, Achievement } from '../database/services';
import { getDatabaseManager } from '../database/database';

export interface BackupData {
  version: string;
  timestamp: string;
  exploredAreas: ExploredArea[];
  userStats: UserStats | null;
  achievements: Achievement[];
  metadata: {
    totalAreas: number;
    exportedAt: string;
    appVersion: string;
  };
}

export interface BackupValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BackupOptions {
  includeMetadata?: boolean;
  compress?: boolean;
  validateIntegrity?: boolean;
}

export interface RestoreOptions {
  validateBeforeRestore?: boolean;
  createBackupBeforeRestore?: boolean;
  mergeMode?: 'replace' | 'merge' | 'skip_existing';
}

export class BackupService {
  private static instance: BackupService | null = null;
  private databaseService = getDatabaseService();
  private databaseManager = getDatabaseManager();

  private constructor() {}

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  /**
   * Creates a backup of all user data
   */
  async createBackup(options: BackupOptions = {}): Promise<string> {
    try {
      const {
        includeMetadata = true,
        validateIntegrity = true
      } = options;

      // Validate database integrity before backup
      if (validateIntegrity) {
        const integrityCheck = await this.databaseService.performIntegrityCheck();
        if (!integrityCheck.isValid) {
          throw new Error(`Database integrity check failed: ${integrityCheck.issues.join(', ')}`);
        }
      }

      // Export all data
      const exportedData = await this.databaseService.exportData();
      
      // Create backup data structure
      const backupData: BackupData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        exploredAreas: exportedData.exploredAreas,
        userStats: exportedData.userStats,
        achievements: exportedData.achievements,
        metadata: {
          totalAreas: exportedData.exploredAreas.length,
          exportedAt: new Date().toISOString(),
          appVersion: '1.0.0' // This should come from app config
        }
      };

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `cartographer-backup-${timestamp}.json`;
      const filePath = `${FileSystem.documentDirectory}${filename}`;

      // Write backup file
      await FileSystem.writeAsStringAsync(
        filePath,
        JSON.stringify(backupData, null, 2),
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      console.log(`Backup created successfully: ${filename}`);
      return filePath;
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw new Error(`Failed to create backup: ${error}`);
    }
  }

  /**
   * Exports backup file for sharing
   */
  async exportBackup(options: BackupOptions = {}): Promise<void> {
    try {
      const backupPath = await this.createBackup(options);
      
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing is not available on this device');
      }

      // Share the backup file
      await Sharing.shareAsync(backupPath, {
        mimeType: 'application/json',
        dialogTitle: 'Export Cartographer Backup'
      });

      console.log('Backup exported successfully');
    } catch (error) {
      console.error('Failed to export backup:', error);
      throw new Error(`Failed to export backup: ${error}`);
    }
  }

  /**
   * Validates backup data structure and integrity
   */
  validateBackupData(backupData: any): BackupValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check required fields
      if (!backupData.version) {
        errors.push('Missing backup version');
      }

      if (!backupData.timestamp) {
        errors.push('Missing backup timestamp');
      }

      if (!Array.isArray(backupData.exploredAreas)) {
        errors.push('Invalid explored areas data');
      }

      if (!Array.isArray(backupData.achievements)) {
        errors.push('Invalid achievements data');
      }

      // Validate explored areas structure
      if (Array.isArray(backupData.exploredAreas)) {
        backupData.exploredAreas.forEach((area: any, index: number) => {
          if (typeof area.latitude !== 'number' || typeof area.longitude !== 'number') {
            errors.push(`Invalid coordinates in explored area ${index}`);
          }
          if (typeof area.radius !== 'number' || area.radius <= 0) {
            errors.push(`Invalid radius in explored area ${index}`);
          }
          if (!area.explored_at) {
            errors.push(`Missing explored_at in explored area ${index}`);
          }
        });
      }

      // Validate user stats structure
      if (backupData.userStats) {
        const stats = backupData.userStats;
        if (typeof stats.total_areas_explored !== 'number') {
          warnings.push('Invalid total_areas_explored in user stats');
        }
        if (typeof stats.exploration_percentage !== 'number') {
          warnings.push('Invalid exploration_percentage in user stats');
        }
      }

      // Validate achievements structure
      if (Array.isArray(backupData.achievements)) {
        backupData.achievements.forEach((achievement: any, index: number) => {
          if (!achievement.type || !achievement.name) {
            errors.push(`Missing required fields in achievement ${index}`);
          }
          if (typeof achievement.progress !== 'number') {
            errors.push(`Invalid progress in achievement ${index}`);
          }
        });
      }

      // Check version compatibility
      if (backupData.version && backupData.version !== '1.0.0') {
        warnings.push(`Backup version ${backupData.version} may not be fully compatible`);
      }

      // Check data consistency
      if (backupData.userStats && Array.isArray(backupData.exploredAreas)) {
        const actualAreas = backupData.exploredAreas.length;
        const reportedAreas = backupData.userStats.total_areas_explored;
        if (actualAreas !== reportedAreas) {
          warnings.push(`Mismatch between actual areas (${actualAreas}) and reported areas (${reportedAreas})`);
        }
      }

    } catch (error) {
      errors.push(`Validation error: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Imports backup from file picker
   */
  async importBackup(options: RestoreOptions = {}): Promise<void> {
    try {
      const {
        validateBeforeRestore = true,
        createBackupBeforeRestore = true,
        mergeMode = 'replace'
      } = options;

      // Pick backup file
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        throw new Error('Backup import cancelled');
      }

      const fileUri = result.assets[0].uri;
      await this.restoreFromFile(fileUri, options);

    } catch (error) {
      console.error('Failed to import backup:', error);
      throw new Error(`Failed to import backup: ${error}`);
    }
  }

  /**
   * Restores data from backup file
   */
  async restoreFromFile(filePath: string, options: RestoreOptions = {}): Promise<void> {
    try {
      const {
        validateBeforeRestore = true,
        createBackupBeforeRestore = true,
        mergeMode = 'replace'
      } = options;

      // Read backup file
      const backupContent = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.UTF8
      });

      const backupData: BackupData = JSON.parse(backupContent);

      // Validate backup data
      if (validateBeforeRestore) {
        const validation = this.validateBackupData(backupData);
        if (!validation.isValid) {
          throw new Error(`Invalid backup data: ${validation.errors.join(', ')}`);
        }
        
        if (validation.warnings.length > 0) {
          console.warn('Backup validation warnings:', validation.warnings);
        }
      }

      // Create backup before restore if requested
      if (createBackupBeforeRestore) {
        await this.createBackup({ validateIntegrity: false });
        console.log('Pre-restore backup created');
      }

      // Restore data based on merge mode
      await this.restoreData(backupData, mergeMode);

      console.log('Backup restored successfully');
    } catch (error) {
      console.error('Failed to restore from file:', error);
      throw new Error(`Failed to restore from file: ${error}`);
    }
  }

  /**
   * Restores data with specified merge mode
   */
  private async restoreData(backupData: BackupData, mergeMode: 'replace' | 'merge' | 'skip_existing'): Promise<void> {
    try {
      await this.databaseService.withTransaction(async () => {
        if (mergeMode === 'replace') {
          // Replace all data
          await this.databaseService.importData({
            exploredAreas: backupData.exploredAreas,
            userStats: backupData.userStats,
            achievements: backupData.achievements
          });
        } else if (mergeMode === 'merge') {
          // Merge data (add new, update existing)
          await this.mergeBackupData(backupData);
        } else if (mergeMode === 'skip_existing') {
          // Only add new data, skip existing
          await this.mergeBackupDataSkipExisting(backupData);
        }
      });
    } catch (error) {
      console.error('Failed to restore data:', error);
      throw new Error(`Failed to restore data: ${error}`);
    }
  }

  /**
   * Merges backup data with existing data
   */
  private async mergeBackupData(backupData: BackupData): Promise<void> {
    // Get existing data
    const existingData = await this.databaseService.exportData();
    
    // Merge explored areas (avoid duplicates based on location and time)
    const existingAreasMap = new Map(
      existingData.exploredAreas.map(area => 
        [`${area.latitude}_${area.longitude}_${area.explored_at}`, area]
      )
    );

    const newAreas = backupData.exploredAreas.filter(area => 
      !existingAreasMap.has(`${area.latitude}_${area.longitude}_${area.explored_at}`)
    );

    // Add new explored areas
    for (const area of newAreas) {
      await this.databaseService.createExploredArea(area);
    }

    // Merge user stats (take maximum values)
    if (backupData.userStats && existingData.userStats) {
      const mergedStats = {
        total_areas_explored: Math.max(
          backupData.userStats.total_areas_explored,
          existingData.userStats.total_areas_explored
        ),
        total_distance: Math.max(
          backupData.userStats.total_distance,
          existingData.userStats.total_distance
        ),
        exploration_percentage: Math.max(
          backupData.userStats.exploration_percentage,
          existingData.userStats.exploration_percentage
        ),
        current_streak: Math.max(
          backupData.userStats.current_streak,
          existingData.userStats.current_streak
        ),
        longest_streak: Math.max(
          backupData.userStats.longest_streak,
          existingData.userStats.longest_streak
        )
      };
      
      await this.databaseService.updateUserStats(mergedStats);
    } else if (backupData.userStats) {
      await this.databaseService.updateUserStats(backupData.userStats);
    }

    // Merge achievements (avoid duplicates based on type and name)
    const existingAchievementsMap = new Map(
      existingData.achievements.map(achievement => 
        [`${achievement.type}_${achievement.name}`, achievement]
      )
    );

    const newAchievements = backupData.achievements.filter(achievement => 
      !existingAchievementsMap.has(`${achievement.type}_${achievement.name}`)
    );

    for (const achievement of newAchievements) {
      await this.databaseService.createAchievement(achievement);
    }
  }

  /**
   * Merges backup data, skipping existing entries
   */
  private async mergeBackupDataSkipExisting(backupData: BackupData): Promise<void> {
    // Similar to merge but more conservative - only add completely new data
    await this.mergeBackupData(backupData);
  }

  /**
   * Lists available backup files in document directory
   */
  async listBackupFiles(): Promise<Array<{ name: string; path: string; size: number; modifiedAt: Date }>> {
    try {
      const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory!);
      const backupFiles = files.filter(file => file.startsWith('cartographer-backup-') && file.endsWith('.json'));
      
      const fileInfos = await Promise.all(
        backupFiles.map(async (filename) => {
          const filePath = `${FileSystem.documentDirectory}${filename}`;
          const info = await FileSystem.getInfoAsync(filePath);
          
          return {
            name: filename,
            path: filePath,
            size: info.size || 0,
            modifiedAt: new Date(info.modificationTime || 0)
          };
        })
      );

      return fileInfos.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
    } catch (error) {
      console.error('Failed to list backup files:', error);
      return [];
    }
  }

  /**
   * Deletes a backup file
   */
  async deleteBackupFile(filePath: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(filePath);
      console.log(`Backup file deleted: ${filePath}`);
    } catch (error) {
      console.error('Failed to delete backup file:', error);
      throw new Error(`Failed to delete backup file: ${error}`);
    }
  }

  /**
   * Gets backup file information
   */
  async getBackupInfo(filePath: string): Promise<BackupData | null> {
    try {
      const backupContent = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.UTF8
      });

      const backupData: BackupData = JSON.parse(backupContent);
      return backupData;
    } catch (error) {
      console.error('Failed to get backup info:', error);
      return null;
    }
  }

  /**
   * Performs automatic cleanup of old backup files
   */
  async cleanupOldBackups(maxBackups: number = 10): Promise<void> {
    try {
      const backupFiles = await this.listBackupFiles();
      
      if (backupFiles.length > maxBackups) {
        const filesToDelete = backupFiles.slice(maxBackups);
        
        for (const file of filesToDelete) {
          await this.deleteBackupFile(file.path);
        }
        
        console.log(`Cleaned up ${filesToDelete.length} old backup files`);
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }
}

// Export singleton instance
export const getBackupService = (): BackupService => {
  return BackupService.getInstance();
};