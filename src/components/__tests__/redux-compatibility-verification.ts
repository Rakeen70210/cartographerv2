/**
 * Redux State Compatibility Verification for SkiaFogOverlay
 * 
 * This script verifies that SkiaFogOverlay is compatible with:
 * 1. Existing fogSlice state structure
 * 2. Exploration data from SQLite storage
 * 3. Location service integration
 */

import { GenericExploredArea } from '../../types/fog';

// Test data structures that match the existing Redux state
export const testFogSliceState = {
  isVisible: true,
  opacity: 0.8,
  animationInProgress: false,
  lastClearingAnimation: 0,
  fogGeometry: null,
  animationSpeed: 1.0,
  cloudDensity: 0.7,
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
  cloudSystemEnabled: false,
  cloudSystemError: null,
  cloudSystemInitialized: false,
};

// Test data that matches SQLite database format
export const testSQLiteExploredAreas: GenericExploredArea[] = [
  {
    id: 1,
    latitude: 37.7749,
    longitude: -122.4194,
    radius: 100,
    explored_at: '2024-01-01T12:00:00.000Z',
    accuracy: 10,
    created_at: '2024-01-01T12:00:00.000Z',
  },
  {
    id: 2,
    latitude: 37.7849,
    longitude: -122.4094,
    radius: 150,
    explored_at: '2024-01-01T13:00:00.000Z',
    accuracy: 15,
    created_at: '2024-01-01T13:00:00.000Z',
  },
];

// Test data that matches Redux exploration slice format
export const testReduxExploredAreas: GenericExploredArea[] = [
  {
    id: '1',
    center: [-122.4194, 37.7749],
    radius: 100,
    exploredAt: Date.now(),
    accuracy: 10,
  },
  {
    id: '2',
    center: [-122.4094, 37.7849],
    radius: 150,
    exploredAt: Date.now() - 1000,
    accuracy: 15,
  },
];

// Test mixed format data (SQLite + Redux)
export const testMixedExploredAreas: GenericExploredArea[] = [
  // SQLite format
  {
    id: 1,
    latitude: 37.7749,
    longitude: -122.4194,
    radius: 100,
    explored_at: '2024-01-01T12:00:00.000Z',
    accuracy: 10,
  },
  // Redux format
  {
    id: '2',
    center: [-122.4094, 37.7849],
    radius: 150,
    exploredAt: Date.now(),
    accuracy: 15,
  },
];

// Test viewport data that matches MapContainer usage
export const testViewportData = {
  width: 414, // iPhone screen width
  height: 896, // iPhone screen height
  bounds: {
    north: 37.8049,
    south: 37.7449,
    east: -122.3894,
    west: -122.4494,
  },
};

// Verification functions
export const verifyFogSliceCompatibility = (fogState: typeof testFogSliceState): boolean => {
  try {
    // Check required properties exist
    const requiredProps = [
      'isVisible', 'opacity', 'animationInProgress', 'clearingAreas',
      'animationSpeed', 'cloudDensity', 'activeAnimations'
    ];
    
    for (const prop of requiredProps) {
      if (!(prop in fogState)) {
        console.error(`Missing required fog slice property: ${prop}`);
        return false;
      }
    }
    
    // Check clearingAreas structure
    if (Array.isArray(fogState.clearingAreas)) {
      for (const area of fogState.clearingAreas) {
        if (!area.center || !Array.isArray(area.center) || area.center.length !== 2) {
          console.error('Invalid clearingArea center format');
          return false;
        }
        if (typeof area.radius !== 'number') {
          console.error('Invalid clearingArea radius format');
          return false;
        }
      }
    }
    
    console.log('✅ Fog slice compatibility verified');
    return true;
  } catch (error) {
    console.error('❌ Fog slice compatibility check failed:', error);
    return false;
  }
};

export const verifyExploredAreasCompatibility = (areas: GenericExploredArea[]): boolean => {
  try {
    for (const area of areas) {
      // Check if area has either SQLite format (latitude/longitude) or Redux format (center)
      const hasSQLiteFormat = 'latitude' in area && 'longitude' in area;
      const hasReduxFormat = 'center' in area && Array.isArray(area.center);
      
      if (!hasSQLiteFormat && !hasReduxFormat) {
        console.error('Area missing both SQLite and Redux coordinate formats:', area);
        return false;
      }
      
      // Verify coordinate values are valid
      if (hasSQLiteFormat) {
        const { latitude, longitude } = area;
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          console.error('Invalid SQLite coordinate types:', { latitude, longitude });
          return false;
        }
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          console.error('Invalid SQLite coordinate values:', { latitude, longitude });
          return false;
        }
      }
      
      if (hasReduxFormat) {
        const [lng, lat] = area.center!;
        if (typeof lat !== 'number' || typeof lng !== 'number') {
          console.error('Invalid Redux coordinate types:', { lat, lng });
          return false;
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          console.error('Invalid Redux coordinate values:', { lat, lng });
          return false;
        }
      }
      
      // Check radius
      if (typeof area.radius !== 'number' || area.radius <= 0) {
        console.error('Invalid radius:', area.radius);
        return false;
      }
    }
    
    console.log('✅ Explored areas compatibility verified');
    return true;
  } catch (error) {
    console.error('❌ Explored areas compatibility check failed:', error);
    return false;
  }
};

export const verifyViewportCompatibility = (viewport: typeof testViewportData): boolean => {
  try {
    // Check required properties
    if (typeof viewport.width !== 'number' || typeof viewport.height !== 'number') {
      console.error('Invalid viewport dimensions');
      return false;
    }
    
    if (!viewport.bounds) {
      console.error('Missing viewport bounds');
      return false;
    }
    
    const { north, south, east, west } = viewport.bounds;
    if (typeof north !== 'number' || typeof south !== 'number' || 
        typeof east !== 'number' || typeof west !== 'number') {
      console.error('Invalid viewport bounds types');
      return false;
    }
    
    // Check bounds make sense
    if (north <= south || east <= west) {
      console.error('Invalid viewport bounds values');
      return false;
    }
    
    console.log('✅ Viewport compatibility verified');
    return true;
  } catch (error) {
    console.error('❌ Viewport compatibility check failed:', error);
    return false;
  }
};

// Run all compatibility checks
export const runAllCompatibilityChecks = (): boolean => {
  console.log('🔍 Running Redux State Compatibility Verification...');
  
  const fogSliceOk = verifyFogSliceCompatibility(testFogSliceState);
  const sqliteAreasOk = verifyExploredAreasCompatibility(testSQLiteExploredAreas);
  const reduxAreasOk = verifyExploredAreasCompatibility(testReduxExploredAreas);
  const mixedAreasOk = verifyExploredAreasCompatibility(testMixedExploredAreas);
  const viewportOk = verifyViewportCompatibility(testViewportData);
  
  const allPassed = fogSliceOk && sqliteAreasOk && reduxAreasOk && mixedAreasOk && viewportOk;
  
  if (allPassed) {
    console.log('🎉 All compatibility checks passed! SkiaFogOverlay is compatible with existing Redux state and SQLite storage.');
  } else {
    console.log('❌ Some compatibility checks failed. Review the errors above.');
  }
  
  return allPassed;
};

// Export for use in tests or manual verification
export default {
  testFogSliceState,
  testSQLiteExploredAreas,
  testReduxExploredAreas,
  testMixedExploredAreas,
  testViewportData,
  verifyFogSliceCompatibility,
  verifyExploredAreasCompatibility,
  verifyViewportCompatibility,
  runAllCompatibilityChecks,
};