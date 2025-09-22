/**
 * Cloud Fragment Shader
 * Implements volumetric cloud effects with multi-layer opacity blending
 */

export const CloudFragmentShaderSource = `
  precision mediump float;

  // Varyings from vertex shader
  varying vec2 v_texCoord;
  varying float v_density;
  varying vec3 v_worldPos;
  varying vec3 v_normal;
  varying float v_elevation;

  // Uniforms for cloud rendering
  uniform float u_time;
  uniform float u_cloudDensity;
  uniform float u_cloudOpacity;
  uniform vec2 u_windVector;
  uniform vec2 u_dissipationCenter;
  uniform float u_dissipationRadius;
  uniform float u_zoomLevel;
  uniform sampler2D u_cloudTexture;

  // Noise function for procedural cloud density
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  // Simple noise function
  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  // Multi-octave noise for cloud density calculation
  float cloudNoise(vec2 position, float time) {
    float value = 0.0;
    float amplitude = 1.0;
    float frequency = 0.01;
    
    // Apply wind movement to noise sampling
    vec2 windOffset = u_windVector * time * 0.1;
    vec2 samplePos = position + windOffset;
    
    // Multi-octave noise
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(samplePos * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    
    return clamp(value, 0.0, 1.0);
  }

  // Calculate dissipation factor based on distance from dissipation center
  float calculateDissipation(vec2 worldPos, vec2 center, float radius) {
    if (radius <= 0.0) {
      return 1.0; // No dissipation
    }
    
    float distance = length(worldPos - center);
    
    if (distance >= radius) {
      return 1.0; // Outside dissipation area
    }
    
    // Smooth falloff from center to edge
    float falloff = distance / radius;
    return smoothstep(0.0, 1.0, falloff);
  }

  // Multi-layer opacity blending for volumetric appearance
  vec4 calculateVolumetricCloud(vec2 texCoord, float baseDensity, float time) {
    // Sample base cloud texture
    vec4 baseTexture = texture2D(u_cloudTexture, texCoord);
    
    // Calculate procedural noise density
    float noiseDensity = cloudNoise(v_worldPos.xy, time);
    
    // Combine base density with noise and texture
    float finalDensity = baseDensity * noiseDensity * baseTexture.a * u_cloudDensity;
    
    // Create multiple layers for volumetric effect
    float layer1 = finalDensity;
    float layer2 = finalDensity * 0.7 * cloudNoise(v_worldPos.xy * 2.0, time * 0.5);
    float layer3 = finalDensity * 0.4 * cloudNoise(v_worldPos.xy * 4.0, time * 0.3);
    
    // Combine layers with different opacities
    float combinedDensity = layer1 + layer2 * 0.6 + layer3 * 0.3;
    combinedDensity = clamp(combinedDensity, 0.0, 1.0);
    
    // Calculate cloud color based on density and elevation
    vec3 lightCloudColor = vec3(0.95, 0.95, 0.98); // Light cloud color
    vec3 darkCloudColor = vec3(0.6, 0.65, 0.7);    // Dark cloud color
    vec3 cloudColor = mix(lightCloudColor, darkCloudColor, combinedDensity);
    
    // Add subtle elevation-based color variation
    float elevationFactor = clamp(v_elevation * 0.001, 0.0, 1.0);
    cloudColor = mix(cloudColor, vec3(0.8, 0.85, 0.9), elevationFactor * 0.2);
    
    // Calculate final alpha with soft edges
    float alpha = combinedDensity * u_cloudOpacity;
    
    // Apply soft edge rendering with smooth alpha transitions
    float edgeFactor = smoothstep(0.1, 0.9, combinedDensity);
    alpha *= edgeFactor;
    
    return vec4(cloudColor, alpha);
  }

  // Apply zoom-based detail adjustment
  float getDetailLevel(float zoom) {
    // More detail at higher zoom levels
    return mix(0.3, 1.0, clamp((zoom - 8.0) / 10.0, 0.0, 1.0));
  }

  void main() {
    // Calculate dissipation factor
    float dissipationFactor = calculateDissipation(v_worldPos.xy, u_dissipationCenter, u_dissipationRadius);
    
    // If fully dissipated, render transparent
    if (dissipationFactor < 0.01) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }
    
    // Get detail level based on zoom
    float detailLevel = getDetailLevel(u_zoomLevel);
    
    // Calculate volumetric cloud color and opacity
    vec4 cloudColor = calculateVolumetricCloud(v_texCoord, v_density * detailLevel, u_time);
    
    // Apply dissipation to alpha
    cloudColor.a *= dissipationFactor;
    
    // Ensure minimum visibility for very thin clouds
    if (cloudColor.a < 0.05) {
      cloudColor.a = 0.0;
    }
    
    gl_FragColor = cloudColor;
  }
`;

export class CloudFragmentShader {
  private gl: WebGLRenderingContext;
  private shader: WebGLShader | null = null;

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
  }

  /**
   * Compile the fragment shader
   */
  compile(): WebGLShader {
    if (this.shader) {
      return this.shader;
    }

    const shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    if (!shader) {
      throw new Error('Failed to create fragment shader');
    }

    this.gl.shaderSource(shader, CloudFragmentShaderSource);
    this.gl.compileShader(shader);

    // Check compilation status
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Fragment shader compilation failed: ${error}`);
    }

    this.shader = shader;
    return shader;
  }

  /**
   * Get the compiled shader
   */
  getShader(): WebGLShader {
    if (!this.shader) {
      return this.compile();
    }
    return this.shader;
  }

  /**
   * Dispose of the shader
   */
  dispose(): void {
    if (this.shader) {
      this.gl.deleteShader(this.shader);
      this.shader = null;
    }
  }

  /**
   * Get uniform locations for the fragment shader
   */
  static getUniformLocations(gl: WebGLRenderingContext, program: WebGLProgram): Record<string, WebGLUniformLocation> {
    const uniforms: Record<string, WebGLUniformLocation> = {};
    
    const uniformNames = [
      'u_time',
      'u_cloudDensity',
      'u_cloudOpacity',
      'u_windVector',
      'u_dissipationCenter',
      'u_dissipationRadius',
      'u_zoomLevel',
      'u_cloudTexture'
    ];

    uniformNames.forEach(name => {
      const location = gl.getUniformLocation(program, name);
      if (location !== null) {
        uniforms[name] = location;
      }
    });

    return uniforms;
  }

  /**
   * Create a simple fallback texture for when cloud textures fail to load
   */
  static createFallbackTexture(gl: WebGLRenderingContext): WebGLTexture {
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create fallback texture');
    }

    // Create a simple 2x2 white texture
    const pixels = new Uint8Array([
      255, 255, 255, 255,  // White
      200, 200, 200, 200,  // Light gray
      200, 200, 200, 200,  // Light gray
      255, 255, 255, 255   // White
    ]);

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    return texture;
  }
}