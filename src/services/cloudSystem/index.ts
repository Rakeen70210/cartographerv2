/**
 * Cloud System Module
 * Main entry point for the procedural cloud generation system
 */

// Noise generation
export * from './noise';

// Geometry generation
export * from './geometry';

// Texture management
export * from './textures';

// Shader system
export * from './shaders';

// Animation system
export * from './animation';

// Geographic context and terrain awareness
export * from './geography';

// Re-export key types and classes for convenience
export type {
  NoiseConfiguration
} from './noise';

export {
  PerlinNoise,
  NoiseUtils,
  NoisePresets
} from './noise';

export {
  AnimationController,
  DriftAnimation,
  MorphingEffects,
  EasingFunctions
} from './animation';