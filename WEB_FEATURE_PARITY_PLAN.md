# Web Feature Parity Plan (Mobile ↔ Web)

Goal: Make the web target match the mobile experience (Mapbox style, fog/exploration, cloud system, Profile tooling) while reusing existing services and Redux state.

## Guiding principles

- Keep feature logic in `src/services/` + Redux slices; make platform differences live behind `*.web.ts(x)` adapters.
- Keep `MapScreen.tsx` platform-agnostic; implement platform-specific map rendering in `MapContainer(.web).tsx`.
- Prefer parity over perfection: ship traditional fog parity first, then iterate toward Skia-like visuals and cloud rendering.

## Definition of done (acceptance)

- Map loads on web using `MAPBOX_CONFIG.DEFAULT_STYLE` and matches mobile styling/controls.
- Fog renders and clears based on exploration state (via real geolocation), persists across refresh, and respects `fogSlice` settings (visible/opacity).
- Exploration updates persist to storage and are reflected in Profile stats.
- Cloud system toggle is available; web either renders clouds via custom layer or falls back gracefully to traditional fog.
- Profile screen features work (stats + achievements), plus “best-effort” equivalents for backup/offline tooling.

## Phase 0 — Parity matrix + acceptance checks

Deliverables:
- A parity checklist with each feature mapped to: mobile implementation, web status, owner file(s), and acceptance criteria.
- Identify hard blockers (e.g., DB backend on web, background tasks).

Checklist categories:
- Map UX: style, camera, zoom/center controls, user-location indicator, follow mode, loading/errors.
- Fog: visibility/opacity, geometry generation, performance (LOD), persistence, “clear around user” semantics.
- Exploration: location tracking, dwell/accuracy logic, DB writes, cache updates.
- Cloud system: settings UI, initialization, fallback behavior.
- Profile: stats, achievements, backup, offline.

### Parity Matrix (initial)

| Feature | Mobile implementation (owner file/s) | Web status | Blocker / notes | Acceptance check |
| --- | --- | --- | --- | --- |
| App shell + navigation | `App.tsx`, `src/components/TabNavigation.tsx` | Diverged (`App.web.tsx` demo) | Web entry bypasses shared app | Web uses shared shell, tabs render map/profile |
| Map render (Mapbox) | `src/components/MapContainer.tsx` (`@rnmapbox/maps`) | Mapbox GL JS in `App.web.tsx` | Web map lives outside Redux flow | Map loads via `MapContainer.web.tsx` and Redux |
| Map style | `src/config/mapbox.ts` | Uses `MAPBOX_CONFIG.DEFAULT_STYLE` in `App.web.tsx` | None | Web uses same config-driven style |
| Viewport state | `src/store/slices/mapSlice.ts` + `MapContainer.tsx` | Local state in `App.web.tsx` | Web map not wired to Redux | Web updates `mapSlice` + persists viewport |
| Map controls (zoom/center) | `src/components/MapScreen.tsx` | Buttons exist in web demo | Web controls not wired to Redux | Web buttons update Redux + map |
| User location indicator | `Mapbox.UserLocation` in `MapContainer.tsx` | Mapbox GL JS Geolocate control | Needs Redux sync + follow mode | Location updates set `mapSlice.userLocation` |
| Follow user mode | `mapSlice.followUserLocation` + Mapbox camera | Not implemented on web | Web map not following Redux | Follow mode works on web |
| Loading/error UX | `MapScreen.tsx` + `mapSlice` | Ad-hoc overlay in `App.web.tsx` | Not aligned with shared UI | Web shows same loading/error states |
| Fog geometry | `src/services/fogService.ts` | Used in `App.web.tsx` | Not wired to Redux/exploration | Web fog driven by explored areas from Redux |
| Fog visibility/opacity | `src/store/slices/fogSlice.ts` + `SkiaFogOverlay` | Hardcoded in web demo | Needs Redux-driven layer config | Toggle/opacity reflected in web layer |
| Fog persistence | DB + exploration sync | Web uses local state only | DB backend + Redux needed | Fog persists across refresh |
| Exploration detection | `src/services/explorationService.ts` | Not used on web | Location service + DB on web | Geolocation triggers new areas |
| Fog-location integration | `src/services/fogLocationIntegrationService.ts` | Not started on web | Background/task deps | `start()` runs on web without background tasks |
| Spatial cache | `src/services/spatialCacheService.ts` | Not used on web | Needs DB + bounds updates | Bounds query loads explored areas |
| Cloud system (render) | Skia + cloud integration | Not on web | WebGL custom layer not wired | Custom layer renders or falls back |
| Cloud settings UI | `src/components/CloudSettingsPanel.tsx` | Not shown on web | Web uses demo app shell | Cloud settings accessible on web |
| Profile stats | `src/components/ProfileScreen.tsx` + DB | Not on web | Web DB backend needed | Stats match mobile data |
| Achievements | `src/services/achievementsService.ts` + DB | Not on web | Web DB backend needed | Achievements render with progress |
| Backup | `src/services/backupService.ts` (Expo FS/Sharing) | Not supported | Web file APIs needed | Export/import works via browser |
| Offline queue/cache | `src/services/offlineService.ts` | Not supported | RN NetInfo + FS on web | Web queue + cache behavior defined |
| Mapbox offline packs | `src/services/mapboxOfflineService.ts` | Not supported | RN Mapbox offline API | Explicitly disabled w/ UI messaging |

