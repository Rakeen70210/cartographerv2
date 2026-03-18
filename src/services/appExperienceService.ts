import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ProgressSnapshot {
  percentageExplored: number;
  currentStreak: number;
  areasExploredToday: number;
}

export interface BootstrapSnapshot {
  activeTab: 'explore' | 'progress' | 'me';
  progress?: ProgressSnapshot;
  updatedAt: number;
}

const BOOTSTRAP_SNAPSHOT_KEY = 'cartographer.bootstrap_snapshot';

class AppExperienceService {
  async loadBootstrapSnapshot(): Promise<BootstrapSnapshot | null> {
    try {
      const rawSnapshot = await AsyncStorage.getItem(BOOTSTRAP_SNAPSHOT_KEY);
      if (!rawSnapshot) {
        return null;
      }

      return JSON.parse(rawSnapshot) as BootstrapSnapshot;
    } catch (error) {
      console.error('Failed to load bootstrap snapshot:', error);
      return null;
    }
  }

  async saveBootstrapSnapshot(snapshot: BootstrapSnapshot): Promise<void> {
    try {
      const existingSnapshot = await this.loadBootstrapSnapshot();
      await AsyncStorage.setItem(
        BOOTSTRAP_SNAPSHOT_KEY,
        JSON.stringify({
          ...existingSnapshot,
          ...snapshot,
        })
      );
    } catch (error) {
      console.error('Failed to save bootstrap snapshot:', error);
    }
  }
}

export const appExperienceService = new AppExperienceService();
