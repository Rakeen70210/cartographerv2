import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationUpdate } from '../types';

const BACKGROUND_LOCATION_TASK = 'background-location-task';
const BACKGROUND_LOCATIONS_KEY = 'background_locations';

// Background location task handler
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    
    try {
      // Process each location update
      const locationUpdates: LocationUpdate[] = locations.map((location) => ({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        timestamp: location.timestamp || Date.now(),
      }));

      // Store background locations for processing when app becomes active
      const existingLocations = await getStoredBackgroundLocations();
      const allLocations = [...existingLocations, ...locationUpdates];
      
      // Keep only the last 100 background locations to prevent storage bloat
      const recentLocations = allLocations.slice(-100);
      
      await AsyncStorage.setItem(BACKGROUND_LOCATIONS_KEY, JSON.stringify(recentLocations));
      
      console.log(`Stored ${locationUpdates.length} background location updates`);
      
    } catch (processingError) {
      console.error('Error processing background locations:', processingError);
    }
  }
});

// Helper function to get stored background locations
async function getStoredBackgroundLocations(): Promise<LocationUpdate[]> {
  try {
    const stored = await AsyncStorage.getItem(BACKGROUND_LOCATIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error getting stored background locations:', error);
    return [];
  }
}

// Function to retrieve and clear background locations (called when app becomes active)
export async function processBackgroundLocations(): Promise<LocationUpdate[]> {
  try {
    const locations = await getStoredBackgroundLocations();
    
    if (locations.length > 0) {
      // Clear stored locations after retrieving
      await AsyncStorage.removeItem(BACKGROUND_LOCATIONS_KEY);
      console.log(`Retrieved ${locations.length} background locations for processing`);
    }
    
    return locations;
  } catch (error) {
    console.error('Error processing background locations:', error);
    return [];
  }
}

export { BACKGROUND_LOCATION_TASK };