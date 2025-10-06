import { getDatabaseManager, initializeDatabase } from './database';
import { getDatabaseService } from './services';
import { Achievement } from './services';

export interface InitializationResult {
  isFirstLaunch: boolean;
  databaseInitialized: boolean;
  userStatsInitialized: boolean;
  achievementsInitialized: boolean;
  errors: string[];
}

export interface DefaultAchievement {
  type: string;
  name: string;
  description: string;
  progress: number;
}

// Default achievements to create on first launch
const DEFAULT_ACHIEVEMENTS: DefaultAchievement[] = [
  {
    type: 'exploration',
    name: 'First Steps',
    description: 'Explore your first area',
    progress: 0
  },
  {
    type: 'exploration',
    name: 'Local Explorer',
    description: 'Explore 10 different areas',
    progress: 0
  },
  {
    type: 'exploration',
    name: 'Neighborhood Navigator',
    description: 'Explore 50 different areas',
    progress: 0
  },
  {
    type: 'exploration',
    name: 'City Wanderer',
    description: 'Explore 100 different areas',
    progress: 0
  },
  {
    type: 'exploration',
    name: 'Regional Rover',
    description: 'Explore 500 different areas',
    progress: 0
  },
  {
    type: 'distance',
    name: 'First Mile',
    description: 'Travel 1 mile while exploring',
    progress: 0
  },
  {
    type: 'distance',
    name: 'Marathon Explorer',
    description: 'Travel 26.2 miles while exploring',
    progress: 0
  },
  {
    type: 'distance',
    name: 'Century Traveler',
    description: 'Travel 100 miles while exploring',
    progress: 0
  },
  {
    type: 'streak',
    name: 'Daily Explorer',
    description: 'Explore for 7 consecutive days',
    progress: 0
  },
  {
    type: 'streak',
    name: 'Weekly Wanderer',
    description: 'Explore for 30 consecutive days',
    progress: 0
  },
  {
    type: 'percentage',
    name: 'Getting Started',
    description: 'Reach 1% exploration coverage',
    progress: 0
  },
  {
    type: 'percentage',
    name: 'Making Progress',
    description: 'Reach 5% exploration coverage',
    progress: 0
  },
  {
    type: 'percentage',
    name: 'Serious Explorer',
    description: 'Reach 10% exploration coverage',
    progress: 0
  }
];

export class DatabaseInitializationService {
  private static instance: DatabaseInitializationService | null = null;

  public static getInstance(): DatabaseInitializationService {
    if (!DatabaseInitializationService.instance) {
      DatabaseInitializationService.instance = new DatabaseInitializationService();
    }
    return DatabaseInitializationService.instance;
  }

  /**
   * Initialize the database and set up default data on first launch
   */
  async initializeOnFirstLaunch(): Promise<InitializationResult> {
    const result: InitializationResult = {
      isFirstLaunch: false,
      databaseInitialized: false,
      userStatsInitialized: false,
      achievementsInitialized: false,
      errors: []
    };

    try {
      // Initialize database manager and schema
      await this.initializeDatabase(result);
      
      // Check if this is first launch
      result.isFirstLaunch = await this.isFirstLaunch();
      
      if (result.isFirstLaunch) {
        console.log('First launch detected - initializing default data');
        
        // Initialize user stats with default values
        await this.initializeUserStats(result);
        
        // Create initial achievement records
        await this.initializeAchievements(result);
        
        // Add test explored areas in development mode
        if (__DEV__) {
          await this.initializeTestExploredAreas(result);
        }
        
        // Mark first launch as complete
        await this.markFirstLaunchComplete();
      } else {
        console.log('Existing installation detected - skipping default data initialization');
        result.userStatsInitialized = true;
        result.achievementsInitialized = true;
      }

    } catch (error) {
      const errorMessage = `Database initialization failed: ${error}`;
      console.error(errorMessage);
      result.errors.push(errorMessage);
    }

    return result;
  }

