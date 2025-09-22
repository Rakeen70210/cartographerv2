/**
 * Uniform Manager
 * Handles WebGL uniform binding and updates with type safety
 */

import { ShaderUniforms } from '../../../types/cloud';

export interface UniformValue {
  type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'mat4' | 'int' | 'sampler2D';
  value: number | number[] | Float32Array;
}

export class UniformManager {
  private gl: WebGLRenderingContext;
  private uniformLocations: Record<string, WebGLUniformLocation>;
  private uniformCache: Map<string, UniformValue> = new Map();

  constructor(gl: WebGLRenderingContext, uniformLocations: Record<string, WebGLUniformLocation>) {
    this.gl = gl;
    this.uniformLocations = uniformLocations;
  }

  /**
   * Set a uniform value with type checking and caching
   */
  setUniform(name: string, value: number | number[] | Float32Array, type?: string): void {
    const location = this.uniformLocations[name];
    if (!location) {
      console.warn(`Uniform location not found: ${name}`);
      return;
    }

    // Determine type if not provided
    const uniformType = type || this.inferUniformType(value);
    
    // Check cache to avoid redundant updates
    const cachedValue = this.uniformCache.get(name);
    if (cachedValue && this.areValuesEqual(cachedValue.value, value)) {
      return; // Value hasn't changed, skip update
    }

    try {
      this.bindUniform(location, value, uniformType);
      
      // Cache the value
      this.uniformCache.set(name, { type: uniformType as any, value });
    } catch (error) {
      console.error(`Failed to set uniform ${name}:`, error);
    }
  }

  /**
   * Update multiple uniforms from ShaderUniforms object
   */
  updateUniforms(uniforms: Partial<ShaderUniforms>): void {
    if (uniforms.u_time !== undefined) {
      this.setUniform('u_time', uniforms.u_time, 'float');
    }
    
    if (uniforms.u_cloudDensity !== undefined) {
      this.setUniform('u_cloudDensity', uniforms.u_cloudDensity, 'float');
    }
    
    if (uniforms.u_cloudOpacity !== undefined) {
      this.setUniform('u_cloudOpacity', uniforms.u_cloudOpacity, 'float');
    }
    
    if (uniforms.u_windVector !== undefined) {
      this.setUniform('u_windVector', uniforms.u_windVector, 'vec2');
    }
    
    if (uniforms.u_dissipationCenter !== undefined) {
      this.setUniform('u_dissipationCenter', uniforms.u_dissipationCenter, 'vec2');
    }
    
    if (uniforms.u_dissipationRadius !== undefined) {
      this.setUniform('u_dissipationRadius', uniforms.u_dissipationRadius, 'float');
    }
    
    if (uniforms.u_zoomLevel !== undefined) {
      this.setUniform('u_zoomLevel', uniforms.u_zoomLevel, 'float');
    }
    
    if (uniforms.u_viewMatrix !== undefined) {
      this.setUniform('u_viewMatrix', uniforms.u_viewMatrix, 'mat4');
    }
    
    if (uniforms.u_projectionMatrix !== undefined) {
      this.setUniform('u_projectionMatrix', uniforms.u_projectionMatrix, 'mat4');
    }
  }

  /**
   * Bind texture uniform
   */
  setTextureUniform(name: string, texture: WebGLTexture, textureUnit: number = 0): void {
    const location = this.uniformLocations[name];
    if (!location) {
      console.warn(`Texture uniform location not found: ${name}`);
      return;
    }

    this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.uniform1i(location, textureUnit);
  }

  /**
   * Clear uniform cache
   */
  clearCache(): void {
    this.uniformCache.clear();
  }

  /**
   * Get cached uniform value
   */
  getCachedValue(name: string): UniformValue | undefined {
    return this.uniformCache.get(name);
  }

  /**
   * Check if uniform exists
   */
  hasUniform(name: string): boolean {
    return name in this.uniformLocations;
  }

  /**
   * Get all uniform names
   */
  getUniformNames(): string[] {
    return Object.keys(this.uniformLocations);
  }

  private bindUniform(location: WebGLUniformLocation, value: number | number[] | Float32Array, type: string): void {
    switch (type) {
      case 'float':
        this.gl.uniform1f(location, value as number);
        break;
        
      case 'vec2':
        const vec2 = value as number[] | Float32Array;
        this.gl.uniform2f(location, vec2[0], vec2[1]);
        break;
        
      case 'vec3':
        const vec3 = value as number[] | Float32Array;
        this.gl.uniform3f(location, vec3[0], vec3[1], vec3[2]);
        break;
        
      case 'vec4':
        const vec4 = value as number[] | Float32Array;
        this.gl.uniform4f(location, vec4[0], vec4[1], vec4[2], vec4[3]);
        break;
        
      case 'mat4':
        const mat4 = value as Float32Array;
        this.gl.uniformMatrix4fv(location, false, mat4);
        break;
        
      case 'int':
      case 'sampler2D':
        this.gl.uniform1i(location, value as number);
        break;
        
      default:
        throw new Error(`Unsupported uniform type: ${type}`);
    }
  }

  private inferUniformType(value: number | number[] | Float32Array): string {
    if (typeof value === 'number') {
      return 'float';
    }
    
    if (Array.isArray(value) || value instanceof Float32Array) {
      switch (value.length) {
        case 2: return 'vec2';
        case 3: return 'vec3';
        case 4: return 'vec4';
        case 16: return 'mat4';
        default: return 'float';
      }
    }
    
    return 'float';
  }

  private areValuesEqual(a: number | number[] | Float32Array, b: number | number[] | Float32Array): boolean {
    if (typeof a === 'number' && typeof b === 'number') {
      return Math.abs(a - b) < 0.0001; // Float comparison with epsilon
    }
    
    if ((Array.isArray(a) || a instanceof Float32Array) && 
        (Array.isArray(b) || b instanceof Float32Array)) {
      if (a.length !== b.length) return false;
      
      for (let i = 0; i < a.length; i++) {
        if (Math.abs(a[i] - b[i]) > 0.0001) return false;
      }
      return true;
    }
    
    return false;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.uniformCache.clear();
  }
}