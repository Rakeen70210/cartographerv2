import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapViewport } from '../types/map';

const VIEWPORT_STORAGE_KEY = '@cartographer/viewport';
const EXPLORATION_STORAGE_KEY = '@cartographer/exploration';

// Viewport persistence
export const saveViewport = async (viewport: MapViewport): Promise<void> => {
  try {
    const viewportData = JSON.stringify(viewport);
    await AsyncStorage.setItem(VIEWPORT_STORAGE_KEY, viewportData);
  } catch (error) {
    console.error('Failed to save viewport:', error);
  }
};

export const loadViewport = async (): Promise<MapViewport | null> => {
  try {
    const viewportData = await AsyncStorage.getItem(VIEWPORT_STORAGE_KEY);
    if (viewportData) {
      return JSON.parse(viewportData);
    }
    return null;
  } catch (error) {
    console.error('Failed to load viewport:', error);
    return null;
  }
};

// Exploration data persistence (lightweight cache)
export const saveExplorationCache = async (data: any): Promise<void> => {
  try {
    const cacheData = JSON.stringify(data);
    await AsyncStorage.setItem(EXPLORATION_STORAGE_KEY, cacheData);
  } catch (error) {
    console.error('Failed to save exploration cache:', error);
  }
};

export const loadExplorationCache = async (): Promise<any | null> => {
  try {
    const cacheData = await AsyncStorage.getItem(EXPLORATION_STORAGE_KEY);
    if (cacheData) {
      return JSON.parse(cacheData);
    }
    return null;
  } catch (error) {
    console.error('Failed to load exploration cache:', error);
    return null;
  }
};

// Clear all persisted data
export const clearPersistedData = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([VIEWPORT_STORAGE_KEY, EXPLORATION_STORAGE_KEY]);
  } catch (error) {
    console.error('Failed to clear persisted data:', error);
  }
};