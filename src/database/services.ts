import * as SQLite from 'expo-sqlite';
import { getDatabaseManager } from './database';

export interface ExploredArea {
  id?: number;
  latitude: number;
  longitude: number;
  radius: number;
  explored_at: string;
  accuracy?: number;
  created_at?: string;
}

export interface UserStats {
  id: number;
  total_areas_explored: number;
  total_distance: number;
  exploration_percentage: number;
  current_streak: number;
  longest_streak: number;
  updated_at: string;
}

export interface Achievement {
  id?: number;
  type: string;
  name: string;
  description?: string;
  unlocked_at?: string;
  progress: number;
}

export interface SpatialQuery {
  latitude: number;
  longitude: number;
  radius: number; // in kilometers
}

export class DatabaseService {
  private _db: SQLite.SQLiteDatabase | null = null;

  constructor() {
    // Don't initialize database in constructor to avoid circular dependency
  }

  private get db(): SQLite.SQLiteDatabase {
    if (!this._db) {
      this._db = getDatabaseManager().getDatabase();
    }
    return this._db;
  }

  // Explored Areas CRUD Operations
  async createExploredArea(area: Omit<ExploredArea, 'id' | 'created_at'>): Promise<number> {
    try {
      const result = await this.db.runAsync(
        `INSERT INTO explored_areas (latitude, longitude, radius, explored_at, accuracy)
         VALUES (?, ?, ?, ?, ?)`,
        [area.latitude, area.longitude, area.radius, area.explored_at, area.accuracy || null]
      );
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Failed to create explored area:', error);
      throw new Error(`Failed to create explored area: ${error}`);
    }
  }

  async getExploredAreaById(id: number): Promise<ExploredArea | null> {
    try {
      const result = await this.db.getFirstAsync<ExploredArea>(
        'SELECT * FROM explored_areas WHERE id = ?',
        [id]
      );
      return result || null;
    } catch (error) {
      console.error('Failed to get explored area:', error);
      throw new Error(`Failed to get explored area: ${error}`);
    }
  }

  async getAllExploredAreas(): Promise<ExploredArea[]> {
    try {
      const result = await this.db.getAllAsync<ExploredArea>(
        'SELECT * FROM explored_areas ORDER BY explored_at DESC'
      );
      return result;
    } catch (error) {
      console.error('Failed to get all explored areas:', error);
      throw new Error(`Failed to get all explored areas: ${error}`);
    }
  }

  async getExploredAreasInBounds(
    northEast: { lat: number; lng: number },
    southWest: { lat: number; lng: number }
  ): Promise<ExploredArea[]> {
    try {
      const result = await this.db.getAllAsync<ExploredArea>(
        `SELECT * FROM explored_areas 
         WHERE latitude BETWEEN ? AND ? 
         AND longitude BETWEEN ? AND ?`,
        [southWest.lat, northEast.lat, southWest.lng, northEast.lng]
      );
      return result;
    } catch (error) {
      console.error('Failed to get explored areas in bounds:', error);
      throw new Error(`Failed to get explored areas in bounds: ${error}`);
    }
  }

  // Spatial query to find areas within a certain distance
  async findNearbyExploredAreas(query: SpatialQuery): Promise<ExploredArea[]> {
    try {
      // Using Haversine formula approximation for spatial queries
      // Note: This is a simplified approach. For production, consider using SpatiaLite extension
      const latDelta = query.radius / 111.32; // Approximate degrees per km for latitude
      const lngDelta = query.radius / (111.32 * Math.cos(query.latitude * Math.PI / 180));

      // Use bounding box approach since SQLite doesn't have trigonometric functions
      const result = await this.db.getAllAsync<ExploredArea>(
        `SELECT * FROM explored_areas 
         WHERE latitude BETWEEN ? AND ? 
         AND longitude BETWEEN ? AND ?`,
        [
          query.latitude - latDelta, query.latitude + latDelta,
          query.longitude - lngDelta, query.longitude + lngDelta
        ]
      );

      // Filter by actual distance and add distance property in JavaScript
      const filteredResults = result
        .map(area => {
          const distance = this.calculateDistance(
            query.latitude, query.longitude,
            area.latitude, area.longitude
          );
          return { ...area, distance };
        })
        .filter(area => area.distance <= query.radius)
        .sort((a, b) => a.distance - b.distance);
      
      return filteredResults;
    } catch (error) {
      console.error('Failed to find nearby explored areas:', error);
      throw new Error(`Failed to find nearby explored areas: ${error}`);
    }
  }

