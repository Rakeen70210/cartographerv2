/**
 * Device Capability Detector Tests
 */

import { DeviceCapabilityDetector } from '../DeviceCapabilityDetector';
import { DeviceCapabilities, PerformanceTier } from '../../../../types/cloud';

// Mock WebGL context for testing
const mockWebGLContext = {
  getParameter: jest.fn(),
  getExtension: jest.fn(),
  createShader: jest.fn(),
  shaderSource: jest.fn(),
  compileShader: jest.fn(),
  getShaderParameter: jest.fn(),
  createProgram: jest.fn(),
  attachShader: jest.fn(),
  linkProgram: jest.fn(),
  getProgramParameter: jest.fn(),
  useProgram: jest.fn(),
  uniform1f: jest.fn(),
  createBuffer: jest.fn(),
  bindBuffer: jest.fn(),
  bufferData: jest.fn(),
  getAttribLocation: jest.fn(),
  enableVertexAttribArray: jest.fn(),
  vertexAttribPointer: jest.fn(),
  drawArrays: jest.fn(),
  deleteShader: jest.fn()
};

// Mock canvas and WebGL
Object.defineProperty(document, 'createElement', {
  value: jest.fn().mockImplementation((tagName: string) => {
    if (tagName === 'canvas') {
      return {
        getContext: jest.fn().mockImplementation((type: string) => {
          if (type === 'webgl' || type === 'experimental-webgl') {
            return mockWebGLContext;
          }
          return null;
        }),
        width: 256,
        height: 256
      };
    }
    return {};
  })
});

// Mock performance.now
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn(() => Date.now())
  }
});

// Mock requestAnimationFrame
Object.defineProperty(global, 'requestAnimationFrame', {
  value: jest.fn((callback: FrameRequestCallback) => {
    setTimeout(() => callback(performance.now()), 16);
    return 1;
  })
});

describe('DeviceCapabilityDetector', () => {
  let detector: DeviceCapabilityDetector;

  beforeEach(() => {
    detector = DeviceCapabilityDetector.getInstance();
    detector.clearCache();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default WebGL mock responses
    mockWebGLContext.getParameter.mockImplementation((param: number) => {
      const GL_MAX_TEXTURE_SIZE = 0x0D33;
      if (param === GL_MAX_TEXTURE_SIZE) return 2048;
      return 16;
    });
    
    mockWebGLContext.getExtension.mockImplementation((name: string) => {
      if (name === 'OES_texture_float') return {};
      return null;
    });
  });

  afterEach(() => {
    detector.clearCache();
  });

  describe('detectCapabilities', () => {
    it('should detect basic device capabilities', async () => {
      const capabilities = await detector.detectCapabilities();
      
      expect(capabilities).toBeDefined();
      expect(capabilities?.gpuTier).toMatch(/^(low|medium|high)$/);
      expect(capabilities?.memoryMB).toBeGreaterThan(0);
      expect(capabilities?.maxTextureSize).toBeGreaterThan(0);
      expect([1, 2]).toContain(capabilities?.webglVersion);
    });

    it('should cache capabilities after first detection', async () => {
      const capabilities1 = await detector.detectCapabilities();
      const capabilities2 = await detector.detectCapabilities();
      
      expect(capabilities1).toBe(capabilities2);
    });

    it('should handle WebGL unavailable gracefully', async () => {
      // Mock WebGL as unavailable
      document.createElement = jest.fn().mockImplementation(() => ({
        getContext: jest.fn().mockReturnValue(null)
      }));

      const capabilities = await detector.detectCapabilities();
      
      expect(capabilities?.gpuTier).toBe('low');
      expect(capabilities?.supportsFloatTextures).toBe(false);
    });
  });

  describe('getRecommendedPerformanceTier', () => {
    it('should return appropriate tier for high-end device', () => {
      const highEndCapabilities: DeviceCapabilities = {
        gpuTier: 'high',
        memoryMB: 2048,
        supportsFloatTextures: true,
        maxTextureSize: 4096,
        webglVersion: 2
      };

      const tier = detector.getRecommendedPerformanceTier(highEndCapabilities);
      
      expect(tier.name).toBe('high');
      expect(tier.animationQuality).toBe('high');
      expect(tier.textureResolution).toBeGreaterThan(512);
    });

    it('should return appropriate tier for low-end device', () => {
      const lowEndCapabilities: DeviceCapabilities = {
        gpuTier: 'low',
        memoryMB: 128,
        supportsFloatTextures: false,
        maxTextureSize: 512,
        webglVersion: 1
      };

      const tier = detector.getRecommendedPerformanceTier(lowEndCapabilities);
      
      expect(tier.name).toBe('low');
      expect(tier.animationQuality).toBe('low');
      expect(tier.textureResolution).toBeLessThanOrEqual(512);
    });
  });

  describe('getRecommendedPerformanceMode', () => {
    it('should recommend high mode for high-end device', () => {
      const highEndCapabilities: DeviceCapabilities = {
        gpuTier: 'high',
        memoryMB: 2048,
        supportsFloatTextures: true,
        maxTextureSize: 4096,
        webglVersion: 2
      };

      const mode = detector.getRecommendedPerformanceMode(highEndCapabilities);
      expect(mode).toBe('high');
    });

    it('should recommend low mode for low-end device', () => {
      const lowEndCapabilities: DeviceCapabilities = {
        gpuTier: 'low',
        memoryMB: 128,
        supportsFloatTextures: false,
        maxTextureSize: 512,
        webglVersion: 1
      };

      const mode = detector.getRecommendedPerformanceMode(lowEndCapabilities);
      expect(mode).toBe('low');
    });
  });

  describe('getPerformanceTiers', () => {
    it('should return all available performance tiers', () => {
      const tiers = detector.getPerformanceTiers();
      
      expect(tiers).toHaveLength(3);
      expect(tiers.map(t => t.name)).toEqual(['low', 'medium', 'high']);
    });
  });

  describe('getPerformanceTier', () => {
    it('should return specific tier by name', () => {
      const lowTier = detector.getPerformanceTier('low');
      const highTier = detector.getPerformanceTier('high');
      const invalidTier = detector.getPerformanceTier('invalid');
      
      expect(lowTier?.name).toBe('low');
      expect(highTier?.name).toBe('high');
      expect(invalidTier).toBeNull();
    });
  });
});