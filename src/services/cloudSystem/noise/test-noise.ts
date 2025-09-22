/**
 * Simple test script to verify Perlin noise implementation
 */

import { PerlinNoise, NoiseConfiguration } from './PerlinNoise';
import { NoisePresets, NoiseUtils } from './NoiseUtils';

// Test basic noise generation
console.log('Testing Perlin Noise Implementation...');

const noise = new PerlinNoise(12345);
const config: NoiseConfiguration = {
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

// Test presets
console.log('\nTesting presets:');
Object.entries(NoisePresets).forEach(([name, preset]) => {
  const value = noise.noise(50, 50, preset);
  console.log(`${name}: ${value.toFixed(4)}`);
});

// Test utilities
console.log('\nTesting utilities:');
console.log(`Clamp(-0.5): ${NoiseUtils.clamp(-0.5)}`);
console.log(`Clamp(1.5): ${NoiseUtils.clamp(1.5)}`);
console.log(`RemapToPositive(-1): ${NoiseUtils.remapToPositive(-1)}`);
console.log(`RemapToPositive(1): ${NoiseUtils.remapToPositive(1)}`);

// Test animation offset
const [offsetX, offsetY] = NoiseUtils.getAnimationOffset(1, 10, 90);
console.log(`Animation offset (90°, speed 10): [${offsetX.toFixed(2)}, ${offsetY.toFixed(2)}]`);

console.log('\nPerlin noise implementation test completed successfully!');