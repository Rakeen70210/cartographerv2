/**
 * Unit tests for cloud texture atlas system
 */

import {
  CloudTextureAtlas,
  ProceduralCloudTextureGenerator,
  CloudTextureManager,
  AtlasConfig,
  TextureData
} from '../CloudTextureAtlas';

import {
  CloudTextureLoader,
  TextureFormatUtils
} from '../TextureLoader';

describe('CloudTextureAtlas', () => {
  let atlas: CloudTextureAtlas;
  let config: AtlasConfig;

  beforeEach(() => {
    config = {
      width: 256,
      height: 256,
      tileSize: 64,
      padding: 2,
      generateMipmaps: false
    };
    atlas = new CloudTextureAtlas(config);
  });

  describe('atlas creation', () => {
    it('should create atlas with correct dimensions', () => {
      const atlasConfig = atlas.getConfig();
      expect(atlasConfig.width).toBe(256);
      expect(atlasConfig.height).toBe(256);
      
      const atlasData = atlas.getAtlasData();
      expect(atlasData.length).toBe(256 * 256 * 4); // RGBA
    });

    it('should initialize with empty atlas', () => {
      const patterns = atlas.getAllPatterns();
      expect(patterns.length).toBe(0);
    });
  });

  describe('pattern management', () => {
    it('should add patterns to atlas', () => {
      const textureData: TextureData = {
        data: new Uint8Array(32 * 32).fill(128),
        width: 32,
        height: 32,
        channels: 1
      };

      const pattern = atlas.addPattern('test', 'Test Pattern', textureData);
      
      expect(pattern).toBeDefined();
      expect(pattern!.id).toBe('test');
      expect(pattern!.name).toBe('Test Pattern');
      expect(pattern!.width).toBe(32);
      expect(pattern!.height).toBe(32);
    });

    it('should calculate correct UV coordinates', () => {
      const textureData: TextureData = {
        data: new Uint8Array(32 * 32).fill(128),
        width: 32,
        height: 32,
        channels: 1
      };

      const pattern = atlas.addPattern('test', 'Test Pattern', textureData);
      
      expect(pattern!.uvBounds.minU).toBeCloseTo(config.padding / config.width, 3);
      expect(pattern!.uvBounds.minV).toBeCloseTo(config.padding / config.height, 3);
      expect(pattern!.uvBounds.maxU).toBeCloseTo((config.padding + 32) / config.width, 3);
      expect(pattern!.uvBounds.maxV).toBeCloseTo((config.padding + 32) / config.height, 3);
    });

    it('should retrieve patterns by ID', () => {
      const textureData: TextureData = {
        data: new Uint8Array(32 * 32).fill(128),
        width: 32,
        height: 32,
        channels: 1
      };

      atlas.addPattern('test', 'Test Pattern', textureData);
      
      const retrieved = atlas.getPattern('test');
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('test');
    });

    it('should handle patterns that do not fit', () => {
      const largeTextureData: TextureData = {
        data: new Uint8Array(300 * 300).fill(128),
        width: 300,
        height: 300,
        channels: 1
      };

      const pattern = atlas.addPattern('large', 'Large Pattern', largeTextureData);
      expect(pattern).toBeNull();
    });
  });

  describe('texture coordinate mapping', () => {
    it('should map local coordinates to atlas coordinates', () => {
      const textureData: TextureData = {
        data: new Uint8Array(32 * 32).fill(128),
        width: 32,
        height: 32,
        channels: 1
      };

      atlas.addPattern('test', 'Test Pattern', textureData);
      
      const [u, v] = atlas.getTextureCoordinates('test', 0.5, 0.5);
      
      expect(u).toBeGreaterThan(0);
      expect(u).toBeLessThan(1);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    });

    it('should handle invalid pattern IDs', () => {
      const [u, v] = atlas.getTextureCoordinates('nonexistent', 0.5, 0.5);
      expect(u).toBe(0);
      expect(v).toBe(0);
    });
  });
});

