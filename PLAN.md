# Consumer-Ready Cartographer Implementation Plan

## Product Direction

Build the next release as a `local-first v1`. The app should feel dependable and rewarding on one device before it takes on accounts, cross-device sync, or broader social features.

The product shift is:

- from `map + utilities`
- to `explore + progress + identity`

The implementation order is:

1. Shell and visual foundation
2. Core exploration trust loop
3. Progress and retention read models
4. Offline readiness, startup speed, and reliability
5. Me and Advanced information architecture
6. Cloud sync and accounts after local-first stability

## Implementation Status

- Phase 0 `implemented`
- Phase 1 `implemented`
- Phase 2 `partially implemented`
- Phase 3 `partially implemented`
- Phase 4 `implemented`
- Phase 5 `not implemented`

## Implemented In Repo

- New `Explore / Progress / Me` shell landed in `src/components/TabNavigation.tsx`.
- New consumer-facing `Progress` screen landed in `src/components/ProgressScreen.tsx`.
- `MapScreen` was rebuilt around a HUD, discovery toast, richer loading/error states, and stronger exploration framing.
- `ProfileScreen` was rebuilt into a more consumer-facing `Me` surface, with advanced controls pushed down behind secondary actions.
- Startup/loading UI in `App.tsx` was upgraded and now uses a lightweight persisted bootstrap snapshot from `src/services/appExperienceService.ts`.
- Exploration persistence now uses a shared decision engine plus local-first exploration record writes through:
  - `src/services/explorationEngine.ts`
  - `src/services/explorationService.ts`
  - `src/services/backgroundLocationService.ts`
  - `src/services/offlineService.ts`
  - `src/database/services.ts`
- Offline maps no longer use the San Francisco demo copy/path in `src/components/OfflineManager.tsx`.
- Profile refresh now reloads achievements and history along with stats in `src/store/slices/profileSlice.ts`.

## Still Deferred

- Persisted SQLite read models such as `progress_summary`, `daily_activity`, and `place_highlights`
- A full `app_health` model and consumer health badge
- Viewport-driven offline region planning and storage estimation
- Real account identity, cloud sync, remote backup, inbox/outbox sync queues, and conflict resolution

## Post-Review Next Steps

Gemini review confirmed the overall direction, but called out four high-ROI gaps that should now drive the next implementation slice:

1. Add persisted SQLite read models first.
   `Progress` is now visible in the product, so it should stop depending on repeated full-table scans before user data grows enough to make it feel slow.
2. Add offline storage estimation before real downloads.
   Removing the demo region was correct, but users still need a size estimate and confirmation before downloading large offline regions.
3. Add a formal permission/health state.
   The app still needs a deterministic `needs_location_permission` and related health model so tracking failures are obvious rather than silent.
4. Tighten type safety around the new exploration contract.
   The shared exploration event/result path is now important enough that it should be one of the first areas brought under stricter verification.

## Goals

- Make exploration feel immediate, consistent, and trustworthy.
- Make the map screen rewarding instead of merely functional.
- Move system-management UI out of the primary user journey.
- Make Progress and Me open quickly from precomputed local data.
- Keep the existing Expo, SQLite, Redux, Mapbox, offline queue, and manual backup architecture.

## Non-Goals For This Plan

- Social graph, multiplayer, or competitive features
- Large cloud backend before local-first foundations are stable
- Replacing manual backup with sync in the first consumer-ready release

## Current Repo Anchors

The current implementation already gives a strong base, but it is still surfaced like a technical prototype:

