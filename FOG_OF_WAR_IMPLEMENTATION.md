# Fog of War Implementation Guide

This document outlines the implementation of the "fog of war" effect in the Cartographer v2 application. The system is designed to be performant and visually appealing, revealing the map as the user explores, similar to the effect shown in the provided `fog-of-war-2.png` and `cloud.png` images.

## High-Level Architecture

The fog of war system is composed of three main parts that work together:

1.  **`fogService` (Service Layer):** The brain of the system. It processes explored areas, determines which parts of the map are still covered by fog, and generates the corresponding geometry (polygons).
2.  **`fogSlice` (State Management):** A Redux slice that holds the state of the fog, including the generated geometry, visibility, opacity, and animation status.
3.  **`FogOverlay` (View Layer):** A React component that renders the fog on the map using the geometry from the `fogSlice`. It uses Mapbox GL for rendering and includes visual effects like cloud textures and particle animations.

## Data Flow

The process of revealing the map follows this sequence:

1.  **Location Tracking:** The application tracks the user's location.
2.  **Exploration Data:** Explored areas (location points with a radius) are saved to the database.
3.  **Fog Geometry Generation:** The `fogService` is called with the list of all explored areas.
    *   It uses a spatial grid to efficiently mark explored cells.
    *   It generates a `FeatureCollection` of polygons (the `FogGeometry`) representing the unexplored areas (the fog).
    *   This process is optimized with caching and Level of Detail (LOD) adjustments based on the map's zoom level.
4.  **State Update:** The generated `FogGeometry` is dispatched to the `fogSlice`, updating the application's state.
5.  **Rendering:** The `FogOverlay` component, subscribed to the `fogSlice`, receives the new geometry and re-renders the fog layer on the map, effectively "clearing" the fog from the newly explored areas.

## Core Components in Detail

### `fogService.ts`

This service is responsible for the core logic of the fog of war.

-   **Spatial Grid:** It uses a grid system to partition the map. Each cell in the grid is marked as either explored or unexplored. This is more efficient than dealing with thousands of individual location points directly.
-   **Geometry Generation:** It creates GeoJSON polygons for the unexplored areas. To optimize performance, it can merge adjacent unexplored cells into larger polygons.
-   **Level of Detail (LOD):** The service adjusts the complexity of the fog geometry based on the map's zoom level. At lower zoom levels (zoomed out), it generates a simpler, less detailed fog to maintain performance.

### `fogSlice.ts`

This Redux slice acts as the single source of truth for the fog's state. Key properties include:

-   `fogGeometry`: The GeoJSON `FeatureCollection` that defines the shape of the fog.
-   `isVisible`: A boolean to toggle the fog overlay on and off.
-   `animationInProgress`: A flag to indicate when a fog clearing animation is active.
-   `cloudDensity` & `animationSpeed`: Parameters to control the appearance and behavior of the cloud effects.

### `FogOverlay.tsx`

This component is responsible for everything the user sees.

-   **Mapbox Integration:** It uses `@rnmapbox/maps` to render the fog. The `FogGeometry` is passed to a `Mapbox.ShapeSource`.
-   **Styling:** The fog is styled using `Mapbox.FillLayer`. The component can apply different styles based on the zoom level.
-   **Visual Effects:**
    *   **Cloud Texture:** The component is set up to use a fill pattern (`fillPattern: 'cloud-pattern'`). The `cloud.png` and `fog-of-war-2.png` images can be used here to give the fog a textured, cloud-like appearance instead of being a solid color.
    *   **Animations:** It orchestrates animations for clearing the fog, using `FogParticles.tsx` to create particle effects that give the impression of dissipating clouds.
    *   **Dynamic Clouds:** It uses `CloudRenderer.tsx` to render animated, multi-layered clouds on top of the fog for a more dynamic and realistic effect.

## Visuals and Textures

The images you provided are key to achieving the desired aesthetic.

-   `cloud.png` / `fog-of-war-2.png`: These images can be used as a repeating pattern to style the fog layer. In `FogOverlay.tsx`, this can be achieved by loading the image as a custom map style asset and referencing it in the `fillPattern` property of the `Mapbox.FillLayer`. This will make the fog look like a textured cloud cover instead of a flat color.

Example of using a fill pattern:
```typescript
<Mapbox.FillLayer
  id="cloud-fog-texture-fill"
  style={{
    // ... other styles
    fillPattern: 'cloud-pattern', // The name you assign to the image asset
  }}
/>
```

## Performance Optimizations

Performance is critical for a smooth user experience. The system includes several optimizations:

-   **LOD System:** As mentioned, the complexity of the fog is reduced at lower zoom levels.
-   **Caching:** The `fogService` caches the generated fog geometry to avoid redundant calculations.
-   **Geometry Simplification:** The `FogOverlay` component further simplifies the geometry before rendering, especially at lower zoom levels.
-   **Animation Throttling:** Animations are simplified or disabled at lower zoom levels or when performance degrades.

This documentation should provide a solid foundation for understanding and extending the fog of war feature.