### Blockers / unknowns (to resolve first)

- Web database backend: confirm `expo-sqlite` web support; if insufficient, add a web adapter (likely IndexedDB) behind `src/database/*.web.ts`.
- Background tasks on web: `src/services/taskManager.ts` + `backgroundLocationService.ts` require web-safe no-ops.
- File system + sharing on web: `backupService.ts` needs browser file APIs.
- NetInfo on web: `offlineService.ts` requires a web implementation for connectivity + cache/queue.

### Phase 0 acceptance

- Parity matrix completed with owners, web status, blockers, and acceptance checks (this section).
- Blockers list is explicit and ready to be assigned/triaged.

## Phase 1 — Unify the web app shell (remove web demo divergence)

Current: `App.web.tsx` is a standalone Mapbox GL JS demo with local component state.

Target:
- Web runs the same app shell as mobile: `App.tsx` → `TabNavigation` → `MapScreen`/`ProfileScreen`.
- Platform-only dependencies are moved behind web-safe adapters.

Deliverables:
- Replace `App.web.tsx` with a thin wrapper that renders shared `App.tsx` (or remove `App.web.tsx` and let Expo use `App.tsx`).
- Add `*.web.ts` stubs/adapters for native-only modules:
  - `src/services/taskManager.ts` (background tasks) → web no-op queue implementation.
  - `src/services/backgroundLocationService.ts` → web no-op (foreground only).
  - `src/services/mapboxOfflineService.ts` → web “not supported” implementation.
  - `src/services/offlineService.ts` → web network + queue using browser APIs.
  - `src/services/backupService.ts` → web file import/export via browser APIs.
  - `src/services/deviceCapabilityService.ts` → web capability detection using browser info (fallback tiering).

Acceptance:
- `npm run web` loads the same navigation + screens as mobile (even if some buttons show “not supported”).

## Phase 2 — `MapContainer.web.tsx` (Mapbox GL JS) as the rendering parity layer

Target:
- Keep `src/components/MapScreen.tsx` unchanged.
- Add `src/components/MapContainer.web.tsx` that mirrors `MapContainer.tsx` responsibilities using Mapbox GL JS:
  - Initialize map with `MAPBOX_CONFIG` style/center/zoom.
  - Sync map viewport into `mapSlice` (`updateViewport`, `setMapReady`, `setMapError`, `setUserLocation`).
  - Respect follow-user mode behavior from Redux.
  - Implement bounds-driven explored-area loading similar to mobile:
    - read visible bounds on idle/moveend
    - query via `spatialCacheService.search(bounds)` + `databaseService.getAreasByIds`
    - dispatch `setExploredAreas` with Redux format.
  - Implement viewport persistence (`saveViewport`/`loadViewport`) on web.