- [`src/components/TabNavigation.tsx`](/home/rakeenhuq/Downloads/cartographerv2/src/components/TabNavigation.tsx) is a custom two-tab shell with `map` and `profile`.
- [`src/components/MapScreen.tsx`](/home/rakeenhuq/Downloads/cartographerv2/src/components/MapScreen.tsx) mainly wraps the map and a light tracking/loading layer.
- [`src/components/ProfileScreen.tsx`](/home/rakeenhuq/Downloads/cartographerv2/src/components/ProfileScreen.tsx) gives top-level space to Cloud, Offline, Backup, and system tuning.
- [`App.tsx`](/home/rakeenhuq/Downloads/cartographerv2/App.tsx) still uses plain initialization and error screens.
- [`src/services/explorationService.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/services/explorationService.ts), [`src/services/backgroundLocationService.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/services/backgroundLocationService.ts), and [`src/services/offlineService.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/services/offlineService.ts) split exploration logic across multiple paths with different rules.
- [`src/database/schema.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/database/schema.ts) and [`src/database/services.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/database/services.ts) already contain both `explored_areas` and `visited_tiles`.
- [`src/services/statisticsService.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/services/statisticsService.ts) and [`src/store/slices/profileSlice.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/store/slices/profileSlice.ts) still do too much recomputation on refresh.
- [`src/components/OfflineManager.tsx`](/home/rakeenhuq/Downloads/cartographerv2/src/components/OfflineManager.tsx), [`src/components/BackupManager.tsx`](/home/rakeenhuq/Downloads/cartographerv2/src/components/BackupManager.tsx), and [`src/components/CloudSettingsPanel.tsx`](/home/rakeenhuq/Downloads/cartographerv2/src/components/CloudSettingsPanel.tsx) hold valuable functionality that should move behind a secondary information architecture.

## Phase 0: Shell And Visual Foundation

Status: `implemented`

### UI Pairing

- Replace the two-tab shell with `Explore`, `Progress`, and `Me`.
- Remove emoji tabs and move to one consistent icon set.
- Replace plain loading and error states with branded, atmospheric surfaces.
- Establish one visual language for fog, floating controls, glass layers, motion, and typography.

### Backend Pairing

This phase has no hard backend dependency, but the shell should be designed to accept later state from:

- `bootstrap snapshot`
- `app health`
- `progress summary`

### Repo Touchpoints

- [`src/components/TabNavigation.tsx`](/home/rakeenhuq/Downloads/cartographerv2/src/components/TabNavigation.tsx)
- [`src/components/MapScreen.tsx`](/home/rakeenhuq/Downloads/cartographerv2/src/components/MapScreen.tsx)
- [`src/components/ProfileScreen.tsx`](/home/rakeenhuq/Downloads/cartographerv2/src/components/ProfileScreen.tsx)
- [`App.tsx`](/home/rakeenhuq/Downloads/cartographerv2/App.tsx)
- shared style tokens/components under `src/components/` and `src/utils/`

### Exit Criteria

- Navigation is `explore | progress | me`.
- Startup and fatal states look intentional instead of diagnostic.
- All primary navigation and map controls use the same iconography and control language.

Implemented notes:

- `src/components/TabNavigation.tsx` now uses `Explore`, `Progress`, and `Me`.
- `src/components/cartographerTheme.ts` was added for a shared atmospheric surface palette.
- `App.tsx` and `src/components/MapScreen.tsx` now use branded loading/error treatments instead of plain text screens.

## Phase 1: Core Exploration Trust Loop

Status: `implemented`

### Problem

Foreground and background exploration currently do not use the same acceptance rules or persistence flow. That creates a trust problem for a product whose primary promise is “what you walked should count.”

### UI Pairing

- Rewarding Explore HUD
- discovery pulse/haptic/toast
- daily uncover count
- streak feedback
- next frontier or nearest unexplored edge
- onboarding copy that explains why location access matters

### Backend Changes

- Create one exploration acceptance pipeline used by both foreground and background collection.
- Use the same dwell rules, accuracy thresholds, overlap logic, radius logic, and rejection reason codes across both paths.
- Make accepted exploration writes local-first and transactional:
  - write exploration event/history
  - upsert canonical tile coverage
  - update derived local read models
  - optionally enqueue future sync work
- Make `visited_tiles` the canonical coverage model for progress, HUD, sync, and render readiness.
- Keep `explored_areas` temporarily as history and migration support until readers are migrated.
- Emit one exploration result contract for UI consumers with:
  - acceptance state
  - rejection reason
  - source
  - coverage delta
  - timestamp
  - optional discovery classification

### Repo Touchpoints

- [`src/services/explorationService.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/services/explorationService.ts)
- [`src/services/backgroundLocationService.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/services/backgroundLocationService.ts)
- [`src/services/offlineService.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/services/offlineService.ts)
- [`src/database/services.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/database/services.ts)
- [`src/database/schema.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/database/schema.ts)
- Explore HUD components in `src/components/`

### Exit Criteria

- The same location sample is accepted or rejected the same way in foreground and background paths.
- Offline exploration updates the user-visible local state immediately.
- Every accepted exploration can drive visual delight from one shared event/result object.

Implemented notes:

- `src/services/explorationEngine.ts` now holds the shared acceptance/dwell/overlap decision logic.
- `src/services/explorationService.ts` and `src/services/backgroundLocationService.ts` now share that rule set.
- `src/database/services.ts` now has `persistExplorationRecord(...)` for local-first explored-area plus tile writes.
- `src/services/offlineService.ts` now replays queued exploration through the same local record shape.
- `src/components/MapScreen.tsx` now consumes exploration events for discovery feedback.

## Phase 2: Progress And Retention Read Models

Status: `partially implemented`

### Problem

