/**
 * Skia Cloud Shader
 * GLSL fragment shader implementation for React Native Skia with multi-octave noise (FBM)
 * Optimized for mobile GPU performance with zoom-based level-of-detail
 */

export interface SkiaCloudUniforms {
  u_time: number;
  u_resolution: [number, number];
  u_zoom: number;
  u_wind_offset: [number, number];
  u_cloud_density: number;
  u_animation_speed: number;
}

/**
 * GLSL Fragment Shader Source for Skia Cloud Rendering
 * Implements Fractional Brownian Motion (FBM) for realistic cloud patterns
 */
export const SkiaCloudFragmentShader = `
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_zoom;
uniform vec2 u_wind_offset;
uniform float u_cloud_density;
uniform float u_animation_speed;

// Hash function for noise generation
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Improved noise function with better distribution
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  
  // Four corner values
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  
  // Smooth interpolation using smoothstep
  vec2 u = f * f * (3.0 - 2.0 * f);
  
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// Fractional Brownian Motion (FBM) implementation
// Multi-octave noise for realistic cloud formations
float fbm(vec2 p, int octaves, float persistence, float lacunarity) {
  float value = 0.0;
  float amplitude = 1.0;
  float frequency = 1.0;
  float maxValue = 0.0;
  
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    
    value += amplitude * noise(p * frequency);
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  
  return value / maxValue;
}

// Zoom-based level-of-detail optimization
int getLODOctaves(float zoom) {
  // Adjust octave count based on zoom level for performance
  if (zoom < 8.0) {
    return 2; // Low detail for distant view
  } else if (zoom < 12.0) {
    return 4; // Medium detail
  } else if (zoom < 16.0) {
    return 6; // High detail
  } else {
    return 8; // Maximum detail for close-up view
  }
}

// Enhanced cloud density calculation with multiple layers
float calculateCloudDensity(vec2 uv, float time) {
  // Apply wind movement and time-based animation
  vec2 windTime = u_wind_offset * time * u_animation_speed * 0.02;
  vec2 cloudCoord = uv + windTime;
  
  // Get appropriate octave count for current zoom level
  int octaves = getLODOctaves(u_zoom);
  
  // Base cloud layer with large-scale patterns
  float baseLayer = fbm(cloudCoord * u_zoom * 0.5, octaves, 0.5, 2.0);
  
  // Detail layer with smaller-scale variations
  float detailLayer = fbm(cloudCoord * u_zoom * 2.0, int(max(2.0, float(octaves - 2))), 0.4, 2.1);
  
  // Turbulence layer for natural irregularity
  float turbulence = fbm(cloudCoord * u_zoom * 4.0 + time * 0.01, int(max(1.0, float(octaves - 4))), 0.3, 2.2);
  
  // Combine layers with different weights
  float density = baseLayer * 0.6 + detailLayer * 0.3 + turbulence * 0.1;
  
  // Apply cloud density control
  density *= u_cloud_density;
  
  // Create more realistic cloud distribution with threshold
  density = smoothstep(0.3, 0.8, density);
  
  return clamp(density, 0.0, 1.0);
}

// Cloud color calculation with atmospheric effects
vec3 calculateCloudColor(float density, vec2 uv) {
  // Base cloud colors
  vec3 lightCloud = vec3(0.95, 0.95, 0.98);  // Light cloud color
  vec3 darkCloud = vec3(0.7, 0.75, 0.8);     // Shadow areas
  vec3 edgeCloud = vec3(0.85, 0.9, 0.95);    // Cloud edges
  
  // Create color variation based on density
  vec3 cloudColor = mix(lightCloud, darkCloud, density * 0.6);
  
  // Add subtle edge highlighting for depth
  float edgeFactor = 1.0 - smoothstep(0.1, 0.4, density);
  cloudColor = mix(cloudColor, edgeCloud, edgeFactor * 0.3);
  
  // Add slight blue tint for atmospheric perspective
  float atmosphericTint = smoothstep(0.0, 1.0, length(uv - 0.5));
  cloudColor = mix(cloudColor, vec3(0.8, 0.85, 0.9), atmosphericTint * 0.1);
  
  return cloudColor;
}

// Soft alpha calculation for natural cloud edges
float calculateAlpha(float density) {
  // Create soft, natural-looking cloud edges
  float alpha = density;
  
  // Apply smooth falloff for realistic transparency
  alpha = smoothstep(0.1, 0.9, alpha);
  
  // Ensure minimum visibility threshold
  if (alpha < 0.05) {
    alpha = 0.0;
  }
  
  return alpha * 0.8; // Overall opacity control
}

vec4 main(vec2 fragCoord) {
  // Normalize coordinates
  vec2 uv = fragCoord / u_resolution;
  
  // Calculate animated cloud density
  float density = calculateCloudDensity(uv, u_time);
  
  // Early exit for transparent areas (performance optimization)
  if (density < 0.01) {
    return vec4(0.0, 0.0, 0.0, 0.0);
  }
  
  // Calculate cloud color and alpha
  vec3 cloudColor = calculateCloudColor(density, uv);
  float alpha = calculateAlpha(density);
  
  return vec4(cloudColor, alpha);
}
`;

/**
 * Default uniform values for Skia cloud shader
 */
export const defaultSkiaCloudUniforms: SkiaCloudUniforms = {
  u_time: 0.0,
  u_resolution: [1024, 1024],
  u_zoom: 10.0,
  u_wind_offset: [0.0, 0.0],
  u_cloud_density: 0.7,
  u_animation_speed: 1.0,
};

/**
 * Uniform validation and bounds checking for performance safety
 */
export function validateSkiaCloudUniforms(uniforms: Partial<SkiaCloudUniforms>): SkiaCloudUniforms {
  return {
    u_time: Math.max(0, uniforms.u_time ?? defaultSkiaCloudUniforms.u_time),
    u_resolution: uniforms.u_resolution ?? defaultSkiaCloudUniforms.u_resolution,
    u_zoom: Math.max(1, Math.min(20, uniforms.u_zoom ?? defaultSkiaCloudUniforms.u_zoom)),
    u_wind_offset: uniforms.u_wind_offset ?? defaultSkiaCloudUniforms.u_wind_offset,
    u_cloud_density: Math.max(0, Math.min(1, uniforms.u_cloud_density ?? defaultSkiaCloudUniforms.u_cloud_density)),
    u_animation_speed: Math.max(0, Math.min(3, uniforms.u_animation_speed ?? defaultSkiaCloudUniforms.u_animation_speed)),
  };
}

/**
 * Performance optimization settings based on zoom level
 */
export interface LODSettings {
  octaves: number;
  animationQuality: number;
  updateFrequency: number;
}

export function getLODSettings(zoom: number): LODSettings {
  if (zoom < 8) {
    return {
      octaves: 2,
      animationQuality: 0.5,
      updateFrequency: 30, // 30fps for distant view
    };
  } else if (zoom < 12) {
    return {
      octaves: 4,
      animationQuality: 0.7,
      updateFrequency: 45, // 45fps for medium view
    };
  } else if (zoom < 16) {
    return {
      octaves: 6,
      animationQuality: 0.9,
      updateFrequency: 60, // 60fps for close view
    };
  } else {
    return {
      octaves: 8,
      animationQuality: 1.0,
      updateFrequency: 60, // Maximum quality
    };
  }
}