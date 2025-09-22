/**
 * Multi-octave Perlin noise generator for cloud pattern generation
 * Implements classic Perlin noise algorithm with configurable parameters
 */

export interface NoiseConfiguration {
  octaves: number;
  persistence: number;
  lacunarity: number;
  scale: number;
  seed?: number;
}

export class PerlinNoise {
  private permutation: number[];
  private gradients: number[][];

  constructor(seed: number = 12345) {
    this.permutation = this.generatePermutation(seed);
    this.gradients = this.generateGradients();
  }

  /**
   * Generate multi-octave Perlin noise at given coordinates
   */
  public noise(x: number, y: number, config: NoiseConfiguration): number {
    let value = 0;
    let amplitude = 1;
    let frequency = config.scale;
    let maxValue = 0;

    for (let i = 0; i < config.octaves; i++) {
      value += this.singleOctaveNoise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= config.persistence;
      frequency *= config.lacunarity;
    }

    return value / maxValue;
  }

  /**
   * Generate single octave Perlin noise
   */
  private singleOctaveNoise(x: number, y: number): number {
    // Grid cell coordinates
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    // Interpolation weights
    const sx = this.fade(x - x0);
    const sy = this.fade(y - y0);

    // Gradient vectors at grid corners
    const n00 = this.dotGridGradient(x0, y0, x, y);
    const n10 = this.dotGridGradient(x1, y0, x, y);
    const n01 = this.dotGridGradient(x0, y1, x, y);
    const n11 = this.dotGridGradient(x1, y1, x, y);

    // Interpolate
    const ix0 = this.lerp(n00, n10, sx);
    const ix1 = this.lerp(n01, n11, sx);
    const value = this.lerp(ix0, ix1, sy);

    return value;
  }

  /**
   * Calculate dot product of gradient and distance vectors
   */
  private dotGridGradient(ix: number, iy: number, x: number, y: number): number {
    const gradient = this.getGradient(ix, iy);
    const dx = x - ix;
    const dy = y - iy;
    return dx * gradient[0] + dy * gradient[1];
  }

  /**
   * Get gradient vector for grid point
   */
  private getGradient(x: number, y: number): number[] {
    const hash = this.hash(x, y);
    return this.gradients[hash % this.gradients.length];
  }

  /**
   * Hash function for grid coordinates
   */
  private hash(x: number, y: number): number {
    const xi = Math.abs(x) % 256;
    const yi = Math.abs(y) % 256;
    return this.permutation[(this.permutation[xi] + yi) % 256];
  }

  /**
   * Fade function for smooth interpolation
   */
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  /**
   * Linear interpolation
   */
  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  /**
   * Generate permutation table from seed
   */
  private generatePermutation(seed: number): number[] {
    const perm = Array.from({ length: 256 }, (_, i) => i);
    
    // Seeded shuffle using simple LCG
    let rng = seed;
    for (let i = perm.length - 1; i > 0; i--) {
      rng = (rng * 1664525 + 1013904223) % 4294967296;
      const j = Math.floor((rng / 4294967296) * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }

    return perm;
  }

  /**
   * Generate gradient vectors
   */
  private generateGradients(): number[][] {
    return [
      [1, 1], [-1, 1], [1, -1], [-1, -1],
      [1, 0], [-1, 0], [0, 1], [0, -1]
    ];
  }
}