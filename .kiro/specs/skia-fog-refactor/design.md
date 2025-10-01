# Design Document

## Overview

The Skia Fog of War Refactor replaces the existing WebGL-based cloud system with a React Native Skia implementation that provides superior performance and visual quality on mobile devices. The new architecture centers around a single `SkiaFogOverlay` component that uses GLSL shaders for procedural cloud generation and Skia's masking capabilities for smooth area revelation.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MapContainer                             │
│  ┌─────────────────┐  ┌─────────────────────────────────┐   │
│  │   Mapbox Map    │  │      SkiaFogOverlay             │   │
│  │                 │  │  ┌─────────────────────────────┐ │   │
│  │                 │  │  │     Skia Canvas             │ │   │
│  │                 │  │  │  ┌─────────────────────────┐│ │   │
│  │                 │  │  │  │   Cloud Shader Fill     ││ │   │
│  │                 │  │  │  └─────────────────────────┘│ │   │
│  │                 │  │  │  ┌─────────────────────────┐│ │   │
│  │                 │  │  │  │   Exploration Mask      ││ │   │
│  │                 │  │  │  └─────────────────────────┘│ │   │
│  │                 │  │  └─────────────────────────────┘ │   │
│  └─────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

1. **MapContainer**: Main container managing map and fog overlay
2. **SkiaFogOverlay**: Core Skia-based fog rendering component
3. **Cloud Shader System**: GLSL shader for procedural cloud generation
4. **Mask System**: Skia Path and BlurMask for area revelation
5. **Animation Controller**: Manages time-based animations and dissipation effects

## Components and Interfaces

### SkiaFogOverlay Component

```typescript
interface SkiaFogOverlayProps {
  exploredAreas: ExploredArea[];
  zoomLevel: number;
  viewport: {
    width: number;
    height: number;
    bounds: MapBounds;
  };
}

interface CloudShaderUniforms {
  u_time: number;
  u_resolution: [number, number];
  u_zoom: number;
  u_wind_offset: [number, number];
}

interface DissipationAnimation {
  id: string;
  center: [number, number];
  radius: SharedValue<number>;
  startTime: number;
  duration: number;
}
```

### Shader System

The cloud shader uses Fractional Brownian Motion (FBM) for realistic cloud patterns:

```glsl
// Core noise function for cloud generation
float fbm(vec2 p, int octaves, float persistence, float lacunarity) {
  float value = 0.0;
  float amplitude = 1.0;
  float frequency = 1.0;
  
  for (int i = 0; i < octaves; i++) {
    value += amplitude * noise(p * frequency);
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  
  return value;
}

// Main fragment shader
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 cloudCoord = uv + u_wind_offset + u_time * 0.01;
  
  // Generate multi-octave cloud pattern
  float cloudDensity = fbm(cloudCoord * u_zoom, 4, 0.5, 2.0);
  
  // Apply zoom-based LOD
  int octaves = max(2, int(4.0 * u_zoom));
  cloudDensity = fbm(cloudCoord, octaves, 0.5, 2.0);
  
  gl_FragColor = vec4(0.9, 0.9, 0.9, cloudDensity * 0.8);
}
```

### Masking System

The masking system uses Skia's Path and BlurMask for smooth area revelation:

```typescript
class ExplorationMaskManager {
  private exploredPath: SkPath;
  private blurMask: BlurMask;
  
  updateExploredAreas(areas: ExploredArea[]): void {
    // Convert polygon coordinates to Skia Path
    this.exploredPath = this.createPathFromAreas(areas);
  }
  
  createDissipationMask(animations: DissipationAnimation[]): SkPath {
    // Create animated circles for dissipation effects
    const animationPath = Skia.Path.Make();
    animations.forEach(anim => {
      animationPath.addCircle(anim.center[0], anim.center[1], anim.radius.value);
    });
    return animationPath;
  }
}
```

## Data Models

### Cloud Configuration

