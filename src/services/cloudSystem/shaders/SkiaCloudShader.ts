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
// FLUFFY CUMULUS CLOUD SHADER (Bright White Fog of War)
// Algorithm: Enhanced Billowed Turbulence for realistic cloud appearance
// --------------------------------------------------------------------------


// High quality 2D noise with improved gradient
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    // Quintic interpolation for smoother results
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Enhanced Billowed Turbulence for fluffier, cumulus-like clouds
float billowNoise(vec2 p, float time) {
    float f = 0.0;
    float amp = 0.55;
    float freq = 1.0;
    
    // Increased octaves for more fluffy detail
    for(int i = 0; i < 6; i++) {
        // Slower, more organic motion
        vec2 motion = vec2(time * 0.03 * float(i+1), -time * 0.015 * float(i+1));
        
        // Enhanced billow effect for rounder puffs
        float n = noise(p * freq + motion);
        float billow = 1.0 - abs(n * 2.0 - 1.0);
        // Square the billow for more pronounced puffy shapes
        billow = billow * billow;
        f += billow * amp;
        
        p *= 2.0;
        amp *= 0.5;
    }
    return f;
}

// Secondary detail noise for cloud texture
float detailNoise(vec2 p, float time) {
    float f = 0.0;
    float amp = 0.3;
    for(int i = 0; i < 3; i++) {
        vec2 motion = vec2(time * 0.08, time * 0.04);
        f += noise(p * 4.0 + motion) * amp;
        p *= 2.5;
        amp *= 0.4;
    }
    return f;
}

float calculateCloudDensity(vec2 uv, float time) {
    // 1. Zoom Logic - larger cloud formations at all zoom levels
    float t = time * u_animation_speed * 0.06;
    vec2 wind = u_wind_offset * t * 0.25;
    
    // Scale differently based on zoom for consistent cloud size
    float zoomScale = max(0.15, u_zoom * 0.2);
    vec2 p = (uv + wind) * zoomScale; 
    
    // 2. Generate main cloud turbulence with multiple scales
    float d = billowNoise(p, t);
    
    // 3. Add large-scale variation for distinct cloud patches
    float largeScale = billowNoise(p * 0.3, t * 0.5) * 0.4;
    d = d * 0.7 + largeScale;
    
    // 4. Add fine detail layer
    float detail = detailNoise(p * 2.0, t);
    d = d + detail * 0.1;
    
    // 5. High contrast shaping for distinct fluffy clouds
    d = pow(d, 1.3);
    d = smoothstep(0.25, 0.85, d);
    
    // 6. Variable base - some areas fully transparent, others fully opaque
    return clamp(d, 0.0, 1.0);
}

vec4 main(vec2 fragCoord) {
    vec2 uv = fragCoord / u_resolution;
    // Fix Aspect Ratio
    uv.x *= u_resolution.x / u_resolution.y;
    
    float density = calculateCloudDensity(uv, u_time);
    
    // Enhanced volumetric lighting - sample multiple neighbors for 3D effect
    float d2 = calculateCloudDensity(uv + vec2(-0.02, -0.02), u_time);
    float d3 = calculateCloudDensity(uv + vec2(0.015, 0.015), u_time);
    
    // Calculate depth/volume effect
    float delta = density - d2;
    float backlight = d3 - density;
    
    // Highlight on cloud tops (sun from above-left)
    float highlight = max(0.0, delta) * 3.0;
    // Backlight for depth and rim lighting
    float backlightAmount = max(0.0, backlight) * 1.2;
    
    // Colors: BRIGHT WHITE FLUFFY CLOUDS
    vec3 shadow = vec3(0.82, 0.85, 0.92);   // Soft blue-gray shadow
    vec3 mid    = vec3(0.94, 0.95, 0.97);   // Near-white body  
    vec3 high   = vec3(1.0, 1.0, 1.0);      // Pure white highlights
    vec3 glow   = vec3(0.96, 0.97, 1.0);    // Cool backlight glow
    
    // Build up cloud color with clear transitions
    vec3 color = mix(shadow, mid, smoothstep(0.2, 0.5, density));
    color = mix(color, high, smoothstep(0.5, 0.85, density));
    
    // Add highlight on edges catching "sunlight"
    color = mix(color, high, clamp(highlight, 0.0, 0.5));
    
    // Add subtle backlight glow for depth
    color = mix(color, glow, backlightAmount * 0.25);
    
    // Alpha: More opaque clouds with soft edges
    // Higher minimum alpha to ensure clouds obscure the background
    float alpha = smoothstep(0.0, 0.4, density);
    // Ensure minimum 60% opacity where clouds exist, max 96%
    alpha = 0.6 + alpha * 0.36;
    alpha = clamp(alpha * density, 0.0, 0.96);
    
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