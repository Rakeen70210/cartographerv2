# Cloud-Based Fog of War Implementation Plan

## 1. Introduction

The goal is to replace the current fog of war implementation with a dynamic, visually appealing, and performant cloud-based system. This system will render volumetric, multi-layered clouds that drift and morph over time, and dissipate gracefully as the user explores new areas, similar to the visual style shown in the reference images.

This plan leverages the existing application architecture, particularly the `cloudSystem` and `fog` related services and components.

## 2. Core Concepts

The implementation will be based on the following core concepts:

*   **Procedural Generation**: We will use noise algorithms (like Perlin or Simplex noise) to generate natural-looking, non-repeating cloud patterns. This ensures the cloudscape is vast and organic.
*   **Multi-Layer Rendering**: To create a sense of depth and parallax, we will render multiple layers of clouds. Each layer will move at a slightly different speed, creating a realistic 3D effect.
*   **Dynamic Animation**: Clouds will not be static. They will drift according to a simulated wind direction and subtly change shape (morph) over time.
*   **Progressive Revelation**: When a user explores an area, the clouds will not simply disappear. Instead, they will animate a dissipation effect, creating a satisfying "clearing" of the fog.
*   **Performance Optimization**: A Level of Detail (LOD) system will be crucial. Cloud complexity, density, and animation quality will be dynamically adjusted based on the map's zoom level and the device's performance capabilities to ensure a smooth user experience.

## 3. Proposed File Structure

We will build out the existing `src/services/cloudSystem` directory. The proposed structure is as follows:

```
src/services/cloudSystem/
├── animation/         # Manages cloud animations (drift, morphing, dissipation)
│   ├── AnimationController.ts
│   ├── DissipationAnimator.ts
│   └── ...
├── engine/            # Core rendering engine logic
│   └── CloudRenderingEngine.ts
├── geography/         # Terrain-aware cloud generation
│   ├── TerrainAnalyzer.ts
│   └── ...
├── geometry/          # Cloud mesh and geometry generation
│   ├── CloudGeometry.ts
│   └── DensityCalculator.ts
├── integration/       # Bridge between cloud system and the rest of the app
│   ├── CloudFogIntegration.ts
│   └── MapboxCloudLayer.ts
├── noise/             # Perlin/Simplex noise generation
│   └── PerlinNoise.ts
├── performance/       # Performance monitoring and optimization
│   ├── LODSystem.ts
│   └── ...
├── settings/          # Management of cloud settings and user customization
│   └── CloudSettingsManager.ts
├── shaders/           # GLSL shaders for cloud rendering
│   ├── cloud.vert.glsl
│   └── cloud.frag.glsl
├── textures/          # Cloud texture generation and management
│   └── CloudTextureAtlas.ts
└── interfaces.ts      # Core TypeScript interfaces for the cloud system
```

## 4. Implementation Plan

The implementation will be broken down into the following tasks:

### Task 1: Foundational Components (Noise & Geometry)

1.  **Noise Generation**: Implement a robust Perlin or Simplex noise generator in `src/services/cloudSystem/noise/`. This will be the basis for all procedural generation.
2.  **Density Calculation**: Create a `DensityCalculator` in `src/services/cloudSystem/geometry/` that uses the noise generator to create 2D cloud density maps.
3.  **Geometry Generation**: Implement a `CloudGeometryGenerator` that converts density maps into 3D mesh data (vertices, indices, texture coordinates).

### Task 2: Rendering Engine & Mapbox Integration

1.  **Cloud Rendering Engine**: Develop the `CloudRenderingEngine` in `src/services/cloudSystem/engine/`. This will be the central orchestrator, managing the cloud state, generating cloud patches, and handling the render loop.
2.  **Mapbox Custom Layer**: Create a `MapboxCloudLayer` in `src/services/cloudSystem/integration/`. This custom layer will interface with Mapbox GL to render the cloud geometry using WebGL.
3.  **Shaders**: Write the vertex and fragment shaders (`cloud.vert.glsl`, `cloud.frag.glsl`) required by the `MapboxCloudLayer`. The fragment shader will be responsible for the volumetric lighting and soft cloud appearance.

### Task 3: Animation System

1.  **Drift & Morph**: Enhance the `AnimationController` to apply a constant, gentle drift to the cloud layers. Implement morphing effects by evolving the noise patterns over time.
2.  **Dissipation Animation**: Implement a `DissipationAnimator`. When an area is explored, this animator will create a "hole" in the cloud density map with soft, animated edges. This will be more efficient than manipulating geometry directly.

### Task 4: Integration with Application Logic

1.  **Exploration Service Bridge**: Enhance `CloudFogIntegration` to listen for events from the `ExplorationService`. When a new area is explored, it will command the `CloudRenderingEngine` to trigger a dissipation animation for that location.
2.  **Component Integration**: Modify `FogOverlay.tsx` to use the new `MapboxCloudLayer` instead of the current implementation. The `CloudRenderer.tsx` component will be used to manage the custom layer.
3.  **Settings UI**: Connect the `CloudSettingsPanel.tsx` to the new `CloudSettingsManager` to allow users to control cloud density, animation speed, and visual quality.

### Task 5: Performance Optimization

1.  **LOD System**: Implement the `LODSystem` in `src/services/cloudSystem/performance/`. It will define different levels of detail (e.g., `low`, `medium`, `high`).
2.  **Dynamic Adjustment**: The `CloudRenderingEngine` will query the `LODSystem` based on the current map zoom level. At lower zoom levels, it will use lower-resolution textures, simpler geometry, and less complex shaders.
3.  **Performance Monitoring**: Integrate with the `PerformanceMonitorService` to automatically adjust the quality level down if the frame rate drops below a certain threshold (e.g., 45 FPS).

By following this plan, we can incrementally build a sophisticated, performant, and visually impressive cloud-based fog of war system that integrates seamlessly with the existing application structure.
