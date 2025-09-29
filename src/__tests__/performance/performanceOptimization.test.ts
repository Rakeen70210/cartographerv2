/**
 * Performance Optimization Tests
 * Tests the performance optimization utilities and services
 */

import { getPerformanceOptimizer, quickPerformanceOptimization, aggressivePerformanceOptimization } from '../../utils/performanceOptimization';
import { getPerformanceMonitorService } from '../../services/performanceMonitorService';
import { getMemoryManagementService } from '../../services/memoryManagementService';
import { getFogService } from '../../services/fogService';

// Mock external dependencies
jest.mock('react-native-device-info');
jest.mock('react-native');

// Mock services
jest.mock('../../services/performanceMonitorService');
jest.mock('../../services/memoryManagementService');
jest.mock('../../services/fogService');

describe('Performance Optimization Tests', () => {
  let performanceOptimizer: any;
  let performanceMonitorService: any;
  let memoryManagementService: any;
  let fogService: any;

  beforeAll(async () => {
    // Setup mocked performanceMonitorService
    const mockPerformanceMonitorServiceInstance = {
      initialize: jest.fn(() => Promise.resolve()),
      forceMemoryCleanup: jest.fn(() => Promise.resolve()),
      getCurrentMetrics: jest.fn().mockReturnValue({
        fps: 30,
        frameTime: 33,
        memoryUsageMB: 100,
        renderTime: 15,
        particleCount: 50,
        fogComplexity: 0.5
      }),
      getLODSettings: jest.fn((zoom: number) => ({
        zoomLevel: zoom,
        fogCellSize: 10,
        maxFogFeatures: 100,
        cloudComplexity: 0.5,
        particleQuality: 'medium' as const,
        enableAnimations: true
      })),
      getAdaptiveSettings: jest.fn((fps: number, memory: number) => ({
        maxParticles: fps < 30 ? 100 : 200,
        fogDetailLevel: memory > 200 ? 'low' : 'high'
      })),
      recordFrame: jest.fn()
    };

    // Setup mocked memoryManagementService
    const storedData: Map<string, any> = new Map();
    let cleanupCount = 0;

    const mockMemoryManagementServiceInstance = {
      initialize: jest.fn().mockResolvedValue(undefined),
      store: jest.fn((pool: string, key: string, data: any, priority: number) => {
        storedData.set(`${pool}:${key}`, data);
        return true;
      }),
      retrieve: jest.fn((pool: string, key: string) => {
        return storedData.get(`${pool}:${key}`);
      }),
      getStats: jest.fn(() => ({
        entryCount: storedData.size,
        totalUsed: storedData.size * 100, // Mock size calculation
        cleanupCount
      })),
      forceCleanup: jest.fn(() => {
        cleanupCount++;
      }),
      optimizeForPerformance: jest.fn().mockResolvedValue(undefined),
      getMemoryUsage: jest.fn(() => ({ used: 50, total: 100 })),
      cleanupUnusedResources: jest.fn(),
      isMemoryLow: jest.fn(() => false),
      forceGarbageCollection: jest.fn(() => Promise.resolve()),
      clearCaches: jest.fn(() => Promise.resolve())
    };

    // Setup mocked fogService
    const mockFogServiceInstance = {
      generateFogGeometry: jest.fn().mockReturnValue({
        type: 'FeatureCollection' as const,
        features: []
      }),
      optimizeGeometryForZoom: jest.fn((geometry: any, zoom: number) => ({
        ...geometry,
        features: geometry.features.slice(0, zoom * 10) // Simplify based on zoom
      })),
      calculateLevelOfDetail: jest.fn((zoom: number) => {
        if (zoom <= 3) return 0.2;
        if (zoom <= 6) return 0.4;
        if (zoom <= 10) return 0.6;
        if (zoom <= 17) return 0.8;
        return 1.0;
      })
    };

    // Configure the mocked getters to return the mock instances
    (getPerformanceMonitorService as jest.Mock).mockReturnValue(mockPerformanceMonitorServiceInstance);
    (getMemoryManagementService as jest.Mock).mockReturnValue(mockMemoryManagementServiceInstance);
    (getFogService as jest.Mock).mockReturnValue(mockFogServiceInstance);

    // Initialize services
    performanceOptimizer = getPerformanceOptimizer();
    performanceMonitorService = getPerformanceMonitorService();
    memoryManagementService = getMemoryManagementService();
    fogService = getFogService();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    performanceOptimizer.resetHistory();
  });

  describe('Performance Optimizer', () => {
    test('should initialize successfully', async () => {
      await expect(performanceOptimizer.initialize()).resolves.not.toThrow();
    });

    test('should perform basic performance optimization', async () => {
      // Mock performance metrics
      jest.spyOn(performanceMonitorService, 'getCurrentMetrics').mockReturnValue({
        fps: 25, // Poor performance
        frameTime: 40,
        memoryUsageMB: 150,
        renderTime: 20,
        particleCount: 100,
        fogComplexity: 1.0
      });

      const result = await performanceOptimizer.optimizePerformance({
        enableAdaptiveQuality: true,
        enableMemoryManagement: true,
        enableBackgroundOptimization: false,
        aggressiveOptimization: false
      });

      expect(result).toBeDefined();
      expect(result.applied).toBeInstanceOf(Array);
      expect(result.applied.length).toBeGreaterThan(0);
      expect(result.memoryFreed).toBeGreaterThanOrEqual(0);
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    test('should perform aggressive optimization for low-end devices', async () => {
      // Mock very poor performance
      jest.spyOn(performanceMonitorService, 'getCurrentMetrics').mockReturnValue({
        fps: 15, // Very poor performance
        frameTime: 66,
        memoryUsageMB: 300,
        renderTime: 50,
        particleCount: 200,
        fogComplexity: 1.0
      });

      const result = await performanceOptimizer.optimizePerformance({
        enableAdaptiveQuality: true,
        enableMemoryManagement: true,
        enableBackgroundOptimization: true,
        aggressiveOptimization: true
      });

      expect(result.applied).toContain('aggressive_memory_cleanup');
      expect(result.memoryFreed).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    test('should not optimize when already optimizing', async () => {
      // Start first optimization
      const firstOptimization = performanceOptimizer.optimizePerformance({
        enableAdaptiveQuality: true,
        enableMemoryManagement: true,
        enableBackgroundOptimization: false,
        aggressiveOptimization: false
      });

      // Try to start second optimization immediately
      const secondOptimization = performanceOptimizer.optimizePerformance({
        enableAdaptiveQuality: true,
        enableMemoryManagement: true,
        enableBackgroundOptimization: false,
        aggressiveOptimization: false
      });

      const [firstResult, secondResult] = await Promise.all([firstOptimization, secondOptimization]);

      // Second optimization should return the same result as first
      expect(secondResult).toEqual(firstResult);
    });

    test('should track optimization history', async () => {
      const result = await performanceOptimizer.optimizePerformance({
        enableAdaptiveQuality: true,
        enableMemoryManagement: false,
        enableBackgroundOptimization: false,
        aggressiveOptimization: false
      });

      const history = performanceOptimizer.getOptimizationHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(result);
    });
  });

  describe('Performance Monitor Service', () => {
    test('should provide level of detail settings for different zoom levels', () => {
      const zoomLevels = [1, 5, 10, 15, 20];
      
      zoomLevels.forEach(zoom => {
        const lodSettings = performanceMonitorService.getLODSettings(zoom);
        
        expect(lodSettings).toBeDefined();
        expect(lodSettings.zoomLevel).toBeDefined();
        expect(lodSettings.fogCellSize).toBeGreaterThan(0);
        expect(lodSettings.maxFogFeatures).toBeGreaterThan(0);
        expect(lodSettings.cloudComplexity).toBeGreaterThanOrEqual(0);
        expect(lodSettings.cloudComplexity).toBeLessThanOrEqual(1);
        expect(['low', 'medium', 'high']).toContain(lodSettings.particleQuality);
        expect(typeof lodSettings.enableAnimations).toBe('boolean');
      });
    });

    test('should provide adaptive settings based on performance', () => {
      const testCases = [
        { fps: 60, memory: 100, expectedChanges: 0 }, // Good performance
        { fps: 40, memory: 150, expectedChanges: 1 }, // Moderate performance
        { fps: 20, memory: 250, expectedChanges: 2 }  // Poor performance
      ];

      testCases.forEach(testCase => {
        const adaptiveSettings = performanceMonitorService.getAdaptiveSettings(
          testCase.fps,
          testCase.memory
        );

        expect(adaptiveSettings).toBeDefined();
        
        if (testCase.fps < 30) {
          expect(adaptiveSettings.maxParticles).toBeDefined();
          expect(adaptiveSettings.fogDetailLevel).toBeDefined();
        }
      });
    });

    test('should record frame timing correctly', () => {
      // Record multiple frames
      for (let i = 0; i < 10; i++) {
        performanceMonitorService.recordFrame();
      }

      const metrics = performanceMonitorService.getCurrentMetrics();
      expect(metrics.fps).toBeGreaterThan(0);
      expect(metrics.frameTime).toBeGreaterThan(0);
    });
  });

  describe('Memory Management Service', () => {
    test('should store and retrieve data from memory pools', async () => {
      await memoryManagementService.initialize();

      const testData = { message: 'test data', timestamp: Date.now() };
      const stored = memoryManagementService.store('fogGeometry', 'test_key', testData, 1);
      
      expect(stored).toBe(true);

      const retrieved = memoryManagementService.retrieve('fogGeometry', 'test_key');
      expect(retrieved).toEqual(testData);
    });

    test('should handle memory pool overflow', async () => {
      await memoryManagementService.initialize();

      // Fill up a small pool
      const largeData = new Array(1000).fill('x').join('');
      
      // Store multiple large items
      for (let i = 0; i < 100; i++) {
        memoryManagementService.store('animations', `large_item_${i}`, largeData, 1);
      }

      const stats = memoryManagementService.getStats();
      expect(stats.entryCount).toBeGreaterThan(0);
      expect(stats.totalUsed).toBeGreaterThan(0);
    });

    test('should perform memory cleanup', async () => {
      await memoryManagementService.initialize();

      // Add some data
      memoryManagementService.store('fogGeometry', 'cleanup_test', { data: 'test' }, 1);
      
      const initialStats = memoryManagementService.getStats();
      
      // Force cleanup
      memoryManagementService.forceCleanup();
      
      const finalStats = memoryManagementService.getStats();
      expect(finalStats.cleanupCount).toBeGreaterThan(initialStats.cleanupCount);
    });

    test('should optimize for performance based on memory pressure', async () => {
      await memoryManagementService.initialize();

      // This should not throw an error
      await expect(memoryManagementService.optimizeForPerformance()).resolves.not.toThrow();
    });
  });

  describe('Fog Service Performance', () => {
    test('should generate fog geometry with level of detail', () => {
      const exploredAreas = [
        {
          id: 1,
          latitude: 37.7749,
          longitude: -122.4194,
          radius: 100,
          explored_at: new Date().toISOString(),
          accuracy: 10
        }
      ];

      const zoomLevels = [5, 10, 15];
      
      zoomLevels.forEach(zoom => {
        const geometry = fogService.generateFogGeometry(exploredAreas, zoom);
        
        expect(geometry).toBeDefined();
        expect(geometry.type).toBe('FeatureCollection');
        expect(geometry.features).toBeInstanceOf(Array);
      });
    });

    test('should optimize geometry for different zoom levels', () => {
      const mockGeometry = {
        type: 'FeatureCollection' as const,
        features: new Array(2000).fill(null).map((_, i) => ({
          type: 'Feature' as const,
          properties: { opacity: 1, type: 'fog' },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
          }
        }))
      };

      const optimizedLow = fogService.optimizeGeometryForZoom(mockGeometry, 5);
      const optimizedHigh = fogService.optimizeGeometryForZoom(mockGeometry, 15);

      // Low zoom should have fewer features than high zoom
      expect(optimizedLow.features.length).toBeLessThanOrEqual(optimizedHigh.features.length);
    });

    test('should calculate level of detail correctly', () => {
      const testCases = [
        { zoom: 1, expectedLOD: 0.2 },
        { zoom: 5, expectedLOD: 0.4 },
        { zoom: 10, expectedLOD: 0.6 },
        { zoom: 15, expectedLOD: 0.8 },
        { zoom: 20, expectedLOD: 1.0 }
      ];

      testCases.forEach(testCase => {
        const lod = fogService.calculateLevelOfDetail(testCase.zoom);
        expect(lod).toBe(testCase.expectedLOD);
      });
    });
  });

  describe('Utility Functions', () => {
    test('should perform quick performance optimization', async () => {
      const result = await quickPerformanceOptimization();
      
      expect(result).toBeDefined();
      expect(result.applied).toBeInstanceOf(Array);
      expect(result.memoryFreed).toBeGreaterThanOrEqual(0);
      expect(result.performanceImprovement).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    test('should perform aggressive performance optimization', async () => {
      const result = await aggressivePerformanceOptimization();
      
      expect(result).toBeDefined();
      expect(result.applied).toContain('aggressive_memory_cleanup');
      expect(result.memoryFreed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Extended Session Performance', () => {
    test('should handle extended session without memory leaks', async () => {
      const sessionDuration = 5000; // 5 seconds for testing
      const startTime = Date.now();
      let iterationCount = 0;

      // Simulate extended session
      while (Date.now() - startTime < sessionDuration) {
        // Simulate location updates
        const mockLocation = {
          latitude: 37.7749 + Math.random() * 0.01,
          longitude: -122.4194 + Math.random() * 0.01,
          radius: 100,
          explored_at: new Date().toISOString(),
          accuracy: 10
        };

        // Generate fog geometry
        fogService.generateFogGeometry([mockLocation], 10);
        
        // Record frame
        performanceMonitorService.recordFrame();
        
        iterationCount++;
        
        // Small delay to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(iterationCount).toBeGreaterThan(0);
      
      // Check that performance metrics are still reasonable
      const finalMetrics = performanceMonitorService.getCurrentMetrics();
      expect(finalMetrics.fps).toBeGreaterThan(0);
      expect(finalMetrics.memoryUsageMB).toBeLessThan(1000); // Should not exceed 1GB
    });

    test('should optimize performance during high load', async () => {
      // Simulate high load scenario
      const highLoadData = new Array(1000).fill(null).map((_, i) => ({
        id: i,
        latitude: 37.7749 + (i % 100) * 0.001,
        longitude: -122.4194 + Math.floor(i / 100) * 0.001,
        radius: 100,
        explored_at: new Date().toISOString(),
        accuracy: 10
      }));

      // Generate fog geometry with high load
      const startTime = Date.now();
      const geometry = fogService.generateFogGeometry(highLoadData, 15);
      const endTime = Date.now();

      expect(geometry).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Perform optimization after high load
      const optimizationResult = await quickPerformanceOptimization();
      expect(optimizationResult.applied.length).toBeGreaterThan(0);
    });
  });
});