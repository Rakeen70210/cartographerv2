import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ExploredArea {
  id: string;
  center: [number, number];
  radius: number;
  exploredAt: number;
  accuracy?: number;
}

interface ExplorationStats {
  totalAreasExplored: number;
  explorationPercentage: number;
  currentStreak: number;
  longestStreak: number;
  totalDistance: number;
  countriesVisited: string[];
  citiesVisited: string[];
}

interface ExplorationState {
  exploredAreas: ExploredArea[];
  stats: ExplorationStats;
  isProcessingLocation: boolean;
  lastExplorationUpdate: number | null;
  pendingAreas: ExploredArea[]; // Areas waiting to be saved to database
  error: string | null;
}

const initialState: ExplorationState = {
  exploredAreas: [],
  stats: {
    totalAreasExplored: 0,
    explorationPercentage: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalDistance: 0,
    countriesVisited: [],
    citiesVisited: [],
  },
  isProcessingLocation: false,
  lastExplorationUpdate: null,
  pendingAreas: [],
  error: null,
};

const explorationSlice = createSlice({
  name: 'exploration',
  initialState,
  reducers: {
    addExploredArea: (state, action: PayloadAction<ExploredArea>) => {
      const newArea = action.payload;
      
      // Check if area already exists (avoid duplicates)
      const exists = state.exploredAreas.some(area => 
        area.id === newArea.id
      );
      
      if (!exists) {
        state.exploredAreas.push(newArea);
        state.pendingAreas.push(newArea);
        state.stats.totalAreasExplored += 1;
        state.lastExplorationUpdate = Date.now();
      }
    },
    
    setExploredAreas: (state, action: PayloadAction<ExploredArea[]>) => {
      state.exploredAreas = action.payload;
      state.stats.totalAreasExplored = action.payload.length;
    },
    
    updateExplorationStats: (state, action: PayloadAction<Partial<ExplorationStats>>) => {
      state.stats = {
        ...state.stats,
        ...action.payload,
      };
    },
    
    setProcessingLocation: (state, action: PayloadAction<boolean>) => {
      state.isProcessingLocation = action.payload;
    },
    
    clearPendingAreas: (state) => {
      state.pendingAreas = [];
    },
    
    removePendingArea: (state, action: PayloadAction<string>) => {
      state.pendingAreas = state.pendingAreas.filter(
        area => area.id !== action.payload
      );
    },
    
    setExplorationError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isProcessingLocation = false;
    },
    
    clearExplorationError: (state) => {
      state.error = null;
    },
    
    incrementStreak: (state) => {
      state.stats.currentStreak += 1;
      if (state.stats.currentStreak > state.stats.longestStreak) {
        state.stats.longestStreak = state.stats.currentStreak;
      }
    },
    
    resetStreak: (state) => {
      state.stats.currentStreak = 0;
    },
    
    addCountryVisited: (state, action: PayloadAction<string>) => {
      const country = action.payload;
      if (!state.stats.countriesVisited.includes(country)) {
        state.stats.countriesVisited.push(country);
      }
    },
    
    addCityVisited: (state, action: PayloadAction<string>) => {
      const city = action.payload;
      if (!state.stats.citiesVisited.includes(city)) {
        state.stats.citiesVisited.push(city);
      }
    },
  },
});

export const {
  addExploredArea,
  setExploredAreas,
  updateExplorationStats,
  setProcessingLocation,
  clearPendingAreas,
  removePendingArea,
  setExplorationError,
  clearExplorationError,
  incrementStreak,
  resetStreak,
  addCountryVisited,
  addCityVisited,
} = explorationSlice.actions;

export default explorationSlice.reducer;