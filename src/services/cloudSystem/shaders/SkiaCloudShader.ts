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

// --------------------------------------------------------------------------
// BILLOWED STORM SHADER (High Contrast Fog of War)
// Algorithm: Billowed Turbulence (Ridged Multi-fractal variant)
// --------------------------------------------------------------------------


// High quality 2D noise
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Billowed Turbulence: |Noise| gives "creases", 1.0 - |Noise| gives "puffs"
float billowNoise(vec2 p, float time) {
    float f = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    
    for(int i = 0; i < 4; i++) {
        // Move each octave differently for fluid motion
        vec2 motion = vec2(time * 0.05 * float(i+1), -time * 0.02 * float(i+1));
        
        // The absolute value |noise| creates the sharp creases
        // We invert it (1.0 - |n|) to get round puffs
        float n = noise(p * freq + motion);
        f += (1.0 - abs(n * 2.0 - 1.0)) * amp;
        
        p *= 2.0;
        amp *= 0.5;
    }
    return f;
}

float calculateCloudDensity(vec2 uv, float time) {
    // 1. Zoom Logic for "Big Clouds"
    float t = time * u_animation_speed * 0.1;
    vec2 wind = u_wind_offset * t * 0.5;
    vec2 p = (uv + wind) * u_zoom * 0.35; 
    
    // 2. Generate Turbulence
    float d = billowNoise(p, t);
    
    // 3. Shape the Cloud (Contrast)
    d = pow(d, 1.1); 
    d = smoothstep(0.2, 0.8, d);
    
    // 4. Guaranteed Base Density
    return clamp(0.5 + d * 0.5, 0.0, 1.0);
}

vec4 main(vec2 fragCoord) {
    vec2 uv = fragCoord / u_resolution;
    // Fix Aspect Ratio (Crucial for round clouds)
    uv.x *= u_resolution.x / u_resolution.y;
    
    float density = calculateCloudDensity(uv, u_time);
    
    // Fake "Rim Light" / Volume detail
    // Sample a neighbor pixel to find edges
    // Note: We need to manually calculate the neighbor UV with aspect ratio fix too, 
    // or just assume the offset is small enough that it doesn't matter (it doesn't).
    float d2 = calculateCloudDensity(uv + vec2(-0.02, -0.02), u_time);
    d2 = smoothstep(0.2, 0.8, pow(d2, 1.1)); // Match the contrast curve of the main density roughly
    
    // Actually, calling calculateCloudDensity again is standard.
    // Let's just use the raw density difference.
    
    float delta = density - d2;
    
    // Rim light
    float rim = max(0.0, delta) * 3.0;
    
    // Colors: DESATURATED STORM (cool slate)
    vec3 shadow = vec3(0.12, 0.15, 0.18); // Deep Slate
    vec3 mid    = vec3(0.35, 0.38, 0.42); // Grey
    vec3 high   = vec3(0.55, 0.58, 0.62); // Light Grey
    
    vec3 color = mix(shadow, mid, smoothstep(0.4, 0.7, density));
    color = mix(color, high, smoothstep(0.7, 1.0, density));
    
    // Add Rim
    color += vec3(0.2) * rim;
    
    // Alpha: "Fog of War"
    // Since density is min 0.5, alpha will be min ~0.6
    float alpha = clamp(density * 1.2, 0.0, 0.98);
    
    return vec4(color, alpha);
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
  u_animation_speed: 1.5,
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
      octaves: 3, // Increased from 2 for better base shape
      animationQuality: 0.6,
      updateFrequency: 30,
    };
  } else if (zoom < 12) {
    return {
      octaves: 5, // Increased from 4 for more detail
      animationQuality: 0.8,
      updateFrequency: 45,
    };
  } else if (zoom < 16) {
    return {
      octaves: 7, // Increased from 6 for high detail
      animationQuality: 0.9,
      updateFrequency: 60,
    };
  } else {
    return {
      octaves: 8,
      animationQuality: 1.0,
      updateFrequency: 60,
    };
  }
}