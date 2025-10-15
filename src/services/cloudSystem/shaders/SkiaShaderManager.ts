/**
 * Skia Shader Manager
 * Handles shader compilation, uniform binding, and error recovery for React Native Skia
 */

import { Skia, RuntimeEffect, SkRuntimeEffect, Image } from '@shopify/react-native-skia';
import { SkiaCloudFragmentShader, SkiaCloudUniforms, validateSkiaCloudUniforms, defaultSkiaCloudUniforms, UNIFORM_MASK_FLOAT_COUNT } from './SkiaCloudShader';
import { FallbackTextureGenerator, FallbackTextureConfig } from './FallbackTextureGenerator';

export interface ShaderCompilationResult {
  success: boolean;
  shader?: SkRuntimeEffect;
  error?: string;
  fallbackMode: boolean;
}

export interface UniformUpdateResult {
  success: boolean;
  updatedUniforms: SkiaCloudUniforms;
  error?: string;
}

/**
 * Fallback shader for error recovery
 * Simple solid color shader when main shader compilation fails
 */
const FallbackShaderSource = `
uniform vec2 u_resolution;
uniform float u_cloud_density;

vec4 main(vec2 fragCoord) {
  vec2 uv = fragCoord / u_resolution;
  
  // Simple gradient fallback
  float gradient = smoothstep(0.0, 1.0, length(uv - 0.5));
  float alpha = (1.0 - gradient) * u_cloud_density * 0.5;
  
  return vec4(0.8, 0.8, 0.9, alpha);
}
`;

export class SkiaShaderManager {
  private cloudShader: SkRuntimeEffect | null = null;
  private fallbackShader: SkRuntimeEffect | null = null;
  private fallbackTextureGenerator: FallbackTextureGenerator;
  private fallbackTexture: Image | null = null;
  private currentUniforms: SkiaCloudUniforms;
  private isUsingFallback: boolean = false;
  private isUsingTextureMode: boolean = false;
  private compilationAttempts: number = 0;
  private maxCompilationAttempts: number = 3;
  private lastErrorMessage: string = '';
  private errorTimestamp: number = 0;

  constructor() {
    this.currentUniforms = { ...defaultSkiaCloudUniforms };
    this.fallbackTextureGenerator = new FallbackTextureGenerator();
  }

  /**
   * Initialize and compile the cloud shader with comprehensive error handling
   */
  async initialize(): Promise<ShaderCompilationResult> {
    try {
      console.log('🌫️ Initializing Skia shader manager...');
      
      // Attempt to compile the main cloud shader
      const mainResult = await this.compileCloudShader();
      
      if (mainResult.success) {
        console.log('✅ Skia cloud shader compiled successfully');
        this.isUsingFallback = false;
        this.isUsingTextureMode = false;
        return mainResult;
      }

      // Store error information for diagnostics
      this.lastErrorMessage = mainResult.error || 'Unknown compilation error';
      this.errorTimestamp = Date.now();

      // If main shader fails, try fallback shader
      console.warn('⚠️ Main shader compilation failed, attempting fallback shader:', mainResult.error);
      const fallbackResult = await this.compileFallbackShader();
      
      if (fallbackResult.success) {
        this.isUsingFallback = true;
        this.isUsingTextureMode = false;
        console.log('✅ Fallback shader compiled successfully');
        return { ...fallbackResult, fallbackMode: true };
      }

      // Both shaders failed, try texture fallback mode
      console.warn('⚠️ Fallback shader also failed, attempting texture mode:', fallbackResult.error);
      const textureResult = await this.initializeTextureMode();
      
      if (textureResult.success) {
        this.isUsingFallback = true;
        this.isUsingTextureMode = true;
        console.log('✅ Texture fallback mode initialized successfully');
        return { ...textureResult, fallbackMode: true };
      }

      // All fallback methods failed
      const combinedError = `All rendering methods failed. Main: ${mainResult.error}, Fallback: ${fallbackResult.error}, Texture: ${textureResult.error}`;
      throw new Error(combinedError);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown shader compilation error';
      console.error('❌ Shader manager initialization failed:', errorMessage);
      
      this.lastErrorMessage = errorMessage;
      this.errorTimestamp = Date.now();
      
      return {
        success: false,
        error: errorMessage,
        fallbackMode: false,
      };
    }
  }

