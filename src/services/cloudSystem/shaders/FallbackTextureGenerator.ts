/**
 * Fallback Texture Generator
 * Creates beautiful pre-rendered fog textures using Skia drawing APIs when shaders fail
 */

import { Skia, Canvas, Paint, Path, Image, ImageFormat } from '@shopify/react-native-skia';
import { PerlinNoise } from '../noise/PerlinNoise';

export interface FallbackTextureConfig {
  width: number;
  height: number;
  cloudDensity: number;
  animationSpeed: number;
  windOffset: [number, number];
  baseColor: [number, number, number]; // RGB values 0-1
  opacity: number;
}

export interface FallbackTextureResult {
  success: boolean;
  image?: Image;
  error?: string;
}

export class FallbackTextureGenerator {
  private perlinNoise: PerlinNoise;
  private cachedTextures: Map<string, Image> = new Map();
  private maxCacheSize: number = 10;

  constructor() {
    this.perlinNoise = new PerlinNoise();
  }

  /**
   * Generate a beautiful fallback fog texture using Skia drawing APIs
   */
  generateFogTexture(config: FallbackTextureConfig): FallbackTextureResult {
    try {
      const cacheKey = this.generateCacheKey(config);
      
      // Check cache first
      const cachedTexture = this.cachedTextures.get(cacheKey);
      if (cachedTexture) {
        return { success: true, image: cachedTexture };
      }

      // Create Skia surface for drawing
      const surface = Skia.Surface.Make(config.width, config.height);
      if (!surface) {
        throw new Error('Failed to create Skia surface for fallback texture');
      }

      const canvas = surface.getCanvas();
      
      // Generate the fog texture
      this.drawFogTexture(canvas, config);
      
      // Create image from surface
      const image = surface.makeImageSnapshot();
      if (!image) {
        throw new Error('Failed to create image snapshot from surface');
      }

      // Cache the texture
      this.cacheTexture(cacheKey, image);

      return { success: true, image };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown texture generation error';
      console.error('Fallback texture generation failed:', errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Draw fog texture using Skia drawing APIs
   */
  private drawFogTexture(canvas: Canvas, config: FallbackTextureConfig): void {
    const { width, height, cloudDensity, windOffset, baseColor, opacity } = config;
    
    // Clear canvas with transparent background
    canvas.clear(Skia.Color('transparent'));

    // Create multiple layers for realistic fog effect
    this.drawCloudLayer(canvas, width, height, {
      scale: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      offset: windOffset,
      density: cloudDensity * 0.8,
      color: baseColor,
      opacity: opacity * 0.6,
    });

    this.drawCloudLayer(canvas, width, height, {
      scale: 0.02,
      octaves: 3,
      persistence: 0.6,
      lacunarity: 1.8,
      offset: [windOffset[0] * 0.7, windOffset[1] * 0.7],
      density: cloudDensity * 0.6,
      color: [baseColor[0] * 1.1, baseColor[1] * 1.1, baseColor[2] * 1.1],
      opacity: opacity * 0.4,
    });

    // Add subtle detail layer
    this.drawDetailLayer(canvas, width, height, {
      scale: 0.05,
      offset: windOffset,
      density: cloudDensity * 0.3,
      color: baseColor,
      opacity: opacity * 0.2,
    });
  }

  /**
   * Draw a single cloud layer using noise
   */
  private drawCloudLayer(
    canvas: Canvas,
    width: number,
    height: number,
    params: {
      scale: number;
      octaves: number;
      persistence: number;
      lacunarity: number;
      offset: [number, number];
      density: number;
      color: [number, number, number];
      opacity: number;
    }
  ): void {
    const { scale, octaves, persistence, lacunarity, offset, density, color, opacity } = params;
    
    // Create paint for this layer
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setBlendMode(Skia.BlendMode.SrcOver);

    // Sample noise at regular intervals for performance
    const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 200));
    
    for (let x = 0; x < width; x += sampleStep) {
      for (let y = 0; y < height; y += sampleStep) {
        // Calculate noise coordinates with wind offset
        const noiseX = (x + offset[0]) * scale;
        const noiseY = (y + offset[1]) * scale;
        
        // Generate fractal noise
        let noiseValue = 0;
        let amplitude = 1;
        let frequency = 1;
        
        for (let i = 0; i < octaves; i++) {
          noiseValue += amplitude * this.perlinNoise.noise(noiseX * frequency, noiseY * frequency);
          amplitude *= persistence;
          frequency *= lacunarity;
        }
        
        // Normalize noise value to 0-1 range
        noiseValue = (noiseValue + 1) * 0.5;
        
        // Apply density threshold
        const alpha = Math.max(0, (noiseValue - (1 - density)) / density) * opacity;
        
        if (alpha > 0.01) { // Only draw visible pixels
          // Create color with calculated alpha
          const finalColor = Skia.Color([
            Math.floor(color[0] * 255),
            Math.floor(color[1] * 255),
            Math.floor(color[2] * 255),
            Math.floor(alpha * 255)
          ]);
          
          paint.setColor(finalColor);
          
          // Draw a small rectangle for this sample
          const rect = Skia.XYWHRect(x, y, sampleStep, sampleStep);
          canvas.drawRect(rect, paint);
        }
      }
    }
  }

  /**
   * Draw detail layer with fine noise patterns
   */
  private drawDetailLayer(
    canvas: Canvas,
    width: number,
    height: number,
    params: {
      scale: number;
      offset: [number, number];
      density: number;
      color: [number, number, number];
      opacity: number;
    }
  ): void {
    const { scale, offset, density, color, opacity } = params;
    
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setBlendMode(Skia.BlendMode.Overlay);

    // Create path for detail patterns
    const path = Skia.Path.Make();
    
    // Sample at lower resolution for detail layer
    const sampleStep = Math.max(2, Math.floor(Math.min(width, height) / 100));
    
    for (let x = 0; x < width; x += sampleStep * 2) {
      for (let y = 0; y < height; y += sampleStep * 2) {
        const noiseX = (x + offset[0]) * scale;
        const noiseY = (y + offset[1]) * scale;
        
        const noiseValue = (this.perlinNoise.noise(noiseX, noiseY) + 1) * 0.5;
        
        if (noiseValue > (1 - density)) {
          const alpha = (noiseValue - (1 - density)) / density * opacity;
          
          if (alpha > 0.05) {
            // Add small circles for detail
            path.addCircle(x, y, sampleStep * 0.5);
          }
        }
      }
    }
    
    // Draw the detail path
    const finalColor = Skia.Color([
      Math.floor(color[0] * 255),
      Math.floor(color[1] * 255),
      Math.floor(color[2] * 255),
      Math.floor(opacity * 128) // Lower opacity for detail layer
    ]);
    
    paint.setColor(finalColor);
    canvas.drawPath(path, paint);
  }

  /**
   * Generate animated fallback texture with time-based variations
   */
  generateAnimatedTexture(
    config: FallbackTextureConfig,
    time: number
  ): FallbackTextureResult {
    // Create time-based variations in the config
    const animatedConfig: FallbackTextureConfig = {
      ...config,
      windOffset: [
        config.windOffset[0] + Math.sin(time * 0.001) * 10,
        config.windOffset[1] + Math.cos(time * 0.0008) * 8,
      ],
      cloudDensity: config.cloudDensity + Math.sin(time * 0.0005) * 0.1,
    };

    return this.generateFogTexture(animatedConfig);
  }

  /**
   * Generate cache key for texture caching
   */
  private generateCacheKey(config: FallbackTextureConfig): string {
    const rounded = {
      width: Math.round(config.width / 10) * 10, // Round to nearest 10
      height: Math.round(config.height / 10) * 10,
      density: Math.round(config.cloudDensity * 100) / 100,
      windX: Math.round(config.windOffset[0] / 5) * 5, // Round wind to nearest 5
      windY: Math.round(config.windOffset[1] / 5) * 5,
      opacity: Math.round(config.opacity * 100) / 100,
    };

    return `${rounded.width}x${rounded.height}_d${rounded.density}_w${rounded.windX},${rounded.windY}_o${rounded.opacity}`;
  }

  /**
   * Cache texture with size management
   */
  private cacheTexture(key: string, image: Image): void {
    // Remove oldest entries if cache is full
    if (this.cachedTextures.size >= this.maxCacheSize) {
      const firstKey = this.cachedTextures.keys().next().value;
      if (firstKey) {
        this.cachedTextures.delete(firstKey);
      }
    }

    this.cachedTextures.set(key, image);
  }

  /**
   * Clear texture cache
   */
  clearCache(): void {
    this.cachedTextures.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    keys: string[];
  } {
    return {
      size: this.cachedTextures.size,
      maxSize: this.maxCacheSize,
      keys: Array.from(this.cachedTextures.keys()),
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.clearCache();
  }
}