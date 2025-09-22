/**
 * Device Capability Detection System
 * Analyzes device hardware capabilities for cloud rendering optimization
 */

import { DeviceCapabilities, PerformanceTier, PerformanceMode } from '../../../types/cloud';

export class DeviceCapabilityDetector {
  private static instance: DeviceCapabilityDetector;
  private cachedCapabilities: DeviceCapabilities | null = null;
  private performanceTiers: PerformanceTier[] = [];

  private constructor() {
    this.initializePerformanceTiers();
  }

  public static getInstance(): DeviceCapabilityDetector {
    if (!DeviceCapabilityDetector.instance) {
      DeviceCapabilityDetector.instance = new DeviceCapabilityDetector();
    }
    return DeviceCapabilityDetector.instance;
  }

  /**
   * Detect device capabilities including GPU, memory, and WebGL features
   */
  public async detectCapabilities(): Promise<DeviceCapabilities> {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities;
    }

    const capabilities: DeviceCapabilities = {
      gpuTier: await this.detectGPUTier(),
      memoryMB: this.estimateAvailableMemory(),
      supportsFloatTextures: this.checkFloatTextureSupport(),
      maxTextureSize: this.getMaxTextureSize(),
      webglVersion: this.detectWebGLVersion()
    };

    this.cachedCapabilities = capabilities;
    return capabilities;
  }

  /**
   * Get recommended performance tier based on device capabilities
   */
  public getRecommendedPerformanceTier(capabilities: DeviceCapabilities): PerformanceTier {
    // Sort tiers by complexity (low to high)
    const sortedTiers = [...this.performanceTiers].sort((a, b) => 
      this.getTierComplexityScore(a) - this.getTierComplexityScore(b)
    );

    // Find the highest tier the device can handle
    for (let i = sortedTiers.length - 1; i >= 0; i--) {
      const tier = sortedTiers[i];
      if (this.canHandleTier(capabilities, tier)) {
        return tier;
      }
    }

    // Fallback to lowest tier
    return sortedTiers[0];
  }

  /**
   * Get performance mode recommendation based on capabilities
   */
  public getRecommendedPerformanceMode(capabilities: DeviceCapabilities): PerformanceMode {
    const tier = this.getRecommendedPerformanceTier(capabilities);
    
    if (tier.animationQuality === 'high' && capabilities.gpuTier === 'high') {
      return 'high';
    } else if (tier.animationQuality === 'medium' || capabilities.gpuTier === 'medium') {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Check if device supports WebGL float textures
   */
  private checkFloatTextureSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) return false;

      const ext = gl.getExtension('OES_texture_float');
      return ext !== null;
    } catch (error) {
      console.warn('Failed to check float texture support:', error);
      return false;
    }
  }

  /**
   * Detect WebGL version support
   */
  private detectWebGLVersion(): 1 | 2 {
    try {
      const canvas = document.createElement('canvas');
      
      // Try WebGL 2 first
      const gl2 = canvas.getContext('webgl2');
      if (gl2) return 2;

      // Fallback to WebGL 1
      const gl1 = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl1) return 1;

      return 1; // Default fallback
    } catch (error) {
      console.warn('Failed to detect WebGL version:', error);
      return 1;
    }
  }

  /**
   * Get maximum texture size supported by GPU
   */
  private getMaxTextureSize(): number {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) return 1024; // Conservative fallback

      return gl.getParameter(gl.MAX_TEXTURE_SIZE) || 1024;
    } catch (error) {
      console.warn('Failed to get max texture size:', error);
      return 1024;
    }
  }

  /**
   * Detect GPU performance tier through benchmarking
   */
  private async detectGPUTier(): Promise<'low' | 'medium' | 'high'> {
    try {
      const benchmarkScore = await this.runGPUBenchmark();
      
      if (benchmarkScore > 80) return 'high';
      if (benchmarkScore > 40) return 'medium';
      return 'low';
    } catch (error) {
      console.warn('GPU benchmark failed, using fallback detection:', error);
      return this.fallbackGPUDetection();
    }
  }

  /**
   * Run a simple GPU benchmark to assess performance
   */
  private async runGPUBenchmark(): Promise<number> {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
          resolve(20); // Low score for no WebGL
          return;
        }

        // Simple fragment shader benchmark
        const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, `
          attribute vec2 a_position;
          void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
          }
        `);

        const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, `
          precision mediump float;
          uniform float u_time;
          
          void main() {
            vec2 uv = gl_FragCoord.xy / 256.0;
            float noise = 0.0;
            
            // Simple noise calculation for benchmarking
            for (int i = 0; i < 8; i++) {
              float scale = pow(2.0, float(i));
              noise += sin(uv.x * scale + u_time) * cos(uv.y * scale + u_time) / scale;
            }
            
            gl_FragColor = vec4(vec3(noise), 1.0);
          }
        `);

        if (!vertexShader || !fragmentShader) {
          resolve(30);
          return;
        }

        const program = gl.createProgram();
        if (!program) {
          resolve(30);
          return;
        }

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          resolve(30);
          return;
        }

        // Measure rendering performance
        const startTime = performance.now();
        const frames = 60;
        let frameCount = 0;

        const renderFrame = () => {
          gl.useProgram(program);
          gl.uniform1f(gl.getUniformLocation(program, 'u_time'), performance.now() * 0.001);
          
          // Simple quad rendering
          const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
          const buffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
          
          const positionLocation = gl.getAttribLocation(program, 'a_position');
          gl.enableVertexAttribArray(positionLocation);
          gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
          
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          
          frameCount++;
          
          if (frameCount < frames) {
            requestAnimationFrame(renderFrame);
          } else {
            const endTime = performance.now();
            const fps = frames / ((endTime - startTime) / 1000);
            
            // Convert FPS to score (0-100)
            const score = Math.min(100, (fps / 60) * 100);
            resolve(score);
          }
        };

        renderFrame();
      } catch (error) {
        resolve(25); // Low score on error
      }
    });
  }

  /**
   * Create and compile a WebGL shader
   */
  private createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Fallback GPU detection based on user agent and other heuristics
   */
  private fallbackGPUDetection(): 'low' | 'medium' | 'high' {
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Check for high-end indicators
    if (userAgent.includes('iphone') && (userAgent.includes('iphone1') || userAgent.includes('iphone2'))) {
      return 'high';
    }
    
    if (userAgent.includes('ipad')) {
      return 'medium';
    }
    
    // Android device detection
    if (userAgent.includes('android')) {
      // Very basic Android GPU detection
      if (userAgent.includes('adreno') || userAgent.includes('mali-g')) {
        return 'medium';
      }
      return 'low';
    }
    
    // Desktop/web fallback
    return 'medium';
  }

  /**
   * Estimate available memory for cloud rendering
   */
  private estimateAvailableMemory(): number {
    try {
      // Try to get device memory if available (Chrome)
      const deviceMemory = (navigator as any).deviceMemory;
      if (deviceMemory) {
        // Reserve 75% of device memory for other uses
        return Math.floor(deviceMemory * 1024 * 0.25); // Convert GB to MB, use 25%
      }

      // Fallback estimation based on platform
      const userAgent = navigator.userAgent.toLowerCase();
      
      if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
        return 512; // Conservative iOS estimate
      }
      
      if (userAgent.includes('android')) {
        return 256; // Conservative Android estimate
      }
      
      return 1024; // Desktop fallback
    } catch (error) {
      console.warn('Failed to estimate memory:', error);
      return 256; // Very conservative fallback
    }
  }

  /**
   * Initialize performance tier configurations
   */
  private initializePerformanceTiers(): void {
    this.performanceTiers = [
      {
        name: 'low',
        maxCloudCells: 50,
        textureResolution: 256,
        animationQuality: 'low',
        shaderComplexity: 'simple',
        updateFrequency: 15
      },
      {
        name: 'medium',
        maxCloudCells: 150,
        textureResolution: 512,
        animationQuality: 'medium',
        shaderComplexity: 'standard',
        updateFrequency: 30
      },
      {
        name: 'high',
        maxCloudCells: 300,
        textureResolution: 1024,
        animationQuality: 'high',
        shaderComplexity: 'advanced',
        updateFrequency: 60
      }
    ];
  }

  /**
   * Check if device can handle a specific performance tier
   */
  private canHandleTier(capabilities: DeviceCapabilities, tier: PerformanceTier): boolean {
    // Check texture size support
    if (tier.textureResolution > capabilities.maxTextureSize) {
      return false;
    }

    // Check memory requirements (rough estimation)
    const estimatedMemoryUsage = this.estimateTierMemoryUsage(tier);
    if (estimatedMemoryUsage > capabilities.memoryMB) {
      return false;
    }

    // Check GPU tier compatibility
    const requiredGPUTier = this.getRequiredGPUTier(tier);
    if (!this.isGPUTierSufficient(capabilities.gpuTier, requiredGPUTier)) {
      return false;
    }

    return true;
  }

  /**
   * Estimate memory usage for a performance tier
   */
  private estimateTierMemoryUsage(tier: PerformanceTier): number {
    // Rough estimation: texture memory + vertex data + overhead
    const textureMemory = (tier.textureResolution * tier.textureResolution * 4) / (1024 * 1024); // RGBA bytes to MB
    const vertexMemory = (tier.maxCloudCells * 1000 * 4 * 8) / (1024 * 1024); // Rough vertex data estimate
    const overhead = 50; // MB overhead for shaders, uniforms, etc.
    
    return textureMemory + vertexMemory + overhead;
  }

  /**
   * Get required GPU tier for performance tier
   */
  private getRequiredGPUTier(tier: PerformanceTier): 'low' | 'medium' | 'high' {
    if (tier.shaderComplexity === 'advanced') return 'high';
    if (tier.shaderComplexity === 'standard') return 'medium';
    return 'low';
  }

  /**
   * Check if GPU tier is sufficient for requirements
   */
  private isGPUTierSufficient(available: 'low' | 'medium' | 'high', required: 'low' | 'medium' | 'high'): boolean {
    const tierValues = { low: 1, medium: 2, high: 3 };
    return tierValues[available] >= tierValues[required];
  }

  /**
   * Get complexity score for a performance tier
   */
  private getTierComplexityScore(tier: PerformanceTier): number {
    const complexityWeights = { simple: 1, standard: 2, advanced: 3 };
    const qualityWeights = { low: 1, medium: 2, high: 3 };
    
    return (
      tier.maxCloudCells * 0.01 +
      tier.textureResolution * 0.001 +
      complexityWeights[tier.shaderComplexity] * 10 +
      qualityWeights[tier.animationQuality] * 5 +
      tier.updateFrequency * 0.1
    );
  }

  /**
   * Get all available performance tiers
   */
  public getPerformanceTiers(): PerformanceTier[] {
    return [...this.performanceTiers];
  }

  /**
   * Get performance tier by name
   */
  public getPerformanceTier(name: string): PerformanceTier | null {
    return this.performanceTiers.find(tier => tier.name === name) || null;
  }

  /**
   * Clear cached capabilities (useful for testing or when device changes)
   */
  public clearCache(): void {
    this.cachedCapabilities = null;
  }
}