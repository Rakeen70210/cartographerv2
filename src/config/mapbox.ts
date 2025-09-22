// Mapbox configuration
// Access token is loaded from environment variables

export const MAPBOX_CONFIG = {
  // Mapbox access token from environment variables
  // Get one from https://account.mapbox.com/access-tokens/
  ACCESS_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '',
  
  // Default map settings
  DEFAULT_STYLE: 'mapbox://styles/mapbox/streets-v12', // Google Maps-like style
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