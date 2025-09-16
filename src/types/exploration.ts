export interface ExplorationArea {
  id: string;
  center: [number, number];
  radius: number;
  exploredAt: Date;
  clearingProgress: number; // 0-1 for animation
}

export interface ExplorationState {
  totalAreasExplored: number;
  explorationPercentage: number;
  currentStreak: number;
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  type: string;
  name: string;
  description: string;
  unlockedAt?: Date;
  progress: number;
}