The app already has progress, stats, achievements, and history, but those views are too dependent on full-table scans and refresh-time recomputation.

### UI Pairing

- New `Progress` tab
- hero card with streak and percent explored
- three headline stats
- recent wins
- collectible achievements
- richer place/region summaries

### Backend Changes

- Add persisted read models for:
  - `progress_summary`
  - `daily_activity`
  - `streak_state`
  - `recent_discoveries`
  - `achievement_progress`
  - `place_highlights`
- Update these incrementally when exploration is accepted instead of rebuilding them on every screen open.
- Persist reverse-geocoding/place cache in SQLite with TTL or versioning.
- Keep a repair/rebuild path for migrations, imports, and data recovery.

### Repo Touchpoints

- [`src/services/statisticsService.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/services/statisticsService.ts)
- [`src/services/achievementsService.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/services/achievementsService.ts)
- [`src/store/slices/profileSlice.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/store/slices/profileSlice.ts)
- [`src/database/schema.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/database/schema.ts)
- [`src/database/services.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/database/services.ts)
- new Progress screen components under `src/components/`

### Exit Criteria

- Progress can render from local read models without scanning all exploration rows during normal refresh.
- Achievements and place summaries feel instantaneous on repeat opens.
- Streaks, recent wins, and headline stats are reliable enough to be promoted into the main consumer journey.

Implemented notes:

- `src/components/ProgressScreen.tsx` now exists and promotes streaks, percent explored, recent wins, and achievements into a first-class surface.
- `src/store/slices/profileSlice.ts` refresh now reloads achievements and history together with stats.

Deferred notes:

- No persisted SQLite read-model tables were added yet.
- `src/services/statisticsService.ts` still performs heavier recomputation than the target architecture calls for.
- This is now the highest-priority backend gap because the new `Progress` surface is already user-facing.

## Phase 3: Offline Readiness, Startup Speed, And Reliability

Status: `partially implemented`

### Problem

The app does a lot of work before it feels ready, and the offline surface is currently more of a systems console than a consumer workflow.

### UI Pairing

- branded setup/loading states
- clearer permission guidance
- one friendly health/status badge
- offline readiness messaging on Me
- explicit “download this area” flows

### Backend Changes

- Add a persisted `bootstrap_snapshot` with:
  - last useful map camera
  - recent coverage summary
  - progress summary
  - readiness flags
- Add an `app_health` model with user-facing states:
  - `ready`
  - `needs_location_permission`
  - `offline_limited`
  - `recovering_local_writes`
  - `performance_limited`
- Build an offline region planner that supports:
  - current viewport download
  - explored-cluster download
  - storage estimate before download
  - offline coverage manifest/readiness state
- Replace demo offline-region behavior with map-driven and explored-area-driven flows only.

### Repo Touchpoints

- [`App.tsx`](/home/rakeenhuq/Downloads/cartographerv2/App.tsx)
- [`src/components/OfflineManager.tsx`](/home/rakeenhuq/Downloads/cartographerv2/src/components/OfflineManager.tsx)
- [`src/services/mapboxOfflineService.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/services/mapboxOfflineService.ts)
- [`src/services/offlineService.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/services/offlineService.ts)
- [`src/database/schema.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/database/schema.ts)
- state consumers in the main shell and Me screen

### Exit Criteria

- Cold start can paint a meaningful first frame from persisted data.
- Users can tell whether tracking and offline coverage are healthy without reading diagnostics.
- Offline region download is based on actual map context, not placeholder/demo logic.

Implemented notes:

- `src/services/appExperienceService.ts` now stores a lightweight bootstrap snapshot.
- `App.tsx` now uses that snapshot to improve startup messaging.
- `src/components/OfflineManager.tsx` no longer routes users through the old demo-region language/path.

Deferred notes:

- There is not yet a full persisted `app_health` state model.
- There is not yet viewport-based offline planning or storage estimation.
- These two gaps are now the highest-priority reliability follow-ups for offline and permission trust.

## Phase 4: Me And Advanced Information Architecture

Status: `implemented`

### Problem

Important capabilities already exist, but they are surfaced in a way that competes with the main player journey.

### UI Pairing

- consumer-facing `Me` screen
- system features moved into `Advanced`
- friendly experience presets
- data safety and recovery separated from moment-to-moment exploration

### Backend Changes

- Add an `experience_preset` model for:
  - `battery_saver`
  - `balanced`
  - `immersive`
- Map presets to cloud/fog/performance configuration.
- Preserve advanced tuning controls, but keep them as explicit overrides behind an Advanced disclosure.
- Preserve backup/import/export as recovery tools, not headline navigation.

### Repo Touchpoints

