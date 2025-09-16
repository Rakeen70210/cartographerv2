import { createSelector } from '@reduxjs/toolkit';
import { RootState } from './store';

// Map selectors
export const selectMapState = (state: RootState) => state.map;
export const selectMapViewport = (state: RootState) => state.map.viewport;
export const selectMapReady = (state: RootState) => state.map.isMapReady;
export const selectMapError = (state: RootState) => state.map.error;
export const selectUserLocation = (state: RootState) => state.map.userLocation;
export const selectFollowUserLocation = (state: RootState) => state.map.followUserLocation;

// Location selectors
export const selectLocationState = (state: RootState) => state.location;
export const selectCurrentLocation = (state: RootState) => state.location.currentLocation;
export const selectLocationTracking = (state: RootState) => state.location.isTracking;
export const selectLocationPermission = (state: RootState) => state.location.hasPermission;
export const selectLocationError = (state: RootState) => state.location.error;

// Exploration selectors
export const selectExplorationState = (state: RootState) => state.exploration;
export const selectExploredAreas = (state: RootState) => state.exploration.exploredAreas;
export const selectExplorationStats = (state: RootState) => state.exploration.stats;
export const selectPendingAreas = (state: RootState) => state.exploration.pendingAreas;

// Fog selectors
export const selectFogState = (state: RootState) => state.fog;
export const selectFogGeometry = (state: RootState) => state.fog.fogGeometry;
export const selectFogVisibility = (state: RootState) => state.fog.isVisible;
export const selectFogOpacity = (state: RootState) => state.fog.opacity;
export const selectFogAnimationInProgress = (state: RootState) => state.fog.animationInProgress;

// Combined selectors
export const selectMapAndLocation = createSelector(
  [selectMapState, selectLocationState],
  (mapState, locationState) => ({
    viewport: mapState.viewport,
    isMapReady: mapState.isMapReady,
    userLocation: mapState.userLocation,
    isTracking: locationState.isTracking,
    hasPermission: locationState.hasPermission,
    currentLocation: locationState.currentLocation,
  })
);

export const selectExplorationProgress = createSelector(
  [selectExplorationStats],
  (stats) => ({
    totalAreas: stats.totalAreasExplored,
    percentage: stats.explorationPercentage,
    streak: stats.currentStreak,
    countries: stats.countriesVisited.length,
    cities: stats.citiesVisited.length,
  })
);

export const selectMapStatus = createSelector(
  [selectMapReady, selectMapError, selectLocationPermission],
  (isReady, error, hasPermission) => ({
    isReady,
    hasError: !!error,
    error,
    hasLocationPermission: hasPermission,
    canShowMap: isReady && !error,
  })
);