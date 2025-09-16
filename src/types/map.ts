// Map-related type definitions

export interface MapContainerProps {
  onLocationUpdate?: (location: [number, number]) => void;
  initialCenter?: [number, number];
  initialZoom?: number;
}

export interface MapContainerState {
  mapReady: boolean;
  userLocation: [number, number] | null;
}

export interface MapViewport {
  center: [number, number];
  zoom: number;
  bearing?: number;
  pitch?: number;
}

export interface MapGestureEvent {
  geometry: {
    coordinates: [number, number];
  };
  properties: {
    zoom: number;
    bearing: number;
    pitch: number;
  };
}

// Map configuration types
export interface MapboxConfig {
  ACCESS_TOKEN: string;
  DEFAULT_STYLE: string;
  DEFAULT_CENTER: [number, number];
  DEFAULT_ZOOM: number;
  ANIMATION_DURATION: number;
  COMPASS_ENABLED: boolean;
  SCALE_BAR_ENABLED: boolean;
  ATTRIBUTION_ENABLED: boolean;
  LOGO_ENABLED: boolean;
}