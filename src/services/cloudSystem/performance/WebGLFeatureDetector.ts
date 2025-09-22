/**
 * WebGL Feature Detection
 * Detects WebGL capabilities and extensions for cloud rendering optimization
 */

export interface WebGLCapabilities {
  version: 1 | 2;
  maxTextureSize: number;
  maxCombinedTextureImageUnits: number;
  maxVertexTextureImageUnits: number;
  maxFragmentUniformVectors: number;
  maxVertexUniformVectors: number;
  maxVaryingVectors: number;
  maxVertexAttribs: number;
  maxViewportDims: [number, number];
  aliasedLineWidthRange: [number, number];
  aliasedPointSizeRange: [number, number];
  extensions: string[];
  renderer: string;
  vendor: string;
  version: string;
  shadingLanguageVersion: string;
}

export interface WebGLExtensionSupport {
  floatTextures: boolean;
  halfFloatTextures: boolean;
  textureFilterAnisotropic: boolean;
  vertexArrayObject: boolean;
  instancedArrays: boolean;
  multipleRenderTargets: boolean;
  depthTexture: boolean;
  standardDerivatives: boolean;
  shaderTextureLod: boolean;
  fragmentDepth: boolean;
  drawBuffers: boolean;
  colorBufferFloat: boolean;
  colorBufferHalfFloat: boolean;
}

export class WebGLFeatureDetector {
  private static instance: WebGLFeatureDetector;
  private cachedCapabilities: WebGLCapabilities | null = null;
  private cachedExtensions: WebGLExtensionSupport | null = null;

  private constructor() {}

  public static getInstance(): WebGLFeatureDetector {
    if (!WebGLFeatureDetector.instance) {
      WebGLFeatureDetector.instance = new WebGLFeatureDetector();
    }
    return WebGLFeatureDetector.instance;
  }

  /**
   * Detect WebGL capabilities
   */
  public detectCapabilities(): WebGLCapabilities | null {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities;
    }

    try {
      const canvas = document.createElement('canvas');
      let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
      let version: 1 | 2 = 1;

      // Try WebGL 2 first
      gl = canvas.getContext('webgl2');
      if (gl) {
        version = 2;
      } else {
        // Fallback to WebGL 1
        gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
          return null;
        }
        version = 1;
      }

