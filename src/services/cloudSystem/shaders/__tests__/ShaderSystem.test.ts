/**
 * Shader System Tests
 * Tests for WebGL shader compilation and management
 */

import { ShaderSystem } from '../ShaderSystem';
import { ShaderCompiler } from '../ShaderCompiler';
import { UniformManager } from '../UniformManager';

// Mock WebGL context for testing
const createMockWebGLContext = (): Partial<WebGLRenderingContext> => {
  const mockShader = {} as WebGLShader;
  const mockProgram = {} as WebGLProgram;
  const mockLocation = {} as WebGLUniformLocation;

  return {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    VALIDATE_STATUS: 35715,
    TEXTURE0: 33984,
    TEXTURE_2D: 3553,
    
    createShader: jest.fn(() => mockShader),
    createProgram: jest.fn(() => mockProgram),
    shaderSource: jest.fn(),
    compileShader: jest.fn(),
    attachShader: jest.fn(),
    linkProgram: jest.fn(),
    useProgram: jest.fn(),
    deleteShader: jest.fn(),
    deleteProgram: jest.fn(),
    validateProgram: jest.fn(),
    
    getShaderParameter: jest.fn(() => true),
    getProgramParameter: jest.fn(() => true),
    getShaderInfoLog: jest.fn(() => ''),
    getProgramInfoLog: jest.fn(() => ''),
    
    getAttribLocation: jest.fn(() => 0),
    getUniformLocation: jest.fn(() => mockLocation),
    
    uniform1f: jest.fn(),
    uniform2f: jest.fn(),
    uniform3f: jest.fn(),
    uniform4f: jest.fn(),
    uniform1i: jest.fn(),
    uniformMatrix4fv: jest.fn(),
    
    activeTexture: jest.fn(),
    bindTexture: jest.fn(),
    createTexture: jest.fn(() => ({} as WebGLTexture)),
    texImage2D: jest.fn(),
    texParameteri: jest.fn(),
  };
};

describe('ShaderSystem', () => {
  let shaderSystem: ShaderSystem;
  let mockGL: Partial<WebGLRenderingContext>;

  beforeEach(() => {
    shaderSystem = new ShaderSystem();
    mockGL = createMockWebGLContext();
  });

  afterEach(() => {
    shaderSystem.dispose();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid WebGL context', async () => {
      await expect(shaderSystem.initialize(mockGL as WebGLRenderingContext)).resolves.not.toThrow();
      expect(shaderSystem.isInitialized()).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      await shaderSystem.initialize(mockGL as WebGLRenderingContext);
      const createShaderSpy = jest.spyOn(mockGL, 'createShader');
      
      await shaderSystem.initialize(mockGL as WebGLRenderingContext);
      
      // Should not create new shaders on second initialization
      expect(createShaderSpy).not.toHaveBeenCalled();
    });
  });

  describe('shader compilation', () => {
    it('should compile cloud shaders successfully', async () => {
      await shaderSystem.initialize(mockGL as WebGLRenderingContext);
      
      const cloudShader = shaderSystem.getCloudShader();
      expect(cloudShader).toBeDefined();
      expect(cloudShader.program).toBeDefined();
      expect(cloudShader.uniforms).toBeDefined();
      expect(cloudShader.attributes).toBeDefined();
    });

    it('should handle shader compilation errors gracefully', async () => {
      // Mock compilation failure
      (mockGL.getShaderParameter as jest.Mock).mockReturnValue(false);
      (mockGL.getShaderInfoLog as jest.Mock).mockReturnValue('Compilation error');

      await expect(shaderSystem.initialize(mockGL as WebGLRenderingContext)).rejects.toThrow();
    });
  });

  describe('uniform management', () => {
    beforeEach(async () => {
      await shaderSystem.initialize(mockGL as WebGLRenderingContext);
    });

    it('should update uniforms without errors', () => {
      const uniforms = {
        u_time: 1.0,
        u_cloudDensity: 0.5,
        u_windVector: [1.0, 0.5] as [number, number],
        u_zoomLevel: 10.0
      };

      expect(() => shaderSystem.updateUniforms(uniforms)).not.toThrow();
    });

    it('should bind shader program correctly', () => {
      expect(() => shaderSystem.bindShaderProgram()).not.toThrow();
      expect(mockGL.useProgram).toHaveBeenCalled();
    });
  });

  describe('context loss handling', () => {
    beforeEach(async () => {
      await shaderSystem.initialize(mockGL as WebGLRenderingContext);
    });

    it('should handle context loss', () => {
      expect(shaderSystem.isInitialized()).toBe(true);
      
      shaderSystem.handleContextLoss();
      
      expect(shaderSystem.isInitialized()).toBe(false);
    });

    it('should restore context successfully', async () => {
      shaderSystem.handleContextLoss();
      
      await expect(shaderSystem.handleContextRestore(mockGL as WebGLRenderingContext)).resolves.not.toThrow();
      expect(shaderSystem.isInitialized()).toBe(true);
    });
  });

  describe('disposal', () => {
    it('should dispose resources properly', async () => {
      await shaderSystem.initialize(mockGL as WebGLRenderingContext);
      
      shaderSystem.dispose();
      
      expect(mockGL.deleteProgram).toHaveBeenCalled();
      expect(shaderSystem.isInitialized()).toBe(false);
    });
  });
});

