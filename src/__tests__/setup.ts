/**
 * Test Setup Configuration
 * Sets up mocks and test environment for all tests
 */

import '@testing-library/jest-native/extend-expect';

// Mock Expo modules
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  Accuracy: {
    Highest: 1,
    High: 2,
    Balanced: 3,
    Low: 4,
    Lowest: 5,
  },
  LocationAccuracy: {
    Highest: 1,
    High: 2,
    Balanced: 3,
    Low: 4,
    Lowest: 5,
  },
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(() => Promise.resolve({
    execAsync: jest.fn(),
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
    withTransactionAsync: jest.fn(),
    closeAsync: jest.fn(),
  })),
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(),
  unregisterTaskAsync: jest.fn(),
  getRegisteredTasksAsync: jest.fn(),
}));

jest.mock('@rnmapbox/maps', () => ({
  MapView: 'MapView',
  Camera: 'Camera',
  UserLocation: 'UserLocation',
  ShapeSource: 'ShapeSource',
  FillLayer: 'FillLayer',
  LineLayer: 'LineLayer',
  SymbolLayer: 'SymbolLayer',
  offlineManager: {
    createPack: jest.fn(),
    getPacks: jest.fn(),
    deletePack: jest.fn(),
    getPackStatus: jest.fn(),
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/documents/',
  cacheDirectory: '/mock/cache/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  moveAsync: jest.fn(),
  copyAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  getInfoAsync: jest.fn(),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(),
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
}));

// Mock React Native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  Alert: {
    alert: jest.fn(),
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  Animated: {
    Value: jest.fn(() => ({
      setValue: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    })),
    timing: jest.fn(() => ({
      start: jest.fn(),
    })),
    spring: jest.fn(() => ({
      start: jest.fn(),
    })),
    View: 'Animated.View',
  },
  PanResponder: {
    create: jest.fn(),
  },
}));

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: process.env.NODE_ENV === 'test' ? jest.fn() : console.log,
  warn: console.warn,
  error: console.error,
};

// Mock timers for consistent testing
beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// Global test timeout
jest.setTimeout(30000); // 30 seconds for E2E tests