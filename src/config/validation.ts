import { MAPBOX_CONFIG, validateMapboxConfig } from './mapbox';

/**
 * Validates all app configuration on startup
 * Logs warnings for missing or invalid configuration
 */
export const validateAppConfiguration = (): boolean => {
  console.log('🔧 Validating app configuration...');
  
  let isValid = true;
  
  // Validate Mapbox configuration
  if (!validateMapboxConfig()) {
    console.error('❌ Mapbox configuration is invalid');
    console.log('📝 To fix this:');
    console.log('   1. Copy .env.example to .env');
    console.log('   2. Get your tokens from https://account.mapbox.com/access-tokens/');
    console.log('   3. Replace the placeholder values in .env');
    isValid = false;
  } else {
    console.log('✅ Mapbox configuration is valid');
  }
  
  // Log current configuration (without exposing full tokens)
  console.log('📋 Current configuration:');
  console.log(`   - Access Token: ${MAPBOX_CONFIG.ACCESS_TOKEN ? `${MAPBOX_CONFIG.ACCESS_TOKEN.substring(0, 10)}...` : 'Not set'}`);
  console.log(`   - Default Style: ${MAPBOX_CONFIG.DEFAULT_STYLE}`);
  console.log(`   - Default Zoom: ${MAPBOX_CONFIG.DEFAULT_ZOOM}`);
  
  return isValid;
};

/**
 * Environment-specific configuration checks
 */
export const getEnvironmentInfo = () => {
  return {
    isDevelopment: __DEV__,
    platform: require('react-native').Platform.OS,
    hasMapboxToken: !!MAPBOX_CONFIG.ACCESS_TOKEN,
    tokenFormat: MAPBOX_CONFIG.ACCESS_TOKEN?.startsWith('pk.') ? 'valid' : 'invalid'
  };
};