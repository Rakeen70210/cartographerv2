/**
 * Cloud texture atlas system for managing cloud pattern textures
 */

export interface CloudPattern {
  id: string;
  name: string;
  atlasX: number;
  atlasY: number;
  width: number;
  height: number;
  uvBounds: {
    minU: number;
    minV: number;
    maxU: number;
    maxV: number;
  };
}

export interface AtlasConfig {
  width: number;
  height: number;
  tileSize: number;
  padding: number;
  generateMipmaps: boolean;
}

export interface TextureData {
  data: Uint8Array;
  width: number;
  height: number;
  channels: number; // 1 for grayscale, 4 for RGBA
}

/**
 * Cloud texture atlas for managing multiple cloud patterns in a single texture
 */
export class CloudTextureAtlas {
  private config: AtlasConfig;
  private patterns: Map<string, CloudPattern> = new Map();
  private atlasData: Uint8Array;
  private nextX: number = 0;
  private nextY: number = 0;
  private currentRowHeight: number = 0;

  constructor(config: AtlasConfig) {
    this.config = config;
    this.atlasData = new Uint8Array(config.width * config.height * 4); // RGBA
    this.initializeAtlas();
  }

  /**
   * Add a cloud pattern to the atlas
   */
  public addPattern(id: string, name: string, textureData: TextureData): CloudPattern | null {
    const paddedWidth = textureData.width + this.config.padding * 2;
    const paddedHeight = textureData.height + this.config.padding * 2;

    // Check if pattern fits in current row
    if (this.nextX + paddedWidth > this.config.width) {
      // Move to next row
      this.nextX = 0;
      this.nextY += this.currentRowHeight;
      this.currentRowHeight = 0;
    }

    // Check if pattern fits in atlas
    if (this.nextY + paddedHeight > this.config.height) {
      console.warn(`Cloud pattern ${id} does not fit in atlas`);
      return null;
    }

    // Calculate atlas position (with padding)
    const atlasX = this.nextX + this.config.padding;
    const atlasY = this.nextY + this.config.padding;

    // Copy texture data to atlas
    this.copyTextureToAtlas(textureData, atlasX, atlasY);

    // Calculate UV coordinates
    const uvBounds = {
      minU: atlasX / this.config.width,
      minV: atlasY / this.config.height,
      maxU: (atlasX + textureData.width) / this.config.width,
      maxV: (atlasY + textureData.height) / this.config.height
    };

    const pattern: CloudPattern = {
      id,
      name,
      atlasX,
      atlasY,
      width: textureData.width,
      height: textureData.height,
      uvBounds
    };

    this.patterns.set(id, pattern);

    // Update position for next pattern
    this.nextX += paddedWidth;
    this.currentRowHeight = Math.max(this.currentRowHeight, paddedHeight);

    return pattern;
  }

  /**
   * Get a cloud pattern by ID
   */
  public getPattern(id: string): CloudPattern | undefined {
    return this.patterns.get(id);
  }

  /**
   * Get all patterns in the atlas
   */
  public getAllPatterns(): CloudPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get the atlas texture data
   */
  public getAtlasData(): Uint8Array {
    return this.atlasData;
  }

  /**
   * Get atlas configuration
   */
  public getConfig(): AtlasConfig {
    return { ...this.config };
  }

  /**
   * Get texture coordinates for a specific pattern
   */
  public getTextureCoordinates(patternId: string, localU: number, localV: number): [number, number] {
    const pattern = this.patterns.get(patternId);
    if (!pattern) {
      return [0, 0];
    }

    const u = pattern.uvBounds.minU + localU * (pattern.uvBounds.maxU - pattern.uvBounds.minU);
    const v = pattern.uvBounds.minV + localV * (pattern.uvBounds.maxV - pattern.uvBounds.minV);

    return [u, v];
  }

  /**
   * Initialize atlas with default background
   */
  private initializeAtlas(): void {
    // Fill with transparent black
    this.atlasData.fill(0);
  }