```typescript
interface CloudConfig {
  windSpeed: number;
  windDirection: number;
  cloudDensity: number;
  animationSpeed: number;
  lodSettings: {
    minOctaves: number;
    maxOctaves: number;
    zoomThresholds: number[];
  };
}

interface PerformanceSettings {
  targetFPS: number;
  adaptiveQuality: boolean;
  maxShaderComplexity: number;
}
```

### Animation State

```typescript
interface FogAnimationState {
  clearingAreas: DissipationAnimation[];
  windOffset: SharedValue<[number, number]>;
  globalTime: SharedValue<number>;
  isAnimating: boolean;
}
```

## Error Handling

### Shader Compilation Errors

```typescript
class ShaderErrorHandler {
  handleCompilationError(error: string): void {
    console.warn('Shader compilation failed:', error);
    // Fallback to simplified shader or static fog
    this.enableFallbackMode();
  }
  
  enableFallbackMode(): void {
    // Use basic color fill instead of complex shader
    // Maintain functionality with reduced visual quality
  }
}
```

### Performance Degradation

```typescript
class PerformanceMonitor {
  private frameRate: number = 60;
  
  monitorPerformance(): void {
    // Track frame rate and adjust quality accordingly
    if (this.frameRate < 30) {
      this.reduceShaderComplexity();
    }
  }
  
  reduceShaderComplexity(): void {
    // Decrease octaves, reduce animation frequency
    // Maintain visual appeal while improving performance
  }
}
```

## Testing Strategy

### Unit Testing

1. **Shader Compilation Tests**: Verify GLSL shader compiles correctly
2. **Path Generation Tests**: Test conversion of exploration areas to Skia paths
3. **Animation Logic Tests**: Validate dissipation animation calculations
4. **Performance Tests**: Ensure frame rate targets are met

### Integration Testing

1. **Redux Integration**: Test state synchronization with existing fog slice
2. **Mapbox Integration**: Verify coordinate system compatibility
3. **Component Lifecycle**: Test proper cleanup and resource management

### Visual Testing

1. **Shader Output Validation**: Compare rendered output against expected patterns
2. **Animation Smoothness**: Verify dissipation animations are visually smooth
3. **Cross-Platform Consistency**: Ensure consistent rendering on iOS and Android

### Performance Testing

```typescript
describe('SkiaFogOverlay Performance', () => {
  it('should maintain 60fps during cloud animation', async () => {
    const monitor = new FrameRateMonitor();
    // Render fog overlay for 5 seconds
    // Assert average frame rate >= 55fps
  });
  
  it('should adapt quality based on device capabilities', () => {
    const lowEndDevice = { gpu: 'basic', memory: '2GB' };
    const config = generateConfigForDevice(lowEndDevice);
    expect(config.lodSettings.maxOctaves).toBeLessThan(4);
  });
});
```

## Migration Strategy

### Phase 1: Component Replacement
- Replace `FogOverlay.tsx` with `SkiaFogOverlay.tsx`
- Maintain identical props interface for seamless integration
- Add feature flag for gradual rollout

### Phase 2: Shader Implementation
- Implement GLSL cloud shader with basic noise
- Add uniform management and animation system
- Test performance on target devices

### Phase 3: Masking and Animation
- Implement exploration area masking
- Add dissipation animations with proper timing
- Integrate with existing Redux state management

### Phase 4: Cleanup and Optimization
- Remove deprecated components (CloudRenderer, FogParticles)
- Optimize shader performance and memory usage
- Add comprehensive error handling and fallbacks

## Performance Considerations

### GPU Optimization
- Use efficient noise algorithms optimized for mobile GPUs
- Implement LOD system to reduce complexity at lower zoom levels
- Batch uniform updates to minimize GPU state changes

### Memory Management
- Reuse Skia Path objects where possible
- Implement proper cleanup in component unmount
- Monitor texture memory usage and implement cleanup thresholds

### Battery Life
- Use requestAnimationFrame for smooth animations
- Pause animations when app is backgrounded
- Implement adaptive quality based on battery level