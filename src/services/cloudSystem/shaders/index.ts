/**
 * Shader System Module
 * Contains WebGL shader management and compilation
 */

// Main shader system implementation
export { ShaderSystem } from './ShaderSystem';

// Shader source code and utilities
export { CloudVertexShader, CloudVertexShaderSource } from './CloudVertexShader';
export { CloudFragmentShader, CloudFragmentShaderSource } from './CloudFragmentShader';
export { ShaderCompiler } from './ShaderCompiler';
export { UniformManager } from './UniformManager';

// Skia-based shader system (new implementation)
export { SkiaShaderManager } from './SkiaShaderManager';
export { SkiaShaderErrorHandler } from './SkiaShaderErrorHandler';
export { SkiaShaderSystem } from './SkiaShaderSystem';
export { FallbackTextureGenerator } from './FallbackTextureGenerator';
export { 
  SkiaCloudFragmentShader, 
  defaultSkiaCloudUniforms, 
  validateSkiaCloudUniforms,
  getLODSettings
} from './SkiaCloudShader';
export type { 
  SkiaCloudUniforms, 
  LODSettings 
} from './SkiaCloudShader';
export type { 
  ShaderCompilationResult as SkiaShaderCompilationResult, 
  UniformUpdateResult 
} from './SkiaShaderManager';
export type {
  ShaderError,
  ErrorRecoveryStrategy,
  ShaderErrorHandlerConfig
} from './SkiaShaderErrorHandler';
export type {
  FallbackTextureConfig,
  FallbackTextureResult
} from './FallbackTextureGenerator';
export type {
  SkiaShaderSystemConfig,
  ShaderSystemState,
  PerformanceMetrics
} from './SkiaShaderSystem';

// Re-export types for convenience
export type { ShaderCompilationResult, ProgramLinkResult } from './ShaderCompiler';
export type { UniformValue } from './UniformManager';