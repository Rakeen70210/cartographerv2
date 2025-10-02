import React from 'react';
import { render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { SkiaFogOverlay } from '../SkiaFogOverlay';
import fogSlice from '../../store/slices/fogSlice';
import explorationSlice from '../../store/slices/explorationSlice';
import { GenericExploredArea } from '../../types/fog';

// Mock Skia components
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: ({ children }: any) => children,
  Fill: ({ children }: any) => children,
  Path: ({ children }: any) => children,
  useSharedValueEffect: jest.fn(),
  useClock: () => ({ current: 0 }),
  Shader: ({ children }: any) => children,
  Group: ({ children }: any) => children,
}));

// Mock performance monitoring hook
jest.mock('../../hooks/useSkiaPerformanceMonitoring', () => ({
  useSkiaPerformanceMonitoring: () => ({
    isInitialized: true,
    currentQuality: {
      animationSpeed: 1.0,
      cloudDensity: 0.7,
      shaderComplexity: 'standard',
      blurRadius: 8,
      updateFrequency: 60,
      enableLayeredEffects: true,
    },
    metrics: { currentFPS: 60 },
    isPerformanceAcceptable: true,
    debugInfo: {},
    forceQualityReduction: jest.fn(),
  }),
}));

// Mock shader system
jest.mock('../../services/cloudSystem/shaders/SkiaShaderSystem', () => ({
  SkiaShaderSystem: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    getSystemState: jest.fn().mockReturnValue({ isUsingFallback: false }),
    updateUniforms: jest.fn().mockReturnValue({ success: true }),
    getActiveShader: jest.fn().mockReturnValue({}),
    getUniformsForSkia: jest.fn().mockReturnValue({}),
    setShaderComplexity: jest.fn(),
    performHealthCheck: jest.fn().mockResolvedValue(true),
    pauseAnimation: jest.fn(),
    resumeAnimation: jest.fn(),
    dispose: jest.fn(),
  })),
}));

// Mock masking system
jest.mock('../../services/cloudSystem/integration/FogMaskingSystem', () => ({
  FogMaskingSystem: jest.fn().mockImplementation(() => ({
    generateFogMask: jest.fn().mockReturnValue({
      combinedMaskPath: {},
      maskPaint: {},
      layeredEffects: [],
    }),
    updateConfig: jest.fn(),
    clearCaches: jest.fn(),
  })),
  DEFAULT_FOG_MASKING_CONFIG: {
    performanceMode: 'mid',
    enableAdaptiveBlur: true,
    enableLayeredBlur: false,
    blurRadius: 8,
  },
}));

// Mock fog dissipation service
jest.mock('../../services/fogDissipationService', () => ({
  fogDissipationService: {
    getActiveAnimations: jest.fn().mockReturnValue([]),
    syncWithReduxState: jest.fn(),
    cleanup: jest.fn(),
  },
}));

