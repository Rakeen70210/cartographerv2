/**
 * Shader System Tests
 * Tests for WebGL shader compilation and management
 */

import { ShaderSystem } from '../ShaderSystem';
import { ShaderCompiler } from '../ShaderCompiler';
import { UniformManager } from '../UniformManager';

// Comprehensive WebGL context mock for testing
const createMockWebGLContext = (): Partial<WebGLRenderingContext> => {
  const mockShader = {} as WebGLShader;
  const mockProgram = {} as WebGLProgram;
  const mockLocation = {} as WebGLUniformLocation;
  const mockBuffer = {} as WebGLBuffer;
  const mockFramebuffer = {} as WebGLFramebuffer;
  const mockTexture = {} as WebGLTexture;

  return {
    // Shader constants
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    VALIDATE_STATUS: 35715,

    // Texture constants
    TEXTURE0: 33984,
    TEXTURE_2D: 3553,
    RGBA: 6408,
    UNSIGNED_BYTE: 5121,
    NEAREST: 9728,
    LINEAR: 9729,
    CLAMP_TO_EDGE: 33071,
    REPEAT: 10497,

    // Buffer constants
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
    FLOAT: 5126,

    // Drawing constants
    TRIANGLES: 4,

    // Blending constants
    BLEND: 3042,
    SRC_ALPHA: 770,
    ONE_MINUS_SRC_ALPHA: 771,

    // Depth testing constants
    DEPTH_TEST: 2929,
    LEQUAL: 515,
    NEVER: 512,
    LESS: 513,
    EQUAL: 514,
    GREATER: 516,
    NOTEQUAL: 517,
    GEQUAL: 518,
    ALWAYS: 519,

    // Clearing constants
    COLOR_BUFFER_BIT: 16384,
    DEPTH_BUFFER_BIT: 256,

    // Face culling constants
    CULL_FACE: 2884,
    BACK: 1029,
    FRONT_AND_BACK: 1032,

    // Framebuffer constants
    FRAMEBUFFER: 36160,
    FRAMEBUFFER_COMPLETE: 36053,

    // Context loss
    CONTEXT_LOST_WEBGL: 37442,

    // Core methods
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
    enableVertexAttribArray: jest.fn(),
    disableVertexAttribArray: jest.fn(),
    vertexAttribPointer: jest.fn(),

    uniform1f: jest.fn(),
    uniform2f: jest.fn(),
    uniform3f: jest.fn(),
    uniform4f: jest.fn(),
    uniform1i: jest.fn(),
    uniformMatrix4fv: jest.fn(),

    activeTexture: jest.fn(),
    bindTexture: jest.fn(),
    createTexture: jest.fn(() => mockTexture),
    texImage2D: jest.fn(),
    texParameteri: jest.fn(),
    generateMipmap: jest.fn(),

    // Buffer methods
    createBuffer: jest.fn(() => mockBuffer),
    bindBuffer: jest.fn(),
    bufferData: jest.fn(),

    // Drawing methods
    drawArrays: jest.fn(),
    drawElements: jest.fn(),

    // State management methods
    enable: jest.fn(),
    disable: jest.fn(),
    blendFunc: jest.fn(),
    clearColor: jest.fn(),
    clear: jest.fn(),
    depthFunc: jest.fn(),
    depthMask: jest.fn(),
    cullFace: jest.fn(),
    viewport: jest.fn(),

    // Framebuffer methods
    createFramebuffer: jest.fn(() => mockFramebuffer),
    bindFramebuffer: jest.fn(),
    framebufferTexture2D: jest.fn(),
    checkFramebufferStatus: jest.fn(() => 36053), // FRAMEBUFFER_COMPLETE
    deleteFramebuffer: jest.fn(),

    // Context loss detection
    isContextLost: jest.fn(() => false),
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
      const createProgramSpy = jest.spyOn(mockGL, 'createProgram');

      await shaderSystem.initialize(mockGL as WebGLRenderingContext);

      // Should not create new program on second initialization since system is already initialized
      expect(createProgramSpy).toHaveBeenCalledTimes(1);
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