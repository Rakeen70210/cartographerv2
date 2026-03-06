import { ITextureManager } from '../interfaces';
import { CloudTextureManager } from './CloudTextureAtlas';

export class WebTextureManager implements ITextureManager {
  private gl: WebGLRenderingContext | null = null;
  private texture: WebGLTexture | null = null;
  private atlasManager: CloudTextureManager | null = null;
  private textureResolution = 512;

  async initialize(gl: WebGLRenderingContext): Promise<void> {
    this.gl = gl;
    await this.createTextureAtlas();
    await this.loadCloudTextures();
  }

  async loadCloudTextures(): Promise<void> {
    if (!this.gl) {
      return;
    }

    if (!this.atlasManager) {
      await this.createTextureAtlas();
    }

    const atlas = this.atlasManager?.getAtlas();
    if (!atlas) {
      return;
    }

    const { width, height } = atlas.getConfig();
    const data = atlas.getAtlasData();

    this.texture = this.gl.createTexture();
    if (!this.texture) {
      return;
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      width,
      height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      data
    );
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  async createTextureAtlas(): Promise<void> {
    this.atlasManager = CloudTextureManager.createDefault();
  }

  getCloudTexture(_type: string): WebGLTexture | null {
    return this.texture;
  }

  updateTextureResolution(resolution: number): void {
    this.textureResolution = resolution;
    if (!this.gl) {
      return;
    }

    this.dispose();
    this.createTextureAtlas()
      .then(() => this.loadCloudTextures())
      .catch(error => {
        console.error('Failed to update cloud textures:', error);
      });
  }

  dispose(): void {
    if (this.gl && this.texture) {
      this.gl.deleteTexture(this.texture);
    }
    this.texture = null;
    this.atlasManager = null;
  }
}