  /**
   * Copy texture data to atlas at specified position
   */
  private copyTextureToAtlas(textureData: TextureData, atlasX: number, atlasY: number): void {
    const { width, height, channels, data } = textureData;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIndex = (y * width + x) * channels;
        const dstIndex = ((atlasY + y) * this.config.width + (atlasX + x)) * 4;

        if (channels === 1) {
          // Grayscale to RGBA
          const gray = data[srcIndex];
          this.atlasData[dstIndex] = gray;     // R
          this.atlasData[dstIndex + 1] = gray; // G
          this.atlasData[dstIndex + 2] = gray; // B
          this.atlasData[dstIndex + 3] = 255;  // A
        } else if (channels === 4) {
          // RGBA to RGBA
          this.atlasData[dstIndex] = data[srcIndex];
          this.atlasData[dstIndex + 1] = data[srcIndex + 1];
          this.atlasData[dstIndex + 2] = data[srcIndex + 2];
          this.atlasData[dstIndex + 3] = data[srcIndex + 3];
        }
      }
    }
  }
}

/**
 * Procedural cloud texture generator
 */
export class ProceduralCloudTextureGenerator {
  /**
   * Generate a basic cloud texture using noise
   */
  public static generateCloudTexture(
    width: number,
    height: number,
    seed: number = 12345
  ): TextureData {
    const data = new Uint8Array(width * height);
    
    // Simple noise-based cloud texture
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const ny = y / height;
        
        // Multi-octave noise
        let value = 0;
        let amplitude = 1;
        let frequency = 4;
        
        for (let i = 0; i < 4; i++) {
          value += this.noise(nx * frequency + seed, ny * frequency + seed) * amplitude;
          amplitude *= 0.5;
          frequency *= 2;
        }
        
        // Normalize and convert to 0-255 range
        value = (value + 1) * 0.5; // -1,1 to 0,1
        value = Math.max(0, Math.min(1, value)); // Clamp
        
        data[y * width + x] = Math.floor(value * 255);
      }
    }

    return {
      data,
      width,
      height,
      channels: 1
    };
  }

  /**
   * Generate a wispy cirrus cloud texture
   */
  public static generateCirrusTexture(
    width: number,
    height: number,
    seed: number = 12345
  ): TextureData {
    const data = new Uint8Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const ny = y / height;
        
        // Stretched noise for wispy effect
        let value = this.noise(nx * 8 + seed, ny * 2 + seed);
        value += this.noise(nx * 16 + seed, ny * 4 + seed) * 0.5;
        value += this.noise(nx * 32 + seed, ny * 8 + seed) * 0.25;
        
        // Apply falloff from edges for more natural shape
        const edgeFalloff = this.calculateEdgeFalloff(nx, ny, 0.8);
        value *= edgeFalloff;
        
        // Normalize and convert
        value = (value + 1) * 0.5;
        value = Math.max(0, Math.min(1, value));
        
        data[y * width + x] = Math.floor(value * 255);
      }
    }

    return {
      data,
      width,
      height,
      channels: 1
    };
  }

  /**
   * Generate a dense cumulus cloud texture
   */
  public static generateCumulusTexture(
    width: number,
    height: number,
    seed: number = 12345
  ): TextureData {
    const data = new Uint8Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const ny = y / height;
        
        // Dense, billowy noise
        let value = this.noise(nx * 6 + seed, ny * 6 + seed);
        value += this.noise(nx * 12 + seed, ny * 12 + seed) * 0.5;
        value += this.noise(nx * 24 + seed, ny * 24 + seed) * 0.25;
        
        // Apply ridged noise for more defined edges
        const ridge = Math.abs(this.noise(nx * 8 + seed, ny * 8 + seed));
        value = Math.max(value, ridge * 0.7);
        
        // Circular falloff for cloud-like shape
        const centerX = 0.5;
        const centerY = 0.5;
        const distance = Math.sqrt((nx - centerX) ** 2 + (ny - centerY) ** 2);
        const falloff = Math.max(0, 1 - distance * 2);
        value *= falloff;
        
        // Normalize and convert
        value = (value + 1) * 0.5;
        value = Math.max(0, Math.min(1, value));
        
        data[y * width + x] = Math.floor(value * 255);
      }
    }

    return {
      data,
      width,
      height,
      channels: 1
    };
  }

  /**
   * Generate a fog texture
   */
  public static generateFogTexture(
    width: number,
    height: number,
    seed: number = 12345
  ): TextureData {
    const data = new Uint8Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const ny = y / height;
        
        // Smooth, low-frequency noise for fog
        let value = this.noise(nx * 2 + seed, ny * 2 + seed);
        value += this.noise(nx * 4 + seed, ny * 4 + seed) * 0.3;
        value += this.noise(nx * 8 + seed, ny * 8 + seed) * 0.1;
        
        // Very gradual falloff
        const edgeFalloff = this.calculateEdgeFalloff(nx, ny, 0.9);
        value *= edgeFalloff;
        
        // Normalize and convert
        value = (value + 1) * 0.5;
        value = Math.max(0, Math.min(1, value));
        
        data[y * width + x] = Math.floor(value * 255);
      }
    }

    return {
      data,
      width,
      height,
      channels: 1
    };
  }

  /**
   * Simple noise function (simplified Perlin-like noise)
   */
  private static noise(x: number, y: number): number {
    // Simple hash-based noise
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return 2 * (n - Math.floor(n)) - 1;
  }

  /**
   * Calculate edge falloff for natural cloud shapes
   */
  private static calculateEdgeFalloff(x: number, y: number, strength: number): number {
    const centerX = 0.5;
    const centerY = 0.5;
    const maxDistance = Math.sqrt(0.5); // Distance from center to corner
    const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    const normalizedDistance = distance / maxDistance;
    
    return Math.pow(1 - Math.min(1, normalizedDistance), strength);
  }
}

