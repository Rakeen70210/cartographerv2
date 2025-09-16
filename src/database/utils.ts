import { getDatabaseManager, getDatabaseService } from './index';

export interface DatabaseHealth {
  isHealthy: boolean;
  lastCheck: Date;
  issues: string[];
  recommendations: string[];
}

export class DatabaseHealthMonitor {
  private static instance: DatabaseHealthMonitor | null = null;
  private lastHealthCheck: Date | null = null;
  private healthCheckInterval: number = 24 * 60 * 60 * 1000; // 24 hours

  static getInstance(): DatabaseHealthMonitor {
    if (!DatabaseHealthMonitor.instance) {
      DatabaseHealthMonitor.instance = new DatabaseHealthMonitor();
    }
    return DatabaseHealthMonitor.instance;
  }

  async performHealthCheck(): Promise<DatabaseHealth> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let isHealthy = true;

    try {
      const dbManager = getDatabaseManager();
      const dbService = getDatabaseService();

      // Check database integrity
      const integrityResult = await dbService.performIntegrityCheck();
      if (!integrityResult.isValid) {
        isHealthy = false;
        issues.push(...integrityResult.issues);
        recommendations.push('Run database repair to fix integrity issues');
      }

      // Check if database is accessible
      try {
        await dbService.getUserStats();
      } catch (error) {
        isHealthy = false;
        issues.push('Database access failed');
        recommendations.push('Restart the application or reinitialize database');
      }

      // Check for orphaned records or inconsistencies
      const exploredAreas = await dbService.getAllExploredAreas();
      const userStats = await dbService.getUserStats();
      
      if (userStats && exploredAreas.length !== userStats.total_areas_explored) {
        issues.push('User stats inconsistent with explored areas count');
        recommendations.push('Recalculate user statistics');
      }

      this.lastHealthCheck = new Date();

      return {
        isHealthy,
        lastCheck: this.lastHealthCheck,
        issues,
        recommendations
      };
    } catch (error) {
      return {
        isHealthy: false,
        lastCheck: new Date(),
        issues: [`Health check failed: ${error}`],
        recommendations: ['Restart application and check database initialization']
      };
    }
  }

  async autoRepair(): Promise<boolean> {
    try {
      const dbService = getDatabaseService();
      
      // Attempt automatic repair
      const repairSuccess = await dbService.repairDatabase();
      
      if (repairSuccess) {
        console.log('Database auto-repair completed successfully');
        return true;
      } else {
        console.warn('Database auto-repair failed');
        return false;
      }
    } catch (error) {
      console.error('Auto-repair failed:', error);
      return false;
    }
  }

  shouldPerformHealthCheck(): boolean {
    if (!this.lastHealthCheck) return true;
    
    const timeSinceLastCheck = Date.now() - this.lastHealthCheck.getTime();
    return timeSinceLastCheck > this.healthCheckInterval;
  }

  async recalculateUserStats(): Promise<void> {
    try {
      const dbService = getDatabaseService();
      
      await dbService.withTransaction(async () => {
        const exploredAreas = await dbService.getAllExploredAreas();
        
        // Calculate total distance (simplified calculation)
        let totalDistance = 0;
        for (let i = 1; i < exploredAreas.length; i++) {
          const prev = exploredAreas[i - 1];
          const curr = exploredAreas[i];
          totalDistance += this.calculateDistance(
            prev.latitude, prev.longitude,
            curr.latitude, curr.longitude
          );
        }

        // Calculate exploration percentage (simplified - would need more complex logic in real app)
        const explorationPercentage = Math.min((exploredAreas.length / 1000) * 100, 100);

        // Update user stats
        await dbService.updateUserStats({
          total_areas_explored: exploredAreas.length,
          total_distance: totalDistance,
          exploration_percentage: explorationPercentage
        });
      });
    } catch (error) {
      console.error('Failed to recalculate user stats:', error);
      throw error;
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

export interface DatabaseErrorHandler {
  handleError(error: Error, context: string): Promise<boolean>;
}

export class DefaultDatabaseErrorHandler implements DatabaseErrorHandler {
  async handleError(error: Error, context: string): Promise<boolean> {
    console.error(`Database error in ${context}:`, error);

    // Check if it's a recoverable error
    if (this.isRecoverableError(error)) {
      const healthMonitor = DatabaseHealthMonitor.getInstance();
      
      // Attempt auto-repair
      const repairSuccess = await healthMonitor.autoRepair();
      
      if (repairSuccess) {
        console.log(`Successfully recovered from database error in ${context}`);
        return true;
      }
    }

    // Log error for debugging
    console.error(`Unrecoverable database error in ${context}:`, {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    return false;
  }

  private isRecoverableError(error: Error): boolean {
    const recoverablePatterns = [
      /database is locked/i,
      /database disk image is malformed/i,
      /no such table/i,
      /constraint failed/i
    ];

    return recoverablePatterns.some(pattern => pattern.test(error.message));
  }
}

// Utility functions for common database operations
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  context: string,
  errorHandler: DatabaseErrorHandler = new DefaultDatabaseErrorHandler()
): Promise<T | null> => {
  try {
    return await operation();
  } catch (error) {
    const recovered = await errorHandler.handleError(error as Error, context);
    
    if (recovered) {
      // Retry the operation once after recovery
      try {
        return await operation();
      } catch (retryError) {
        console.error(`Retry failed for ${context}:`, retryError);
        return null;
      }
    }
    
    return null;
  }
};

export const validateDatabaseState = async (): Promise<boolean> => {
  try {
    const healthMonitor = DatabaseHealthMonitor.getInstance();
    const health = await healthMonitor.performHealthCheck();
    
    if (!health.isHealthy) {
      console.warn('Database health issues detected:', health.issues);
      
      // Attempt auto-repair if issues are found
      const repairSuccess = await healthMonitor.autoRepair();
      
      if (repairSuccess) {
        // Re-check health after repair
        const postRepairHealth = await healthMonitor.performHealthCheck();
        return postRepairHealth.isHealthy;
      }
      
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Database state validation failed:', error);
    return false;
  }
};