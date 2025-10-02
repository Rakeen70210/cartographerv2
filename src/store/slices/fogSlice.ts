import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { FogState, FogGeometry } from '../../types/fog';

interface FogSliceState {
  isVisible: boolean;
  opacity: number;
  animationInProgress: boolean;
  lastClearingAnimation: number;
  fogGeometry: FogGeometry | null;
  animationSpeed: number;
  cloudDensity: number;
  activeAnimations: string[];
  clearingAreas: Array<{
    center: [number, number];
    radius: number;
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    };
  }>;
  // Wind configuration
  windDirection: number; // 0-360 degrees
  windSpeed: number; // 0-2 multiplier
  windEnabled: boolean;
  windTurbulence: number; // 0-1
  // Cloud system state
  cloudSystemEnabled: boolean;
  cloudSystemError: string | null;
  cloudSystemInitialized: boolean;
}

const initialState: FogSliceState = {
  isVisible: true,
  opacity: 0.8,
  animationInProgress: false,
  lastClearingAnimation: 0,
  fogGeometry: null,
  animationSpeed: 1.0,
  cloudDensity: 0.7,
  activeAnimations: [],
  clearingAreas: [],
  // Wind configuration
  windDirection: 45, // Northeast direction
  windSpeed: 1.0,
  windEnabled: true,
  windTurbulence: 0.3,
  // Cloud system state
  cloudSystemEnabled: false,
  cloudSystemError: null,
  cloudSystemInitialized: false,
};

