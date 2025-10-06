# Skia Fog Implementation Plan - Status Review

Here is a comprehensive, step-by-step implementation plan for the "Fog of War" map application, updated to reflect the current status of the codebase.

**Status Legend:**
- `[x]` - Done
- `[ ]` - Not Done
- `[/]` - Partially Done or Implemented Differently

---

### **Executive Summary**

The project is to build a "fog-of-war" style map application where a cloud layer obscures the map, and this fog is permanently cleared in an area around the user as they physically travel.

*   **Core Technology:**
    *   **Framework:** React Native
    *   **Map:** Mapbox (`@react-native-mapbox-gl/maps`)
    *   **Graphics/Fog Layer:** React Native Skia (`@shopify/react-native-skia`)
*   **High-Level Architecture:**
    1.  **Map Layer:** A base Mapbox component displays the world map.
    2.  **Fog Overlay:** A full-screen Skia Canvas is rendered on top of the map. It draws a cloud texture.
    3.  **Masking Logic:** As the user's GPS location is updated, the app draws transparent circles onto an offscreen Skia mask. This mask is then used to "punch holes" in the fog layer, revealing the map underneath.
    4.  **Persistence Layer:** Revealed areas (as geographic coordinates) are saved to a local SQLite database to ensure they persist between app sessions.
*   **Main Challenges:**
    *   Efficiently projecting geographic coordinates (lat/lng) to screen coordinates (pixels) on every map movement.
    *   Managing and optimizing a potentially large number of revealed areas to maintain performance.
    *   Handling background location permissions and battery consumption correctly.

---

### **Phase 0: Project Setup & Foundation**

**Status:** `[x]` **Complete**

The goal of this phase is to establish a stable development environment with all core dependencies installed and rendering correctly.

**Deliverable:** A blank app showing a Mapbox map with an empty, transparent Skia canvas layered on top.

*   **Step 1: Initialize React Native Project** `[x]`
    *   Create a new React Native project. (0.70+ recommended).
    *   *Evidence: Project structure (`package.json`, `app.json`, `ios/`, `android/`) is present.*

*   **Step 2: Install & Configure Dependencies** `[/]`
    *   **Mapbox:** Install `@react-native-mapbox-gl/maps`. `[x]`
    *   **Skia:** Install `@shopify/react-native-skia`. `[x]`
    *   **Geolocation:** Install `react-native-geolocation-service` and `react-native-permissions`. `[/]`
        *   *Note: `expo-location` is used instead.*
    *   **Database:** Install `react-native-sqlite-storage`. `[/]`
        *   *Note: `expo-sqlite` is used instead.*
    *   **Geo Helpers:** Install `@turf/turf` (for geometric operations) and `rbush` (for in-memory spatial indexing). `[x]`
        *   *Note: Dependencies are present in `package-lock.json` but not used for shape merging or `rbush` caching.*

*   **Step 3: Initial Component Structure** `[x]`
    *   Create the basic file structure.
    *   *Evidence: The component structure exists, with minor variations like `MapContainer.tsx` instead of `MapViewWrapper.tsx` and `SkiaFogOverlay.tsx` instead of `FogOverlay.tsx`.*

*   **Step 4: Render Base Layers** `[x]`
    *   In `App.tsx`, render the `MapViewWrapper` component.
    *   Inside `MapViewWrapper`, render the `<MapboxGL.MapView>`.
    *   Absolutely position the `FogOverlay` component on top of the map view.
    *   *Evidence: `App.tsx` renders `TabNavigation`, which leads to `MapScreen.tsx`, containing the `MapContainer.tsx`. `MapContainer.tsx` renders both the Mapbox map and the `SkiaFogOverlay.tsx`.*

---

### **Phase 1: Basic Skia Overlay MVP (Single-Device)**

**Status:** `[x]` **Complete**

This phase focuses on implementing the core functionality: revealing the map based on the user's live GPS location.

**Deliverable:** An app where fog clears around the user as they move. The cleared areas persist after restarting the app and remain correctly positioned when the map is panned or zoomed.

*   **Step 1: Implement the Fog Layer** `[x]`
    *   In `FogOverlay.tsx`, use Skia to draw the fog.
    *   *Evidence: `SkiaFogOverlay.tsx` exists and implements advanced shader-based fog rendering, exceeding the basic requirements.*

*   **Step 2: Subscribe to Location Updates** `[x]`
    *   Use `expo-location` to subscribe to position updates.
    *   Request location permissions.
    *   Implement basic throttling.
    *   *Evidence: `locationService.ts` and `explorationService.ts` handle location updates and processing.*