describe('ShaderCompiler', () => {
  let compiler: ShaderCompiler;
  let mockGL: Partial<WebGLRenderingContext>;

  beforeEach(() => {
    mockGL = createMockWebGLContext();
    compiler = new ShaderCompiler(mockGL as WebGLRenderingContext);
  });

  it('should compile shader successfully', () => {
    const source = 'void main() { gl_Position = vec4(0.0); }';
    
    const result = compiler.compileShader(source, mockGL.VERTEX_SHADER!);
    
    expect(result.success).toBe(true);
    expect(result.shader).toBeDefined();
  });

  it('should handle compilation errors', () => {
    (mockGL.getShaderParameter as jest.Mock).mockReturnValue(false);
    (mockGL.getShaderInfoLog as jest.Mock).mockReturnValue('Syntax error');
    
    const result = compiler.compileShader('invalid shader', mockGL.VERTEX_SHADER!);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Syntax error');
  });

  it('should create fallback shaders', () => {
    const vertexShader = compiler.createFallbackVertexShader();
    const fragmentShader = compiler.createFallbackFragmentShader();
    
    expect(vertexShader).toContain('void main()');
    expect(fragmentShader).toContain('void main()');
  });
});

describe('UniformManager', () => {
  let uniformManager: UniformManager;
  let mockGL: Partial<WebGLRenderingContext>;
  let mockLocations: Record<string, WebGLUniformLocation>;

  beforeEach(() => {
    mockGL = createMockWebGLContext();
    mockLocations = {
      u_time: {} as WebGLUniformLocation,
      u_cloudDensity: {} as WebGLUniformLocation,
      u_windVector: {} as WebGLUniformLocation,
    };
    uniformManager = new UniformManager(mockGL as WebGLRenderingContext, mockLocations);
  });

  afterEach(() => {
    uniformManager.dispose();
  });

  it('should set float uniforms', () => {
    uniformManager.setUniform('u_time', 1.5, 'float');
    
    expect(mockGL.uniform1f).toHaveBeenCalledWith(mockLocations.u_time, 1.5);
  });

  it('should set vector uniforms', () => {
    uniformManager.setUniform('u_windVector', [1.0, 0.5], 'vec2');
    
    expect(mockGL.uniform2f).toHaveBeenCalledWith(mockLocations.u_windVector, 1.0, 0.5);
  });

  it('should cache uniform values to avoid redundant updates', () => {
    uniformManager.setUniform('u_time', 1.0, 'float');
    uniformManager.setUniform('u_time', 1.0, 'float'); // Same value
    
    expect(mockGL.uniform1f).toHaveBeenCalledTimes(1);
  });

  it('should handle missing uniform locations gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    uniformManager.setUniform('nonexistent_uniform', 1.0);
    
    expect(consoleSpy).toHaveBeenCalledWith('Uniform location not found: nonexistent_uniform');
    consoleSpy.mockRestore();
  });
});