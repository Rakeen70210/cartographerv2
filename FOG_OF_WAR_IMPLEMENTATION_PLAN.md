# Implementation Plan: 2.5D and 3D Fog of War Effect

## 1. Feasibility Analysis

**Conclusion: Feasible.**

The project is well-architected to support the implementation of advanced 2.5D and 3D "fog of war" effects. The existing codebase demonstrates a sophisticated rendering pipeline that can be extended for this purpose.

**Supporting Evidence:**

*   **Custom Rendering Pipeline:** The presence of a comprehensive `src/services/cloudSystem` directory, which includes modules for shaders, geometry, animation, and performance, indicates that a custom rendering engine is already a core part of the application. This is the ideal foundation for building advanced visual effects.
*   **Mapbox GL Integration:** The project uses `@rnmapbox/maps`, and the file `src/services/cloudSystem/integration/MapboxCloudLayer.ts` suggests that the team is already using or planning to use Mapbox's custom layer interface. This interface allows for direct WebGL rendering, which is necessary for 3D effects.
*   **Existing Components:** Components like `CloudRenderer.tsx` and `FogParticles.tsx` show that the application can already render custom elements on the map. These can be adapted to handle the new, more complex fog effects.
*   **Shader-Based Approach:** The existence of `CloudVertexShader.ts` and `CloudFragmentShader.ts` confirms that the application uses custom shaders. This is essential for creating volumetric lighting and density effects required for realistic 3D fog.
*   **Performance Optimization:** The project includes a robust performance optimization framework (`LODSystem.ts`, `PerformanceManager.ts`, `MemoryManager.ts`). This is critical, as 3D volumetric effects can be resource-intensive. The new implementation can and should be integrated into this system.

---

## 2. Proposed Implementation Strategy

The goal is to create two distinct but related effects, moving beyond the current 2D polygon overlay to a more immersive experience.

### 2.1. The 2.5D "Volumetric Clouds" Effect

This effect, inspired by the `fog-of-war.png` reference, involves rendering multiple, layered 2D cloud textures that move at different speeds to create a parallax depth effect over the map.

*   **Technique:** Leverage the existing `CloudRenderer.tsx` and `cloudAnimationService.ts`.
*   **Implementation:**
    1.  Generate multiple layers of cloud geometry from the base fog data.
    2.  Each layer will use the `cloud.png` asset (or a procedurally generated texture) as a repeating pattern.
    3.  The `cloudAnimationService.ts` will be enhanced to animate each layer's position (offset) at a different speed, creating the parallax effect. The existing `DriftAnimation.ts` is a perfect starting point for this.
    4.  Layers will have varying opacity and scale to simulate depth.

### 2.2. The 3D "Immersive Fog" Effect

This effect, inspired by `fog-of-war-2.png`, involves rendering a true 3D volume of fog that the user can move through.

*   **Technique:** Implement a volumetric rendering technique using a custom Mapbox GL layer and GLSL shaders.
*   **Implementation:**
    1.  **Ray Marching in Fragment Shader:** The core of this effect will be in `CloudFragmentShader.ts`. A ray-marching algorithm will be implemented to simulate light passing through a volume.
    2.  **Procedural Density:** Inside the shader, a 3D noise function (like Perlin or Simplex noise) will determine the fog's density at each point in the volume, creating realistic, non-uniform clouds.
    3.  **Lighting:** The shader will include lighting calculations to give the fog volume depth, with light scattering effects to make it appear volumetric.
    4.  **Geometry:** Instead of rendering 2D polygons, we will render a simple 3D shape (like a cube or a slab) that defines the bounds of the fog volume. The fragment shader will do the heavy lifting of rendering the volume *inside* this shape.

---

## 3. Asset Requirements

While the existing `cloud.png` can be used for the 2.5D effect or as a sprite in a particle system, a more robust and flexible approach requires procedural generation.

*   **Required New Asset: Noise Texture:**
    *   A seamless 2D or 3D noise texture (e.g., Perlin, Simplex, or Worley noise) is essential for the 3D effect.
    *   **Purpose:** This texture will be sampled repeatedly in the fragment shader to generate complex and natural-looking cloud patterns without the memory overhead of large image assets. It allows for infinite variation and detail.
    *   **Plan:** A script or utility should be created to generate this noise texture (e.g., a 256x256 RGBA noise texture) and save it to `assets/`.

---

## 4. Detailed Implementation Steps

### Step 1: Enhance the Data Model

The current system generates 2D fog polygons. This needs to be extended to support 3D volumes.

1.  **Modify `fogService.ts`:** Update the service to define fog not just as a 2D area but as a 3D volume with a defined `altitude` and `thickness`.
2.  **Update `explorationService.ts`:** When an area is explored, it should clear a "column" of the 3D fog volume, not just a 2D shape.

### Step 2: Implement the 2.5D Effect

1.  **Modify `cloudAnimationService.ts`:**
    *   Update the service to generate 2-3 distinct `FogGeometry` layers from a single fog region.
    *   Assign each layer a different `speed` and `offset` property. The `DriftAnimation.ts` can be used to manage the movement.
2.  **Modify `CloudRenderer.tsx`:**
    *   Render the multiple fog layers provided by the animation service.
    *   Apply different style properties (opacity, scale) to each layer to enhance the perception of depth.

### Step 3: Implement the 3D Volumetric Effect

This is the most significant part of the implementation and will primarily involve the shader programs.

1.  **Update `CloudVertexShader.ts`:**
    *   Ensure the shader can handle basic 3D geometry (e.g., a cube representing the fog volume bounds).
    *   Pass world position and other necessary attributes (`varyings`) to the fragment shader.

2.  **Update `CloudFragmentShader.ts`:**
    *   **Ray Marching:** Implement a loop that "marches" a ray from the camera through the fog volume.
    *   **Noise Sampling:** In each step of the loop, sample the 3D noise texture to get a density value.
    *   **Density Accumulation:** Accumulate the density values along the ray.
    *   **Lighting:** Apply a simple lighting model. For example, light absorption can be calculated based on accumulated density, making denser parts of the cloud darker.
    *   **Final Color:** The final color of the pixel will be a blend of the background map color and the fog color, based on the total accumulated density.

3.  **Update `MapboxCloudLayer.ts` / `CloudRenderer.tsx`:**
    *   This component will be responsible for setting up the WebGL state for 3D rendering.
    *   It will need to create and bind the 3D geometry (the bounding volume for the fog).
    *   It must pass camera position, view matrices, and other scene information to the shaders as uniforms.

### Step 4: Integrate with Performance Systems

The 3D effect is computationally expensive. Integration with the existing performance framework is crucial.

1.  **Integrate with `LODSystem.ts`:**
    *   Define different quality levels for the volumetric fog.
    *   **Low Quality:** Reduce the number of steps in the ray-marching loop, use a lower-resolution noise texture.
    *   **High Quality:** Increase the number of ray-marching steps, use higher-resolution textures and more complex lighting.
    *   The `LODSystem` will dynamically switch between these quality levels based on zoom and device performance.
2.  **Integrate with `MemoryManager.ts`:**
    *   Ensure the noise textures and any other large assets are managed by the `MemoryManager` to prevent memory leaks and manage the application's memory footprint.
3.  **Implement Culling:**
    *   In the `CloudRenderer`, implement frustum culling to avoid trying to render fog volumes that are not visible to the camera. This will provide a significant performance boost.
