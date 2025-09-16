// Mapbox configuration
// In production, these should come from environment variables or secure storage

export const MAPBOX_CONFIG = {
  // Replace with your actual Mapbox access token
  // Get one from https://account.mapbox.com/access-tokens/
  ACCESS_TOKEN: 'YOUR_MAPBOX_ACCESS_TOKEN',
  
  // Default map settings
  DEFAULT_STYLE: 'mapbox://styles/mapbox/streets-v12', // Google Maps-like style
  DEFAULT_CENTER: [0, 0] as [number, number], // World center
  DEFAULT_ZOOM: 2,
  
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
  if (!MAPBOX_CONFIG.ACCESS_TOKEN || MAPBOX_CONFIG.ACCESS_TOKEN === 'YOUR_MAPBOX_ACCESS_TOKEN') {
    console.warn('Mapbox access token not configured. Please set a valid token in src/config/mapbox.ts');
    return false;
  }
  return true;
};