Acceptance:
- Web map viewport stays in sync with Redux and persists across reloads.
- Explored areas for the current bounds load and update without manual clicking.

## Phase 3 — Traditional fog parity on web (GeoJSON fill layer)

Target:
- Use existing `fogService.generateFogGeometry(...)` with the *same* explored-area inputs that mobile uses.
- Render fog in Mapbox GL JS as:
  - a GeoJSON source + fill layer (`fill-opacity` from feature property)
  - optional outline/edge layer if needed
- Drive fog from Redux:
  - `exploration.exploredAreas` changes trigger `setData`
  - `fogSlice.isVisible` toggles layer visibility
  - `fogSlice.opacity` multiplies fill opacity
- Update fog on `moveend` or throttled `move` based on performance.

Visual parity iteration:
- First pass: solid fill with opacity.
- Second pass: improve edges (e.g., multiple layers with opacity ramps, or a canvas/custom layer).

Acceptance:
- Fog updates correctly when exploration changes and when map bounds change.

## Phase 4 — Real exploration on web (foreground geolocation)

Target:
- Ensure `locationService` runs on web (foreground-only).
- Ensure `fogLocationIntegrationService.start()` works on web without background-task dependencies:
  - background task manager APIs must be stubbed/guarded on web
  - exploration processing + DB writes must still work
- Keep click-to-explore as a dev-only tool (behind `__DEV__` or a debug setting).

Acceptance:
- Moving location (or simulated browser location) creates explored areas and clears fog.
- State persists in the web DB backend (see Phase 6 if DB is the blocker).

## Phase 5 — Cloud system integration on web (custom layer + fallback)

Target:
- Mount `src/services/cloudSystem/integration/MapboxCloudLayer.ts` as a Mapbox GL JS custom layer.
- Wire cloud system lifecycle to:
  - `cloudFogIntegration` start/stop
  - `CloudSettingsPanel` controls
  - `fogSystemCompatibility` (choose cloud vs traditional vs both)
- Use web capability detection to enable/disable:
  - WebGL feature checks
  - performance defaults (LOD)
  - fallback to traditional fog if unsupported or errors occur.

Acceptance:
- Cloud toggle doesn’t break map rendering; fallback to traditional fog is reliable.

## Phase 6 — Profile parity (DB-backed stats, backup, offline)

Key decision: database backend on web.
- If `expo-sqlite` on web is sufficient: keep it.
- If not: add a web database adapter (likely IndexedDB) behind `src/database/*.web.ts` with the same `DatabaseService` interface.

Note: This is currently the biggest parity blocker; if the web DB layer isn’t stable, Profile stats, achievements, and backup/restore will remain limited until the adapter is in place.

Backup parity:
- Web export: download JSON file containing backup data.
- Web import: file picker reads JSON and restores/merges.

Offline parity:
- Web cannot use RN Mapbox offline packs; implement “best-effort” equivalents:
  - offline queue for exploration writes
  - cache for API/data (if any) using IndexedDB/localStorage
  - clearly indicate limitations in UI.

Acceptance:
- Profile stats/achievements render on web and match mobile numbers given the same exploration data.
- Backup export/import works end-to-end on web.

## QA plan (smoke checklist)

- Map loads with `MAPBOX_CONFIG.DEFAULT_STYLE`, no redbox.
- Fog visible/opacity toggles work.
- Exploration via geolocation creates areas and clears fog; refresh persists.
- Cloud toggle: renders or falls back without errors.
- Profile screen loads stats + achievements; backup export/import roundtrip succeeds.
