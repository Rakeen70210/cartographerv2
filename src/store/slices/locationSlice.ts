import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface LocationState {
  currentLocation: [number, number] | null;
  isTracking: boolean;
  hasPermission: boolean;
  permissionStatus: 'granted' | 'denied' | 'undetermined';
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  lastUpdate: number | null;
  error: string | null;
  backgroundTracking: boolean;
}

const initialState: LocationState = {
  currentLocation: null,
  isTracking: false,
  hasPermission: false,
  permissionStatus: 'undetermined',
  accuracy: null,
  heading: null,
  speed: null,
  lastUpdate: null,
  error: null,
  backgroundTracking: false,
};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setLocationPermission: (state, action: PayloadAction<{
      hasPermission: boolean;
      status: 'granted' | 'denied' | 'undetermined';
    }>) => {
      state.hasPermission = action.payload.hasPermission;
      state.permissionStatus = action.payload.status;
      state.error = null;
    },
    
    startLocationTracking: (state) => {
      state.isTracking = true;
      state.error = null;
    },
    
    stopLocationTracking: (state) => {
      state.isTracking = false;
    },
    
    updateLocation: (state, action: PayloadAction<{
      coordinates: [number, number];
      accuracy?: number;
      heading?: number;
      speed?: number;
    }>) => {
      const { coordinates, accuracy, heading, speed } = action.payload;
      state.currentLocation = coordinates;
      state.accuracy = accuracy || null;
      state.heading = heading || null;
      state.speed = speed || null;
      state.lastUpdate = Date.now();
      state.error = null;
    },
    
    setLocationError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isTracking = false;
    },
    
    clearLocationError: (state) => {
      state.error = null;
    },
    
    setBackgroundTracking: (state, action: PayloadAction<boolean>) => {
      state.backgroundTracking = action.payload;
    },
    
    resetLocationState: (state) => {
      return initialState;
    },
  },
});

export const {
  setLocationPermission,
  startLocationTracking,
  stopLocationTracking,
  updateLocation,
  setLocationError,
  clearLocationError,
  setBackgroundTracking,
  resetLocationState,
} = locationSlice.actions;

export default locationSlice.reducer;