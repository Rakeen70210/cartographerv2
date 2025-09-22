/**
 * Core TypeScript interfaces for the Cloud-Based Fog of War System
 * Defines data types for cloud geometry, animation states, and system components
 */

// Vector and geometric types
export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface CloudBoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CloudGeographicArea {
  center: [number, number]; // [longitude, latitude]
  radius: number; // meters
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Cloud geometry and rendering types
export interface CloudVertex {
  position: [number, number, number]; // x, y, z (elevation)
  texCoord: [number, number];
  density: number;
  normal: [number, number, number];
}

export interface CloudPatch {
  id: string;
  bounds: CloudBoundingBox;
  vertices: Float32Array;
  indices: Uint16Array;
  densityMap: Float32Array;
  textureCoords: Float32Array;
}

export interface CloudCell {
  id: string;
  worldPosition: [number, number];
  vertices: CloudVertex[];
  density: number;
  explored: boolean;
  dissipationState: DissipationState;
}

export interface CloudGrid {
  cellSize: number; // meters
  cells: Map<string, CloudCell>;
  textureAtlas: CloudTextureAtlas;
}

// Texture and visual types
export interface CloudPattern {
  id: string;
  textureCoords: [number, number, number, number]; // u1, v1, u2, v2
  density: number;
  type: 'cumulus' | 'stratus' | 'cirrus' | 'fog';
}

export interface CloudTextureAtlas {
  texture: WebGLTexture | null;
  width: number;
  height: number;
  tileSize: number;
  cloudPatterns: CloudPattern[];
}

// Animation and state types
export interface DissipationState {
  active: boolean;
  startTime: number;
  duration: number;
  center: [number, number];
  radius: number;
  progress: number; // 0-1
}

export interface AnimationState {
  cloudDrift: {
    offset: Vector2;
    speed: number;
    direction: number;
  };
  dissipation: {
    active: boolean;
    center: [number, number];
    radius: number;
    progress: number; // 0-1
    duration: number;
  };
  morphing: {
    noiseOffset: number;
    morphSpeed: number;
  };
}

export interface DissipationAnimation {
  startTime: number;
  duration: number;
  center: [number, number];
  maxRadius: number;
  easing: EasingFunction;
}

export type EasingFunction = (t: number) => number;

// Configuration types
export interface CloudGeneratorConfig {
  cloudDensity: number; // 0-1
  noiseScale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  windDirection: Vector2;
  windSpeed: number;
}

export interface CloudSettings {
  density: number; // 0-1
  animationSpeed: number; // 0-2
  quality: 'low' | 'medium' | 'high';
  colorScheme: 'day' | 'night' | 'custom';
  opacity: number; // 0-1
  contrast: number; // 0-2
}

// Performance and device types
export type PerformanceMode = 'low' | 'medium' | 'high';

export interface PerformanceTier {
  name: string;
  maxCloudCells: number;
  textureResolution: number;
  animationQuality: 'low' | 'medium' | 'high';
  shaderComplexity: 'simple' | 'standard' | 'advanced';
  updateFrequency: number; // Hz
}

export interface DeviceCapabilities {
  gpuTier: 'low' | 'medium' | 'high';
  memoryMB: number;
  supportsFloatTextures: boolean;
  maxTextureSize: number;
  webglVersion: 1 | 2;
}

// Shader and WebGL types
export interface ShaderUniforms {
  u_time: number;
  u_cloudDensity: number;
  u_windVector: [number, number];
  u_dissipationCenter: [number, number];
  u_dissipationRadius: number;
  u_zoomLevel: number;
  u_viewMatrix: Float32Array;
  u_projectionMatrix: Float32Array;
  u_cloudOpacity: number;
}

export interface CloudShaderProgram {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation>;
  attributes: Record<string, number>;
}

// System state and events
export interface CloudState {
  initialized: boolean;
  rendering: boolean;
  animating: boolean;
  performanceMode: PerformanceMode;
  visibleCells: string[];
  activeAnimations: DissipationAnimation[];
}

export interface CloudSystemEvents {
  onCloudStateChange: (state: CloudState) => void;
  onPerformanceChange: (mode: PerformanceMode) => void;
  onError: (error: CloudSystemError) => void;
}

export interface CloudSystemError {
  type: 'shader_compilation' | 'webgl_context_lost' | 'texture_loading' | 'performance';
  message: string;
  recoverable: boolean;
}