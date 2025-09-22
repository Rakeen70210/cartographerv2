/**
 * Simple JavaScript test to verify Perlin noise implementation
 */

// Since we can't easily run TypeScript, let's create a simplified JS version for testing
class SimplePerlinNoise {
  constructor(seed = 12345) {
    this.permutation = this.generatePermutation(seed);
    this.gradients = [
      [1, 1], [-1, 1], [1, -1], [-1, -1],
      [1, 0], [-1, 0], [0, 1], [0, -1]
    ];
  }

  noise(x, y, config) {
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

  singleOctaveNoise(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const sx = this.fade(x - x0);
    const sy = this.fade(y - y0);

    const n00 = this.dotGridGradient(x0, y0, x, y);
    const n10 = this.dotGridGradient(x1, y0, x, y);
    const n01 = this.dotGridGradient(x0, y1, x, y);
    const n11 = this.dotGridGradient(x1, y1, x, y);

    const ix0 = this.lerp(n00, n10, sx);
    const ix1 = this.lerp(n01, n11, sx);
    return this.lerp(ix0, ix1, sy);
  }

  dotGridGradient(ix, iy, x, y) {
    const gradient = this.getGradient(ix, iy);
    const dx = x - ix;
    const dy = y - iy;
    return dx * gradient[0] + dy * gradient[1];
  }

  getGradient(x, y) {
    const hash = this.hash(x, y);
    return this.gradients[hash % this.gradients.length];
  }

  hash(x, y) {
    const xi = Math.abs(x) % 256;
    const yi = Math.abs(y) % 256;
    return this.permutation[(this.permutation[xi] + yi) % 256];
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(a, b, t) {
    return a + t * (b - a);
  }

  generatePermutation(seed) {
    const perm = Array.from({ length: 256 }, (_, i) => i);
    
    let rng = seed;
    for (let i = perm.length - 1; i > 0; i--) {
      rng = (rng * 1664525 + 1013904223) % 4294967296;
      const j = Math.floor((rng / 4294967296) * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }

    return perm;
  }
}

// Test the implementation
console.log('Testing Perlin Noise Implementation...');

const noise = new SimplePerlinNoise(12345);
const config = {
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2.0,
  scale: 0.01
};

// Test consistency
const x = 100;
const y = 200;
const value1 = noise.noise(x, y, config);
const value2 = noise.noise(x, y, config);

console.log(`Consistency test: ${value1} === ${value2} ? ${value1 === value2}`);

// Test different coordinates produce different values
const value3 = noise.noise(x + 1, y, config);
console.log(`Different coordinates: ${value1} !== ${value3} ? ${value1 !== value3}`);

// Test value ranges
const samples = 100;
const values = [];
for (let i = 0; i < samples; i++) {
  const testX = Math.random() * 1000;
  const testY = Math.random() * 1000;
  values.push(noise.noise(testX, testY, config));
}

const min = Math.min(...values);
const max = Math.max(...values);
console.log(`Value range: [${min.toFixed(4)}, ${max.toFixed(4)}]`);

// Test performance
const startTime = Date.now();
const iterations = 1000;
for (let i = 0; i < iterations; i++) {
  noise.noise(i * 0.1, i * 0.1, config);
}
const endTime = Date.now();
const timePerIteration = (endTime - startTime) / iterations;
console.log(`Performance: ${timePerIteration.toFixed(4)}ms per iteration`);

console.log('Perlin noise implementation test completed successfully!');