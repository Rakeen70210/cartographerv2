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
  setCloudSystemEnabled,
  setCloudSystemError,
  setCloudSystemInitialized,
  updateCloudState,
} = fogSlice.actions;

// Convenience exports
export const setFogVisible = setFogVisibility;

export default fogSlice.reducer;