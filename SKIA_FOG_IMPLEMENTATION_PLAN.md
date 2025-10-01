# React Native Skia Fog of War Implementation Plan

This document outlines the step-by-step plan to refactor the existing fog of war system and implement a dynamic, shader-based experience using `react-native-skia`, as depicted in the user-provided reference images.

---

### **Phase 1: Setup and Installation**

1.  **Install Dependencies**:
    Add `@shopify/react-native-skia` to the project. This library is the foundation for the new rendering system.
    ```bash
    npx expo install @shopify/react-native-skia
    ```

---

### **Phase 2: Skia Fog Overlay Component**

1.  **Create New Component File**:
    *   Create a new file: `src/components/SkiaFogOverlay.tsx`. This component will encapsulate all the Skia rendering logic and will replace the current `FogOverlay.tsx`.

2.  **Component Structure**:
    *   The `SkiaFogOverlay` component will receive `exploredAreas` and `zoomLevel` as props, similar to the existing `FogOverlay`.
    *   It will use a full-screen `<Canvas>` component from `react-native-skia` that sits between the map and the UI controls.
    *   It will fetch the `clearingAreas` and `animationInProgress` state from the `fogSlice` in the Redux store to handle dissipation animations.

---

### **Phase 3: The Cloud Shader**

1.  **Create Shader File**:
    *   Create a new file for the shader code: `src/services/cloudSystem/shaders/SkiaFogShader.glsl`.

2.  **Write the GLSL Shader**:
    *   This shader will be responsible for procedurally generating the animated cloud texture.
    *   **Uniforms**:
        *   `uniform float u_time;` (for animation)
        *   `uniform vec2 u_resolution;` (screen dimensions)
        *   `uniform float u_zoom;` (map zoom level for LOD)
        *   `uniform vec2 u_wind_offset;` (for cloud drifting)
    *   **Logic**:
        *   Implement a multi-octave noise function (Fractional Brownian Motion or FBM) to create the base cloud pattern.
        *   Use `u_time` and `u_wind_offset` to translate the noise coordinates, creating a slow, drifting animation.
        *   Use the `u_zoom` uniform to control the level of detail. At lower zoom levels, use fewer octaves or a larger noise scale to improve performance. At higher zoom levels, increase the complexity for more detail.
        *   The shader's final output (`gl_FragColor`) should be a grayscale value representing cloud density, which will be used for opacity.

---

### **Phase 4: Integrating the Shader**

1.  **Load and Use the Shader in `SkiaFogOverlay.tsx`**:
    *   Import the GLSL shader source code as a string.
    *   Use `Skia.RuntimeEffect.Make(shaderSource)` to compile the shader at runtime.
    *   Create animated values for the uniforms. Use the `useClockValue()` hook for the `u_time` uniform to drive the animation loop.
    *   Use a `<Fill>` component that covers the entire `<Canvas>`.
    *   Apply the compiled shader to the `<Fill>` component using a `<Shader>` component. Pass the uniform values to it.

---

### **Phase 5: Masking Revealed Areas**

This is the core of the fog-of-war effect. We will render the cloud shader everywhere *except* for the areas the user has explored.

1.  **Convert Explored Areas to Skia Path**:
    *   In `SkiaFogOverlay.tsx`, use the `exploredAreas` prop.
    *   Create a memoized `SkPath` object from the `exploredAreas` polygons. You may be able to adapt logic from the existing `fogService.ts` which already processes this geometry. The goal is to create a single path that represents the union of all explored areas.

2.  **Implement the Mask**:
    *   The most effective way to achieve the soft-edged reveal is to use a `BlurMask`.
    *   The `SkPath` of explored areas will be drawn onto the canvas.
    *   Apply a `<BlurMask>` filter to this path. The `blur` radius will create the soft, feathered edge around the revealed areas.
    *   The cloud shader `<Fill>` will be drawn *after* the blurred path, using a `BlendMode` of `srcOut` or a similar mode to "cut out" the revealed areas from the fog.

---

### **Phase 6: Refactoring and Final Integration**

1.  **Update `MapContainer.tsx`**:
    *   Open `src/components/MapContainer.tsx`.
    *   Remove the existing `<FogOverlay />` component.
    *   Add the new `<SkiaFogOverlay />` component in its place.
    *   Ensure the `exploredAreas` and `viewport.zoom` props from the Redux store are correctly passed to the new component.

2.  **Update `fogSlice.ts`**:
    *   The logic for `startFogClearingAnimation` and `completeFogClearingAnimation` will need to be adapted. Instead of just managing IDs, they should handle the state needed for the Skia-based dissipation animation (e.g., the center and radius of the clearing circle).

---

### **Phase 7: Dissipation Animation**

When a new area is explored, it should not just appear instantly. We need a smooth dissipation animation.

1.  **Listen for New Areas**:
    *   In `SkiaFogOverlay.tsx`, subscribe to the `clearingAreas` state from the `fogSlice`.

2.  **Animate the Mask**:
    *   When a new clearing area appears, we will animate its reveal.
    *   Create an animated value for the radius of the new area, starting from 0 and animating to its full size using `withTiming` and an easing function.
    *   Draw this animated circle onto the mask path. As the circle's radius animates, it will look like the fog is smoothly dissipating outwards from the user's location.
    *   The blur on the mask will ensure this animation has a soft, natural edge.

---

### **Phase 8: Code Cleanup**

Once the new `SkiaFogOverlay` is implemented and working correctly, the following files and components can be deprecated and removed:

1.  **`src/components/FogOverlay.tsx`**: The old component is now fully replaced.
2.  **`src/components/CloudRenderer.tsx`**: This is replaced by the Skia shader.
3.  **`src/components/FogParticles.tsx`**: The particle effect is now part of the Skia implementation.
4.  **Review `src/services/fogService.ts`**: While the geometry generation part of this service will be obsolete, any utility functions for processing or merging polygons may still be useful for creating the `SkPath` and can be kept.
5.  **Review `src/services/cloudAnimationService.ts` and `fogAnimationService.ts`**: These services will be replaced by the Skia-based animation logic within `SkiaFogOverlay.tsx`.

By following this plan, you will replace the static, shape-based fog overlay with a dynamic, high-performance, and visually stunning Skia-powered system.