const fogSlice = createSlice({
  name: 'fog',
  initialState,
  reducers: {
    setFogVisibility: (state, action: PayloadAction<boolean>) => {
      state.isVisible = action.payload;
    },
    
    setFogOpacity: (state, action: PayloadAction<number>) => {
      state.opacity = Math.max(0, Math.min(1, action.payload));
    },
    
    setFogGeometry: (state, action: PayloadAction<FogGeometry | null>) => {
      state.fogGeometry = action.payload;
    },
    
    startFogClearingAnimation: (state, action: PayloadAction<{
      animationId: string;
      area: {
        center: [number, number];
        radius: number;
        bounds: {
          north: number;
          south: number;
          east: number;
          west: number;
        };
      };
    }>) => {
      state.animationInProgress = true;
      state.lastClearingAnimation = Date.now();
      state.activeAnimations.push(action.payload.animationId);
      state.clearingAreas.push(action.payload.area);
    },
    
    completeFogClearingAnimation: (state, action: PayloadAction<string>) => {
      const animationId = action.payload;
      state.activeAnimations = state.activeAnimations.filter(id => id !== animationId);
      
      // Remove the corresponding clearing area
      if (state.activeAnimations.length === 0) {
        state.animationInProgress = false;
        state.clearingAreas = [];
      }
    },
    
    setAnimationSpeed: (state, action: PayloadAction<number>) => {
      state.animationSpeed = Math.max(0.1, Math.min(3.0, action.payload));
    },
    
    setCloudDensity: (state, action: PayloadAction<number>) => {
      state.cloudDensity = Math.max(0, Math.min(1, action.payload));
    },
    
    updateFogForExploration: (state, action: PayloadAction<{ 
      geometry: FogGeometry;
      animate?: boolean;
    }>) => {
      state.fogGeometry = action.payload.geometry;
      
      if (action.payload.animate) {
        state.animationInProgress = true;
        state.lastClearingAnimation = Date.now();
      }
    },
    
    resetFogState: (state) => {
      state.isVisible = true;
      state.opacity = 0.8;
      state.animationInProgress = false;
      state.fogGeometry = null;
      state.lastClearingAnimation = 0;
      state.activeAnimations = [];
      state.clearingAreas = [];
    },

    setCloudAnimationEnabled: (state, action: PayloadAction<boolean>) => {
      // This can be used to enable/disable cloud animations for performance
      state.animationInProgress = action.payload;
    },

    updateCloudSettings: (state, action: PayloadAction<{
      animationSpeed?: number;
      cloudDensity?: number;
    }>) => {
      if (action.payload.animationSpeed !== undefined) {
        state.animationSpeed = Math.max(0.1, Math.min(3.0, action.payload.animationSpeed));
      }
      if (action.payload.cloudDensity !== undefined) {
        state.cloudDensity = Math.max(0, Math.min(1, action.payload.cloudDensity));
      }
    },

    // Wind configuration actions
    setWindDirection: (state, action: PayloadAction<number>) => {
      state.windDirection = Math.max(0, Math.min(360, action.payload)) % 360;
    },

    setWindSpeed: (state, action: PayloadAction<number>) => {
      state.windSpeed = Math.max(0, Math.min(2, action.payload));
    },

    setWindEnabled: (state, action: PayloadAction<boolean>) => {
      state.windEnabled = action.payload;
    },

    setWindTurbulence: (state, action: PayloadAction<number>) => {
      state.windTurbulence = Math.max(0, Math.min(1, action.payload));
    },

    updateWindSettings: (state, action: PayloadAction<{
      direction?: number;
      speed?: number;
      enabled?: boolean;
      turbulence?: number;
    }>) => {
      if (action.payload.direction !== undefined) {
        state.windDirection = Math.max(0, Math.min(360, action.payload.direction)) % 360;
      }
      if (action.payload.speed !== undefined) {
        state.windSpeed = Math.max(0, Math.min(2, action.payload.speed));
      }
      if (action.payload.enabled !== undefined) {
        state.windEnabled = action.payload.enabled;
      }
      if (action.payload.turbulence !== undefined) {
        state.windTurbulence = Math.max(0, Math.min(1, action.payload.turbulence));
      }
    },

    // Cloud system actions
    setCloudSystemEnabled: (state, action: PayloadAction<boolean>) => {
      state.cloudSystemEnabled = action.payload;
      if (action.payload) {
        state.cloudSystemError = null; // Clear error when enabling
      }
    },

    setCloudSystemError: (state, action: PayloadAction<string | null>) => {
      state.cloudSystemError = action.payload;
      if (action.payload) {
        state.cloudSystemEnabled = false; // Disable on error
      }
    },

    setCloudSystemInitialized: (state, action: PayloadAction<boolean>) => {
      state.cloudSystemInitialized = action.payload;
    },

    updateCloudState: (state, action: PayloadAction<{
      enabled?: boolean;
      error?: string | null;
      initialized?: boolean;
    }>) => {
      if (action.payload.enabled !== undefined) {
        state.cloudSystemEnabled = action.payload.enabled;
      }
      if (action.payload.error !== undefined) {
        state.cloudSystemError = action.payload.error;
      }
      if (action.payload.initialized !== undefined) {
        state.cloudSystemInitialized = action.payload.initialized;
      }
    },

    // Enhanced dissipation animation actions
    updateAnimationProgress: (state, action: PayloadAction<{
      animationId: string;
      progress: number;
    }>) => {
      // This can be used to track animation progress for UI feedback
      const { animationId, progress } = action.payload;
      // Store progress information if needed for UI
    },

    batchStartClearingAnimations: (state, action: PayloadAction<Array<{
      animationId: string;
      area: {
        center: [number, number];
        radius: number;
        bounds: {
          north: number;
          south: number;
          east: number;
          west: number;
        };
      };
    }>>) => {
      state.animationInProgress = true;
      state.lastClearingAnimation = Date.now();
      
      action.payload.forEach(({ animationId, area }) => {
        state.activeAnimations.push(animationId);
        state.clearingAreas.push(area);
      });
    },

    batchCompleteClearingAnimations: (state, action: PayloadAction<string[]>) => {
      const completedIds = action.payload;
      
      completedIds.forEach(animationId => {
        state.activeAnimations = state.activeAnimations.filter(id => id !== animationId);
      });
      
      // Update clearing areas - remove completed ones
      // Note: This is a simplified approach. In practice, you might want more sophisticated tracking
      if (state.activeAnimations.length === 0) {
        state.animationInProgress = false;
        state.clearingAreas = [];
      }
    },
  },
});

export const {
  setFogVisibility,
  setFogOpacity,
  setFogGeometry,
  startFogClearingAnimation,
  completeFogClearingAnimation,
  setAnimationSpeed,
  setCloudDensity,
  updateFogForExploration,
  resetFogState,
  setCloudAnimationEnabled,
  updateCloudSettings,
  setWindDirection,
  setWindSpeed,
  setWindEnabled,
  setWindTurbulence,
  updateWindSettings,
  setCloudSystemEnabled,
  setCloudSystemError,
  setCloudSystemInitialized,
  updateCloudState,
  updateAnimationProgress,
  batchStartClearingAnimations,
  batchCompleteClearingAnimations,
} = fogSlice.actions;

// Convenience exports
export const setFogVisible = setFogVisibility;

export default fogSlice.reducer;