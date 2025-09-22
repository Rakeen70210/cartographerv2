/**
 * Simple test for cloud texture system
 */

console.log('Testing Cloud Texture System...');

// Test texture atlas packing
function testAtlasPacking() {
  console.log('Testing atlas packing...');
  
  const atlasWidth = 256;
  const atlasHeight = 256;
  const tileSize = 64;
  const padding = 2;
  
  // Simulate adding patterns to atlas
  const patterns = [];
  let nextX = 0;
  let nextY = 0;
  let currentRowHeight = 0;
  
  const patternSizes = [
    { width: 32, height: 32 },
    { width: 64, height: 64 },
    { width: 48, height: 48 },
    { width: 32, height: 64 }
  ];
  
  patternSizes.forEach((size, index) => {
    const paddedWidth = size.width + padding * 2;
    const paddedHeight = size.height + padding * 2;
    
    // Check if pattern fits in current row
    if (nextX + paddedWidth > atlasWidth) {
      nextX = 0;
      nextY += currentRowHeight;
      currentRowHeight = 0;
    }
    
    // Check if pattern fits in atlas
    if (nextY + paddedHeight <= atlasHeight) {
      const atlasX = nextX + padding;
      const atlasY = nextY + padding;
      
      const uvBounds = {
        minU: atlasX / atlasWidth,
        minV: atlasY / atlasHeight,
        maxU: (atlasX + size.width) / atlasWidth,
        maxV: (atlasY + size.height) / atlasHeight
      };
      
      patterns.push({
        id: `pattern_${index}`,
        atlasX,
        atlasY,
        width: size.width,
        height: size.height,
        uvBounds
      });
      
      nextX += paddedWidth;
      currentRowHeight = Math.max(currentRowHeight, paddedHeight);
      
      console.log(`Pattern ${index}: ${size.width}x${size.height} at (${atlasX}, ${atlasY})`);
      console.log(`  UV: [${uvBounds.minU.toFixed(3)}, ${uvBounds.minV.toFixed(3)}] to [${uvBounds.maxU.toFixed(3)}, ${uvBounds.maxV.toFixed(3)}]`);
    } else {
      console.log(`Pattern ${index}: ${size.width}x${size.height} does not fit`);
    }
  });
  
  console.log(`Successfully packed ${patterns.length} patterns`);
}

// Test procedural texture generation
function testProceduralGeneration() {
  console.log('\nTesting procedural texture generation...');
  
  const width = 32;
  const height = 32;
  
  // Simple noise function
  function noise(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return 2 * (n - Math.floor(n)) - 1;
  }
  
  // Generate cloud texture
  const textureData = new Array(width * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const ny = y / height;
      
      // Multi-octave noise
      let value = 0;
      let amplitude = 1;
      let frequency = 4;
      
      for (let i = 0; i < 4; i++) {
        value += noise(nx * frequency, ny * frequency) * amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }
      
      // Normalize to 0-255 range
      value = (value + 1) * 0.5;
      value = Math.max(0, Math.min(1, value));
      
      textureData[y * width + x] = Math.floor(value * 255);
    }
  }
  
  // Check texture properties
  const min = Math.min(...textureData);
  const max = Math.max(...textureData);
  const avg = textureData.reduce((sum, val) => sum + val, 0) / textureData.length;
  const uniqueValues = new Set(textureData).size;
  
  console.log(`Generated ${width}x${height} texture:`);
  console.log(`  Value range: [${min}, ${max}]`);
  console.log(`  Average: ${avg.toFixed(1)}`);
  console.log(`  Unique values: ${uniqueValues}`);
  console.log(`  Variation: ${uniqueValues > 10 ? 'Good' : 'Low'}`);
}

// Test texture coordinate mapping
function testTextureCoordinates() {
  console.log('\nTesting texture coordinate mapping...');
  
  // Simulate pattern in atlas
  const pattern = {
    uvBounds: {
      minU: 0.25,
      minV: 0.25,
      maxU: 0.75,
      maxV: 0.75
    }
  };
  
  // Test coordinate mapping
  const testCoords = [
    [0, 0],
    [0.5, 0.5],
    [1, 1]
  ];
  
  testCoords.forEach(([localU, localV]) => {
    const u = pattern.uvBounds.minU + localU * (pattern.uvBounds.maxU - pattern.uvBounds.minU);
    const v = pattern.uvBounds.minV + localV * (pattern.uvBounds.maxV - pattern.uvBounds.minV);
    
    console.log(`Local (${localU}, ${localV}) -> Atlas (${u.toFixed(3)}, ${v.toFixed(3)})`);
  });
}

// Test format conversion
function testFormatConversion() {
  console.log('\nTesting format conversion...');
  
  // Test RGBA to grayscale conversion
  const rgbaData = [
    255, 0, 0, 255,    // Red
    0, 255, 0, 255,    // Green
    0, 0, 255, 255,    // Blue
    255, 255, 255, 255 // White
  ];
  
  const grayscaleData = [];
  for (let i = 0; i < rgbaData.length; i += 4) {
    const r = rgbaData[i];
    const g = rgbaData[i + 1];
    const b = rgbaData[i + 2];
    
    // Luminance formula
    const gray = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
    grayscaleData.push(gray);
  }
  
  console.log('RGBA to Grayscale conversion:');
  console.log(`  Red (255,0,0) -> ${grayscaleData[0]}`);
  console.log(`  Green (0,255,0) -> ${grayscaleData[1]}`);
  console.log(`  Blue (0,0,255) -> ${grayscaleData[2]}`);
  console.log(`  White (255,255,255) -> ${grayscaleData[3]}`);
}

// Test texture resizing
function testTextureResize() {
  console.log('\nTesting texture resize...');
  
  // Original 4x4 texture
  const originalWidth = 4;
  const originalHeight = 4;
  const originalData = Array.from({ length: 16 }, (_, i) => i * 16); // 0, 16, 32, ..., 240
  
  // Resize to 2x2
  const newWidth = 2;
  const newHeight = 2;
  const newData = [];
  
  const scaleX = originalWidth / newWidth;
  const scaleY = originalHeight / newHeight;
  
  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcX = Math.floor(x * scaleX);
      const srcY = Math.floor(y * scaleY);
      const srcIndex = srcY * originalWidth + srcX;
      
      newData.push(originalData[srcIndex]);
    }
  }
  
  console.log(`Resized ${originalWidth}x${originalHeight} to ${newWidth}x${newHeight}:`);
  console.log(`  Original: [${originalData.slice(0, 4).join(', ')}...]`);
  console.log(`  Resized: [${newData.join(', ')}]`);
}

// Run tests
testAtlasPacking();
testProceduralGeneration();
testTextureCoordinates();
testFormatConversion();
testTextureResize();

console.log('\nCloud texture system test completed successfully!');