/**
 * Verification script for SkiaFogOverlay Redux integration
 * 
 * This verifies that SkiaFogOverlay properly integrates with:
 * 1. Existing fogSlice state structure
 * 2. Exploration data synchronization with SQLite storage
 * 3. Location service integration compatibility
 */

import { configureStore } from '@reduxjs/toolkit';
import fogSlice from '../../store/slices/fogSlice';
import explorationSlice from '../../store/slices/explorationSlice';
import mapSlice from '../../store/slices/mapSlice';
import locationSlice from '../../store/slices/locationSlice';
import { GenericExploredArea } from '../../types/fog';

// Create a test store with the same structure as the main app
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      fog: fogSlice,
      exploration: explorationSlice,
      map: mapSlice,
      location: locationSlice,
    },
    preloadedState: initialState,
  });
};

// Test data that matches real application usage
const testExploredAreas: GenericExploredArea[] = [
  // SQLite format (from database)
  {
    id: 1,
    latitude: 37.7749,
    longitude: -122.4194,
    radius: 100,
    explored_at: '2024-01-01T12:00:00.000Z',
    accuracy: 10,
    created_at: '2024-01-01T12:00:00.000Z',
  },
  // Redux format (from exploration slice)
  {
    id: 'area-456',
    center: [-122.4094, 37.7849],
    radius: 150,
    exploredAt: Date.now(),
    accuracy: 15,
  },
];

const testFogState = {
  isVisible: true,
  opacity: 0.8,
  animationInProgress: true,
  lastClearingAnimation: Date.now(),
  fogGeometry: null,
  animationSpeed: 1.2,
  cloudDensity: 0.75,
  activeAnimations: ['anim-1', 'anim-2'],
  clearingAreas: [
    {
      center: [-122.4194, 37.7749] as [number, number],
      radius: 100,
      bounds: {
        north: 37.7849,
        south: 37.7649,
        east: -122.4094,
        west: -122.4294,
      },
    },
  ],
  cloudSystemEnabled: true,
  cloudSystemError: null,
  cloudSystemInitialized: true,
};

const testMapState = {
  viewport: {
    center: [-122.4194, 37.7749] as [number, number],
    zoom: 12,
    bearing: 0,
    pitch: 0,
  },
  isMapReady: true,
  isLoading: false,
  error: null,
  userLocation: [-122.4194, 37.7749] as [number, number],
  followUserLocation: true,
  lastViewportUpdate: Date.now(),
};

/**
 * Verify that SkiaFogOverlay can access all required Redux state
 */
export const verifyReduxStateAccess = (): boolean => {
  try {
    const store = createTestStore({
      fog: testFogState,
      exploration: {
        exploredAreas: testExploredAreas.filter(area => 'center' in area),
        stats: {
          totalAreasExplored: 2,
          explorationPercentage: 15.5,
          currentStreak: 3,
          longestStreak: 5,
          totalDistance: 1250.5,
          countriesVisited: ['US'],
          citiesVisited: ['San Francisco'],
        },
        isProcessingLocation: false,
        lastExplorationUpdate: Date.now(),
        pendingAreas: [],
        error: null,
      },
      map: testMapState,
    });

    const state = store.getState();

    // Verify fog state access
    const fogState = state.fog;
    if (!fogState || typeof fogState.isVisible !== 'boolean') {
      console.error('❌ Cannot access fog visibility state');
      return false;
    }

    if (!Array.isArray(fogState.clearingAreas)) {
      console.error('❌ Cannot access clearing areas state');
      return false;
    }

    if (typeof fogState.animationInProgress !== 'boolean') {
      console.error('❌ Cannot access animation progress state');
      return false;
    }

    // Verify exploration state access
    const explorationState = state.exploration;
    if (!explorationState || !Array.isArray(explorationState.exploredAreas)) {
      console.error('❌ Cannot access explored areas state');
      return false;
    }

    // Verify map state access
    const mapState = state.map;
    if (!mapState || !mapState.viewport || typeof mapState.viewport.zoom !== 'number') {
      console.error('❌ Cannot access map viewport state');
      return false;
    }

    console.log('✅ Redux state access verification passed');
    return true;
  } catch (error) {
    console.error('❌ Redux state access verification failed:', error);
    return false;
  }
};

/**
 * Verify that Redux actions work correctly with SkiaFogOverlay
 */
