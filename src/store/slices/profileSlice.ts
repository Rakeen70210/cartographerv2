import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { getStatisticsService, DetailedStats, ExplorationProgress } from '../../services/statisticsService';
import { Achievement } from '../../database/services';

interface ProfileState {
  stats: DetailedStats | null;
  progress: ExplorationProgress | null;
  achievements: Achievement[];
  explorationHistory: { date: string; areas: number }[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const initialState: ProfileState = {
  stats: null,
  progress: null,
  achievements: [],
  explorationHistory: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
};

// Async thunks for data fetching
export const fetchProfileStats = createAsyncThunk(
  'profile/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const statisticsService = getStatisticsService();
      const [stats, progress, achievements, history] = await Promise.all([
        statisticsService.getDetailedStats(),
        statisticsService.getExplorationProgress(),
        statisticsService.getAchievements(),
        statisticsService.getExplorationHistory(30),
      ]);
      
      return { stats, progress, achievements, history };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch profile stats');
    }
  }
);

export const refreshStats = createAsyncThunk(
  'profile/refreshStats',
  async (_, { rejectWithValue }) => {
    try {
      const statisticsService = getStatisticsService();
      await statisticsService.updateCalculatedStats();
      
      const [stats, progress] = await Promise.all([
        statisticsService.getDetailedStats(),
        statisticsService.getExplorationProgress(),
      ]);
      
      return { stats, progress };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to refresh stats');
    }
  }
);

export const fetchExplorationHistory = createAsyncThunk(
  'profile/fetchHistory',
  async (days: number = 30, { rejectWithValue }) => {
    try {
      const statisticsService = getStatisticsService();
      return await statisticsService.getExplorationHistory(days);
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch exploration history');
    }
  }
);

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    clearProfileError: (state) => {
      state.error = null;
    },
    
    updateAchievementProgress: (state, action: PayloadAction<{ id: number; progress: number; unlocked?: boolean }>) => {
      const { id, progress, unlocked } = action.payload;
      const achievement = state.achievements.find(a => a.id === id);
      if (achievement) {
        achievement.progress = progress;
        if (unlocked) {
          achievement.unlocked_at = new Date().toISOString();
        }
      }
    },
    
    addNewAchievement: (state, action: PayloadAction<Achievement>) => {
      state.achievements.push(action.payload);
    },
    
    setLastUpdated: (state) => {
      state.lastUpdated = Date.now();
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch profile stats
      .addCase(fetchProfileStats.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProfileStats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.stats = action.payload.stats;
        state.progress = action.payload.progress;
        state.achievements = action.payload.achievements;
        state.explorationHistory = action.payload.history;
        state.lastUpdated = Date.now();
        state.error = null;
      })
      .addCase(fetchProfileStats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Refresh stats
      .addCase(refreshStats.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(refreshStats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.stats = action.payload.stats;
        state.progress = action.payload.progress;
        state.lastUpdated = Date.now();
        state.error = null;
      })
      .addCase(refreshStats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      
      // Fetch exploration history
      .addCase(fetchExplorationHistory.fulfilled, (state, action) => {
        state.explorationHistory = action.payload;
      })
      .addCase(fetchExplorationHistory.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  clearProfileError,
  updateAchievementProgress,
  addNewAchievement,
  setLastUpdated,
} = profileSlice.actions;

export default profileSlice.reducer;