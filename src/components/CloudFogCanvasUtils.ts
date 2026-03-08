import { BoundingBox, FogGeometry } from '../types/fog';

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ProjectedFogPolygon {
  rings: ScreenPoint[][];
}

export interface CloudPuffDescriptor {
  id: string;
  center: [number, number];
  radiusLng: number;
  radiusLat: number;
  seed: number;
  opacity: number;
  stretchX: number;
  stretchY: number;
  rotation: number;
  highlight: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const fract = (value: number): number => value - Math.floor(value);

const hash2D = (x: number, y: number): number =>
  fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);

const hash3D = (x: number, y: number, z: number): number =>
  fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123);

const expandBounds = (bounds: BoundingBox, paddingLng: number, paddingLat: number): BoundingBox => ({
  north: bounds.north + paddingLat,
  south: bounds.south - paddingLat,
  east: bounds.east + paddingLng,
  west: bounds.west - paddingLng,
});

export const projectFogGeometryToScreen = (
  fogGeometry: FogGeometry,
  project: (coordinate: [number, number]) => ScreenPoint,
): ProjectedFogPolygon[] => {
  return fogGeometry.features
    .filter(feature => feature.geometry.type === 'Polygon')
    .map(feature => ({
      rings: feature.geometry.coordinates
        .map(ring =>
          ring
            .filter(point => Array.isArray(point) && point.length >= 2)
            .map(([lng, lat]) => project([lng, lat] as [number, number]))
        )
        .filter(ring => ring.length >= 3),
    }))
    .filter(polygon => polygon.rings.length > 0);
};

export const createWorldAnchoredCloudPuffs = (
  bounds: BoundingBox,
  zoomLevel: number,
  density: number,
  timeSeconds: number,
): CloudPuffDescriptor[] => {
  const normalizedDensity = clamp(density, 0, 1);
  const gridSizeLng = clamp(4.8 / Math.pow(2, zoomLevel / 3.45), 0.18, 8);
  const gridSizeLat = gridSizeLng * 0.86;
  const paddedBounds = expandBounds(bounds, gridSizeLng * 1.75, gridSizeLat * 1.75);
  const threshold = 0.46 - normalizedDensity * 0.16;
  const puffs: CloudPuffDescriptor[] = [];

  const startColumn = Math.floor(paddedBounds.west / gridSizeLng);
  const endColumn = Math.ceil(paddedBounds.east / gridSizeLng);
  const startRow = Math.floor(paddedBounds.south / gridSizeLat);
  const endRow = Math.ceil(paddedBounds.north / gridSizeLat);

  for (let column = startColumn; column <= endColumn; column += 1) {
    for (let row = startRow; row <= endRow; row += 1) {
      const coverageNoise = hash2D(column, row);
      if (coverageNoise < threshold) {
        continue;
      }

      const phase = hash3D(column, row, 1);
      const jitterLng = (hash3D(column, row, 2) - 0.5) * gridSizeLng * 0.7;
      const jitterLat = (hash3D(column, row, 3) - 0.5) * gridSizeLat * 0.65;
      const driftLng = Math.sin(timeSeconds * 0.012 + phase * Math.PI * 2) * gridSizeLng * 0.045;
      const driftLat = Math.cos(timeSeconds * 0.01 + phase * Math.PI * 2) * gridSizeLat * 0.035;
      const centerLng = (column + 0.5) * gridSizeLng + jitterLng + driftLng;
      const centerLat = (row + 0.5) * gridSizeLat + jitterLat + driftLat;

      if (
        centerLng < paddedBounds.west ||
        centerLng > paddedBounds.east ||
        centerLat < paddedBounds.south ||
        centerLat > paddedBounds.north
      ) {
        continue;
      }

      const sizeNoise = hash3D(column, row, 4);
      const opacityNoise = hash3D(column, row, 5);

      puffs.push({
        id: `${column}:${row}`,
        center: [centerLng, centerLat],
        radiusLng: gridSizeLng * (0.9 + sizeNoise * 1.25),
        radiusLat: gridSizeLat * (0.8 + hash3D(column, row, 6) * 1.05),
        seed: hash3D(column, row, 11),
        opacity: 0.72 + opacityNoise * 0.22,
        stretchX: 1.3 + hash3D(column, row, 7) * 1.25,
        stretchY: 0.82 + hash3D(column, row, 8) * 0.68,
        rotation: (hash3D(column, row, 9) - 0.5) * 0.32,
        highlight: 0.2 + hash3D(column, row, 10) * 0.15,
      });
    }
  }

  return puffs;
};
