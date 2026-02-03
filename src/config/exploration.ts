export type ExplorationRenderSource = 'areas' | 'tiles';

// Zoom level used for tile-based exploration storage. Higher = finer granularity.
// z=18 is ~150m tiles at the equator (good for "fog of war" without huge storage growth).
export const EXPLORATION_TILE_ZOOM = 18;

// Controls whether the map/fog rendering uses circles ("areas") or tile-derived circles ("tiles").
export const EXPLORATION_RENDER_SOURCE: ExplorationRenderSource =
  process.env.EXPO_PUBLIC_EXPLORATION_RENDER_SOURCE === 'tiles' ? 'tiles' : 'areas';

