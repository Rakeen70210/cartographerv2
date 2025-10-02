// Core Skia fog system interfaces
export interface CloudShaderUniforms {
  u_time: number;
  u_resolution: [number, number];
  u_zoom: number;
  u_wind_offset: [number, number];
}

export interface DissipationAnimation {
  id: string;
  center: [number, number];
  radius: number;
  startTime: number;
  duration: number;
}

export interface CloudConfig {
  windSpeed: number;
  windDirection: number;
  cloudDensity: number;
  animationSpeed: number;
  lodSettings: {
    minOctaves: number;
    maxOctaves: number;
    zoomThresholds: number[];
  };
}

export interface PerformanceSettings {
  targetFPS: number;
  adaptiveQuality: boolean;
  maxShaderComplexity: number;
}

export interface FogAnimationState {
  clearingAreas: DissipationAnimation[];
  windOffset: [number, number];
  globalTime: number;
  isAnimating: boolean;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface SkiaFogViewport {
  width: number;
  height: number;
  bounds: MapBounds;
}

// Shader system interfaces
export interface ShaderCompilationResult {
  success: boolean;
  shader?: any; // Skia RuntimeEffect
  error?: string;
}

export interface UniformUpdateBatch {
  uniforms: Partial<CloudShaderUniforms>;
  timestamp: number;
}

// Performance monitoring interfaces
export interface PerformanceMetrics {
  frameRate: number;
  renderTime: number;
  memoryUsage: number;
  shaderComplexity: number;
}

export interface DeviceCapabilities {
  gpu: 'basic' | 'mid' | 'high';
  memory: string;
  supportsAdvancedShaders: boolean;
  recommendedLOD: number;
}