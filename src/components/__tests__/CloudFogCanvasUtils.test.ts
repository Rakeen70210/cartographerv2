import { FogGeometry } from '../../types/fog';
import {
  MAX_CLOUD_PUFFS,
  createWorldAnchoredCloudPuffs,
  projectFogGeometryToScreen,
} from '../CloudFogCanvasUtils';

describe('CloudFogCanvasUtils', () => {
  it('should project fog polygons to screen coordinates', () => {
    const geometry: FogGeometry = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { opacity: 1, type: 'fog' },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-122.5, 37.7],
              [-122.4, 37.7],
              [-122.4, 37.8],
              [-122.5, 37.8],
              [-122.5, 37.7],
            ]],
          },
        },
      ],
    };

    const projected = projectFogGeometryToScreen(geometry, ([lng, lat]) => ({
      x: lng * 10,
      y: lat * -10,
    }));

    expect(projected).toHaveLength(1);
    expect(projected[0].rings[0][0]).toEqual({ x: -1225, y: -377 });
    expect(projected[0].rings[0]).toHaveLength(5);
  });

  it('should generate deterministic world-anchored cloud puffs', () => {
    const bounds = {
      north: 37.9,
      south: 37.7,
      east: -122.3,
      west: -122.6,
    };

    const first = createWorldAnchoredCloudPuffs(bounds, 10, 0.75, 0);
    const second = createWorldAnchoredCloudPuffs(bounds, 10, 0.75, 0);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(MAX_CLOUD_PUFFS);
  });

  it('should cap dense puff generation to the supported maximum', () => {
    const puffs = createWorldAnchoredCloudPuffs({
      north: 42,
      south: 32,
      east: -110,
      west: -124,
    }, 8, 1, 0);

    expect(puffs).toHaveLength(MAX_CLOUD_PUFFS);
  });

  it('should keep cloud ids stable across a small pan', () => {
    const initial = createWorldAnchoredCloudPuffs({
      north: 37.9,
      south: 37.7,
      east: -122.3,
      west: -122.6,
    }, 10, 0.75, 0);
    const panned = createWorldAnchoredCloudPuffs({
      north: 37.9,
      south: 37.7,
      east: -122.2,
      west: -122.5,
    }, 10, 0.75, 0);

    const initialIds = new Set(initial.map(puff => puff.id));
    const overlappingIds = panned.filter(puff => initialIds.has(puff.id));

    expect(overlappingIds.length).toBeGreaterThan(0);
  });
});
