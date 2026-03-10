import { calculateDistance } from './spatial';

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

export interface TileBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const clampLatitudeForMercator = (lat: number) => clamp(lat, -85.05112878, 85.05112878);

export const lonLatToTileXY = (lng: number, lat: number, z: number): { x: number; y: number } => {
  const n = Math.pow(2, z);
  const latClamped = clampLatitudeForMercator(lat);
  const latRad = (latClamped * Math.PI) / 180;

  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );

  return {
    x: clamp(x, 0, n - 1),
    y: clamp(y, 0, n - 1),
  };
};

export const tileXYToBounds = (x: number, y: number, z: number): TileBounds => {
  const n = Math.pow(2, z);

  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;

  const northRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const southRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));

  const north = (northRad * 180) / Math.PI;
  const south = (southRad * 180) / Math.PI;

  return { north, south, east, west };
};

export const tileCenter = (x: number, y: number, z: number): { lat: number; lng: number } => {
  const bounds = tileXYToBounds(x, y, z);
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };
};

export const tileRadiusMeters = (x: number, y: number, z: number): number => {
  const bounds = tileXYToBounds(x, y, z);
  const center = tileCenter(x, y, z);

  // Half-diagonal in meters (approx) so a circular mask covers the tile.
  const cornerDistance = calculateDistance(center.lat, center.lng, bounds.north, bounds.east);
  return cornerDistance;
};

export const tilesForCircle = (lat: number, lng: number, radiusMeters: number, z: number): TileCoord[] => {
  // Approximate meters -> degrees conversion (good enough for a tile cover set).
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos((lat * Math.PI) / 180);

  const latDelta = radiusMeters / metersPerDegreeLat;
  const lngDelta = radiusMeters / (metersPerDegreeLng || metersPerDegreeLat);

  const north = clampLatitudeForMercator(lat + latDelta);
  const south = clampLatitudeForMercator(lat - latDelta);
  const east = lng + lngDelta;
  const west = lng - lngDelta;

  const nw = lonLatToTileXY(west, north, z);
  const se = lonLatToTileXY(east, south, z);

  const xMin = Math.min(nw.x, se.x);
  const xMax = Math.max(nw.x, se.x);
  const yMin = Math.min(nw.y, se.y);
  const yMax = Math.max(nw.y, se.y);

  const tiles: TileCoord[] = [];
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      tiles.push({ z, x, y });
    }
  }

  return tiles;
};