describe('ProceduralCloudTextureGenerator', () => {
  describe('texture generation', () => {
    it('should generate basic cloud texture', () => {
      const texture = ProceduralCloudTextureGenerator.generateCloudTexture(64, 64, 12345);
      
      expect(texture.width).toBe(64);
      expect(texture.height).toBe(64);
      expect(texture.channels).toBe(1);
      expect(texture.data.length).toBe(64 * 64);
    });

    it('should generate different cloud types', () => {
      const cumulus = ProceduralCloudTextureGenerator.generateCumulusTexture(32, 32, 12345);
      const cirrus = ProceduralCloudTextureGenerator.generateCirrusTexture(32, 32, 12345);
      const fog = ProceduralCloudTextureGenerator.generateFogTexture(32, 32, 12345);
      
      expect(cumulus.data).not.toEqual(cirrus.data);
      expect(cirrus.data).not.toEqual(fog.data);
      expect(fog.data).not.toEqual(cumulus.data);
    });

    it('should generate consistent results with same seed', () => {
      const texture1 = ProceduralCloudTextureGenerator.generateCloudTexture(32, 32, 54321);
      const texture2 = ProceduralCloudTextureGenerator.generateCloudTexture(32, 32, 54321);
      
      expect(texture1.data).toEqual(texture2.data);
    });

    it('should generate different results with different seeds', () => {
      const texture1 = ProceduralCloudTextureGenerator.generateCloudTexture(32, 32, 11111);
      const texture2 = ProceduralCloudTextureGenerator.generateCloudTexture(32, 32, 22222);
      
      expect(texture1.data).not.toEqual(texture2.data);
    });
  });

  describe('texture properties', () => {
    it('should generate values in valid range', () => {
      const texture = ProceduralCloudTextureGenerator.generateCloudTexture(32, 32, 12345);
      
      for (let i = 0; i < texture.data.length; i++) {
        expect(texture.data[i]).toBeGreaterThanOrEqual(0);
        expect(texture.data[i]).toBeLessThanOrEqual(255);
      }
    });

    it('should have variation in generated values', () => {
      const texture = ProceduralCloudTextureGenerator.generateCloudTexture(32, 32, 12345);
      
      const uniqueValues = new Set(texture.data);
      expect(uniqueValues.size).toBeGreaterThan(10); // Should have variety
    });
  });
});

describe('CloudTextureManager', () => {
  let manager: CloudTextureManager;

  beforeEach(() => {
    manager = CloudTextureManager.createDefault();
  });

  describe('initialization', () => {
    it('should create manager with default patterns', () => {
      const atlas = manager.getAtlas();
      const patterns = atlas.getAllPatterns();
      
      expect(patterns.length).toBe(4); // cumulus, cirrus, stratus, fog
      
      const patternIds = patterns.map(p => p.id);
      expect(patternIds).toContain('cumulus');
      expect(patternIds).toContain('cirrus');
      expect(patternIds).toContain('stratus');
      expect(patternIds).toContain('fog');
    });
  });

  describe('pattern access', () => {
    it('should provide access to default patterns', () => {
      const cumulus = manager.getPattern('cumulus');
      const cirrus = manager.getPattern('cirrus');
      const stratus = manager.getPattern('stratus');
      const fog = manager.getPattern('fog');
      
      expect(cumulus).toBeDefined();
      expect(cirrus).toBeDefined();
      expect(stratus).toBeDefined();
      expect(fog).toBeDefined();
    });

    it('should provide texture coordinates for patterns', () => {
      const [u, v] = manager.getTextureCoordinates('cumulus', 0.5, 0.5);
      
      expect(u).toBeGreaterThan(0);
      expect(u).toBeLessThan(1);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    });
  });
});

