/**
 * Cloud System Constants
 * Defines default values and configuration constants for the cloud system
 */

import { CloudSettings, CloudGeneratorConfig, PerformanceTier } from '../../types/cloud';

// Default cloud generation configuration
export const DEFAULT_CLOUD_CONFIG: CloudGeneratorConfig = {
  cloudDensity: 0.6,
  noiseScale: 0.01,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2.0,
  windDirection: { x: 1, y: 0 },
  windSpeed: 0.1
};

// Default cloud system settings
export const DEFAULT_CLOUD_SETTINGS: CloudSettings = {
  density: 0.7,
  animationSpeed: 1.0,
  quality: 'medium',
  colorScheme: 'day',
  opacity: 0.8,
  contrast: 1.0
};

// Performance tier configurations
export const PERFORMANCE_TIERS: Record<string, PerformanceTier> = {
  low: {
    name: 'low',
    maxCloudCells: 100,
    textureResolution: 256,
    animationQuality: 'low',
    shaderComplexity: 'simple',
    updateFrequency: 30
  },
  medium: {
    name: 'medium',
    maxCloudCells: 400,
    textureResolution: 512,
    animationQuality: 'medium',
    shaderComplexity: 'standard',
    updateFrequency: 60
  },
  high: {
    name: 'high',
    maxCloudCells: 1000,
    textureResolution: 1024,
    animationQuality: 'high',
    shaderComplexity: 'advanced',
    updateFrequency: 60
  }
};

// Cloud rendering constants
export const CLOUD_CONSTANTS = {
  // Grid and geometry
  DEFAULT_CELL_SIZE: 100, // meters
  MIN_CLOUD_DENSITY: 0.1,
  MAX_CLOUD_DENSITY: 1.0,
  
  // Animation timing
  DEFAULT_DISSIPATION_DURATION: 2500, // milliseconds
  MIN_DISSIPATION_DURATION: 1000,
  MAX_DISSIPATION_DURATION: 5000,
  
  // Performance thresholds
  TARGET_FPS: 60,
  MIN_ACCEPTABLE_FPS: 30,
  PERFORMANCE_CHECK_INTERVAL: 1000, // milliseconds
  
  // Texture and rendering
  MAX_TEXTURE_SIZE: 2048,
  MIN_TEXTURE_SIZE: 256,
  TEXTURE_ATLAS_PADDING: 2, // pixels
  
  // Shader limits
  MAX_SHADER_UNIFORMS: 32,
  MAX_VERTEX_ATTRIBUTES: 16,
  
  // Memory management
  MAX_CLOUD_PATCHES: 1000,
  CLEANUP_INTERVAL: 5000, // milliseconds
  
  // Geographic constants
  EARTH_RADIUS: 6371000, // meters
  DEGREES_TO_RADIANS: Math.PI / 180,
  RADIANS_TO_DEGREES: 180 / Math.PI
} as const;

// Shader attribute and uniform names
export const SHADER_ATTRIBUTES = {
  POSITION: 'a_position',
  TEX_COORD: 'a_texCoord',
  DENSITY: 'a_density',
  NORMAL: 'a_normal'
} as const;

export const SHADER_UNIFORMS = {
  TIME: 'u_time',
  CLOUD_DENSITY: 'u_cloudDensity',
  WIND_VECTOR: 'u_windVector',
  DISSIPATION_CENTER: 'u_dissipationCenter',
  DISSIPATION_RADIUS: 'u_dissipationRadius',
  ZOOM_LEVEL: 'u_zoomLevel',
  VIEW_MATRIX: 'u_viewMatrix',
  PROJECTION_MATRIX: 'u_projectionMatrix',
  CLOUD_OPACITY: 'u_cloudOpacity',
  TEXTURE_ATLAS: 'u_textureAtlas'
} as const;

// Error messages
export const ERROR_MESSAGES = {
  WEBGL_NOT_SUPPORTED: 'WebGL is not supported on this device',
  SHADER_COMPILATION_FAILED: 'Failed to compile cloud shaders',
  TEXTURE_LOADING_FAILED: 'Failed to load cloud textures',
  CONTEXT_LOST: 'WebGL context was lost',
  INSUFFICIENT_MEMORY: 'Insufficient memory for cloud rendering',
  PERFORMANCE_TOO_LOW: 'Device performance too low for cloud rendering'
} as const;