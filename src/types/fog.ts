import { ExploredArea } from '../database/services';

export interface FogOverlayProps {
  exploredAreas: ExploredArea[];
  animationSpeed?: number;
  cloudDensity?: number;
  onFogCleared?: (area: GeographicArea) => void;
  visible?: boolean;
}

export interface FogGeometry {
  type: 'FeatureCollection';
  features: FogFeature[];
}

export interface FogFeature {
  type: 'Feature';
  properties: {
    opacity: number;
    type: 'fog' | 'cloud';
    animationState?: 'static' | 'dissipating' | 'cleared';
    clearingProgress?: number; // 0-1 for animation progress
    animationId?: string; // Reference to active animation
  };
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

export interface CloudLayer {
  id: string;
  opacity: number;
  animationState: 'static' | 'dissipating' | 'cleared';
  offsetX: number;
  offsetY: number;
  speed: number;
}

export interface GeographicArea {
  center: [number, number];
  radius: number;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface FogState {
  isVisible: boolean;
  opacity: number;
  animationInProgress: boolean;
  lastClearingAnimation: number;
  activeAnimations: string[]; // Track active animation IDs
  clearingAreas: GeographicArea[]; // Areas currently being cleared
}

export interface SpatialGrid {
  cellSize: number; // degrees (e.g., 0.01 = ~1km)
  cells: Map<string, GridCell>;
}

export interface GridCell {
  id: string; // "lat_lng" format
  bounds: BoundingBox;
  explored: boolean;
  exploredAt?: Date;
  fogOpacity: number; // 0-1, for gradual clearing
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}