  /**
   * Initialize the database schema and connection
   */
  private async initializeDatabase(result: InitializationResult): Promise<void> {
    try {
      await initializeDatabase();
      result.databaseInitialized = true;
      console.log('Database schema initialized successfully');
    } catch (error) {
      const errorMessage = `Failed to initialize database schema: ${error}`;
      result.errors.push(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Check if this is the first launch of the app
   */
  private async isFirstLaunch(): Promise<boolean> {
    try {
      const databaseService = getDatabaseService();
      const userStats = await databaseService.getUserStats();
      
      // If no user stats exist, this is first launch
      return userStats === null;
    } catch (error) {
      console.error('Error checking first launch status:', error);
      // If we can't determine, assume it's first launch to be safe
      return true;
    }
  }

  /**
   * Initialize user stats table with default values
   */
  private async initializeUserStats(result: InitializationResult): Promise<void> {
    try {
      const databaseService = getDatabaseService();
      
      // Check if user stats already exist
      const existingStats = await databaseService.getUserStats();
      
      if (!existingStats) {
        // Create initial user stats record with default values
        const db = getDatabaseManager().getDatabase();
        await db.runAsync(`
          INSERT INTO user_stats (
            id, 
            total_areas_explored, 
            total_distance, 
            exploration_percentage, 
            current_streak, 
            longest_streak
          ) VALUES (1, 0, 0.0, 0.0, 0, 0)
        `);
        
        result.userStatsInitialized = true;
        console.log('User stats initialized with default values');
      } else {
        result.userStatsInitialized = true;
        console.log('User stats already exist - skipping initialization');
      }
    } catch (error) {
      const errorMessage = `Failed to initialize user stats: ${error}`;
      result.errors.push(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Create initial achievement records in the database
   */
  private async initializeAchievements(result: InitializationResult): Promise<void> {
    try {
      const databaseService = getDatabaseService();
      
      // Check if achievements already exist
      const existingAchievements = await databaseService.getAllAchievements();
      
      if (existingAchievements.length === 0) {
        // Create all default achievements
        for (const achievement of DEFAULT_ACHIEVEMENTS) {
          await databaseService.createAchievement({
            type: achievement.type,
            name: achievement.name,
            description: achievement.description,
            progress: achievement.progress
          });
        }
        
        result.achievementsInitialized = true;
        console.log(`Initialized ${DEFAULT_ACHIEVEMENTS.length} default achievements`);
      } else {
        result.achievementsInitialized = true;
        console.log(`Found ${existingAchievements.length} existing achievements - skipping initialization`);
      }
    } catch (error) {
      const errorMessage = `Failed to initialize achievements: ${error}`;
      result.errors.push(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Create test explored areas for development (only in __DEV__ mode)
   */
  private async initializeTestExploredAreas(result: InitializationResult): Promise<void> {
    try {
      const databaseService = getDatabaseService();
      
      // Create test explored areas around common locations
      const testAreas = [
        {
          latitude: 37.7749,  // San Francisco
          longitude: -122.4194,
          radius: 100,
          explored_at: new Date('2024-01-01').toISOString(),
          accuracy: 10
        },
        {
          latitude: 37.7849,  // Near San Francisco
          longitude: -122.4094,
          radius: 150,
          explored_at: new Date('2024-01-15').toISOString(),
          accuracy: 15
        },
        {
          latitude: 37.7649,  // Near San Francisco
          longitude: -122.4294,
          radius: 120,
          explored_at: new Date('2024-02-01').toISOString(),
          accuracy: 12
        },
        {
          latitude: 37.4219,  // Mountain View (Google HQ area)
          longitude: -122.084,
          radius: 200,
          explored_at: new Date('2024-02-15').toISOString(),
          accuracy: 8
        }
      ];

      for (const area of testAreas) {
        await databaseService.createExploredArea(area);
      }

      console.log(`Created ${testAreas.length} test explored areas for development`);
    } catch (error) {
      const errorMessage = `Failed to create test explored areas: ${error}`;
      result.errors.push(errorMessage);
      console.warn(errorMessage);
      // Don't throw error for test data - it's not critical
    }
  }

  /**
   * Mark first launch as complete by ensuring user stats exist
   */
  private async markFirstLaunchComplete(): Promise<void> {
    try {
      // The presence of user stats indicates first launch is complete
      // This is already handled by initializeUserStats
      console.log('First launch initialization completed');
    } catch (error) {
      console.error('Error marking first launch complete:', error);
      throw error;
    }
  }

  /**
   * Verify database integrity and initialization status
   */
  async verifyInitialization(): Promise<{
    isValid: boolean;
    hasUserStats: boolean;
    achievementCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    try {
      const databaseService = getDatabaseService();
      
      // Check database integrity
      const { isValid, issues: integrityIssues } = await databaseService.performIntegrityCheck();
      issues.push(...integrityIssues);
      
      // Check user stats
      const userStats = await databaseService.getUserStats();
      const hasUserStats = userStats !== null;
      
      if (!hasUserStats) {
        issues.push('User stats not initialized');
      }
      
      // Check achievements
      const achievements = await databaseService.getAllAchievements();
      const achievementCount = achievements.length;
      
      if (achievementCount === 0) {
        issues.push('No achievements found');
      }
      
      return {
        isValid,
        hasUserStats,
        achievementCount,
        issues
      };
    } catch (error) {
      issues.push(`Verification failed: ${error}`);
      return {
        isValid: false,
        hasUserStats: false,
        achievementCount: 0,
        issues
      };
    }
  }

  /**
   * Reset database to initial state (useful for testing or data corruption recovery)
   */
  async resetToInitialState(): Promise<InitializationResult> {
    try {
      const databaseService = getDatabaseService();
      
      // Clear all data
      await databaseService.withTransaction(async () => {
        const db = getDatabaseManager().getDatabase();
        await db.execAsync('DELETE FROM explored_areas');
        await db.execAsync('DELETE FROM achievements');
        await db.execAsync('DELETE FROM user_stats');
      });
      
      console.log('Database cleared - reinitializing with default data');
      
      // Reinitialize with default data
      return await this.initializeOnFirstLaunch();
    } catch (error) {
      console.error('Failed to reset database:', error);
      throw new Error(`Failed to reset database: ${error}`);
    }
  }
}

// Export singleton instance getter
export const getDatabaseInitializationService = (): DatabaseInitializationService => {
  return DatabaseInitializationService.getInstance();
};

// Export convenience function for easy initialization
export const initializeDatabaseOnFirstLaunch = async (): Promise<InitializationResult> => {
  const service = getDatabaseInitializationService();
  return await service.initializeOnFirstLaunch();
};