/**
 * Cloud texture atlas manager
 */
export class CloudTextureManager {
  private atlas: CloudTextureAtlas;
  private defaultPatterns: Map<string, CloudPattern> = new Map();

  constructor(atlasConfig: AtlasConfig) {
    this.atlas = new CloudTextureAtlas(atlasConfig);
    this.initializeDefaultPatterns();
  }

  /**
   * Get the texture atlas
   */
  public getAtlas(): CloudTextureAtlas {
    return this.atlas;
  }

  /**
   * Get a pattern by type
   */
  public getPattern(type: 'cumulus' | 'cirrus' | 'stratus' | 'fog'): CloudPattern | undefined {
    return this.atlas.getPattern(type);
  }

  /**
   * Initialize default cloud patterns
   */
  private initializeDefaultPatterns(): void {
    const textureSize = this.atlas.getConfig().tileSize;

    // Generate and add default patterns
    const patterns = [
      {
        id: 'cumulus',
        generator: ProceduralCloudTextureGenerator.generateCumulusTexture
      },
      {
        id: 'cirrus',
        generator: ProceduralCloudTextureGenerator.generateCirrusTexture
      },
      {
        id: 'stratus',
        generator: ProceduralCloudTextureGenerator.generateCloudTexture
      },
      {
        id: 'fog',
        generator: ProceduralCloudTextureGenerator.generateFogTexture
      }
    ];

    patterns.forEach(({ id, generator }, index) => {
      const textureData = generator(textureSize, textureSize, 12345 + index * 1000);
      const pattern = this.atlas.addPattern(id, id, textureData);
      
      if (pattern) {
        this.defaultPatterns.set(id, pattern);
      }
    });
  }

  /**
   * Get texture coordinates for a pattern
   */
  public getTextureCoordinates(
    patternType: 'cumulus' | 'cirrus' | 'stratus' | 'fog',
    localU: number,
    localV: number
  ): [number, number] {
    return this.atlas.getTextureCoordinates(patternType, localU, localV);
  }

  /**
   * Create a texture atlas with default cloud patterns
   */
  public static createDefault(): CloudTextureManager {
    const config: AtlasConfig = {
      width: 512,
      height: 512,
      tileSize: 128,
      padding: 2,
      generateMipmaps: true
    };

    return new CloudTextureManager(config);
  }
}