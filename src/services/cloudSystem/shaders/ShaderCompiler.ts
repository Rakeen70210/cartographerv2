/**
 * Shader Compiler Utility
 * Handles WebGL shader compilation with error handling and fallbacks
 */

export interface ShaderCompilationResult {
  success: boolean;
  shader?: WebGLShader;
  error?: string;
}

export interface ProgramLinkResult {
  success: boolean;
  program?: WebGLProgram;
  error?: string;
}

export class ShaderCompiler {
  private gl: WebGLRenderingContext;

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
  }

  /**
   * Compile a shader from source code
   */
  compileShader(source: string, type: number): ShaderCompilationResult {
    const shader = this.gl.createShader(type);
    if (!shader) {
      return {
        success: false,
        error: 'Failed to create shader object'
      };
    }

    try {
      this.gl.shaderSource(shader, source);
      this.gl.compileShader(shader);

      // Check compilation status
      if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
        const error = this.gl.getShaderInfoLog(shader) || 'Unknown compilation error';
        this.gl.deleteShader(shader);
        return {
          success: false,
          error: `Shader compilation failed: ${error}`
        };
      }

      return {
        success: true,
        shader
      };
    } catch (error) {
      this.gl.deleteShader(shader);
      return {
        success: false,
        error: `Shader compilation exception: ${error}`
      };
    }
  }

  /**
   * Link vertex and fragment shaders into a program
   */
  linkProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): ProgramLinkResult {
    const program = this.gl.createProgram();
    if (!program) {
      return {
        success: false,
        error: 'Failed to create shader program'
      };
    }

    try {
      this.gl.attachShader(program, vertexShader);
      this.gl.attachShader(program, fragmentShader);
      this.gl.linkProgram(program);

      // Check linking status
      if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
        const error = this.gl.getProgramInfoLog(program) || 'Unknown linking error';
        this.gl.deleteProgram(program);
        return {
          success: false,
          error: `Program linking failed: ${error}`
        };
      }

      return {
        success: true,
        program
      };
    } catch (error) {
      this.gl.deleteProgram(program);
      return {
        success: false,
        error: `Program linking exception: ${error}`
      };
    }
  }

  /**
   * Validate a shader program
   */
  validateProgram(program: WebGLProgram): boolean {
    this.gl.validateProgram(program);
    return this.gl.getProgramParameter(program, this.gl.VALIDATE_STATUS);
  }

  /**
   * Get all attribute locations from a program
   */
  getAttributeLocations(program: WebGLProgram, attributeNames: string[]): Record<string, number> {
    const locations: Record<string, number> = {};
    
    attributeNames.forEach(name => {
      const location = this.gl.getAttribLocation(program, name);
      if (location !== -1) {
        locations[name] = location;
      }
    });

    return locations;
  }

  /**
   * Get all uniform locations from a program
   */
  getUniformLocations(program: WebGLProgram, uniformNames: string[]): Record<string, WebGLUniformLocation> {
    const locations: Record<string, WebGLUniformLocation> = {};
    
    uniformNames.forEach(name => {
      const location = this.gl.getUniformLocation(program, name);
      if (location !== null) {
        locations[name] = location;
      }
    });

    return locations;
  }

  /**
   * Create a simple fallback vertex shader
   */
  createFallbackVertexShader(): string {
    return `
      attribute vec3 a_position;
      attribute vec2 a_texCoord;
      
      uniform mat4 u_viewMatrix;
      uniform mat4 u_projectionMatrix;
      
      varying vec2 v_texCoord;
      
      void main() {
        gl_Position = u_projectionMatrix * u_viewMatrix * vec4(a_position, 1.0);
        v_texCoord = a_texCoord;
      }
    `;
  }

  /**
   * Create a simple fallback fragment shader
   */
  createFallbackFragmentShader(): string {
    return `
      precision mediump float;
      
      varying vec2 v_texCoord;
      uniform float u_cloudOpacity;
      
      void main() {
        // Simple gray cloud fallback
        vec3 cloudColor = vec3(0.8, 0.8, 0.85);
        float alpha = u_cloudOpacity * 0.5;
        gl_FragColor = vec4(cloudColor, alpha);
      }
    `;
  }

  /**
   * Compile a complete shader program with fallback support
   */
  compileProgram(vertexSource: string, fragmentSource: string, useFallback: boolean = true): ProgramLinkResult {
    // Try to compile vertex shader
    let vertexResult = this.compileShader(vertexSource, this.gl.VERTEX_SHADER);
    
    if (!vertexResult.success && useFallback) {
      console.warn('Vertex shader compilation failed, using fallback:', vertexResult.error);
      vertexResult = this.compileShader(this.createFallbackVertexShader(), this.gl.VERTEX_SHADER);
    }

    if (!vertexResult.success || !vertexResult.shader) {
      return {
        success: false,
        error: `Vertex shader failed: ${vertexResult.error}`
      };
    }

    // Try to compile fragment shader
    let fragmentResult = this.compileShader(fragmentSource, this.gl.FRAGMENT_SHADER);
    
    if (!fragmentResult.success && useFallback) {
      console.warn('Fragment shader compilation failed, using fallback:', fragmentResult.error);
      fragmentResult = this.compileShader(this.createFallbackFragmentShader(), this.gl.FRAGMENT_SHADER);
    }

    if (!fragmentResult.success || !fragmentResult.shader) {
      this.gl.deleteShader(vertexResult.shader);
      return {
        success: false,
        error: `Fragment shader failed: ${fragmentResult.error}`
      };
    }

    // Link the program
    const linkResult = this.linkProgram(vertexResult.shader, fragmentResult.shader);

    // Clean up shaders (they're no longer needed after linking)
    this.gl.deleteShader(vertexResult.shader);
    this.gl.deleteShader(fragmentResult.shader);

    return linkResult;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // Nothing to dispose for the compiler itself
  }
}