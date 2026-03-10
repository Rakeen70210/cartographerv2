// Mapbox configuration
// Access token is loaded from environment variables

import { MapStyleId, MapStyleOption } from '../types/map';

export const MAPBOX_STYLE_URLS: Record<MapStyleId, string> = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
  light: 'mapbox://styles/mapbox/light-v11',
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
  satellite: 'mapbox://styles/mapbox/satellite-v9',
};

const MAP_STYLE_LABELS: Record<MapStyleId, string> = {
  streets: 'Streets',
  dark: 'Dark',
  light: 'Light',
  outdoors: 'Outdoors',
  satellite: 'Satellite',
};

export const MAP_STYLE_OPTIONS: MapStyleOption[] = (Object.keys(MAPBOX_STYLE_URLS) as MapStyleId[]).map(id => ({
  id,
  label: MAP_STYLE_LABELS[id],
  styleURL: MAPBOX_STYLE_URLS[id],
}));

export const MAPBOX_CONFIG = {
  // Mapbox access token from environment variables
  // Get one from https://account.mapbox.com/access-tokens/
  ACCESS_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '',

  // Default map settings
  DEFAULT_STYLE: MAPBOX_STYLE_URLS.streets, // Google Maps-like style
  DEFAULT_CENTER: [0, 0] as [number, number], // World center
  DEFAULT_ZOOM: 2,
  MIN_ZOOM: 0,
  MAX_ZOOM: 20,

  // Animation settings
  ANIMATION_DURATION: 1000,

  // UI settings
  COMPASS_ENABLED: true,
  SCALE_BAR_ENABLED: false,
  ATTRIBUTION_ENABLED: true,
  LOGO_ENABLED: true,
};

// Validate that access token is set
export const validateMapboxConfig = (): boolean => {
  if (!MAPBOX_CONFIG.ACCESS_TOKEN) {
    console.warn('Mapbox access token not configured. Please set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in your .env file');
    return false;
  }
  
  if (!MAPBOX_CONFIG.ACCESS_TOKEN.startsWith('pk.')) {
    console.warn('Invalid Mapbox access token format. Token should start with "pk."');
    return false;
  }
  
  return true;
};
