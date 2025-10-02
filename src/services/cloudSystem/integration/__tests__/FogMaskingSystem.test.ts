import { FogMaskingSystem, DEFAULT_FOG_MASKING_CONFIG } from '../FogMaskingSystem';
import { GenericExploredArea } from '../../../../types/fog';
import { SkiaFogViewport, DissipationAnimation } from '../../../../types/skiaFog';

// Mock Skia since it's not available in test environment
jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Path: {
      Make: jest.fn(() => ({
        addCircle: jest.fn(),
        op: jest.fn(),
        toSVGString: jest.fn(() => 'M0,0L1,1Z')
      })),
      MakeFromSVGString: jest.fn(() => ({
        addCircle: jest.fn(),
        op: jest.fn(),
        toSVGString: jest.fn(() => 'M0,0L1,1Z')
      }))
    },
    PathOp: {
      Union: 'union'
    },
    Paint: jest.fn(() => ({
      setBlendMode: jest.fn(),
      setMaskFilter: jest.fn(),
      setAlphaf: jest.fn(),
      setAntiAlias: jest.fn()
    })),
    MaskFilter: {
      MakeBlur: jest.fn(() => ({}))
    },
    BlurStyle: {
      Normal: 'normal'
    },
    BlendMode: {
      SrcOut: 'srcOut'
    }
  }
}));

describe('FogMaskingSystem', () => {
  let maskingSystem: FogMaskingSystem;
  let mockViewport: SkiaFogViewport;
  let mockExploredAreas: GenericExploredArea[];
  let mockDissipationAnimations: DissipationAnimation[];

  beforeEach(() => {
    maskingSystem = new FogMaskingSystem(DEFAULT_FOG_MASKING_CONFIG);
    
    mockViewport = {
      width: 400,
      height: 600,
      bounds: {
        north: 37.7849,
        south: 37.7749,
        east: -122.4094,
        west: -122.4194
      }
    };

    mockExploredAreas = [
      {
        id: 'area1',
        center: [-122.4144, 37.7794],
        radius: 100,
        exploredAt: Date.now()
      },
      {
        id: 'area2',
        latitude: 37.7774,
        longitude: -122.4164,
        radius: 150,
        explored_at: new Date().toISOString()
      }
    ];

    mockDissipationAnimations = [
      {
        id: 'anim1',
        center: [-122.4134, 37.7784],
        radius: { value: 80 } as any,
        startTime: Date.now(),
        duration: 2000
      }
    ];
  });

  afterEach(() => {
    maskingSystem.clearCaches();
  });

  describe('generateFogMask', () => {
    it('should generate fog mask with explored areas and dissipation animations', () => {
      const result = maskingSystem.generateFogMask(
        mockExploredAreas,
        mockDissipationAnimations,
        mockViewport,
        10
      );

      expect(result).toBeDefined();
      expect(result.exploredAreasPath).toBeDefined();
      expect(result.dissipationPath).toBeDefined();
      expect(result.combinedMaskPath).toBeDefined();
      expect(result.maskPaint).toBeDefined();
    });

    it('should handle empty explored areas', () => {
      const result = maskingSystem.generateFogMask(
        [],
        [],
        mockViewport,
        10
      );

      expect(result).toBeDefined();
      expect(result.exploredAreasPath).toBeDefined();
      expect(result.dissipationPath).toBeNull();
    });

    it('should apply adaptive blur configuration when enabled', () => {
      const config = {
        ...DEFAULT_FOG_MASKING_CONFIG,
        enableAdaptiveBlur: true
      };
      
      const adaptiveMaskingSystem = new FogMaskingSystem(config);
      
      const result = adaptiveMaskingSystem.generateFogMask(
        mockExploredAreas,
        mockDissipationAnimations,
        mockViewport,
        15 // Higher zoom level
      );

      expect(result).toBeDefined();
      expect(result.maskPaint).toBeDefined();
    });
  });

  describe('configuration management', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        enableLayeredBlur: true,
        layerCount: 3
      };

      maskingSystem.updateConfig(newConfig);
      const currentConfig = maskingSystem.getConfig();

      expect(currentConfig.enableLayeredBlur).toBe(true);
      expect(currentConfig.layerCount).toBe(3);
    });

    it('should validate configuration', () => {
      const validation = maskingSystem.validateConfig();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid configuration', () => {
      maskingSystem.updateConfig({ layerCount: 10 }); // Invalid: > 5
      
      const validation = maskingSystem.validateConfig();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', () => {
      const stats = maskingSystem.getCacheStats();
      
      expect(stats).toBeDefined();
      expect(stats.exploration).toBeDefined();
      expect(stats.blur).toBeDefined();
    });

    it('should clear caches', () => {
      // Generate some cached data
      maskingSystem.generateFogMask(
        mockExploredAreas,
        mockDissipationAnimations,
        mockViewport,
        10
      );

      // Clear caches
      maskingSystem.clearCaches();

      // Verify caches are cleared
      const stats = maskingSystem.getCacheStats();
      expect(stats.exploration.hasCachedPath).toBe(false);
      expect(stats.blur.hasCachedPaint).toBe(false);
    });
  });
});