- [`src/components/ProfileScreen.tsx`](/home/rakeenhuq/Downloads/cartographerv2/src/components/ProfileScreen.tsx)
- [`src/components/CloudSettingsPanel.tsx`](/home/rakeenhuq/Downloads/cartographerv2/src/components/CloudSettingsPanel.tsx)
- [`src/components/OfflineManager.tsx`](/home/rakeenhuq/Downloads/cartographerv2/src/components/OfflineManager.tsx)
- [`src/components/BackupManager.tsx`](/home/rakeenhuq/Downloads/cartographerv2/src/components/BackupManager.tsx)
- relevant config and persistence modules under `src/services/` and `src/database/`

### Exit Criteria

- Main profile surface becomes identity, progress, and preferences first.
- Power-user controls remain available, but no longer dominate first-run perception.
- Presets are understandable without exposing raw engineering terms.

Implemented notes:

- `src/components/ProfileScreen.tsx` now centers on identity/progress/preferences instead of system status first.
- Experience presets `battery_saver`, `balanced`, and `immersive` are now surfaced in the main Me screen.
- Offline, backup, and detailed cloud controls were pushed behind secondary utility/advanced actions.

## Phase 5: Cloud Sync And Accounts

Status: `not implemented`

### Problem

The app already has a usable local recovery story through manual backup. Cloud sync should be added only after local correctness is stable.

### UI Pairing

- sign in to keep your map
- optional auto-backup
- cross-device restore
- future foundation for identity-driven features

### Backend Changes

- Add device identity and account identity.
- Add local sync outbox and inbox storage.
- Sync canonical data, not derived blobs:
  - tile coverage merges by set union
  - exploration events merge by stable IDs and timestamps
  - preferences use deterministic last-write-wins
- Keep read models rebuildable from canonical data.
- Keep manual local backup even after sync is introduced.

### Repo Touchpoints

- backup/export/import flows in [`src/database/services.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/database/services.ts)
- Me/account UI under `src/components/`
- future sync service modules under `src/services/`
- schema additions in [`src/database/schema.ts`](/home/rakeenhuq/Downloads/cartographerv2/src/database/schema.ts)

### Exit Criteria

- Sync does not weaken the local-first experience.
- Cross-device restore preserves canonical exploration coverage and history.
- Manual backup remains available as a transparent fallback.

Deferred notes:

- No remote auth, account identity, or sync backend exists in this repo.
- This phase remains blocked on server-side contracts and infrastructure.

## Cross-Cutting Data Model Changes

- Make `visited_tiles` the source of truth for explored coverage.
- Treat `explored_areas` as event/history support during migration.
- Add persisted local models for:
  - `ProgressSummary`
  - `DailyActivity`
  - `StreakState`
  - `RecentDiscovery`
  - `PlaceCacheEntry`
  - `BootstrapSnapshot`
  - `AppHealthStatus`
  - `ExperiencePreset`
- When sync is added later, also add:
  - `DeviceIdentity`
  - `AccountIdentity`
  - `SyncQueue`

## Recommended Delivery Order

### Milestone A: Product Shell

- Phase 0
- enough of Phase 4 to hide advanced/system controls from the primary path

### Milestone B: Trustworthy Exploration

- Phase 1
- map HUD and discovery feedback tied to the shared exploration pipeline

### Milestone C: Rewarding Progress

- Phase 2
- Progress tab and upgraded Me hero/stat surfaces

### Milestone D: Reliable Offline Experience

- Phase 3
- polished setup, readiness, and offline flows

### Milestone E: Cross-Device Foundation

- Phase 5

## Test Strategy

- Foreground and background exploration must share the same acceptance and rejection behavior for identical input samples.
- Accepted exploration must update history, canonical tile coverage, and derived read models in one local transaction.
- Offline exploration must feel immediate locally and reconcile cleanly later.
- Progress views must render from cached local read models during normal operation.
- Backup import and restore must rebuild derived data rather than treating it as canonical input.
- Bootstrap snapshot must allow a meaningful first frame on cold start.
- Health states must map to clear user-facing UI states, not just diagnostics.
- Offline region planning must estimate size, build regions from real map context, and report readiness.
- Presets must map cleanly to underlying fog/performance configuration while still allowing explicit Advanced overrides.
- Later sync tests must cover tile union, event dedupe, preference merge rules, and device restore.

## Success Criteria

- A new user immediately understands the loop: explore, reveal, progress, return.
- Exploration is trusted even when the user is offline or backgrounded.
- Progress feels collectible and fast, not computed and technical.
- Advanced controls still exist, but the app no longer feels like a debugging surface.
- The app can later add accounts and sync without rewriting the local data model again.