  async deleteExploredArea(id: number): Promise<boolean> {
    try {
      const result = await this.db.runAsync(
        'DELETE FROM explored_areas WHERE id = ?',
        [id]
      );
      return result.changes > 0;
    } catch (error) {
      console.error('Failed to delete explored area:', error);
      throw new Error(`Failed to delete explored area: ${error}`);
    }
  }

  // User Stats Operations
  async getUserStats(): Promise<UserStats | null> {
    try {
      const result = await this.db.getFirstAsync<UserStats>(
        'SELECT * FROM user_stats WHERE id = 1'
      );
      return result || null;
    } catch (error) {
      console.error('Failed to get user stats:', error);
      throw new Error(`Failed to get user stats: ${error}`);
    }
  }

  async updateUserStats(stats: Partial<Omit<UserStats, 'id'>>): Promise<void> {
    try {
      const updateFields = Object.keys(stats).map(key => `${key} = ?`).join(', ');
      const values = Object.values(stats);
      
      await this.db.runAsync(
        `UPDATE user_stats SET ${updateFields}, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
        values
      );
    } catch (error) {
      console.error('Failed to update user stats:', error);
      throw new Error(`Failed to update user stats: ${error}`);
    }
  }

  // Achievement Operations
  async createAchievement(achievement: Omit<Achievement, 'id'>): Promise<number> {
    try {
      const result = await this.db.runAsync(
        `INSERT INTO achievements (type, name, description, unlocked_at, progress)
         VALUES (?, ?, ?, ?, ?)`,
        [
          achievement.type,
          achievement.name,
          achievement.description || null,
          achievement.unlocked_at || null,
          achievement.progress
        ]
      );
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Failed to create achievement:', error);
      throw new Error(`Failed to create achievement: ${error}`);
    }
  }

  async getAllAchievements(): Promise<Achievement[]> {
    try {
      const result = await this.db.getAllAsync<Achievement>(
        'SELECT * FROM achievements ORDER BY unlocked_at DESC, progress DESC'
      );
      return result;
    } catch (error) {
      console.error('Failed to get achievements:', error);
      throw new Error(`Failed to get achievements: ${error}`);
    }
  }

  async updateAchievementProgress(id: number, progress: number, unlocked_at?: string): Promise<void> {
    try {
      if (unlocked_at) {
        await this.db.runAsync(
          'UPDATE achievements SET progress = ?, unlocked_at = ? WHERE id = ?',
          [progress, unlocked_at, id]
        );
      } else {
        await this.db.runAsync(
          'UPDATE achievements SET progress = ? WHERE id = ?',
          [progress, id]
        );
      }
    } catch (error) {
      console.error('Failed to update achievement progress:', error);
      throw new Error(`Failed to update achievement progress: ${error}`);
    }
  }

  // Transaction Management
  async withTransaction(callback: () => Promise<void>): Promise<void> {
    try {
      await this.db.withTransactionAsync(callback);
    } catch (error) {
      console.error('Transaction failed:', error);
      throw new Error(`Transaction failed: ${error}`);
    }
  }

  // Database Integrity and Recovery
  async performIntegrityCheck(): Promise<{ isValid: boolean; issues: string[] }> {
    try {
      const result = await this.db.getFirstAsync<{ integrity_check: string }>(
        'PRAGMA integrity_check'
      );
      
      const isValid = result?.integrity_check === 'ok';
      const issues = isValid ? [] : [result?.integrity_check || 'Unknown integrity issue'];
      
      return { isValid, issues };
    } catch (error) {
      console.error('Integrity check failed:', error);
      return { isValid: false, issues: [`Integrity check failed: ${error}`] };
    }
  }

  async performQuickCheck(): Promise<boolean> {
    try {
      const result = await this.db.getFirstAsync<{ quick_check: string }>(
        'PRAGMA quick_check'
      );
      return result?.quick_check === 'ok';
    } catch (error) {
      console.error('Quick check failed:', error);
      return false;
    }
  }

  async checkDatabaseCorruption(): Promise<{ isCorrupted: boolean; corruptionType: string | null }> {
    try {
      // Check if database file is accessible
      const quickCheck = await this.performQuickCheck();
      if (!quickCheck) {
        return { isCorrupted: true, corruptionType: 'structural' };
      }

      // Check table existence
      const tables = await this.db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      
      const expectedTables = ['explored_areas', 'user_stats', 'achievements'];
      const existingTables = tables.map(t => t.name);
      const missingTables = expectedTables.filter(table => !existingTables.includes(table));
      
      if (missingTables.length > 0) {
        return { isCorrupted: true, corruptionType: 'schema' };
      }

      // Check for data consistency
      const integrityResult = await this.performIntegrityCheck();
      if (!integrityResult.isValid) {
        return { isCorrupted: true, corruptionType: 'data' };
      }

      return { isCorrupted: false, corruptionType: null };
    } catch (error) {
      console.error('Corruption check failed:', error);
      return { isCorrupted: true, corruptionType: 'access' };
    }
  }

  async repairDatabase(): Promise<boolean> {
    try {
      console.log('Starting database repair...');
      
      // First, check what type of corruption we're dealing with
      const { isCorrupted, corruptionType } = await this.checkDatabaseCorruption();
      
      if (!isCorrupted) {
        console.log('Database is not corrupted, no repair needed');
        return true;
      }

      console.log(`Detected corruption type: ${corruptionType}`);

      switch (corruptionType) {
        case 'structural':
          return this.repairStructuralCorruption();
        case 'schema':
          return this.repairSchemaCorruption();
        case 'data':
          return this.repairDataCorruption();
        case 'access':
          return this.repairAccessCorruption();
        default:
          return this.performGenericRepair();
      }
    } catch (error) {
      console.error('Database repair failed:', error);
      return false;
    }
  }

  async runMigrations(): Promise<boolean> {
    try {
      console.log('Running database migrations...');
      
      // Get current schema version
      let currentVersion = 0;
      try {
        const result = await this.db.getFirstAsync<{ user_version: number }>(
          'PRAGMA user_version'
        );
        currentVersion = result?.user_version || 0;
      } catch (error) {
        console.warn('Could not get schema version, assuming version 0');
      }

      // Define migrations
      const migrations = [
        {
          version: 1,
          sql: `
            CREATE TABLE IF NOT EXISTS explored_areas (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              latitude REAL NOT NULL,
              longitude REAL NOT NULL,
              radius REAL NOT NULL,
              explored_at DATETIME NOT NULL,
              accuracy REAL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_explored_areas_location ON explored_areas(latitude, longitude);
          `
        },
        {
          version: 2,
          sql: `
            CREATE TABLE IF NOT EXISTS user_stats (
              id INTEGER PRIMARY KEY,
              total_areas_explored INTEGER DEFAULT 0,
              total_distance REAL DEFAULT 0,
              exploration_percentage REAL DEFAULT 0,
              current_streak INTEGER DEFAULT 0,
              longest_streak INTEGER DEFAULT 0,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT OR IGNORE INTO user_stats (id) VALUES (1);
          `
        },
        {
          version: 3,
          sql: `
            CREATE TABLE IF NOT EXISTS achievements (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              type TEXT NOT NULL,
              name TEXT NOT NULL,
              description TEXT,
              unlocked_at DATETIME,
              progress REAL DEFAULT 0
            );
          `
        }
      ];

      // Run migrations
      for (const migration of migrations) {
        if (currentVersion < migration.version) {
          console.log(`Running migration to version ${migration.version}`);
          await this.db.execAsync(migration.sql);
          await this.db.execAsync(`PRAGMA user_version = ${migration.version}`);
          currentVersion = migration.version;
        }
      }

      console.log(`Database migrations completed, current version: ${currentVersion}`);
      return true;
    } catch (error) {
      console.error('Migration failed:', error);
      return false;
    }
  }

  async reinitialize(): Promise<boolean> {
    try {
      console.log('Reinitializing database...');
      
      // Close current connection
      await this.db.closeAsync();
      
      // Get a fresh database instance
      const databaseManager = getDatabaseManager();
      await databaseManager.reinitialize();
      this.db = databaseManager.getDatabase();
      
      // Run migrations to ensure proper schema
      const migrationSuccess = await this.runMigrations();
      
      if (migrationSuccess) {
        console.log('Database reinitialization successful');
        return true;
      } else {
        console.error('Database reinitialization failed during migrations');
        return false;
      }
    } catch (error) {
      console.error('Database reinitialization failed:', error);
      return false;
    }
  }

  // Private repair methods
  private async repairStructuralCorruption(): Promise<boolean> {
    try {
      console.log('Attempting structural corruption repair...');
      
      // Try VACUUM to rebuild the database file
      await this.db.execAsync('VACUUM');
      
      // Verify repair
      const isRepaired = await this.performQuickCheck();
      if (isRepaired) {
        console.log('Structural corruption repair successful');
        return true;
      }
      
      // If VACUUM failed, try reinitialization
      return this.reinitialize();
    } catch (error) {
      console.error('Structural repair failed:', error);
      return this.reinitialize();
    }
  }

  private async repairSchemaCorruption(): Promise<boolean> {
    try {
      console.log('Attempting schema corruption repair...');
      
      // Run migrations to recreate missing tables
      return this.runMigrations();
    } catch (error) {
      console.error('Schema repair failed:', error);
      return this.reinitialize();
    }
  }

  private async repairDataCorruption(): Promise<boolean> {
    try {
      console.log('Attempting data corruption repair...');
      
      // Try to salvage data by exporting what we can
      let salvageableData = null;
      try {
        salvageableData = await this.exportSalvageableData();
      } catch (error) {
        console.warn('Could not salvage data:', error);
      }
      
      // Reinitialize database
      const reinitSuccess = await this.reinitialize();
      if (!reinitSuccess) return false;
      
      // Import salvaged data if available
      if (salvageableData) {
        try {
          await this.importSalvagedData(salvageableData);
          console.log('Salvaged data imported successfully');
        } catch (error) {
          console.warn('Could not import salvaged data:', error);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Data repair failed:', error);
      return this.reinitialize();
    }
  }

  private async repairAccessCorruption(): Promise<boolean> {
    try {
      console.log('Attempting access corruption repair...');
      
      // This typically requires full reinitialization
      return this.reinitialize();
    } catch (error) {
      console.error('Access repair failed:', error);
      return false;
    }
  }

  private async performGenericRepair(): Promise<boolean> {
    try {
      console.log('Attempting generic database repair...');
      
      // Try standard repair operations
      await this.db.execAsync('VACUUM');
      await this.db.execAsync('REINDEX');
      
      // Verify repair was successful
      const { isValid } = await this.performIntegrityCheck();
      if (isValid) {
        console.log('Generic repair successful');
        return true;
      }
      
      // If standard repair failed, try reinitialization
      return this.reinitialize();
    } catch (error) {
      console.error('Generic repair failed:', error);
      return this.reinitialize();
    }
  }

  private async exportSalvageableData(): Promise<any> {
    const salvageableData: any = {
      exploredAreas: [],
      userStats: null,
      achievements: []
    };

    // Try to salvage explored areas
    try {
      salvageableData.exploredAreas = await this.db.getAllAsync<ExploredArea>(
        'SELECT * FROM explored_areas WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
      );
    } catch (error) {
      console.warn('Could not salvage explored areas:', error);
    }

    // Try to salvage user stats
    try {
      salvageableData.userStats = await this.db.getFirstAsync<UserStats>(
        'SELECT * FROM user_stats WHERE id = 1'
      );
    } catch (error) {
      console.warn('Could not salvage user stats:', error);
    }

    // Try to salvage achievements
    try {
      salvageableData.achievements = await this.db.getAllAsync<Achievement>(
        'SELECT * FROM achievements WHERE type IS NOT NULL AND name IS NOT NULL'
      );
    } catch (error) {
      console.warn('Could not salvage achievements:', error);
    }

    return salvageableData;
  }

  private async importSalvagedData(data: any): Promise<void> {
    try {
      await this.withTransaction(async () => {
        // Import explored areas
        if (data.exploredAreas && data.exploredAreas.length > 0) {
          for (const area of data.exploredAreas) {
            try {
              await this.createExploredArea(area);
            } catch (error) {
              console.warn('Could not import explored area:', area, error);
            }
          }
        }

        // Import user stats
        if (data.userStats) {
          try {
            const { id, ...stats } = data.userStats;
            await this.updateUserStats(stats);
          } catch (error) {
            console.warn('Could not import user stats:', error);
          }
        }

        // Import achievements
        if (data.achievements && data.achievements.length > 0) {
          for (const achievement of data.achievements) {
            try {
              await this.createAchievement(achievement);
            } catch (error) {
              console.warn('Could not import achievement:', achievement, error);
            }
          }
        }
      });
    } catch (error) {
      console.error('Failed to import salvaged data:', error);
      throw error;
    }
  }

  // Backup and Recovery Operations
  async exportData(): Promise<{
    exploredAreas: ExploredArea[];
    userStats: UserStats | null;
    achievements: Achievement[];
  }> {
    try {
      const [exploredAreas, userStats, achievements] = await Promise.all([
        this.getAllExploredAreas(),
        this.getUserStats(),
        this.getAllAchievements()
      ]);

      return { exploredAreas, userStats, achievements };
    } catch (error) {
      console.error('Failed to export data:', error);
      throw new Error(`Failed to export data: ${error}`);
    }
  }

  async importData(data: {
    exploredAreas: ExploredArea[];
    userStats: UserStats | null;
    achievements: Achievement[];
  }): Promise<void> {
    try {
      await this.withTransaction(async () => {
        // Clear existing data
        await this.db.execAsync('DELETE FROM explored_areas');
        await this.db.execAsync('DELETE FROM achievements');
        
        // Import explored areas
        for (const area of data.exploredAreas) {
          await this.createExploredArea(area);
        }
        
        // Import user stats
        if (data.userStats) {
          const { id, ...stats } = data.userStats;
          await this.updateUserStats(stats);
        }
        
        // Import achievements
        for (const achievement of data.achievements) {
          await this.createAchievement(achievement);
        }
      });
    } catch (error) {
      console.error('Failed to import data:', error);
      throw new Error(`Failed to import data: ${error}`);
    }
  }

  /**
   * Alias for getAllExploredAreas (for test compatibility)
   */
  async getExploredAreas(): Promise<ExploredArea[]> {
    return await this.getAllExploredAreas();
  }

  /**
   * Database integrity check (for test compatibility)
   */
  async checkIntegrity(): Promise<{ isValid: boolean; issues: string[] }> {
    return await this.performIntegrityCheck();
  }



  /**
   * Attempt database recovery (for test compatibility)
   */
  async attemptRecovery(): Promise<{ success: boolean; message?: string }> {
    try {
      // Try to repair first
      const repairSuccess = await this.repairDatabase();
      
      if (repairSuccess) {
        return { success: true, message: 'Database repaired successfully' };
      }

      // If repair fails, try to salvage data and reinitialize
      const salvageableData = await this.exportSalvageableData();
      await this.reinitialize();
      await this.importSalvagedData(salvageableData);
      
      return { success: true, message: 'Database recovered with salvaged data' };
    } catch (error) {
      console.error('Database recovery failed:', error);
      return { success: false, message: `Recovery failed: ${error}` };
    }
  }

  /**
   * Close database connection (for test compatibility)
   */
  async close(): Promise<void> {
    try {
      if (this._db) {
        await this._db.closeAsync();
        this._db = null;
      }
    } catch (error) {
      console.error('Error closing database:', error);
    }
  }

  /**
   * Initialize database (for test compatibility)
   */
  async initialize(): Promise<void> {
    try {
      const manager = getDatabaseManager();
      await manager.initialize();
      // Database will be lazily loaded through the getter
    } catch (error) {
      console.error('Database initialize failed:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @param lat1 Latitude of first point
   * @param lon1 Longitude of first point
   * @param lat2 Latitude of second point
   * @param lon2 Longitude of second point
   * @returns Distance in kilometers
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

// Singleton instance
let databaseService: DatabaseService | null = null;

export const getDatabaseService = (): DatabaseService => {
  if (!databaseService) {
    databaseService = new DatabaseService();
  }
  return databaseService;
};