/**
 * Cloud Vertex Shader
 * Handles cloud geometry transformation and world-to-screen coordinate conversion
 */

export const CloudVertexShaderSource = `
  // Vertex attributes
  attribute vec3 a_position;      // World position (x, y, elevation)
  attribute vec2 a_texCoord;      // Texture coordinates
  attribute float a_density;      // Cloud density at vertex
  attribute vec3 a_normal;        // Vertex normal for lighting

  // Uniforms for transformation
  uniform mat4 u_viewMatrix;      // View transformation matrix
  uniform mat4 u_projectionMatrix; // Projection matrix
  uniform float u_zoomLevel;      // Current map zoom level
  uniform vec2 u_windVector;      // Wind direction and speed
  uniform float u_time;           // Animation time

  // Varyings to pass to fragment shader
  varying vec2 v_texCoord;
  varying float v_density;
  varying vec3 v_worldPos;
  varying vec3 v_normal;
  varying float v_elevation;

  // Zoom-based scaling function
  float getZoomScale(float zoom) {
    // Scale cloud geometry based on zoom level
    // Higher zoom = more detail, lower zoom = simplified geometry
    return mix(0.5, 2.0, clamp((zoom - 8.0) / 10.0, 0.0, 1.0));
  }

  // Wind-based vertex displacement
  vec3 applyWindDisplacement(vec3 position, vec2 wind, float time) {
    // Apply subtle wind-based movement to vertices
    float windStrength = length(wind);
    vec2 windDir = normalize(wind);
    
    // Create wave-like displacement based on position and time
    float wave = sin(position.x * 0.01 + time * windStrength * 0.5) * 
                 cos(position.y * 0.01 + time * windStrength * 0.3);
    
    // Apply displacement in wind direction
    vec2 displacement = windDir * wave * windStrength * 0.1;
    
    return vec3(position.xy + displacement, position.z);
  }

  void main() {
    // Get zoom-based scaling factor
    float zoomScale = getZoomScale(u_zoomLevel);
    
    // Apply wind displacement to vertex position
    vec3 windDisplacedPos = applyWindDisplacement(a_position, u_windVector, u_time);
    
    // Scale position based on zoom level
    vec3 scaledPosition = windDisplacedPos * zoomScale;
    
    // Transform to world space, then to screen space
    vec4 worldPosition = vec4(scaledPosition, 1.0);
    vec4 viewPosition = u_viewMatrix * worldPosition;
    gl_Position = u_projectionMatrix * viewPosition;
    
    // Pass data to fragment shader
    v_texCoord = a_texCoord;
    v_density = a_density;
    v_worldPos = scaledPosition;
    v_normal = a_normal;
    v_elevation = scaledPosition.z;
    
    // Apply zoom-based point size for point cloud rendering
    gl_PointSize = mix(1.0, 4.0, zoomScale) * a_density;
  }
`;

export class CloudVertexShader {
  private gl: WebGLRenderingContext;
  private shader: WebGLShader | null = null;

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
  }

  /**
   * Compile the vertex shader
   */
  compile(): WebGLShader {
    if (this.shader) {
      return this.shader;
    }

    const shader = this.gl.createShader(this.gl.VERTEX_SHADER);
    if (!shader) {
      throw new Error('Failed to create vertex shader');
    }

    this.gl.shaderSource(shader, CloudVertexShaderSource);
    this.gl.compileShader(shader);

    // Check compilation status
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Vertex shader compilation failed: ${error}`);
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
   * Get attribute locations for the shader program
   */
  static getAttributeLocations(gl: WebGLRenderingContext, program: WebGLProgram): Record<string, number> {
    return {
      a_position: gl.getAttribLocation(program, 'a_position'),
      a_texCoord: gl.getAttribLocation(program, 'a_texCoord'),
      a_density: gl.getAttribLocation(program, 'a_density'),
      a_normal: gl.getAttribLocation(program, 'a_normal'),
    };
  }

  /**
   * Get uniform locations for the shader program
   */
  static getUniformLocations(gl: WebGLRenderingContext, program: WebGLProgram): Record<string, WebGLUniformLocation> {
    const uniforms: Record<string, WebGLUniformLocation> = {};
    
    const uniformNames = [
      'u_viewMatrix',
      'u_projectionMatrix',
      'u_zoomLevel',
      'u_windVector',
      'u_time'
    ];

    uniformNames.forEach(name => {
      const location = gl.getUniformLocation(program, name);
      if (location !== null) {
        uniforms[name] = location;
      }
    });

    return uniforms;
  }
}