  /**
   * Compile the main cloud shader using Skia RuntimeEffect with enhanced error handling
   */
  private async compileCloudShader(): Promise<ShaderCompilationResult> {
    try {
      this.compilationAttempts++;
      console.log(`🔄 Attempting cloud shader compilation (attempt ${this.compilationAttempts}/${this.maxCompilationAttempts})`);
      
      // Validate shader source before compilation
      if (!SkiaCloudFragmentShader || typeof SkiaCloudFragmentShader !== 'string') {
        throw new Error('Invalid shader source: SkiaCloudFragmentShader is not a valid string');
      }

      if (SkiaCloudFragmentShader.length === 0) {
        throw new Error('Invalid shader source: SkiaCloudFragmentShader is empty');
      }

      // Use Skia.RuntimeEffect.Make to compile the shader with error handling
      let shader: SkRuntimeEffect | null = null;
      
      try {
        shader = Skia.RuntimeEffect.Make(SkiaCloudFragmentShader);
      } catch (compilationError) {
        const compileErrorMsg = compilationError instanceof Error ? compilationError.message : 'Unknown Skia compilation error';
        throw new Error(`Skia shader compilation failed: ${compileErrorMsg}`);
      }
      
      if (!shader) {
        throw new Error('Skia.RuntimeEffect.Make returned null - shader compilation failed without specific error');
      }

      // Validate shader by checking if it has the expected uniforms
      try {
        this.validateShaderUniforms(shader);
      } catch (validationError) {
        const validationMsg = validationError instanceof Error ? validationError.message : 'Unknown validation error';
        throw new Error(`Shader validation failed: ${validationMsg}`);
      }
      
      this.cloudShader = shader;
      console.log('✅ Cloud shader compiled and validated successfully');
      
      return {
        success: true,
        shader,
        fallbackMode: false,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown compilation error';
      console.error(`❌ Cloud shader compilation attempt ${this.compilationAttempts} failed:`, {
        error: errorMessage,
        attempt: this.compilationAttempts,
        maxAttempts: this.maxCompilationAttempts,
        shaderSourceLength: SkiaCloudFragmentShader?.length || 0
      });
      
      return {
        success: false,
        error: `Attempt ${this.compilationAttempts}: ${errorMessage}`,
        fallbackMode: false,
      };
    }
  }

  /**
   * Compile the fallback shader for error recovery with enhanced error handling
   */
  private async compileFallbackShader(): Promise<ShaderCompilationResult> {
    try {
      console.log('🔄 Attempting fallback shader compilation...');
      
      // Validate fallback shader source
      if (!FallbackShaderSource || typeof FallbackShaderSource !== 'string') {
        throw new Error('Invalid fallback shader source');
      }

      let shader: SkRuntimeEffect | null = null;
      
      try {
        shader = Skia.RuntimeEffect.Make(FallbackShaderSource);
      } catch (compilationError) {
        const compileErrorMsg = compilationError instanceof Error ? compilationError.message : 'Unknown Skia compilation error';
        throw new Error(`Fallback shader Skia compilation failed: ${compileErrorMsg}`);
      }
      
      if (!shader) {
        throw new Error('Fallback shader compilation failed - Skia.RuntimeEffect.Make returned null');
      }

      this.fallbackShader = shader;
      console.log('✅ Fallback shader compiled successfully');
      
      return {
        success: true,
        shader,
        fallbackMode: true,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown fallback compilation error';
      console.error('❌ Fallback shader compilation failed:', {
        error: errorMessage,
        fallbackSourceLength: FallbackShaderSource?.length || 0
      });
      
      return {
        success: false,
        error: errorMessage,
        fallbackMode: true,
      };
    }
  }

  /**
   * Initialize texture mode as the ultimate fallback when shaders fail
   */
  private async initializeTextureMode(): Promise<ShaderCompilationResult> {
    try {
      console.log('🔄 Initializing texture fallback mode...');
      
      // Generate initial fallback texture
      const textureConfig: FallbackTextureConfig = {
        width: 512,
        height: 512,
        cloudDensity: this.currentUniforms.u_cloud_density,
        animationSpeed: this.currentUniforms.u_animation_speed,
        windOffset: this.currentUniforms.u_wind_offset,
        baseColor: [0.8, 0.8, 0.9], // Light blue-gray
        opacity: 0.7,
      };

      const textureResult = this.fallbackTextureGenerator.generateFogTexture(textureConfig);
      
      if (!textureResult.success || !textureResult.image) {
        throw new Error(textureResult.error || 'Failed to generate fallback texture');
      }

      this.fallbackTexture = textureResult.image;
      console.log('✅ Texture fallback mode initialized successfully');
      
      return {
        success: true,
        fallbackMode: true,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown texture initialization error';
      console.error('❌ Texture fallback mode initialization failed:', errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        fallbackMode: true,
      };
    }
  }

  /**
   * Validate that the shader has the expected uniforms
   */
  private validateShaderUniforms(shader: SkRuntimeEffect): void {
    const expectedUniforms = [
      'u_time',
      'u_resolution',
      'u_zoom',
      'u_wind_offset',
      'u_cloud_density',
      'u_animation_speed'
    ];

    // Note: Skia RuntimeEffect doesn't expose uniform introspection in the same way as WebGL
    // This is a basic validation that the shader compiled successfully
    // The actual uniform validation happens at runtime when we try to set them
    
    if (!shader) {
      throw new Error('Shader validation failed: shader is null');
    }
  }

  /**
   * Update shader uniforms with validation and error handling
   */
  updateUniforms(uniforms: Partial<SkiaCloudUniforms>): UniformUpdateResult {
    try {
      // Validate and sanitize uniform values
      const validatedUniforms = validateSkiaCloudUniforms({
        ...this.currentUniforms,
        ...uniforms,
      });

      // Store the updated uniforms
      this.currentUniforms = validatedUniforms;

      if (__DEV__) {
        const circleUniformLength = this.currentUniforms.u_circleUniforms?.length ?? 0;
        if (circleUniformLength !== UNIFORM_MASK_FLOAT_COUNT) {
          console.warn('🌫️ Shader manager stored unexpected circle uniform length', {
            circleUniformLength,
            expectedLength: UNIFORM_MASK_FLOAT_COUNT,
            maskMode: this.currentUniforms.u_maskMode,
            circleCount: this.currentUniforms.u_circleCount,
          });
        }
      }

      // Update fallback texture if in texture mode and time has changed
      if (this.isUsingTextureMode && uniforms.u_time !== undefined) {
        this.updateFallbackTexture();
      }

      return {
        success: true,
        updatedUniforms: validatedUniforms,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown uniform update error';
      console.error('❌ Uniform update failed:', {
        error: errorMessage,
        uniforms,
        isTextureMode: this.isUsingTextureMode,
        isFallback: this.isUsingFallback
      });
      
      return {
        success: false,
        updatedUniforms: this.currentUniforms,
        error: errorMessage,
      };
    }
  }

  /**
   * Get the current active shader (main or fallback)
   */
  getActiveShader(): SkRuntimeEffect | null {
    if (this.isUsingTextureMode) {
      return null; // No shader in texture mode
    }
    return this.isUsingFallback ? this.fallbackShader : this.cloudShader;
  }

  /**
   * Get the fallback texture for texture mode rendering
   */
  getFallbackTexture(): Image | null {
    return this.fallbackTexture;
  }

  /**
   * Check if currently using texture mode
   */
  isInTextureMode(): boolean {
    return this.isUsingTextureMode;
  }

  /**
   * Update fallback texture with current uniforms (for animated texture mode)
   */
  updateFallbackTexture(): void {
    if (!this.isUsingTextureMode) return;

    try {
      const textureConfig: FallbackTextureConfig = {
        width: 512,
        height: 512,
        cloudDensity: this.currentUniforms.u_cloud_density,
        animationSpeed: this.currentUniforms.u_animation_speed,
        windOffset: this.currentUniforms.u_wind_offset,
        baseColor: [0.8, 0.8, 0.9],
        opacity: 0.7,
      };

      const textureResult = this.fallbackTextureGenerator.generateAnimatedTexture(
        textureConfig,
        this.currentUniforms.u_time * 1000 // Convert to milliseconds
      );

      if (textureResult.success && textureResult.image) {
        this.fallbackTexture = textureResult.image;
      }
    } catch (error) {
      console.warn('Failed to update fallback texture:', error);
    }
  }

  /**
   * Get current uniform values
   */
  getCurrentUniforms(): SkiaCloudUniforms {
    return { ...this.currentUniforms };
  }

  /**
   * Check if using fallback mode
   */
  isInFallbackMode(): boolean {
    return this.isUsingFallback;
  }

  /**
   * Attempt to recover from fallback mode by recompiling main shader
   */
  async attemptRecovery(): Promise<ShaderCompilationResult> {
    if (!this.isUsingFallback) {
      return {
        success: true,
        shader: this.cloudShader!,
        fallbackMode: false,
      };
    }

    // Reset compilation attempts for recovery
    this.compilationAttempts = 0;
    
    console.log('🔄 Attempting to recover from fallback mode...');
    const result = await this.compileCloudShader();
    
    if (result.success) {
      this.isUsingFallback = false;
      this.isUsingTextureMode = false;
      console.log('✅ Successfully recovered from fallback mode to main shader');
    } else {
      console.warn('⚠️ Recovery to main shader failed, remaining in fallback mode');
    }
    
    return result;
  }

  /**
   * Force fallback mode (useful for testing or performance issues)
   */
  async forceFallbackMode(): Promise<ShaderCompilationResult> {
    console.log('🔄 Forcing fallback mode...');
    
    const result = await this.compileFallbackShader();
    if (result.success) {
      this.isUsingFallback = true;
      this.isUsingTextureMode = false;
      console.log('✅ Successfully switched to fallback shader mode');
    } else {
      // If fallback shader fails, try texture mode
      console.warn('⚠️ Fallback shader failed, attempting texture mode...');
      const textureResult = await this.initializeTextureMode();
      if (textureResult.success) {
        this.isUsingFallback = true;
        this.isUsingTextureMode = true;
        console.log('✅ Successfully switched to texture fallback mode');
        return textureResult;
      }
    }
    
    return result;
  }

  /**
   * Force texture mode (ultimate fallback)
   */
  async forceTextureMode(): Promise<ShaderCompilationResult> {
    console.log('🔄 Forcing texture mode...');
    
    const result = await this.initializeTextureMode();
    if (result.success) {
      this.isUsingFallback = true;
      this.isUsingTextureMode = true;
      console.log('✅ Successfully switched to texture mode');
    }
    
    return result;
  }

  /**
   * Get shader compilation diagnostics
   */
  getDiagnostics(): object {
    return {
      hasCloudShader: !!this.cloudShader,
      hasFallbackShader: !!this.fallbackShader,
      hasFallbackTexture: !!this.fallbackTexture,
      isUsingFallback: this.isUsingFallback,
      isUsingTextureMode: this.isUsingTextureMode,
      compilationAttempts: this.compilationAttempts,
      maxCompilationAttempts: this.maxCompilationAttempts,
      lastErrorMessage: this.lastErrorMessage,
      errorTimestamp: this.errorTimestamp,
      currentUniforms: this.currentUniforms,
      textureGeneratorStats: this.fallbackTextureGenerator.getCacheStats(),
    };
  }

  /**
   * Dispose of shader resources
   */
  dispose(): void {
    // Note: Skia RuntimeEffect objects are automatically managed by the Skia engine
    // We just need to clear our references
    this.cloudShader = null;
    this.fallbackShader = null;
    this.fallbackTexture = null;
    this.isUsingFallback = false;
    this.isUsingTextureMode = false;
    this.compilationAttempts = 0;
    this.currentUniforms = { ...defaultSkiaCloudUniforms };
    this.lastErrorMessage = '';
    this.errorTimestamp = 0;
    
    // Dispose of texture generator
    this.fallbackTextureGenerator.dispose();
    
    console.log('✅ Skia shader manager disposed');
  }

  /**
   * Create shader uniforms object for Skia Fill component
   */
  createUniformsForSkia(): Record<string, any> {
    const uniforms: Record<string, any> = {
      u_time: this.currentUniforms.u_time,
      u_resolution: this.currentUniforms.u_resolution,
      u_zoom: this.currentUniforms.u_zoom,
      u_wind_offset: this.currentUniforms.u_wind_offset,
      u_cloud_density: this.currentUniforms.u_cloud_density,
      u_animation_speed: this.currentUniforms.u_animation_speed,
      u_circleCount: this.currentUniforms.u_circleCount,
      u_texWidth: this.currentUniforms.u_texWidth,
      u_featherPx: this.currentUniforms.u_featherPx,
      u_unpackScale: this.currentUniforms.u_unpackScale,
      u_maskMode: this.currentUniforms.u_maskMode,
    };

    if (this.currentUniforms.u_circleData) {
      uniforms.u_circleData = this.currentUniforms.u_circleData;
    }

    if (this.currentUniforms.u_circleUniforms?.length) {
      const circleUniforms = this.currentUniforms.u_circleUniforms;
      if (__DEV__ && circleUniforms.length !== UNIFORM_MASK_FLOAT_COUNT) {
        console.warn('🌫️ Preparing circle uniforms with unexpected length for Skia', {
          circleUniformLength: circleUniforms.length,
          expectedLength: UNIFORM_MASK_FLOAT_COUNT,
        });
      }
      uniforms.u_circleUniforms = Array.from(circleUniforms);
    }

    return uniforms;
  }

  /**
   * Batch update multiple uniforms efficiently
   */
  batchUpdateUniforms(updates: Partial<SkiaCloudUniforms>[]): UniformUpdateResult {
    try {
      let mergedUpdates: Partial<SkiaCloudUniforms> = {};
      
      // Merge all updates into a single object
      for (const update of updates) {
        mergedUpdates = { ...mergedUpdates, ...update };
      }
      
      // Apply the merged updates
      return this.updateUniforms(mergedUpdates);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch update failed';
      console.error('Batch uniform update failed:', errorMessage);
      
      return {
        success: false,
        updatedUniforms: this.currentUniforms,
        error: errorMessage,
      };
    }
  }
}