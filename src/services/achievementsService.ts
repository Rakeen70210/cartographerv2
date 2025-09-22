import { getDatabaseService, Achievement } from '../database/services';

export interface AchievementDefinition {
  type: string;
  name: string;
  description: string;
  checkProgress: (stats: any) => number;
  maxProgress?: number;
}

export class AchievementsService {
  private dbService = getDatabaseService();
  
  private achievementDefinitions: AchievementDefinition[] = [
    {
      type: 'first_steps',
      name: 'First Steps',
      description: 'Explore your first area',
      checkProgress: (stats) => stats.total_areas_explored > 0 ? 100 : 0,
    },
    {
      type: 'explorer',
      name: 'Explorer',
      description: 'Explore 10 different areas',
      checkProgress: (stats) => Math.min((stats.total_areas_explored / 10) * 100, 100),
    },
    {
      type: 'adventurer',
      name: 'Adventurer',
      description: 'Explore 50 different areas',
      checkProgress: (stats) => Math.min((stats.total_areas_explored / 50) * 100, 100),
    },
    {
      type: 'cartographer',
      name: 'Cartographer',
      description: 'Explore 100 different areas',
      checkProgress: (stats) => Math.min((stats.total_areas_explored / 100) * 100, 100),
    },
    {
      type: 'distance_walker',
      name: 'Distance Walker',
      description: 'Travel 10 kilometers total',
      checkProgress: (stats) => Math.min((stats.total_distance / 10) * 100, 100),
    },
    {
      type: 'marathon_explorer',
      name: 'Marathon Explorer',
      description: 'Travel 42 kilometers total',
      checkProgress: (stats) => Math.min((stats.total_distance / 42) * 100, 100),
    },
    {
      type: 'streak_starter',
      name: 'Streak Starter',
      description: 'Maintain a 3-day exploration streak',
      checkProgress: (stats) => Math.min((stats.current_streak / 3) * 100, 100),
    },
    {
      type: 'dedicated_explorer',
      name: 'Dedicated Explorer',
      description: 'Maintain a 7-day exploration streak',
      checkProgress: (stats) => Math.min((stats.current_streak / 7) * 100, 100),
    },
    {
      type: 'exploration_master',
      name: 'Exploration Master',
      description: 'Maintain a 30-day exploration streak',
      checkProgress: (stats) => Math.min((stats.current_streak / 30) * 100, 100),
    },
    {
      type: 'area_coverage',
      name: 'Area Coverage',
      description: 'Achieve 10% area exploration',
      checkProgress: (stats) => Math.min((stats.exploration_percentage / 10) * 100, 100),
    },
    {
      type: 'local_expert',
      name: 'Local Expert',
      description: 'Achieve 25% area exploration',
      checkProgress: (stats) => Math.min((stats.exploration_percentage / 25) * 100, 100),
    },
    {
      type: 'region_master',
      name: 'Region Master',
      description: 'Achieve 50% area exploration',
      checkProgress: (stats) => Math.min((stats.exploration_percentage / 50) * 100, 100),
    },
  ];

  async initializeAchievements(): Promise<void> {
    try {
      const existingAchievements = await this.dbService.getAllAchievements();
      const existingTypes = new Set(existingAchievements.map(a => a.type));

      // Create achievements that don't exist yet
      for (const definition of this.achievementDefinitions) {
        if (!existingTypes.has(definition.type)) {
          await this.dbService.createAchievement({
            type: definition.type,
            name: definition.name,
            description: definition.description,
            progress: 0,
          });
        }
      }
    } catch (error) {
      console.error('Failed to initialize achievements:', error);
    }
  }

  async updateAchievementProgress(stats: any): Promise<Achievement[]> {
    try {
      const achievements = await this.dbService.getAllAchievements();
      const updatedAchievements: Achievement[] = [];

      for (const achievement of achievements) {
        const definition = this.achievementDefinitions.find(d => d.type === achievement.type);
        if (!definition) continue;

        const newProgress = definition.checkProgress(stats);
        const wasUnlocked = !!achievement.unlocked_at;
        const isNowUnlocked = newProgress >= 100;

        if (newProgress !== achievement.progress || (!wasUnlocked && isNowUnlocked)) {
          const unlocked_at = isNowUnlocked && !wasUnlocked 
            ? new Date().toISOString() 
            : achievement.unlocked_at;

          await this.dbService.updateAchievementProgress(
            achievement.id!,
            newProgress,
            unlocked_at || undefined
          );

          updatedAchievements.push({
            ...achievement,
            progress: newProgress,
            unlocked_at,
          });
        }
      }

      return updatedAchievements;
    } catch (error) {
      console.error('Failed to update achievement progress:', error);
      return [];
    }
  }

  async getUnlockedAchievements(): Promise<Achievement[]> {
    try {
      const achievements = await this.dbService.getAllAchievements();
      return achievements.filter(a => a.unlocked_at);
    } catch (error) {
      console.error('Failed to get unlocked achievements:', error);
      return [];
    }
  }

  async getAchievementProgress(): Promise<{ total: number; unlocked: number; percentage: number }> {
    try {
      const achievements = await this.dbService.getAllAchievements();
      const unlocked = achievements.filter(a => a.unlocked_at).length;
      const total = achievements.length;
      const percentage = total > 0 ? (unlocked / total) * 100 : 0;

      return { total, unlocked, percentage };
    } catch (error) {
      console.error('Failed to get achievement progress:', error);
      return { total: 0, unlocked: 0, percentage: 0 };
    }
  }
}

// Singleton instance
let achievementsService: AchievementsService | null = null;

export const getAchievementsService = (): AchievementsService => {
  if (!achievementsService) {
    achievementsService = new AchievementsService();
  }
  return achievementsService;
};