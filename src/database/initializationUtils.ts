import { getDatabaseInitializationService } from './initializationService';
import { getDatabaseService } from './services';

/**
 * Utility functions for database initialization monitoring and debugging
 */

export interface InitializationStatus {
  timestamp: string;
  databaseConnected: boolean;
  userStatsExists: boolean;
  achievementCount: number;
  exploredAreaCount: number;
  databaseIntegrity: boolean;
  lastError?: string;
}

/**
 * Get comprehensive status of database initialization
 */
export async function getInitializationStatus(): Promise<InitializationStatus> {
  const timestamp = new Date().toISOString();
  let lastError: string | undefined;

  try {
    const databaseService = getDatabaseService();
    const initService = getDatabaseInitializationService();

    // Check database connection
    let databaseConnected = false;
    let userStatsExists = false;
    let achievementCount = 0;
    let exploredAreaCount = 0;
    let databaseIntegrity = false;

    try {
      // Test database connection by attempting to get user stats
      const userStats = await databaseService.getUserStats();
      databaseConnected = true;
      userStatsExists = userStats !== null;

      // Get achievement count
      const achievements = await databaseService.getAllAchievements();
      achievementCount = achievements.length;

      // Get explored area count
      const exploredAreas = await databaseService.getAllExploredAreas();
      exploredAreaCount = exploredAreas.length;

      // Check database integrity
      const verification = await initService.verifyInitialization();
      databaseIntegrity = verification.isValid;

    } catch (error) {
      lastError = `Database operation failed: ${error}`;
      console.error(lastError);
    }

    return {
      timestamp,
      databaseConnected,
      userStatsExists,
      achievementCount,
      exploredAreaCount,
      databaseIntegrity,
      lastError
    };

  } catch (error) {
    lastError = `Status check failed: ${error}`;
    console.error(lastError);
    
    return {
      timestamp,
      databaseConnected: false,
      userStatsExists: false,
      achievementCount: 0,
      exploredAreaCount: 0,
      databaseIntegrity: false,
      lastError
    };
  }
}

/**
 * Log initialization status for debugging
 */
export async function logInitializationStatus(): Promise<void> {
  const status = await getInitializationStatus();
  
  console.log('=== Database Initialization Status ===');
  console.log(`Timestamp: ${status.timestamp}`);
  console.log(`Database Connected: ${status.databaseConnected}`);
  console.log(`User Stats Exists: ${status.userStatsExists}`);
  console.log(`Achievement Count: ${status.achievementCount}`);
  console.log(`Explored Area Count: ${status.exploredAreaCount}`);
  console.log(`Database Integrity: ${status.databaseIntegrity}`);
  
  if (status.lastError) {
    console.log(`Last Error: ${status.lastError}`);
  }
  
  console.log('=====================================');
}

/**
 * Perform a health check of the database initialization
 */
export async function performInitializationHealthCheck(): Promise<{
  healthy: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const recommendations: string[] = [];

  try {
    const status = await getInitializationStatus();

    // Check database connection
    if (!status.databaseConnected) {
      issues.push('Database connection failed');
      recommendations.push('Restart the app or check database file permissions');
    }

    // Check user stats
    if (!status.userStatsExists) {
      issues.push('User stats not initialized');
      recommendations.push('Run database initialization service');
    }

    // Check achievements
    if (status.achievementCount === 0) {
      issues.push('No achievements found');
      recommendations.push('Initialize default achievements');
    } else if (status.achievementCount < 10) {
      issues.push('Fewer achievements than expected');
      recommendations.push('Verify all default achievements were created');
    }

    // Check database integrity
    if (!status.databaseIntegrity) {
      issues.push('Database integrity check failed');
      recommendations.push('Run database repair or reset to initial state');
    }

    // Check for errors
    if (status.lastError) {
      issues.push(`Recent error: ${status.lastError}`);
      recommendations.push('Check logs for detailed error information');
    }

    const healthy = issues.length === 0;

    return {
      healthy,
      issues,
      recommendations
    };

  } catch (error) {
    return {
      healthy: false,
      issues: [`Health check failed: ${error}`],
      recommendations: ['Restart the app and check database configuration']
    };
  }
}

/**
 * Reset database to clean state (useful for development/testing)
 */
export async function resetDatabaseForDevelopment(): Promise<boolean> {
  try {
    console.warn('Resetting database to initial state - all data will be lost!');
    
    const initService = getDatabaseInitializationService();
    const result = await initService.resetToInitialState();
    
    if (result.errors.length === 0) {
      console.log('Database reset completed successfully');
      await logInitializationStatus();
      return true;
    } else {
      console.error('Database reset completed with errors:', result.errors);
      return false;
    }
  } catch (error) {
    console.error('Database reset failed:', error);
    return false;
  }
}

/**
 * Export data for backup purposes
 */
export async function createDatabaseBackup(): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const databaseService = getDatabaseService();
    const data = await databaseService.exportData();
    
    return {
      success: true,
      data: {
        ...data,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Backup failed: ${error}`
    };
  }
}