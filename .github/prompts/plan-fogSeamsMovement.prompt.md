## Plan: Eliminate Fog Seams + Keep Clearings Accurate While Moving

Goal: On the web Mapbox map, remove the visible checkerboard seams and prevent the basemap from being exposed during fast pan/zoom, while keeping explored clearings accurate during movement.

Key findings from the code:
- `FogService.generateFogGeometry()` currently returns 100s–1000s of tiny rectangle polygons because `mergeAdjacentCells()` is a stub.
- Web Mapbox fog is updated only on `moveend` in `MapContainer.web.tsx`.

Status: Implemented on March 4, 2026.

**Steps**
1. Web map: make fog/exploration coverage buffered and updated during movement
   - Introduce a “coverage bounds” ref for fog generation (and separately for explored-area query coverage).
   - Compute a buffered bounds region (viewport bounds expanded by a configurable margin).
   - Add a throttled `move` handler that:
     - Detects when the viewport approaches/exceeds the current coverage bounds.
     - Expands coverage bounds and triggers a refresh for BOTH:
       - `loadExplorationAreasForBounds()` using the buffered bounds (so clearings are correct before moveend)
       - fog geometry regeneration for the same buffered bounds.
   - Keep `moveend` for persisting viewport, but avoid redundant fog regeneration if the move handler already refreshed.
   - Address the current ref-staleness issue: `updateFogLayer()` reads `exploredAreasRef.current`, which won’t reflect the freshly-dispatched areas immediately. Prefer either:
     - returning the fetched areas from `loadExplorationAreasForBounds()` and passing them to a parameterized fog update, or
     - synchronizing `exploredAreasRef.current` immediately when new areas are computed.

   Implemented:
   - Added coverage bounds refs: `fogCoverageBoundsRef`, `explorationCoverageBoundsRef` in `src/components/MapContainer.web.tsx`.
   - Added buffered coverage helpers: `expandBounds()`, `shouldRefreshCoverage()`, and buffer/threshold constants (`FOG_COVERAGE_BUFFER_RATIO`, `EXPLORATION_COVERAGE_BUFFER_RATIO`, `COVERAGE_REFRESH_THRESHOLD_RATIO`) in `src/components/MapContainer.web.tsx`.
   - Added throttled `move` refresh (`MOVE_REFRESH_THROTTLE_MS`) that calls `refreshCoverage()` to prefetch exploration areas and regenerate fog while moving in `src/components/MapContainer.web.tsx`.
   - Kept `moveend` for viewport persistence and calls `refreshCoverage()` to ensure coverage remains correct in `src/components/MapContainer.web.tsx`.
   - Fixed ref staleness by making `loadExplorationAreasForBounds()` return the fetched areas and synchronizing `exploredAreasRef.current` before calling `updateFogLayer(...)` in `src/components/MapContainer.web.tsx`.
   - Made `updateFogLayer()` parameterized: accepts `fogBoundsOverride` and `exploredAreasOverride` so the geometry uses the just-fetched areas in `src/components/MapContainer.web.tsx`.

2. Fog geometry: replace “grid of rectangles” with “single fog polygon minus explored union”
   - Keep `FogService.generateFogGeometry()` as the public API, but change its “exploredAreas present + bounds present” path to produce a smooth fog shape:
     - Outer polygon = buffered bounds rectangle.
     - Explored areas = circle polygons (resolution depends on zoom / LOD).
     - Compute explored union (to avoid overlapping holes parity/triangulation artifacts).
     - Compute fog polygon = outer polygon minus explored union.
   - Implementation detail guidance:
     - Use `@turf/turf` (already in dependencies) for:
       - circle generation (`circle`)
       - winding normalization (`rewind`)
       - polygon boolean ops (`union`/`difference`) to avoid overlapping-hole artifacts.
     - Apply zoom-driven circle resolution (fewer points at low zoom, more at high) and cap complexity (e.g., maximum explored polygons processed per refresh).
     - Add a fallback: if explored polygon count is too high (or boolean ops become too slow), fall back to a cheaper representation (e.g., improved `mergeAdjacentCells()` strip-merge) for that update.

   Implemented:
   - Added normalization so `generateFogGeometry()` accepts either DB-style explored areas (`latitude`/`longitude`) or Redux-style (`center`) via `normalizeExploredAreas()` in `src/services/fogService.ts`.
   - Implemented the bounded merged-geometry path `generateMergedFogFeatures(...)` using `@turf/turf` `circle`, `union`, `difference`, and `rewind` in `src/services/fogService.ts`.
   - Added guardrails: `MAX_BOOLEAN_OPERATION_AREAS` and `MAX_BOOLEAN_OPERATION_TIME_MS`, returning `null` to trigger fallback when unions/differences are too costly in `src/services/fogService.ts`.
   - Kept legacy grid/LOD as fallback when merged geometry is skipped/times out in `src/services/fogService.ts`.
   - Circle resolution is zoom-driven via `getCircleStepsForZoom()` in `src/services/fogService.ts`.

3. Optional seam hardening on web layer
   - Even with merged/single polygons, set `fill-antialias: false` on the web fog layer if edge softness still produces visible hairlines.

   Implemented:
   - Set `fill-antialias: false` on the web fog fill layer in `src/components/MapContainer.web.tsx`.

4. Verification and performance checks
   - Manual: run the web app and validate:
     - No grid seams at zoom ~6–18.
     - Rapid pan/zoom never shows unfogged basemap.
     - Explored clearings remain visible and track during movement (not only after `moveend`).
   - Automated: run `npm run test:performance` and ensure fog generation remains within expected timing; update tests if they assert feature counts that will change.

   Completed (manual smoke):
   - Launched `npm run web` and automated pan/zoom via Playwright (Firefox) using the CLI session.
   - Captured artifacts under `.playwright-cli/` including:
     - `.playwright-cli/page-2026-03-04T16-18-31-838Z.png` (baseline loaded)
     - `.playwright-cli/page-2026-03-04T16-18-54-496Z.png` (post pan/zoom)
     - `.playwright-cli/page-2026-03-04T16-19-13-588Z.png` (deep zoom + pan stress)

   Not completed:
   - `npm run test:performance` has not been run yet.

**Relevant files**
- src/components/MapContainer.web.tsx — `updateFogLayer()` and `map.on('moveend', ...)` handler; add throttled `move` refresh.
- src/services/fogService.ts — `generateFogGeometry()` and `mergeAdjacentCells()`; replace rectangle feature generation with polygon-with-holes (difference) output.
- src/services/performanceMonitorService.ts — LOD settings to reuse for circle resolution / complexity caps.
- src/utils/spatial.ts — good home for any lightweight geometry helpers if avoiding turf in hot paths.

**Verification**
1. `npm run web` and visually test seams + pan/zoom accuracy.
2. `npm run test:performance` (and `npm test` if quick).

**Decisions captured from user**
- Prefer the most visually appealing approach.
- Apply changes in shared code (not a separate web-only fog generator).
- Keep clearings accurate during active movement, not just after `moveend`.
