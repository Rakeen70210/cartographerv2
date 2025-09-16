import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { MapViewport } from '../../types/map';
import { MAPBOX_CONFIG } from '../../config/mapbox';

interface MapState {
  viewport: MapViewport;
  isMapReady: boolean;
  isLoading: boolean;
  error: string | null;
  userLocation: [number, number] | null;
  followUserLocation: boolean;
  lastViewportUpdate: number;
}

const initialState: MapState = {
  viewport: {
    center: MAPBOX_CONFIG.DEFAULT_CENTER,
    zoom: MAPBOX_CONFIG.DEFAULT_ZOOM,
    bearing: 0,
    pitch: 0,
  },
  isMapReady: false,
  isLoading: true,
  error: null,
  userLocation: null,
  followUserLocation: true,
  lastViewportUpdate: Date.now(),
};

const mapSlice = createSlice({
  name: 'map',
  initialState,
  reducers: {
    setMapReady: (state, action: PayloadAction<boolean>) => {
      state.isMapReady = action.payload;
      state.isLoading = !action.payload;
    },
    
    setMapLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    setMapError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    
    updateViewport: (state, action: PayloadAction<Partial<MapViewport>>) => {
      state.viewport = {
        ...state.viewport,
        ...action.payload,
      };
      state.lastViewportUpdate = Date.now();
    },
    
    setUserLocation: (state, action: PayloadAction<[number, number] | null>) => {
      state.userLocation = action.payload;
      
      // If following user location and we have a location, update viewport
      if (state.followUserLocation && action.payload) {
        state.viewport.center = action.payload;
      }
    },
    
    setFollowUserLocation: (state, action: PayloadAction<boolean>) => {
      state.followUserLocation = action.payload;
      
      // If enabling follow mode and we have user location, center on it
      if (action.payload && state.userLocation) {
        state.viewport.center = state.userLocation;
      }
    },
    
    centerOnLocation: (state, action: PayloadAction<[number, number]>) => {
      state.viewport.center = action.payload;
      state.followUserLocation = false; // Disable follow mode when manually centering
    },
    
    setZoom: (state, action: PayloadAction<number>) => {
      state.viewport.zoom = action.payload;
    },
    
    setBearing: (state, action: PayloadAction<number>) => {
      state.viewport.bearing = action.payload;
    },
    
    setPitch: (state, action: PayloadAction<number>) => {
      state.viewport.pitch = action.payload;
    },
    
    resetViewport: (state) => {
      state.viewport = {
        center: MAPBOX_CONFIG.DEFAULT_CENTER,
        zoom: MAPBOX_CONFIG.DEFAULT_ZOOM,
        bearing: 0,
        pitch: 0,
      };
      state.followUserLocation = true;
    },
  },
});

export const {
  setMapReady,
  setMapLoading,
  setMapError,
  updateViewport,
  setUserLocation,
  setFollowUserLocation,
  centerOnLocation,
  setZoom,
  setBearing,
  setPitch,
  resetViewport,
} = mapSlice.actions;

export default mapSlice.reducer;