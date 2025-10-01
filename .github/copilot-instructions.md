## Cartographer AI Assistant Development Guide

Purpose: Give AI coding agents the minimum high‑leverage context to make correct, idiomatic changes quickly. Keep answers pragmatic and aligned with existing patterns.

### 1. Architectural Overview
- React Native (Expo) app that gamifies exploration with a dynamic fog‑of‑war over Mapbox.
- Layered structure:
	- `src/components`: Pure/mostly-presentational UI + thin orchestration (`MapScreen`, `FogOverlay`, `CloudRenderer`). Avoid business logic here.
	- `src/services`: Core domain + side‑effects (location tracking, fog generation, achievements, backup, performance, memory, offline). Each service encapsulates state + exposes functions or singleton getters (`getFogService`, `LocationService.getInstance()`).
	- `src/database`: SQLite schema + initialization lifecycle (first launch setup, achievements seeding, health checks) exposed via `initializeDatabaseOnFirstLaunch` and helpers.
	- `src/store`: (Redux Toolkit) app state slices (not fully inspected—follow existing slice co-location + action naming if extending).
	- `src/config`: Environment + Mapbox validation (`validateAppConfiguration` runs early in `App.tsx`). Never bypass validation when introducing new config.
	- `src/types`: Central shared domain types (fog geometry, location, performance).
	- `src/utils`: Cross-cutting helpers—prefer adding here before sprinkling ad‑hoc helpers in services.

### 2. Core Domain Patterns
- Services are singleton or factory wrapped; prefer extending existing service instead of creating new global state.
- Fog system (`fogService.ts`) computes geometry via spatial grid + LOD from `performanceMonitorService`. If adding fog features:
	1. Respect cache (`fogGeometryCache`) semantics (30s freshness) and bounds filtering.
	2. Use / extend `LevelOfDetailSettings` instead of hardcoding thresholds.
	3. Keep geometry output GeoJSON FeatureCollection with Polygon features closed (repeat first coordinate) and attach `properties.type = 'fog'`.
- Performance & memory adaptation: Call `getLODSettings(zoom)` rather than recomputing cell sizes; if new visual system needs scaling, add to LOD config map.
- Location handling (`locationService.ts`):
	- Permission workflow: foreground → background; always short‑circuit if not granted.
	- Recovery path uses `errorRecoveryService` hooks—when adding new failure modes, funnel errors through that service instead of inline retries.
- Database initialization: All first‑launch mutations go through `initializeDatabaseOnFirstLaunch`; if adding default records (e.g., new achievement category) update seeding + health checks consistently.

### 3. Configuration & Environment
- Required runtime env: `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN (pk.*)` and build‑time `MAPBOX_DOWNLOAD_TOKEN (sk.*)`. Validation occurs on startup with partial token logging—preserve redaction pattern if extending (`substring(0,10) + '...'`).
- Add new config keys to `.env.example` and validate in a dedicated function invoked by `validateAppConfiguration`.

### 4. Adding / Modifying Features
- Prefer: component -> hook (if reusable state) -> service method -> database/service side‑effects.
- Avoid embedding async side‑effects directly in components—delegate to services or a hook wrapping a service.
- When introducing caching, mirror the fog cache pattern: Map keyed by serialized input + timestamp + bounded lifetime + cleanup method.
- Use existing distance/geo conversions (`calculateDistance`, cell sizing) before adding new geo math utilities.

### 5. Testing & Verification (Observed Patterns)
- Tests live under `src/__tests__` (integration, e2e, performance scaffolds). When adding service logic, create a focused integration test exercising public service API (not private helpers).
- Mock external SDKs (Mapbox, Expo Location) at module boundary—do not reach into their internals in assertions.

### 6. Performance & Memory
- If a feature may inflate geometry or particle counts: add adaptive branching keyed off `getDeviceCapabilityService().getPerformanceSettings()` or extend `PerformanceMetrics` consumers.
- Never loop over entire world data; always early‑filter by `bounds` when available (see fog grid updates).

### 7. Error Handling & Recovery
- Centralize recoverable operational errors in relevant service (e.g., `locationService` retries with exponential delay). Do not add opaque `try/catch` in UI—bubble errors to service + expose a status method or callback.
- Log patterns: prefix domain with emoji (🌫️ fog, 🔧 config) + concise context. Follow existing style for discoverability in logs.

### 8. Deployment / Build Workflows
- Local dev: `npm install` → `cp .env.example .env` → fill tokens → `npm start`.
- Builds: `npm run build:development|preview|production` (EAS). OTA updates: `npm run update[:preview|:production]`—match channel naming.
- When adding build‑time scripts place them in `scripts/` and document in `DEPLOYMENT.md` if they affect release flow.

### 9. When Extending Types
- Modify shared domain shapes in `src/types/*`; keep backward compatibility for service return types unless incrementing a minor version of the consuming component.
- For new enum‑like string unions, co-locate constants near the types and export through an index barrel if widely reused.

### 10. PR / Change Hygiene for AI Agents
- Before altering cross‑service behavior (fog ↔ performance ↔ memory), scan service files for existing hook points (search for method names rather than re‑implementing logic).
- Keep patches minimal; do not mass‑reformat.
- Add TODO comments only with specific intent + owner tag (`// TODO: <short actionable note>`). Remove stale debug logs unless consistent with existing patterns.

### 11. Quick Reference (Examples)
- Get fog geometry: `getFogService().generateFogGeometry(exploredAreas, zoom, bounds)`.
- Check config on startup: `validateAppConfiguration()` before rendering map.
- Track location: `const loc = await LocationService.getInstance().getCurrentLocation()`.
- Initialize DB in `App.tsx`: call `initializeDatabaseOnFirstLaunch()` and handle `result.errors` array.

### 12. What NOT To Do
- Do not bypass LOD when adding large geometry collections.
- Do not leak full tokens to logs.
- Do not introduce new global singletons without a getter wrapper or reuse pattern.
- Do not put seeding logic directly in components—keep inside database initialization.

Feedback Welcome: If any section lacks clarity for a task you attempt, flag which step was ambiguous so we can refine these instructions.