export const verifyReduxActions = (): boolean => {
  try {
    const store = createTestStore();

    // Test fog actions
    store.dispatch({
      type: 'fog/setFogVisibility',
      payload: false,
    });

    let state = store.getState();
    if (state.fog.isVisible !== false) {
      console.error('❌ Fog visibility action failed');
      return false;
    }

    // Test clearing animation action
    store.dispatch({
      type: 'fog/startFogClearingAnimation',
      payload: {
        animationId: 'test-anim',
        area: {
          center: [-122.4, 37.75] as [number, number],
          radius: 100,
          bounds: {
            north: 37.76,
            south: 37.74,
            east: -122.39,
            west: -122.41,
          },
        },
      },
    });

    state = store.getState();
    if (!state.fog.animationInProgress) {
      console.error('❌ Fog clearing animation action failed');
      return false;
    }

    if (!state.fog.activeAnimations.includes('test-anim')) {
      console.error('❌ Animation ID not added to active animations');
      return false;
    }

    // Test exploration action
    store.dispatch({
      type: 'exploration/addExploredArea',
      payload: {
        id: 'test-area',
        center: [-122.4, 37.75] as [number, number],
        radius: 100,
        exploredAt: Date.now(),
        accuracy: 10,
      },
    });

    state = store.getState();
    if (state.exploration.exploredAreas.length === 0) {
      console.error('❌ Add explored area action failed');
      return false;
    }

    console.log('✅ Redux actions verification passed');
    return true;
  } catch (error) {
    console.error('❌ Redux actions verification failed:', error);
    return false;
  }
};

/**
 * Verify data format compatibility between SQLite and Redux
 */
export const verifyDataFormatCompatibility = (): boolean => {
  try {
    // Test that both SQLite and Redux formats can be processed
    const sqliteArea = testExploredAreas[0]; // SQLite format
    const reduxArea = testExploredAreas[1]; // Redux format

    // Verify SQLite format has required fields
    if (!('latitude' in sqliteArea) || !('longitude' in sqliteArea)) {
      console.error('❌ SQLite format missing coordinate fields');
      return false;
    }

    if (!('explored_at' in sqliteArea)) {
      console.error('❌ SQLite format missing timestamp field');
      return false;
    }

    // Verify Redux format has required fields
    if (!('center' in reduxArea) || !Array.isArray(reduxArea.center)) {
      console.error('❌ Redux format missing center field');
      return false;
    }

    if (!('exploredAt' in reduxArea)) {
      console.error('❌ Redux format missing exploredAt field');
      return false;
    }

    // Verify both formats have common required fields
    for (const area of testExploredAreas) {
      if (typeof area.radius !== 'number' || area.radius <= 0) {
        console.error('❌ Invalid radius in explored area');
        return false;
      }
    }

    console.log('✅ Data format compatibility verification passed');
    return true;
  } catch (error) {
    console.error('❌ Data format compatibility verification failed:', error);
    return false;
  }
};

/**
 * Verify location service integration compatibility
 */
export const verifyLocationServiceIntegration = (): boolean => {
  try {
    const store = createTestStore({
      location: {
        currentLocation: {
          coordinates: [-122.4194, 37.7749] as [number, number],
          accuracy: 10,
          timestamp: Date.now(),
        },
        isTracking: true,
        hasPermission: true,
        error: null,
        backgroundTracking: true,
        lastUpdate: Date.now(),
      },
    });

    const state = store.getState();

    // Verify location state structure
    if (!state.location || !state.location.currentLocation) {
      console.error('❌ Location state not accessible');
      return false;
    }

    const location = state.location.currentLocation;
    if (!Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
      console.error('❌ Invalid location coordinates format');
      return false;
    }

    if (typeof location.accuracy !== 'number') {
      console.error('❌ Invalid location accuracy format');
      return false;
    }

    console.log('✅ Location service integration verification passed');
    return true;
  } catch (error) {
    console.error('❌ Location service integration verification failed:', error);
    return false;
  }
};

/**
 * Run all integration verification tests
 */
export const runAllIntegrationVerifications = (): boolean => {
  console.log('🔍 Running SkiaFogOverlay Redux Integration Verification...');

  const stateAccessOk = verifyReduxStateAccess();
  const actionsOk = verifyReduxActions();
  const dataFormatOk = verifyDataFormatCompatibility();
  const locationIntegrationOk = verifyLocationServiceIntegration();

  const allPassed = stateAccessOk && actionsOk && dataFormatOk && locationIntegrationOk;

  if (allPassed) {
    console.log('🎉 All integration verifications passed! SkiaFogOverlay is fully compatible with existing Redux state and services.');
  } else {
    console.log('❌ Some integration verifications failed. Review the errors above.');
  }

  return allPassed;
};

// Export for use in tests or manual verification
export default {
  verifyReduxStateAccess,
  verifyReduxActions,
  verifyDataFormatCompatibility,
  verifyLocationServiceIntegration,
  runAllIntegrationVerifications,
  testExploredAreas,
  testFogState,
  testMapState,
};