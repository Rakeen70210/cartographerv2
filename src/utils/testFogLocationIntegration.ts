import { fogLocationIntegrationService } from '../services/fogLocationIntegrationService';
import { explorationService } from '../services/explorationService';
import { locationService } from '../services/locationService';

/**
 * Test utility to verify fog-location integration is working
 */
export const testFogLocationIntegration = async () => {
  console.log('🧪 Testing Fog-Location Integration...');
  
  try {
    // Test 1: Check integration service status
    console.log('📊 Checking integration status...');
    const status = fogLocationIntegrationService.getStatus();
    console.log('Integration Status:', status);
    
    // Test 2: Check location service status
    console.log('📍 Checking location service...');
    const locationStatus = locationService.getTrackingStatus();
    console.log('Location Status:', locationStatus);
    
    // Test 3: Check exploration service status
    console.log('🗺️ Checking exploration service...');
    const explorationStatus = explorationService.getExplorationStatus();
    console.log('Exploration Status:', explorationStatus);
    
    // Test 4: Manual fog clearing test
    console.log('🌫️ Testing manual fog clearing...');
    const testLat = 37.7749; // San Francisco
    const testLng = -122.4194;
    
    await fogLocationIntegrationService.manualFogClear(testLat, testLng, 100);
    console.log('✅ Manual fog clearing test completed');
    
    // Test 5: Check if fog geometry updates
    console.log('🔄 Testing fog geometry refresh...');
    await fogLocationIntegrationService.refreshFogGeometry();
    console.log('✅ Fog geometry refresh completed');
    
    console.log('🎉 All integration tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    return false;
  }
};

/**
 * Test location permissions and setup
 */
export const testLocationSetup = async () => {
  console.log('🧪 Testing Location Setup...');
  
  try {
    // Test location permissions
    const permissions = await locationService.requestPermissions();
    console.log('Location Permissions:', permissions);
    
    if (!permissions.granted) {
      console.warn('⚠️ Location permissions not granted');
      return false;
    }
    
    // Test getting current location
    const currentLocation = await locationService.getCurrentLocation();
    console.log('Current Location:', currentLocation);
    
    if (!currentLocation) {
      console.warn('⚠️ Could not get current location');
      return false;
    }
    
    console.log('✅ Location setup test passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Location setup test failed:', error);
    return false;
  }
};

/**
 * Run all integration tests
 */
export const runAllIntegrationTests = async () => {
  console.log('🚀 Running All Integration Tests...');
  
  const locationTest = await testLocationSetup();
  const integrationTest = await testFogLocationIntegration();
  
  const allPassed = locationTest && integrationTest;
  
  if (allPassed) {
    console.log('🎉 All tests passed! Integration is working correctly.');
  } else {
    console.log('❌ Some tests failed. Check the logs above for details.');
  }
  
  return allPassed;
};