describe('CloudTextureLoader', () => {
  let loader: CloudTextureLoader;

  beforeEach(() => {
    loader = new CloudTextureLoader();
  });

  describe('texture management', () => {
    it('should create texture from data', () => {
      const textureData: TextureData = {
        data: new Uint8Array(32 * 32).fill(128),
        width: 32,
        height: 32,
        channels: 1
      };

      const texture = loader.createFromData('test', textureData);
      
      expect(texture.id).toBe('test');
      expect(texture.data).toBe(textureData);
      expect(texture.source).toBe('procedural');
    });

    it('should track loaded textures', () => {
      const textureData: TextureData = {
        data: new Uint8Array(32 * 32).fill(128),
        width: 32,
        height: 32,
        channels: 1
      };

      loader.createFromData('test', textureData);
      
      expect(loader.isLoaded('test')).toBe(true);
      expect(loader.isLoaded('nonexistent')).toBe(false);
    });

    it('should unload textures', () => {
      const textureData: TextureData = {
        data: new Uint8Array(32 * 32).fill(128),
        width: 32,
        height: 32,
        channels: 1
      };

      loader.createFromData('test', textureData);
      expect(loader.isLoaded('test')).toBe(true);
      
      loader.unloadTexture('test');
      expect(loader.isLoaded('test')).toBe(false);
    });
  });

  describe('memory statistics', () => {
    it('should calculate memory usage', () => {
      const textureData1: TextureData = {
        data: new Uint8Array(32 * 32).fill(128),
        width: 32,
        height: 32,
        channels: 1
      };

      const textureData2: TextureData = {
        data: new Uint8Array(64 * 64 * 4).fill(128),
        width: 64,
        height: 64,
        channels: 4
      };

      loader.createFromData('test1', textureData1);
      loader.createFromData('test2', textureData2);
      
      const stats = loader.getMemoryStats();
      expect(stats.textureCount).toBe(2);
      expect(stats.totalBytes).toBe(32 * 32 * 1 + 64 * 64 * 4);
    });
  });
});

describe('TextureFormatUtils', () => {
  describe('format conversion', () => {
    it('should convert RGBA to grayscale', () => {
      const rgbaData = new Uint8Array([
        255, 0, 0, 255,    // Red
        0, 255, 0, 255,    // Green
        0, 0, 255, 255,    // Blue
        255, 255, 255, 255 // White
      ]);

      const grayscale = TextureFormatUtils.rgbaToGrayscale(rgbaData, 2, 2);
      
      expect(grayscale.width).toBe(2);
      expect(grayscale.height).toBe(2);
      expect(grayscale.channels).toBe(1);
      expect(grayscale.data.length).toBe(4);
      
      // Check luminance calculation
      expect(grayscale.data[0]).toBeCloseTo(76, 0); // Red luminance
      expect(grayscale.data[3]).toBe(255); // White luminance
    });

    it('should convert grayscale to RGBA', () => {
      const grayscaleData = new Uint8Array([128, 64, 192, 255]);
      
      const rgba = TextureFormatUtils.grayscaleToRGBA(grayscaleData, 2, 2);
      
      expect(rgba.width).toBe(2);
      expect(rgba.height).toBe(2);
      expect(rgba.channels).toBe(4);
      expect(rgba.data.length).toBe(16);
      
      // Check first pixel
      expect(rgba.data[0]).toBe(128); // R
      expect(rgba.data[1]).toBe(128); // G
      expect(rgba.data[2]).toBe(128); // B
      expect(rgba.data[3]).toBe(255); // A
    });
  });

  describe('texture operations', () => {
    it('should resize texture', () => {
      const originalData = new Uint8Array(16).fill(128); // 4x4
      const textureData: TextureData = {
        data: originalData,
        width: 4,
        height: 4,
        channels: 1
      };

      const resized = TextureFormatUtils.resizeTexture(textureData, 2, 2);
      
      expect(resized.width).toBe(2);
      expect(resized.height).toBe(2);
      expect(resized.channels).toBe(1);
      expect(resized.data.length).toBe(4);
    });

    it('should generate mipmaps', () => {
      const originalData = new Uint8Array(64).fill(128); // 8x8
      const textureData: TextureData = {
        data: originalData,
        width: 8,
        height: 8,
        channels: 1
      };

      const mipmaps = TextureFormatUtils.generateMipmaps(textureData);
      
      expect(mipmaps.length).toBe(4); // 8x8, 4x4, 2x2, 1x1
      expect(mipmaps[0].width).toBe(8);
      expect(mipmaps[1].width).toBe(4);
      expect(mipmaps[2].width).toBe(2);
      expect(mipmaps[3].width).toBe(1);
    });
  });
});