/**
 * Shader System
 * Main class for managing WebGL shader programs, compilation, and uniform updates
 */

import { CloudShaderProgram, ShaderUniforms } from '../../../types/cloud';
import { IShaderSystem } from '../interfaces';
import { CloudVertexShader, CloudVertexShaderSource } from './CloudVertexShader';
import { CloudFragmentShader, CloudFragmentShaderSource } from './CloudFragmentShader';
import { ShaderCompiler, ProgramLinkResult } from './ShaderCompiler';
import { UniformManager } from './UniformManager';

export class ShaderSystem implements IShaderSystem {
  private gl: WebGLRenderingContext | null = null;
  private compiler: ShaderCompiler | null = null;
  private cloudProgram: CloudShaderProgram | null = null;
  private uniformManager: UniformManager | null = null;
  private vertexShader: CloudVertexShader | null = null;
  private fragmentShader: CloudFragmentShader | null = null;
  private initialized: boolean = false;

  /**
   * Initialize the shader system with WebGL context
   */
  async initialize(gl: WebGLRenderingContext): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.gl = gl;
    this.compiler = new ShaderCompiler(gl);
    this.vertexShader = new CloudVertexShader(gl);
    this.fragmentShader = new CloudFragmentShader(gl);

    try {
      // Compile cloud shaders
      this.cloudProgram = await this.compileCloudShaders();
      
      // Create uniform manager
      this.uniformManager = new UniformManager(gl, this.cloudProgram.uniforms);
      
      this.initialized = true;
      console.log('Shader system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize shader system:', error);
      throw error;
    }
  }

  /**
   * Compile cloud shaders and create shader program
   */
  async compileCloudShaders(): Promise<CloudShaderProgram> {
    if (!this.gl || !this.compiler) {
      throw new Error('Shader system not initialized');
    }

    try {
      // Compile the shader program
      const result: ProgramLinkResult = this.compiler.compileProgram(
        CloudVertexShaderSource,
        CloudFragmentShaderSource,
        true // Use fallback on failure
      );

      if (!result.success || !result.program) {
        throw new Error(`Shader compilation failed: ${result.error}`);
      }

      // Get attribute locations
      const attributeNames = ['a_position', 'a_texCoord', 'a_density', 'a_normal'];
      const attributes = this.compiler.getAttributeLocations(result.program, attributeNames);

      // Get uniform locations
      const uniformNames = [
        'u_time', 'u_cloudDensity', 'u_cloudOpacity', 'u_windVector',
        'u_dissipationCenter', 'u_dissipationRadius', 'u_zoomLevel',
        'u_viewMatrix', 'u_projectionMatrix', 'u_cloudTexture'
      ];
      const uniforms = this.compiler.getUniformLocations(result.program, uniformNames);

      // Validate the program
      if (!this.compiler.validateProgram(result.program)) {
        console.warn('Shader program validation failed, but continuing anyway');
      }

      const shaderProgram: CloudShaderProgram = {
        program: result.program,
        uniforms,
        attributes
      };

      console.log('Cloud shaders compiled successfully');
      return shaderProgram;

    } catch (error) {
      console.error('Cloud shader compilation error:', error);
      throw error;
    }
  }

  /**
   * Update shader uniforms
   */
  updateUniforms(uniforms: Partial<ShaderUniforms>): void {
    if (!this.uniformManager) {
      console.warn('Cannot update uniforms: uniform manager not initialized');
      return;
    }

    this.uniformManager.updateUniforms(uniforms);
  }

  /**
   * Bind the cloud shader program for rendering
   */
  bindShaderProgram(program?: CloudShaderProgram): void {
    if (!this.gl) {
      throw new Error('WebGL context not available');
    }

    const shaderProgram = program || this.cloudProgram;
    if (!shaderProgram) {
      throw new Error('No shader program available to bind');
    }

    this.gl.useProgram(shaderProgram.program);
  }

  /**
   * Get the cloud shader program
   */
  getCloudShader(): CloudShaderProgram {
    if (!this.cloudProgram) {
      throw new Error('Cloud shader not compiled');
    }
    return this.cloudProgram;
  }

  /**
   * Set texture uniform
   */
  setTexture(name: string, texture: WebGLTexture, textureUnit: number = 0): void {
    if (!this.uniformManager) {
      console.warn('Cannot set texture: uniform manager not initialized');
      return;
    }

    this.uniformManager.setTextureUniform(name, texture, textureUnit);
  }

  /**
   * Check if shader system is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Handle WebGL context loss
   */
  handleContextLoss(): void {
    console.warn('WebGL context lost, marking shader system as uninitialized');
    this.initialized = false;
    this.cloudProgram = null;
    this.uniformManager = null;
  }

  /**
   * Handle WebGL context restoration
   */
  async handleContextRestore(gl: WebGLRenderingContext): Promise<void> {
    console.log('WebGL context restored, reinitializing shader system');
    this.dispose();
    await this.initialize(gl);
  }

  /**
   * Create a fallback shader program for error recovery
   */
  async createFallbackShader(): Promise<CloudShaderProgram> {
    if (!this.gl || !this.compiler) {
      throw new Error('Cannot create fallback shader: system not initialized');
    }

    const vertexSource = this.compiler.createFallbackVertexShader();
    const fragmentSource = this.compiler.createFallbackFragmentShader();

    const result = this.compiler.compileProgram(vertexSource, fragmentSource, false);
    
    if (!result.success || !result.program) {
      throw new Error(`Fallback shader compilation failed: ${result.error}`);
    }

    // Get minimal attribute and uniform locations
    const attributes = this.compiler.getAttributeLocations(result.program, ['a_position', 'a_texCoord']);
    const uniforms = this.compiler.getUniformLocations(result.program, ['u_viewMatrix', 'u_projectionMatrix', 'u_cloudOpacity']);

    return {
      program: result.program,
      uniforms,
      attributes
    };
  }

  /**
   * Get shader compilation info for debugging
   */
  getShaderInfo(): object {
    return {
      initialized: this.initialized,
      hasCloudProgram: !!this.cloudProgram,
      hasUniformManager: !!this.uniformManager,
      uniformCount: this.cloudProgram ? Object.keys(this.cloudProgram.uniforms).length : 0,
      attributeCount: this.cloudProgram ? Object.keys(this.cloudProgram.attributes).length : 0
    };
  }

  /**
   * Dispose of all shader resources
   */
  dispose(): void {
    if (this.gl && this.cloudProgram) {
      this.gl.deleteProgram(this.cloudProgram.program);
    }

    if (this.vertexShader) {
      this.vertexShader.dispose();
    }

    if (this.fragmentShader) {
      this.fragmentShader.dispose();
    }

    if (this.uniformManager) {
      this.uniformManager.dispose();
    }

    if (this.compiler) {
      this.compiler.dispose();
    }

    this.gl = null;
    this.compiler = null;
    this.cloudProgram = null;
    this.uniformManager = null;
    this.vertexShader = null;
    this.fragmentShader = null;
    this.initialized = false;

    console.log('Shader system disposed');
  }
}