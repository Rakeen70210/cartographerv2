import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapStyleId, MapViewport } from '../types/map';
import { MAPBOX_STYLE_URLS } from '../config/mapbox';

const VIEWPORT_STORAGE_KEY = '@cartographer/viewport';
const EXPLORATION_STORAGE_KEY = '@cartographer/exploration';
const MAP_STYLE_STORAGE_KEY = '@cartographer/map-style';

const VALID_STYLE_IDS = new Set<string>(Object.keys(MAPBOX_STYLE_URLS));

interface PersistedMapStyle {
  id: MapStyleId;
  styleURL: string;
}

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
    await AsyncStorage.multiRemove([VIEWPORT_STORAGE_KEY, EXPLORATION_STORAGE_KEY, MAP_STYLE_STORAGE_KEY]);
  } catch (error) {
    console.error('Failed to clear persisted data:', error);
  }
};

export const saveMapStyle = async (style: PersistedMapStyle): Promise<void> => {
  try {
    await AsyncStorage.setItem(MAP_STYLE_STORAGE_KEY, JSON.stringify(style));
  } catch (error) {
    console.error('Failed to save map style:', error);
  }
};

export const loadMapStyle = async (): Promise<PersistedMapStyle | null> => {
  try {
    const styleData = await AsyncStorage.getItem(MAP_STYLE_STORAGE_KEY);
    if (styleData) {
      const parsed = JSON.parse(styleData);
      if (parsed && typeof parsed.id === 'string' && VALID_STYLE_IDS.has(parsed.id)) {
        const id = parsed.id as MapStyleId;
        return { id, styleURL: MAPBOX_STYLE_URLS[id] };
      }
      console.warn('Invalid persisted map style, falling back to default:', parsed);
      return null;
    }
    return null;
  } catch (error) {
    console.error('Failed to load map style:', error);
    return null;
  }
};
