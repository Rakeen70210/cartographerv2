import { getDatabaseService, ExploredArea, UserStats, Achievement } from '../database/services';

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

const BACKUP_PREFIX = 'cartographer_backup_';
const BACKUP_INDEX_KEY = 'cartographer_backup_index';

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage ?? null;
};

const readStorageJSON = <T,>(key: string, fallback: T): T => {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed to read storage key ${key}:`, error);
    return fallback;
  }
};

const writeStorageJSON = (key: string, value: unknown): void => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to write storage key ${key}:`, error);
  }
};

export class BackupService {
  private static instance: BackupService | null = null;
  private databaseService = getDatabaseService();

  private constructor() {}

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  async createBackup(options: BackupOptions = {}): Promise<string> {
    const {
      includeMetadata = true,
    } = options;

    const exportedData = await this.databaseService.exportData();
    const backupData: BackupData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      exploredAreas: exportedData.exploredAreas,
      userStats: exportedData.userStats,
      achievements: exportedData.achievements,
      metadata: {
        totalAreas: exportedData.exploredAreas.length,
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0',
      },
    };

    const payload = includeMetadata ? backupData : { ...backupData, metadata: backupData.metadata };
    const key = `${BACKUP_PREFIX}${backupData.timestamp}`;
    writeStorageJSON(key, payload);
    this.updateIndex(key);

    return key;
  }

  async exportBackup(options: BackupOptions = {}): Promise<void> {
    const key = await this.createBackup(options);
    const backup = await this.getBackupInfo(key);
    if (!backup) {
      throw new Error('Backup content unavailable');
    }

    if (typeof document === 'undefined') {
      return;
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${key.replace(BACKUP_PREFIX, 'cartographer-backup-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  validateBackupData(backupData: any): BackupValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!backupData?.version) errors.push('Missing backup version');
    if (!backupData?.timestamp) errors.push('Missing backup timestamp');
    if (!Array.isArray(backupData?.exploredAreas)) errors.push('Invalid explored areas data');
    if (!Array.isArray(backupData?.achievements)) errors.push('Invalid achievements data');

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async importBackup(options: RestoreOptions = {}): Promise<void> {
    if (typeof document === 'undefined') {
      throw new Error('Import is not available in this environment');
    }

    const file = await this.pickJsonFile();
    const contents = await file.text();
    await this.restoreFromContent(contents, options);
  }

  async restoreFromFile(filePath: string, options: RestoreOptions = {}): Promise<void> {
    const backupData = readStorageJSON<BackupData | null>(filePath, null);
    if (!backupData) {
      throw new Error('Backup file not found');
    }
    await this.restoreData(backupData, options.mergeMode ?? 'replace', options);
  }

  async listBackupFiles(): Promise<Array<{ name: string; path: string; size: number; modifiedAt: Date }>> {
    const storage = getStorage();
    if (!storage) return [];

    const keys = Object.keys(storage).filter(key => key.startsWith(BACKUP_PREFIX));
    const files = keys.map(key => {
      const raw = storage.getItem(key) ?? '';
      return {
        name: key.replace(BACKUP_PREFIX, 'cartographer-backup-') + '.json',
        path: key,
        size: raw.length,
        modifiedAt: new Date(key.replace(BACKUP_PREFIX, '') || Date.now()),
      };
    });

    return files.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
  }

  async deleteBackupFile(filePath: string): Promise<void> {
    const storage = getStorage();
    if (!storage) return;
    storage.removeItem(filePath);
    this.removeFromIndex(filePath);
  }

  async getBackupInfo(filePath: string): Promise<BackupData | null> {
    return readStorageJSON<BackupData | null>(filePath, null);
  }

  async cleanupOldBackups(maxBackups: number = 10): Promise<void> {
    const files = await this.listBackupFiles();
    if (files.length <= maxBackups) return;

    const filesToDelete = files.slice(maxBackups);
    await Promise.all(filesToDelete.map(file => this.deleteBackupFile(file.path)));
  }

  private async restoreFromContent(contents: string, options: RestoreOptions): Promise<void> {
    const backupData: BackupData = JSON.parse(contents);
    await this.restoreData(backupData, options.mergeMode ?? 'replace', options);
  }

  private async restoreData(
    backupData: BackupData,
    mergeMode: 'replace' | 'merge' | 'skip_existing',
    options: RestoreOptions
  ): Promise<void> {
    const {
      validateBeforeRestore = true,
      createBackupBeforeRestore = true,
    } = options;

    if (validateBeforeRestore) {
      const validation = this.validateBackupData(backupData);
      if (!validation.isValid) {
        throw new Error(`Invalid backup data: ${validation.errors.join(', ')}`);
      }
    }

    if (createBackupBeforeRestore) {
      await this.createBackup({ validateIntegrity: false });
    }

    await this.databaseService.withTransaction(async () => {
      if (mergeMode === 'replace') {
        await this.databaseService.importData({
          exploredAreas: backupData.exploredAreas,
          userStats: backupData.userStats,
          achievements: backupData.achievements,
        });
      } else {
        await this.mergeBackupData(backupData);
      }
    });
  }

  private async mergeBackupData(backupData: BackupData): Promise<void> {
    const existingData = await this.databaseService.exportData();

    const existingAreas = new Map(
      existingData.exploredAreas.map(area => [`${area.latitude}_${area.longitude}_${area.explored_at}`, area])
    );

    const newAreas = backupData.exploredAreas.filter(area =>
      !existingAreas.has(`${area.latitude}_${area.longitude}_${area.explored_at}`)
    );

    for (const area of newAreas) {
      await this.databaseService.createExploredArea(area);
    }

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
        ),
      };
      await this.databaseService.updateUserStats(mergedStats);
    } else if (backupData.userStats) {
      await this.databaseService.updateUserStats(backupData.userStats);
    }

    const existingAchievements = new Map(
      existingData.achievements.map(achievement => [`${achievement.type}_${achievement.name}`, achievement])
    );

    const newAchievements = backupData.achievements.filter(achievement =>
      !existingAchievements.has(`${achievement.type}_${achievement.name}`)
    );

    for (const achievement of newAchievements) {
      await this.databaseService.createAchievement(achievement);
    }
  }

  private async pickJsonFile(): Promise<File> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) {
          resolve(file);
        } else {
          reject(new Error('No file selected'));
        }
      };
      input.click();
    });
  }

  private updateIndex(key: string): void {
    const index = readStorageJSON<string[]>(BACKUP_INDEX_KEY, []);
    if (!index.includes(key)) {
      index.unshift(key);
      writeStorageJSON(BACKUP_INDEX_KEY, index);
    }
  }

  private removeFromIndex(key: string): void {
    const index = readStorageJSON<string[]>(BACKUP_INDEX_KEY, []);
    writeStorageJSON(BACKUP_INDEX_KEY, index.filter(item => item !== key));
  }
}

export const getBackupService = (): BackupService => {
  return BackupService.getInstance();
};
