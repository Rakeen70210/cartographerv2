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
  u_fog_opacity: number;
  u_base_haze: number;
  u_edge_softness: number;
  u_haze_scale: number;
  u_mass_scale: number;
  u_detail_scale: number;
  u_cloud_primary_color: [number, number, number];
  u_cloud_secondary_color: [number, number, number];
  u_cloud_highlight_color: [number, number, number];
  u_cloud_ambient_color: [number, number, number];
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
uniform float u_fog_opacity;
uniform float u_base_haze;
uniform float u_edge_softness;
uniform float u_haze_scale;
uniform float u_mass_scale;
uniform float u_detail_scale;
uniform vec3 u_cloud_primary_color;
uniform vec3 u_cloud_secondary_color;
uniform vec3 u_cloud_highlight_color;
uniform vec3 u_cloud_ambient_color;

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
    
    // 5. Softer shaping for broad cloud sheets instead of isolated puffs
    d = pow(d, 1.05);
    d = smoothstep(0.18, 0.82, d);
    
    // 6. Variable base - some areas fully transparent, others fully opaque
    return clamp(d, 0.0, 1.0);
}

vec4 main(vec2 fragCoord) {
    vec2 uv = fragCoord / u_resolution;
    // Fix Aspect Ratio
    uv.x *= u_resolution.x / u_resolution.y;
    
    float density = calculateCloudDensity(uv, u_time);
    float hazeDensity = calculateCloudDensity(uv * u_haze_scale + vec2(0.05, -0.02), u_time * 0.32);
    float massDensity = calculateCloudDensity(uv * u_mass_scale, u_time * 0.9);
    float detailDensity = calculateCloudDensity(uv * u_detail_scale + vec2(-0.03, 0.02), u_time * 0.85);
    
    // Enhanced volumetric lighting - sample multiple neighbors for 3D effect
    float d2 = calculateCloudDensity(uv + vec2(-0.02, -0.02), u_time);
    float d3 = calculateCloudDensity(uv + vec2(0.015, 0.015), u_time);
    
    // Calculate depth/volume effect
    float delta = density - d2;
    float backlight = d3 - density;
    
    // Highlight on cloud tops (sun from above-left)
    float highlight = max(0.0, delta) * 1.25;
    // Backlight for depth and rim lighting
    float backlightAmount = max(0.0, backlight) * 0.45;
    
    float veil = smoothstep(0.10, 0.72, hazeDensity) * u_base_haze;
    float cloudBody = smoothstep(0.16, 0.76, massDensity);
    float cloudDetail = smoothstep(0.46, 0.88, detailDensity) * 0.22;
    float coverage = clamp(veil * 0.92 + cloudBody * 0.82 + cloudDetail * 0.35, 0.0, 1.0);
    float softenedDensity = smoothstep(0.04, max(0.38, u_edge_softness), coverage);
    
    vec3 shadow = mix(u_cloud_secondary_color, u_cloud_ambient_color, 0.55);
    vec3 mid = mix(u_cloud_ambient_color, u_cloud_primary_color, smoothstep(0.10, 0.74, coverage));
    vec3 high = u_cloud_highlight_color;
    vec3 glow = mix(u_cloud_highlight_color, vec3(1.0), 0.22);
    
    vec3 color = mix(shadow, mid, smoothstep(0.06, 0.68, softenedDensity));
    color = mix(color, high, smoothstep(0.62, 0.96, softenedDensity) * 0.38);
    
    // Keep top-lighting subtle; the reference is soft and low-contrast.
    color = mix(color, high, clamp(highlight, 0.0, 0.18));
    color = mix(color, glow, clamp(backlightAmount, 0.0, 0.1));
    
    float atmosphericVeil = veil * 0.35;
    float cloudAlpha = smoothstep(0.05, max(0.42, u_edge_softness), softenedDensity);
    float alpha = atmosphericVeil + cloudAlpha * (0.42 + coverage * 0.52);
    // u_fog_opacity is the sole external scalar; no extra compress so dense clouds can reach 0.88+
    alpha = clamp(alpha * u_fog_opacity, 0.0, 0.92);
    
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
  u_fog_opacity: 0.82,
  u_base_haze: 0.52,
  u_edge_softness: 0.96,
  u_haze_scale: 0.46,
  u_mass_scale: 0.84,
  u_detail_scale: 1.22,
  u_cloud_primary_color: [0.94, 0.95, 0.97],
  u_cloud_secondary_color: [0.79, 0.84, 0.90],
  u_cloud_highlight_color: [1.0, 1.0, 1.0],
  u_cloud_ambient_color: [0.90, 0.93, 0.97],
};

/**
 * Uniform validation and bounds checking for performance safety
 */
export function validateSkiaCloudUniforms(uniforms: Partial<SkiaCloudUniforms>): SkiaCloudUniforms {
  const clampColor = (value: [number, number, number] | undefined, fallback: [number, number, number]): [number, number, number] => {
    const source = Array.isArray(value) && value.length === 3 ? value : fallback;
    return [
      Math.max(0, Math.min(1, source[0])),
      Math.max(0, Math.min(1, source[1])),
      Math.max(0, Math.min(1, source[2])),
    ];
  };

  return {
    u_time: Math.max(0, uniforms.u_time ?? defaultSkiaCloudUniforms.u_time),
    u_resolution: uniforms.u_resolution ?? defaultSkiaCloudUniforms.u_resolution,
    u_zoom: Math.max(1, Math.min(20, uniforms.u_zoom ?? defaultSkiaCloudUniforms.u_zoom)),
    u_wind_offset: uniforms.u_wind_offset ?? defaultSkiaCloudUniforms.u_wind_offset,
    u_cloud_density: Math.max(0, Math.min(1, uniforms.u_cloud_density ?? defaultSkiaCloudUniforms.u_cloud_density)),
    u_animation_speed: Math.max(0, Math.min(3, uniforms.u_animation_speed ?? defaultSkiaCloudUniforms.u_animation_speed)),
    u_fog_opacity: Math.max(0, Math.min(1, uniforms.u_fog_opacity ?? defaultSkiaCloudUniforms.u_fog_opacity)),
    u_base_haze: Math.max(0, Math.min(1, uniforms.u_base_haze ?? defaultSkiaCloudUniforms.u_base_haze)),
    u_edge_softness: Math.max(0.1, Math.min(1.5, uniforms.u_edge_softness ?? defaultSkiaCloudUniforms.u_edge_softness)),
    u_haze_scale: Math.max(0.1, Math.min(3, uniforms.u_haze_scale ?? defaultSkiaCloudUniforms.u_haze_scale)),
    u_mass_scale: Math.max(0.1, Math.min(3, uniforms.u_mass_scale ?? defaultSkiaCloudUniforms.u_mass_scale)),
    u_detail_scale: Math.max(0.1, Math.min(4, uniforms.u_detail_scale ?? defaultSkiaCloudUniforms.u_detail_scale)),
    u_cloud_primary_color: clampColor(uniforms.u_cloud_primary_color, defaultSkiaCloudUniforms.u_cloud_primary_color),
    u_cloud_secondary_color: clampColor(uniforms.u_cloud_secondary_color, defaultSkiaCloudUniforms.u_cloud_secondary_color),
    u_cloud_highlight_color: clampColor(uniforms.u_cloud_highlight_color, defaultSkiaCloudUniforms.u_cloud_highlight_color),
    u_cloud_ambient_color: clampColor(uniforms.u_cloud_ambient_color, defaultSkiaCloudUniforms.u_cloud_ambient_color),
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
