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
  private db: SQLite.SQLiteDatabase;

  constructor() {
    this.db = getDatabaseManager().getDatabase();
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

      const result = await this.db.getAllAsync<ExploredArea>(
        `SELECT *, 
         (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * 
         cos(radians(longitude) - radians(?)) + sin(radians(?)) * 
         sin(radians(latitude)))) AS distance
         FROM explored_areas 
         WHERE latitude BETWEEN ? AND ? 
         AND longitude BETWEEN ? AND ?
         HAVING distance <= ?
         ORDER BY distance`,
        [
          query.latitude, query.longitude, query.latitude,
          query.latitude - latDelta, query.latitude + latDelta,
          query.longitude - lngDelta, query.longitude + lngDelta,
          query.radius
        ]
      );
      return result;
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

  async repairDatabase(): Promise<boolean> {
    try {
      // Attempt to repair by running VACUUM and REINDEX
      await this.db.execAsync('VACUUM');
      await this.db.execAsync('REINDEX');
      
      // Verify repair was successful
      const { isValid } = await this.performIntegrityCheck();
      return isValid;
    } catch (error) {
      console.error('Database repair failed:', error);
      return false;
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
}

// Singleton instance
let databaseService: DatabaseService | null = null;

export const getDatabaseService = (): DatabaseService => {
  if (!databaseService) {
    databaseService = new DatabaseService();
  }
  return databaseService;
};