      const capabilities: WebGLCapabilities = {
        version,
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxCombinedTextureImageUnits: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
        maxVertexTextureImageUnits: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
        maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
        maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
        maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
        maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
        maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
        aliasedLineWidthRange: gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE),
        aliasedPointSizeRange: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE),
        extensions: gl.getSupportedExtensions() || [],
        renderer: gl.getParameter(gl.RENDERER) || 'Unknown',
        vendor: gl.getParameter(gl.VENDOR) || 'Unknown',
        version: gl.getParameter(gl.VERSION) || 'Unknown',
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION) || 'Unknown'
      };

      this.cachedCapabilities = capabilities;
      return capabilities;
    } catch (error) {
      console.error('Failed to detect WebGL capabilities:', error);
      return null;
    }
  }

  /**
   * Detect WebGL extension support
   */
  public detectExtensionSupport(): WebGLExtensionSupport {
    if (this.cachedExtensions) {
      return this.cachedExtensions;
    }

    const capabilities = this.detectCapabilities();
    if (!capabilities) {
      return this.getDefaultExtensionSupport();
    }

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        return this.getDefaultExtensionSupport();
      }

      const extensions: WebGLExtensionSupport = {
        floatTextures: this.checkExtension(gl, 'OES_texture_float'),
        halfFloatTextures: this.checkExtension(gl, 'OES_texture_half_float'),
        textureFilterAnisotropic: this.checkExtension(gl, 'EXT_texture_filter_anisotropic') || 
                                  this.checkExtension(gl, 'WEBKIT_EXT_texture_filter_anisotropic') ||
                                  this.checkExtension(gl, 'MOZ_EXT_texture_filter_anisotropic'),
        vertexArrayObject: this.checkExtension(gl, 'OES_vertex_array_object'),
        instancedArrays: this.checkExtension(gl, 'ANGLE_instanced_arrays'),
        multipleRenderTargets: this.checkExtension(gl, 'WEBGL_draw_buffers'),
        depthTexture: this.checkExtension(gl, 'WEBGL_depth_texture') || 
                     this.checkExtension(gl, 'WEBKIT_WEBGL_depth_texture') ||
                     this.checkExtension(gl, 'MOZ_WEBGL_depth_texture'),
        standardDerivatives: this.checkExtension(gl, 'OES_standard_derivatives'),
        shaderTextureLod: this.checkExtension(gl, 'EXT_shader_texture_lod'),
        fragmentDepth: this.checkExtension(gl, 'EXT_frag_depth'),
        drawBuffers: this.checkExtension(gl, 'WEBGL_draw_buffers'),
        colorBufferFloat: this.checkExtension(gl, 'WEBGL_color_buffer_float') ||
                         this.checkExtension(gl, 'EXT_color_buffer_float'),
        colorBufferHalfFloat: this.checkExtension(gl, 'EXT_color_buffer_half_float')
      };

      this.cachedExtensions = extensions;
      return extensions;
    } catch (error) {
      console.error('Failed to detect WebGL extensions:', error);
      return this.getDefaultExtensionSupport();
    }
  }

  /**
   * Check if a specific extension is supported
   */
  public isExtensionSupported(extensionName: string): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) return false;
      
      return this.checkExtension(gl, extensionName);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get GPU tier based on renderer information
   */
  public getGPUTier(): 'low' | 'medium' | 'high' {
    const capabilities = this.detectCapabilities();
    if (!capabilities) return 'low';

    const renderer = capabilities.renderer.toLowerCase();
    const vendor = capabilities.vendor.toLowerCase();

    // High-end GPU indicators
    const highEndIndicators = [
      'adreno 6', 'adreno 7', // High-end Qualcomm
      'mali-g7', 'mali-g9', // High-end ARM Mali
      'apple a1', 'apple a2', 'apple m', // Apple Silicon
      'geforce', 'radeon', 'intel iris', // Desktop GPUs
      'powervr gt7', 'powervr gt8' // High-end PowerVR
    ];

    // Medium-end GPU indicators
    const mediumEndIndicators = [
      'adreno 5', 'adreno 4', // Mid-range Qualcomm
      'mali-g5', 'mali-g6', 'mali-t8', // Mid-range ARM Mali
      'apple a8', 'apple a9', 'apple a10', // Older Apple chips
      'powervr gt6', 'intel hd' // Mid-range GPUs
    ];

    // Check for high-end indicators
    for (const indicator of highEndIndicators) {
      if (renderer.includes(indicator) || vendor.includes(indicator)) {
        return 'high';
      }
    }

    // Check for medium-end indicators
    for (const indicator of mediumEndIndicators) {
      if (renderer.includes(indicator) || vendor.includes(indicator)) {
        return 'medium';
      }
    }

    // Additional checks based on capabilities
    if (capabilities.maxTextureSize >= 4096 && capabilities.maxCombinedTextureImageUnits >= 32) {
      return 'high';
    } else if (capabilities.maxTextureSize >= 2048 && capabilities.maxCombinedTextureImageUnits >= 16) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get recommended texture format based on extension support
   */
  public getRecommendedTextureFormat(): 'RGBA' | 'RGB' | 'LUMINANCE' {
    const extensions = this.detectExtensionSupport();
    
    if (extensions.floatTextures) {
      return 'RGBA'; // Can use full RGBA with float precision
    } else if (extensions.halfFloatTextures) {
      return 'RGBA'; // Can use RGBA with half-float precision
    } else {
      return 'RGB'; // Fallback to RGB
    }
  }

  /**
   * Get maximum recommended texture size for cloud rendering
   */
  public getMaxRecommendedTextureSize(): number {
    const capabilities = this.detectCapabilities();
    if (!capabilities) return 512;

    const maxSize = capabilities.maxTextureSize;
    
    // Conservative recommendations based on max texture size
    if (maxSize >= 4096) return 2048; // Use half of max for safety
    if (maxSize >= 2048) return 1024;
    if (maxSize >= 1024) return 512;
    return 256;
  }

  /**
   * Check if device supports instanced rendering
   */
  public supportsInstancedRendering(): boolean {
    const extensions = this.detectExtensionSupport();
    return extensions.instancedArrays;
  }

  /**
   * Check if device supports multiple render targets
   */
  public supportsMultipleRenderTargets(): boolean {
    const extensions = this.detectExtensionSupport();
    return extensions.multipleRenderTargets;
  }

  /**
   * Get shader precision recommendations
   */
  public getShaderPrecisionRecommendations(): {
    vertex: 'lowp' | 'mediump' | 'highp';
    fragment: 'lowp' | 'mediump' | 'highp';
  } {
    const capabilities = this.detectCapabilities();
    if (!capabilities) {
      return { vertex: 'mediump', fragment: 'mediump' };
    }

    // Base recommendations on uniform vector limits
    const fragmentUniforms = capabilities.maxFragmentUniformVectors;
    const vertexUniforms = capabilities.maxVertexUniformVectors;

    return {
      vertex: vertexUniforms >= 256 ? 'highp' : vertexUniforms >= 128 ? 'mediump' : 'lowp',
      fragment: fragmentUniforms >= 256 ? 'highp' : fragmentUniforms >= 128 ? 'mediump' : 'lowp'
    };
  }

  /**
   * Clear cached data (useful for testing)
   */
  public clearCache(): void {
    this.cachedCapabilities = null;
    this.cachedExtensions = null;
  }

  /**
   * Get debug information
   */
  public getDebugInfo(): string {
    const capabilities = this.detectCapabilities();
    const extensions = this.detectExtensionSupport();
    
    if (!capabilities) return 'WebGL not supported';

    return `WebGL ${capabilities.version} | ${capabilities.renderer} | ` +
           `Max Texture: ${capabilities.maxTextureSize} | ` +
           `Texture Units: ${capabilities.maxCombinedTextureImageUnits} | ` +
           `Float Textures: ${extensions.floatTextures} | ` +
           `Instancing: ${extensions.instancedArrays}`;
  }

  /**
   * Check if extension is available
   */
  private checkExtension(gl: WebGLRenderingContext, name: string): boolean {
    try {
      return gl.getExtension(name) !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get default extension support (all false)
   */
  private getDefaultExtensionSupport(): WebGLExtensionSupport {
    return {
      floatTextures: false,
      halfFloatTextures: false,
      textureFilterAnisotropic: false,
      vertexArrayObject: false,
      instancedArrays: false,
      multipleRenderTargets: false,
      depthTexture: false,
      standardDerivatives: false,
      shaderTextureLod: false,
      fragmentDepth: false,
      drawBuffers: false,
      colorBufferFloat: false,
      colorBufferHalfFloat: false
    };
  }
}