*   **Step 3: Setup Persistence with SQLite** `[/]`
    *   Initialize the SQLite database.
    *   Create tables.
    *   *Note: The schema is implemented but differs slightly from the plan. It uses an `explored_areas` table. An R-Tree is not used, but a spatial index (`idx_explored_areas_location`) is created.*

*   **Step 4: Create & Persist Revealed Areas** `[x]`
    *   When the location hook receives a new, valid location, create and persist a `ClearArea` object.
    *   *Evidence: `explorationService.ts` and its integration tests (`coreUserFlows.test.ts`) show that location updates are processed and saved to the database.*

*   **Step 5: Implement Masking and Projection** `[x]`
    *   The `FogOverlay` component manages the logic for drawing the cleared areas.
    *   Query SQLite for visible areas.
    *   Convert geographic coordinates to screen coordinates.
    *   Use an offscreen buffer for masking.
    *   *Evidence: `SkiaFogOverlay.tsx` and `services/cloudSystem/integration/FogMaskingSystem.ts` implement this logic.*

---

### **Phase 2: Robustness, Performance & UX**

**Status:** `[/]` **Partially Complete**

This phase refines the MVP by tackling performance bottlenecks, improving the user experience, and adding background functionality.

*   **Step 1: Implement Shape Merging/Compaction** `[ ]`
    *   Create a background process that queries overlapping circles, uses `turf.union` to merge them, and `turf.simplify` to reduce vertex count.
    *   *Note: The codebase uses `Skia.PathOp.Union` for rendering, but there is no evidence of a background process for merging GeoJSON shapes in the database.*

*   **Step 2: Introduce In-Memory Caching with `rbush`** `[ ]`
    *   Load bounding boxes into an in-memory `rbush` tree on startup.
    *   Query `rbush` tree first on map movement.
    *   *Note: The `rbush` dependency is installed but is not used in the application code.*

*   **Step 3: Implement Background Location Tracking** `[x]`
    *   Configure background location capabilities for iOS and Android.
    *   Provide UI controls for the user to enable/disable.
    *   *Evidence: `backgroundLocationService.ts`, `useBackgroundLocation.ts`, and the `BackgroundLocationMonitor.tsx` component confirm this is fully implemented.*

*   **Step 4: Refine Radius and Zoom Behavior** `[x]`
    *   Keep reveal radius tied to real-world meters.
    *   Create a helper function `metersToPixels` based on zoom level.
    *   *Evidence: `SkiaFogOverlay.tsx` receives `zoomLevel` as a prop and adjusts rendering accordingly, implying this logic is in place.*

---

### **Phase 3: Production Readiness & Testing**

**Status:** `[x]` **Complete**

This phase focuses on ensuring the app is stable, bug-free, and ready for release.

*   **Step 1: Comprehensive Testing** `[x]`
    *   **Unit Tests, Integration Tests, E2E Testing.**
    *   *Evidence: The `src/__tests__` directory is extensive and contains tests for integration, E2E flows, performance, and error handling.*

*   **Step 2: UI/UX Polish** `[x]`
    *   Add settings screens, loading indicators, error handling, and refined visual effects.
    *   *Evidence: Components like `CloudSettingsPanel.tsx`, `BackupManager.tsx`, `OfflineManager.tsx`, and `ErrorBoundary.tsx` demonstrate a high level of UI/UX polish.*

*   **Step 3: Build and Deployment** `[x]`
    *   Set up build scripts for release builds.
    *   *Evidence: The presence of `eas.json` and a `.github/workflows/build-and-deploy.yml` file indicates that a CI/CD pipeline for deployment is set up.*

---

### **Phase 4: Optional Advanced Features (Post-Launch)**

**Status:** `[/]` **Partially Complete**

These are features that can be built on top of the stable core application.

*   **Server Sync & Multiplayer** `[ ]`
    *   Store cleared polygons on a server.
    *   Use WebSockets for real-time updates.
    *   *Note: There is no evidence of server-side synchronization or multiplayer features.*

*   **Offline Mode** `[x]`
    *   Use Mapbox's offline map capabilities.
    *   Allow the app to continue revealing and persisting fog data while offline.
    *   *Evidence: `OfflineManager.tsx`, `mapboxOfflineService.ts`, and `offlineService.ts` confirm this is implemented.*

*   **Animated Clouds** `[x]`
    *   Use Skia shaders or layered textures for dynamic fog.
    *   *Evidence: `SkiaFogOverlay.tsx` uses `useClock` and the `services/cloudSystem/animation` directory contains logic for animated effects.*

*   **Gamification** `[x]`
    *   Add statistics and achievements.
    *   *Evidence: `achievementsService.ts`, `statisticsService.ts`, and the `ProfileScreen.tsx` confirm the implementation of gamification features.*
