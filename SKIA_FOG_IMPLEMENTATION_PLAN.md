# High-Performance Fog of War: Finalized Implementation Plan

**Status:** Finalized. Incorporates feedback from all reviews.

## 1. Executive Summary

The current `SkiaFogOverlay` component causes critical performance issues due to CPU-bound vector path union operations. This plan outlines a revised, high-performance architecture that moves the fog masking logic to the GPU. We will encode explored area and dissipation animation data into a data texture (`SkImage`) and use a custom SkSL (Skia Shading Language) child shader to perform per-pixel masking. This approach is highly scalable, avoids GPU uniform limits, and integrates cleanly with the project's existing shader infrastructure, ensuring a stable, high-FPS user experience.

## 2. Final Architecture

1.  **`FogMaskUniformService` (New Service - CPU):** This service will be the core of the CPU-side logic. On each frame, it will:
    *   Receive the raw `exploredAreas` and `dissipationAnimations`.
    *   Aggressively cull circles outside the current map viewport (with padding).
    *   Apply a Level of Detail (LOD) strategy: at lower zooms or if the circle count exceeds a budget (e.g., >2000), it will use a spatial grid clustering algorithm to merge nearby circles, drastically reducing the data volume.
    *   Convert the remaining circles' geographic coordinates and radii to screen-space pixel coordinates.
    *   Pack this screen-space data into a single RGBA data texture (`SkImage`), normalizing values to the 0-1 range. The packing scheme will be: `R=x`, `G=y`, `B=radius`, `A=type`.
    *   Return a complete set of uniforms, including the data texture as an `ImageShader`, the circle count, and unpack scaling factors.

2.  **`SkiaFogOverlay.tsx` (Refactored Component):** This component will become a thin orchestrator.
    *   It will call the `FogMaskUniformService` to get the necessary uniforms for the current frame.
    *   It will pass these uniforms to the existing `SkiaShaderSystem`.
    *   Its render method will be a single, full-screen `<Fill>` node, with the fog effect driven entirely by the shader.

3.  **`SkiaCloudShader.ts` (Modified Shader - GPU):** The existing cloud shader will be extended.
    *   **Uniforms:** It will be modified to accept a child shader (`uniform shader u_circleData;`) and other masking-related uniforms (`u_circleCount`, `u_featherPx`, `u_unpackScale`).
    *   **Masking Logic:** After calculating the base fog color, it will calculate a `maskAlpha`. For each pixel, it will sample the `u_circleData` texture, denormalize the circle data, and loop through the circles. It will use a `sqrt`-free squared-distance check. If the pixel is within a circle, it will calculate a soft edge using `smoothstep` and the `u_featherPx` uniform. The final fog alpha will be multiplied by this mask alpha. It will **not** use `discard`.

## 3. Component-Level Implementation Details

### 3.1. New Service: `src/services/cloudSystem/FogMaskUniformService.ts`

*   **API:** `buildFogMaskUniforms({ exploredAreas, dissipationAnimations, viewport, zoom })`
*   **Responsibilities:** Culling, LOD/clustering, coordinate conversion, texture packing (normalized RGBA8), `ImageShader` creation, and short-lived caching.

### 3.2. Modified Shader: `src/services/cloudSystem/shaders/SkiaCloudShader.ts`

*   **Language:** SkSL.
*   **Integration:** The new masking logic will be injected into the existing fragment shader source, leveraging the existing `SkiaShaderSystem` for compilation and error handling.
*   **Uniform Contract:**
    *   `uniform shader u_circleData;`
    *   `uniform int u_circleCount;`
    *   `uniform int u_texWidth;`
    *   `uniform float2 u_resolution;`
    *   `uniform float u_featherPx;`
    *   `uniform float3 u_unpackScale; // (viewport.width, viewport.height, max_radius)`

### 3.3. Refactored Component: `src/components/SkiaFogOverlay.tsx`

*   **Responsibilities:** Orchestration only. It will get uniforms from the `FogMaskUniformService` and pass them to the shader via the `SkiaShaderSystem`.
*   **Rendering:** A single `<Fill>` component with a `<Paint>` containing the `<Shader>`.

## 4. Fallback Strategy & Risk Mitigation

A multi-tier fallback system will be implemented to ensure stability.

1.  **Capability Test:** A one-time test on app startup will determine the device's best-supported method.
2.  **Tier 1 (Texture - Default):** The high-performance data texture approach.
3.  **Tier 2 (Uniform Array):** If texture sampling in shaders is problematic, fall back to using uniform arrays with a very small, safe circle limit (e.g., 100).
4.  **Tier 3 (CPU Path):** If all GPU methods fail, revert to the original CPU-based path unioning to ensure the feature remains functional.

## 5. Step-by-Step Implementation Plan

1.  **Step 1: Service & Shader Scaffolding.**
    *   Create `FogMaskUniformService.ts` with method stubs.
    *   Modify `SkiaCloudShader.ts` to include the new uniform declarations and a placeholder masking function.

2.  **Step 2: Data Preparation Service.**
    *   Implement the full logic for culling, LOD/clustering, coordinate conversion, and texture packing in `FogMaskUniformService`.

3.  **Step 3: Shader Logic.**
    *   Implement the final SkSL code for per-pixel masking, including texture sampling, squared-distance checks, and `smoothstep` for feathered edges.

4.  **Step 4: Component Integration.**
    *   Refactor `SkiaFogOverlay.tsx` to use the new service and pass the resulting uniforms to the shader system.

5.  **Step 5: Testing & Validation.**
    *   Add unit tests for `FogMaskUniformService`.
    *   Use a debug overlay to visually confirm circle alignment.
    *   Profile FPS in dense areas to validate performance gains.

## 6. Migration of Old Components

*   The existing `ExplorationMaskManager`, `FogMaskingSystem`, and `BlurMaskManager` will be preserved initially to serve as the Tier 3 (CPU Path) fallback, but will be marked for deprecation.