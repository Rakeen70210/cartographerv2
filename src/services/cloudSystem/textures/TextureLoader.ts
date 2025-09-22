/**
 * Texture loading and management utilities for cloud system
 */

import { TextureData } from './CloudTextureAtlas';

export interface LoadedTexture {
  id: string;
  data: TextureData;
  source: 'file' | 'procedural' | 'url';
}

export interface TextureLoadOptions {
  flipY?: boolean;
  premultiplyAlpha?: boolean;
  generateMipmaps?: boolean;
}

/**
 * Texture loader for cloud system
 */
export class CloudTextureLoader {
  private loadedTextures: Map<string, LoadedTexture> = new Map();
  private loadingPromises: Map<string, Promise<LoadedTexture>> = new Map();

  /**
   * Load texture from URL (for web/development)
   */
  public async loadFromURL(id: string, url: string, options: TextureLoadOptions = {}): Promise<LoadedTexture> {
    // Check if already loaded
    if (this.loadedTextures.has(id)) {
      return this.loadedTextures.get(id)!;
    }

    // Check if currently loading
    if (this.loadingPromises.has(id)) {
      return this.loadingPromises.get(id)!;
    }

    const loadPromise = this.performURLLoad(id, url, options);
    this.loadingPromises.set(id, loadPromise);

    try {
      const texture = await loadPromise;
      this.loadedTextures.set(id, texture);
      return texture;
    } finally {
      this.loadingPromises.delete(id);
    }
  }

  /**
   * Load texture from base64 data
   */
  public async loadFromBase64(id: string, base64Data: string, options: TextureLoadOptions = {}): Promise<LoadedTexture> {
    if (this.loadedTextures.has(id)) {
      return this.loadedTextures.get(id)!;
    }

    const dataUrl = `data:image/png;base64,${base64Data}`;
    return this.loadFromURL(id, dataUrl, options);
  }

  /**
   * Create texture from raw data
   */
  public createFromData(id: string, textureData: TextureData): LoadedTexture {
    const texture: LoadedTexture = {
      id,
      data: textureData,
      source: 'procedural'
    };

    this.loadedTextures.set(id, texture);
    return texture;
  }

  /**
   * Get loaded texture by ID
   */
  public getTexture(id: string): LoadedTexture | undefined {
    return this.loadedTextures.get(id);
  }

  /**
   * Check if texture is loaded
   */
  public isLoaded(id: string): boolean {
    return this.loadedTextures.has(id);
  }

  /**
   * Unload texture and free memory
   */
  public unloadTexture(id: string): void {
    this.loadedTextures.delete(id);
    this.loadingPromises.delete(id);
  }

  /**
   * Clear all loaded textures
   */
  public clearAll(): void {
    this.loadedTextures.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get memory usage statistics
   */
  public getMemoryStats(): { textureCount: number; totalBytes: number } {
    let totalBytes = 0;
    
    for (const texture of this.loadedTextures.values()) {
      const { width, height, channels } = texture.data;
      totalBytes += width * height * channels;
    }

    return {
      textureCount: this.loadedTextures.size,
      totalBytes
    };
  }

  /**
   * Perform actual URL loading
   */
  private async performURLLoad(id: string, url: string, options: TextureLoadOptions): Promise<LoadedTexture> {
    return new Promise((resolve, reject) => {
      // For React Native, we would use Image.resolveAssetSource or similar
      // For now, simulate loading with a simple implementation
      
      if (typeof Image !== 'undefined') {
        // Browser environment
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              reject(new Error('Could not get canvas context'));
              return;
            }

            canvas.width = img.width;
            canvas.height = img.height;
            
            if (options.flipY) {
              ctx.scale(1, -1);
              ctx.translate(0, -img.height);
            }
            
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            
            const textureData: TextureData = {
              data: new Uint8Array(imageData.data),
              width: img.width,
              height: img.height,
              channels: 4
            };

            const texture: LoadedTexture = {
              id,
              data: textureData,
              source: 'url'
            };

            resolve(texture);
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => {
          reject(new Error(`Failed to load texture from ${url}`));
        };

        img.src = url;
      } else {
        // React Native environment - would use different loading mechanism
        reject(new Error('Image loading not implemented for this environment'));
      }
    });
  }
}

/**
 * Texture format utilities
 */
export class TextureFormatUtils {
  /**
   * Convert RGBA to grayscale
   */
  public static rgbaToGrayscale(rgbaData: Uint8Array, width: number, height: number): TextureData {
    const grayscaleData = new Uint8Array(width * height);
    
    for (let i = 0; i < width * height; i++) {
      const r = rgbaData[i * 4];
      const g = rgbaData[i * 4 + 1];
      const b = rgbaData[i * 4 + 2];
      
      // Luminance formula
      const gray = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
      grayscaleData[i] = gray;
    }

    return {
      data: grayscaleData,
      width,
      height,
      channels: 1
    };
  }

  /**
   * Convert grayscale to RGBA
   */
  public static grayscaleToRGBA(grayscaleData: Uint8Array, width: number, height: number): TextureData {
    const rgbaData = new Uint8Array(width * height * 4);
    
    for (let i = 0; i < width * height; i++) {
      const gray = grayscaleData[i];
      rgbaData[i * 4] = gray;     // R
      rgbaData[i * 4 + 1] = gray; // G
      rgbaData[i * 4 + 2] = gray; // B
      rgbaData[i * 4 + 3] = 255;  // A
    }

    return {
      data: rgbaData,
      width,
      height,
      channels: 4
    };
  }

  /**
   * Resize texture data using nearest neighbor
   */
  public static resizeTexture(
    textureData: TextureData,
    newWidth: number,
    newHeight: number
  ): TextureData {
    const { data, width, height, channels } = textureData;
    const newData = new Uint8Array(newWidth * newHeight * channels);

    const scaleX = width / newWidth;
    const scaleY = height / newHeight;

    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const srcX = Math.floor(x * scaleX);
        const srcY = Math.floor(y * scaleY);
        
        const srcIndex = (srcY * width + srcX) * channels;
        const dstIndex = (y * newWidth + x) * channels;
        
        for (let c = 0; c < channels; c++) {
          newData[dstIndex + c] = data[srcIndex + c];
        }
      }
    }

    return {
      data: newData,
      width: newWidth,
      height: newHeight,
      channels
    };
  }

  /**
   * Apply blur filter to texture
   */
  public static blurTexture(textureData: TextureData, radius: number): TextureData {
    const { data, width, height, channels } = textureData;
    const newData = new Uint8Array(data.length);

    // Simple box blur
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        for (let c = 0; c < channels; c++) {
          let sum = 0;
          let count = 0;

          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const nx = x + dx;
              const ny = y + dy;

              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const index = (ny * width + nx) * channels + c;
                sum += data[index];
                count++;
              }
            }
          }

          const dstIndex = (y * width + x) * channels + c;
          newData[dstIndex] = Math.floor(sum / count);
        }
      }
    }

    return {
      data: newData,
      width,
      height,
      channels
    };
  }

  /**
   * Generate mipmaps for texture
   */
  public static generateMipmaps(textureData: TextureData): TextureData[] {
    const mipmaps: TextureData[] = [textureData];
    let currentTexture = textureData;

    while (currentTexture.width > 1 || currentTexture.height > 1) {
      const newWidth = Math.max(1, Math.floor(currentTexture.width / 2));
      const newHeight = Math.max(1, Math.floor(currentTexture.height / 2));
      
      currentTexture = this.resizeTexture(currentTexture, newWidth, newHeight);
      mipmaps.push(currentTexture);
    }

    return mipmaps;
  }
}