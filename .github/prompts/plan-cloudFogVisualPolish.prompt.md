# Cloud Fog Visual Polish

## Summary
Update the fog visuals to a bright soft-cloud treatment. Extend the existing native shader rather than replace it, keep Skia rendering to a single shader pass, and add a separate web overlay path that is synced to Mapbox render cadence and anchored to map/world coordinates.

The chosen defaults are:
- preset-derived uniforms are merged in `SkiaFogOverlay`
- `exploration_soft_clouds` is forced for all users via a one-time migration
- web clouds are anchored to a geographic grid and projected with `map.project` rather than sampled per-pixel with `map.unproject`

## Key Changesa

### Native (Skia)
- In `SkiaCloudShader.ts`, preserve the existing aspect-ratio correction, `zoomScale`, wind offset math, and current multi-octave billow/detail structure.
- Rework the shader output only:
  - keep one GLSL `main()` and compute three conceptual bands inside it: atmospheric veil, cloud body, and highlight/rim
  - add uniforms for haze amount, shadow/highlight tint, edge softness, and band scale controls
  - retune color and alpha so dense clouds are bright white with cool gray depth and the map stays faintly visible underneath
  - `effectiveFogOpacity` is the sole external scalar — no extra damping multipliers before the alpha clamp
  - dense areas reach ~0.88–0.92 alpha; cap at 0.92
- In `SkiaFogOverlay.tsx`, keep the single `<Fill><Shader /></Fill>` render path. Do not add multiple full-screen shader passes.
- Adjust the reveal feel through the masking system so explored holes are softer and more cloud-like, with feathered edges rather than hard cutouts.

### Preset & Settings
- Add a built-in visual preset, `exploration_soft_clouds`, through the existing `stylePresets` registry in `VisualCustomizationManager.ts`, and make it the default unexplored style.
- Add a one-time migration version check during `loadSettings()`:
  - if migration version is older than the rollout version, overwrite saved visual settings with the `exploration_soft_clouds` baseline
  - set `selectedStylePreset` to `exploration_soft_clouds`, `selectedColorScheme` to the preset's scheme, clear custom-color mode, reset opacity/contrast/brightness/saturation to rollout defaults
  - persist the migrated settings and the new migration version so this happens only once
- Keep `getDefaultSettings()` aligned with `exploration_soft_clouds` so fresh installs and post-migration state match.

### Adapter Layer
- Add a small shared `CloudFogVisualAdapter` that converts `VisualCustomizationManager` state plus core cloud settings into render-ready `CloudFogVisualParams`:
  - base haze, edge softness, haze/mass/detail scales
  - primary/secondary/highlight/ambient colors as normalized `[number, number, number]` tuples (not CSS strings)
  - effective fog opacity (simplified chain: `baseFogOpacity × presetOpacity × 0.94`, no extra scheme/visual multipliers)
  - veilAlpha, puffOpacityScale
- In `SkiaFogOverlay.tsx`:
  - load visual customization state from `VisualCustomizationManager` during mount via `useCloudFogVisualParams` hook
  - subscribe to manager updates
  - merge manager-derived visual params with the existing Redux-driven density, animation speed, fog opacity, wind offset, zoom, and resolution when assembling `shaderUniforms` via `buildSkiaFogUniforms`

### Uniform Pipeline
- Extend `SkiaCloudUniforms` with:
  - `u_fog_opacity`, `u_base_haze`, `u_edge_softness`
  - `u_haze_scale`, `u_mass_scale`, `u_detail_scale`
  - `u_cloud_primary_color`, `u_cloud_secondary_color`, `u_cloud_highlight_color`, `u_cloud_ambient_color` (all vec3)
- Propagate through all consumers:
  - `SkiaCloudShader.ts` — GLSL declarations, defaults, validation
  - `SkiaShaderManager.ts` — explicitly enumerate all new keys in `createUniformsForSkia()`
  - `SkiaShaderSystem.ts` — passes through via `shaderManager.createUniformsForSkia()`
  - `SkiaUniformBatcher.ts` — `detectChanges()` uses `Object.entries()` so no enumeration needed; no behavioral change required

### Web Canvas Overlay
- Replace the dark Mapbox GeoJSON fill as the polished path with a `CloudFogCanvasOverlay` component:
  - positioned `<canvas>` (absolutely inset) above the Mapbox canvas
  - continue using fog geometry as the unexplored mask source
  - generate cloud puffs on a fixed geographic grid derived from current map bounds and zoom (`createWorldAnchoredCloudPuffs`)
  - keep puff centers in world coordinates; project to screen each frame with `map.project`
  - apply the unexplored mask in canvas compositing with `destination-out` + radial gradients for feathered reveal holes
  - keep the Mapbox GeoJSON fog source active but set `fill-opacity: 0` (source remains as geometry input)
- Redraw behavior:
  - during active pan/zoom, redraw from Mapbox `render` events throttled to ~25fps (`INTERACT_FRAME_MS = 40`)
  - idle cloud drift uses a lighter animation loop throttled to ~11fps (`IDLE_FRAME_MS = 90`)
  - noise sampling uses world-space grid coordinates so clouds do not swim during movement
- Performance constraints:
  - cap at 60 puffs (`MAX_CLOUD_PUFFS = 60`)
  - grid padding factor 1.0× (not 1.75×)
  - 3–4 lobes per puff (not 4–6)
  - no `context.filter = 'blur()'` calls — radial gradients provide the soft edges without GPU compositing passes

## API / Type Changes
- `SkiaCloudUniforms` extended with 10 new fields (see above)
- `CloudFogVisualParams` interface in `CloudFogVisualAdapter.ts`
- `BuildSkiaFogUniformsInput` and `buildSkiaFogUniforms()` in `CloudFogVisualAdapter.ts`
- `useCloudFogVisualParams(baseFogOpacity)` hook in `src/hooks/`
- `createWorldAnchoredCloudPuffs` and `projectFogGeometryToScreen` utilities in `CloudFogCanvasUtils.ts`
- `VISUAL_SETTINGS_MIGRATION_VERSION_KEY` storage key for one-time rollout
- `SOFT_CLOUD_VISUAL_ROLLOUT_VERSION` constant (current: 1)
- No new Redux slice; visual customization stays outside Redux

## Test Plan
- Shader/unit tests: expanded uniform shape, defaults, validation, Skia serialization
- Preset tests:
  - fresh install defaults to `exploration_soft_clouds`
  - existing saved settings are overwritten once by the rollout migration
  - rerunning initialize/load does not reapply the migration after version is stored
- Migration tests for `VisualCustomizationManager` post-merge patch order
- Adapter tests: preset selection produces expected `CloudFogVisualParams`; `buildSkiaFogUniforms` merges params correctly
- Web overlay tests:
  - fog polygon projection to screen space
  - world-grid cloud identity stability across a small pan
  - render-loop sync via Mapbox `render` events during movement
- Regression checks:
  - native overlay remains a single shader pass
  - low-perf fallback stays bright (existing `rgba(245, 248, 255, ...)` color, no change needed)
  - explored-area clearing still produces soft-edged reveal holes

## Assumptions
- Procedural-only for v1; no texture assets
- Native and web should be visually similar, not pixel-identical
- Performance degradation should reduce cloud detail (puff count, lobes) before changing the overall bright-cloud aesthetic
- Visual customization stays outside Redux; `SkiaFogOverlay` and `CloudFogCanvasOverlay` are the integration points
- `map.project` over world-space cloud primitives is the web anchoring mechanism; per-pixel `map.unproject` sampling is not required
