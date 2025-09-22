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

// Re-export types for convenience
export type { ShaderCompilationResult, ProgramLinkResult } from './ShaderCompiler';
export type { UniformValue } from './UniformManager';