describe('SkiaFogOverlay Redux Integration', () => {
  const createTestStore = (initialState = {}) => {
    return configureStore({
      reducer: {
        fog: fogSlice,
        exploration: explorationSlice,
      },
      preloadedState: {
        fog: {
          isVisible: true,
          opacity: 0.8,
          animationInProgress: false,
          lastClearingAnimation: 0,
          fogGeometry: null,
          animationSpeed: 1.0,
          cloudDensity: 0.7,
          activeAnimations: [],
          clearingAreas: [],
          cloudSystemEnabled: false,
          cloudSystemError: null,
          cloudSystemInitialized: false,
          ...initialState.fog,
        },
        exploration: {
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
          ...initialState.exploration,
        },
      },
    });
  };

  const defaultProps = {
    exploredAreas: [] as GenericExploredArea[],
    zoomLevel: 10,
    viewport: {
      width: 400,
      height: 600,
      bounds: { north: 37.8, south: 37.7, east: -122.3, west: -122.5 },
    },
  };

  it('should render without crashing with empty Redux state', () => {
    const store = createTestStore();
    
    expect(() => {
      render(
        <Provider store={store}>
          <SkiaFogOverlay {...defaultProps} />
        </Provider>
      );
    }).not.toThrow();
  });

  it('should handle explored areas from Redux state', () => {
    const exploredAreas: GenericExploredArea[] = [
      {
        id: '1',
        center: [-122.4, 37.75],
        radius: 100,
        exploredAt: Date.now(),
        accuracy: 10,
      },
      {
        id: '2',
        center: [-122.41, 37.76],
        radius: 150,
        exploredAt: Date.now() - 1000,
        accuracy: 15,
      },
    ];

    const store = createTestStore({
      exploration: {
        exploredAreas: exploredAreas.map(area => ({
          id: area.id,
          center: area.center!,
          radius: area.radius,
          exploredAt: area.exploredAt!,
          accuracy: area.accuracy,
        })),
      },
    });

    expect(() => {
      render(
        <Provider store={store}>
          <SkiaFogOverlay {...defaultProps} exploredAreas={exploredAreas} />
        </Provider>
      );
    }).not.toThrow();
  });

  it('should handle clearing areas from fog slice', () => {
    const clearingAreas = [
      {
        center: [-122.4, 37.75] as [number, number],
        radius: 100,
        bounds: {
          north: 37.76,
          south: 37.74,
          east: -122.39,
          west: -122.41,
        },
      },
    ];

    const store = createTestStore({
      fog: {
        clearingAreas,
        animationInProgress: true,
        activeAnimations: ['anim-1'],
      },
    });

    expect(() => {
      render(
        <Provider store={store}>
          <SkiaFogOverlay {...defaultProps} />
        </Provider>
      );
    }).not.toThrow();
  });

  it('should handle fog configuration from Redux state', () => {
    const store = createTestStore({
      fog: {
        opacity: 0.6,
        animationSpeed: 1.5,
        cloudDensity: 0.9,
        isVisible: true,
      },
    });

    expect(() => {
      render(
        <Provider store={store}>
          <SkiaFogOverlay {...defaultProps} />
        </Provider>
      );
    }).not.toThrow();
  });

  it('should handle different explored area formats', () => {
    // Test compatibility with different data formats from SQLite vs Redux
    const mixedExploredAreas: GenericExploredArea[] = [
      // SQLite format
      {
        id: 1,
        latitude: 37.75,
        longitude: -122.4,
        radius: 100,
        explored_at: new Date().toISOString(),
        accuracy: 10,
      },
      // Redux format
      {
        id: '2',
        center: [-122.41, 37.76],
        radius: 150,
        exploredAt: Date.now(),
        accuracy: 15,
      },
    ];

    const store = createTestStore();

    expect(() => {
      render(
        <Provider store={store}>
          <SkiaFogOverlay {...defaultProps} exploredAreas={mixedExploredAreas} />
        </Provider>
      );
    }).not.toThrow();
  });

  it('should handle performance monitoring integration', () => {
    const store = createTestStore();

    expect(() => {
      render(
        <Provider store={store}>
          <SkiaFogOverlay 
            {...defaultProps} 
            enablePerformanceMonitoring={true}
            targetFPS={30}
          />
        </Provider>
      );
    }).not.toThrow();
  });

  it('should handle viewport changes', () => {
    const store = createTestStore();
    
    const { rerender } = render(
      <Provider store={store}>
        <SkiaFogOverlay {...defaultProps} />
      </Provider>
    );

    // Update viewport
    const newViewport = {
      width: 500,
      height: 700,
      bounds: { north: 37.9, south: 37.6, east: -122.2, west: -122.6 },
    };

    expect(() => {
      rerender(
        <Provider store={store}>
          <SkiaFogOverlay {...defaultProps} viewport={newViewport} />
        </Provider>
      );
    }).not.toThrow();
  });

  it('should handle zoom level changes', () => {
    const store = createTestStore();
    
    const { rerender } = render(
      <Provider store={store}>
        <SkiaFogOverlay {...defaultProps} zoomLevel={10} />
      </Provider>
    );

    expect(() => {
      rerender(
        <Provider store={store}>
          <SkiaFogOverlay {...defaultProps} zoomLevel={15} />
        </Provider>
      );
    }).not.toThrow();
  });
});

describe('SkiaFogOverlay SQLite Compatibility', () => {
  const createTestStore = () => {
    return configureStore({
      reducer: {
        fog: fogSlice,
        exploration: explorationSlice,
      },
    });
  };

  it('should handle SQLite explored area format', () => {
    const sqliteExploredAreas: GenericExploredArea[] = [
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

    const store = createTestStore();

    expect(() => {
      render(
        <Provider store={store}>
          <SkiaFogOverlay 
            {...{
              exploredAreas: sqliteExploredAreas,
              zoomLevel: 12,
              viewport: {
                width: 400,
                height: 600,
                bounds: { north: 37.8, south: 37.7, east: -122.3, west: -122.5 },
              },
            }}
          />
        </Provider>
      );
    }).not.toThrow();
  });

  it('should handle empty explored areas from database', () => {
    const store = createTestStore();

    expect(() => {
      render(
        <Provider store={store}>
          <SkiaFogOverlay 
            {...{
              exploredAreas: [],
              zoomLevel: 10,
              viewport: {
                width: 400,
                height: 600,
                bounds: { north: 37.8, south: 37.7, east: -122.3, west: -122.5 },
              },
            }}
          />
        </Provider>
      );
    }).not.toThrow();
  });

  it('should handle malformed explored area data gracefully', () => {
    const malformedExploredAreas: any[] = [
      // Missing required fields
      { id: 1 },
      // Invalid coordinates
      { id: 2, latitude: 'invalid', longitude: -122.4, radius: 100 },
      // Null values
      { id: 3, latitude: null, longitude: null, radius: 100 },
      // Valid area mixed in
      {
        id: 4,
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 100,
        explored_at: '2024-01-01T12:00:00.000Z',
        accuracy: 10,
      },
    ];

    const store = createTestStore();

    expect(() => {
      render(
        <Provider store={store}>
          <SkiaFogOverlay 
            {...{
              exploredAreas: malformedExploredAreas,
              zoomLevel: 10,
              viewport: {
                width: 400,
                height: 600,
                bounds: { north: 37.8, south: 37.7, east: -122.3, west: -122.5 },
              },
            }}
          />
        </Provider>
      );
    }).not.toThrow();
  });
});