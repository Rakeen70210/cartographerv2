/**
 * Test Setup Configuration
 * Sets up mocks and test environment for all tests
 */

import '@testing-library/jest-native/extend-expect';

// Mock Expo modules
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({
    status: 'granted',
    canAskAgain: true
  })),
  requestBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({
    status: 'granted',
    canAskAgain: true
  })),
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({
    status: 'granted',
    canAskAgain: true
  })),
  getBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({
    status: 'granted',
    canAskAgain: true
  })),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
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

jest.mock('react-native-device-info', () => ({
  getDeviceId: jest.fn(() => Promise.resolve('test-device-id')),
  getSystemName: jest.fn(() => 'iOS'),
  getSystemVersion: jest.fn(() => '15.0'),
  getModel: jest.fn(() => 'iPhone'),
  getBrand: jest.fn(() => 'Apple'),
  getDeviceType: jest.fn(() => 'Handset'),
  getTotalMemory: jest.fn(() => Promise.resolve(4000000000)),
  getUsedMemory: jest.fn(() => Promise.resolve(2000000000)),
  isEmulator: jest.fn(() => Promise.resolve(false)),
  hasSystemFeature: jest.fn(() => Promise.resolve(true)),
  default: {
    getDeviceId: jest.fn(() => Promise.resolve('test-device-id')),
    getSystemName: jest.fn(() => 'iOS'),
    getSystemVersion: jest.fn(() => '15.0'),
    getModel: jest.fn(() => 'iPhone'),
    getBrand: jest.fn(() => 'Apple'),
    getDeviceType: jest.fn(() => 'Handset'),
    getTotalMemory: jest.fn(() => Promise.resolve(4000000000)),
    getUsedMemory: jest.fn(() => Promise.resolve(2000000000)),
    isEmulator: jest.fn(() => Promise.resolve(false)),
    hasSystemFeature: jest.fn(() => Promise.resolve(true)),
  },
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

// Mock database service
const mockExploredAreas: any[] = [];
jest.mock('../database/services', () => ({
  getDatabaseService: jest.fn(() => ({
    initialize: jest.fn(() => Promise.resolve()),
    close: jest.fn(() => Promise.resolve()),
    reinitialize: jest.fn(() => Promise.resolve(true)),
    createExploredArea: jest.fn((area) => {
      mockExploredAreas.push(area);
      return Promise.resolve(1);
    }),
    addExploredArea: jest.fn((area) => {
      mockExploredAreas.push(area);
      return Promise.resolve();
    }),
    getExploredAreas: jest.fn(() => Promise.resolve([...mockExploredAreas])),
    getAllExploredAreas: jest.fn(() => Promise.resolve([...mockExploredAreas])),
    getUserStats: jest.fn(() => Promise.resolve({ 
      areasExplored: mockExploredAreas.length,
      totalDistance: 100,
      timeSpent: 300,
      total_areas_explored: mockExploredAreas.length
    })),
    updateUserStats: jest.fn(() => Promise.resolve()),
    getAchievements: jest.fn(() => Promise.resolve([])),
    getAllAchievements: jest.fn(() => Promise.resolve([])),
    createAchievement: jest.fn(() => Promise.resolve(1)),
    addAchievement: jest.fn(() => Promise.resolve()),
    clearDatabase: jest.fn(() => Promise.resolve()),
    exportData: jest.fn(() => Promise.resolve({ exploredAreas: [], userStats: null, achievements: [] })),
    importData: jest.fn(() => Promise.resolve()),
    validateConnection: jest.fn(() => Promise.resolve(true)),
    withTransaction: jest.fn((callback) => callback()),
    checkIntegrity: jest.fn(() => Promise.resolve({ isValid: true, issues: [] })),
    repairDatabase: jest.fn(() => Promise.resolve(true)),
    runMigrations: jest.fn(() => Promise.resolve(true)),
    attemptRecovery: jest.fn(() => Promise.resolve({ success: true })),
    findNearbyExploredAreas: jest.fn(() => Promise.resolve([])),
    performIntegrityCheck: jest.fn(() => Promise.resolve({ isValid: true, issues: [] })),
  })),
  DatabaseService: jest.fn(() => ({
    initialize: jest.fn(() => Promise.resolve()),
    close: jest.fn(() => Promise.resolve()),
    reinitialize: jest.fn(() => Promise.resolve(true)),
    createExploredArea: jest.fn((area) => {
      mockExploredAreas.push(area);
      return Promise.resolve(1);
    }),
    addExploredArea: jest.fn((area) => {
      mockExploredAreas.push(area);
      return Promise.resolve();
    }),
    getExploredAreas: jest.fn(() => Promise.resolve([...mockExploredAreas])),
    getAllExploredAreas: jest.fn(() => Promise.resolve([...mockExploredAreas])),
    getUserStats: jest.fn(() => Promise.resolve({ 
      areasExplored: mockExploredAreas.length,
      totalDistance: 100,
      timeSpent: 300,
      total_areas_explored: mockExploredAreas.length
    })),
    updateUserStats: jest.fn(() => Promise.resolve()),
    getAchievements: jest.fn(() => Promise.resolve([])),
    getAllAchievements: jest.fn(() => Promise.resolve([])),
    createAchievement: jest.fn(() => Promise.resolve(1)),
    addAchievement: jest.fn(() => Promise.resolve()),
    clearDatabase: jest.fn(() => Promise.resolve()),
    exportData: jest.fn(() => Promise.resolve({ exploredAreas: [], userStats: null, achievements: [] })),
    importData: jest.fn(() => Promise.resolve()),
    validateConnection: jest.fn(() => Promise.resolve(true)),
    withTransaction: jest.fn((callback) => callback()),
    checkIntegrity: jest.fn(() => Promise.resolve({ isValid: true, issues: [] })),
    repairDatabase: jest.fn(() => Promise.resolve(true)),
    runMigrations: jest.fn(() => Promise.resolve(true)),
    attemptRecovery: jest.fn(() => Promise.resolve({ success: true })),
    findNearbyExploredAreas: jest.fn(() => Promise.resolve([])),
    performIntegrityCheck: jest.fn(() => Promise.resolve({ isValid: true, issues: [] })),
  })),
}));

// Mock Mapbox Offline Service
const mockMapboxOfflineService = {
  loadOfflineRegions: jest.fn(() => Promise.resolve([])),
  hasOfflineData: jest.fn(() => true),
};

jest.mock('../services/mapboxOfflineService', () => ({
  getInstance: jest.fn(() => mockMapboxOfflineService),
  getMapboxOfflineService: jest.fn(() => mockMapboxOfflineService),
}));

// Don't mock explorationService - let tests use actual implementation

// Mock offline service
const mockOfflineService = {
  isOffline: jest.fn(() => false),
  isOnline: jest.fn(() => true),
  getNetworkState: jest.fn(() => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
  goOffline: jest.fn(() => {
    mockOfflineService.isOffline.mockReturnValue(true);
    mockOfflineService.isOnline.mockReturnValue(false);
  }),
  goOnline: jest.fn(() => {
    mockOfflineService.isOffline.mockReturnValue(false);
    mockOfflineService.isOnline.mockReturnValue(true);
  }),
  syncWhenOnline: jest.fn(() => Promise.resolve()),
  hasOfflineData: jest.fn(() => true),
  addNetworkListener: jest.fn(() => jest.fn()),
};

jest.mock('../services/offlineService', () => ({
  getInstance: jest.fn(() => mockOfflineService),
  getOfflineService: jest.fn(() => mockOfflineService),
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

// Mock spatial utilities
jest.mock('../utils/spatial', () => ({
  calculateDistance: jest.fn((lat1, lon1, lat2, lon2) => {
    // Simple approximation for testing
    const dlat = lat2 - lat1;
    const dlon = lon2 - lon1;
    return Math.sqrt(dlat * dlat + dlon * dlon) * 111000; // rough meters conversion
  }),
  createLocationKey: jest.fn((lat, lng) => `${lat.toFixed(6)},${lng.toFixed(6)}`),
  calculateCircleOverlap: jest.fn(() => 0.5),
}));

// Mock error recovery service
const mockErrorRecoveryService = {
  handleLocationError: jest.fn(() => Promise.resolve(true)),
  handleDatabaseError: jest.fn(() => Promise.resolve(true)),
  handleNetworkError: jest.fn(() => Promise.resolve(true)),
  handleMapboxError: jest.fn(() => Promise.resolve(true)),
  handleServiceError: jest.fn(() => Promise.resolve(true)),
  checkStorageSpace: jest.fn(() => Promise.resolve({
    totalSpaceMB: 1000,
    availableSpaceMB: 500,
    usedSpaceMB: 500,
    isLowSpace: false,
  })),
  getErrorStats: jest.fn(() => ({
    totalErrors: 0,
    errorsByService: {},
    recentErrors: [],
    recoveryRate: 1,
  })),
  clearErrorHistory: jest.fn(),
  reset: jest.fn(),
};

jest.mock('../services/errorRecoveryService', () => ({
  getErrorRecoveryService: jest.fn(() => mockErrorRecoveryService),
  errorRecoveryService: mockErrorRecoveryService,
}));

// Mock fog service
const mockFogService = {
  updateFogGeometry: jest.fn(() => Promise.resolve()),
  clearFog: jest.fn(() => Promise.resolve()),
  getFogData: jest.fn(() => Promise.resolve({})),
  initialize: jest.fn(() => Promise.resolve()),
  generateFogGeometry: jest.fn(() => ({
    type: 'FeatureCollection',
    features: []
  })),
  getGeographicArea: jest.fn((lat, lng, radius) => ({
    center: [lng, lat],
    radius,
    bounds: {
      north: lat + 0.001,
      south: lat - 0.001,
      east: lng + 0.001,
      west: lng - 0.001
    }
  })),
  isLocationExplored: jest.fn(() => false),
  getFogOpacityAtLocation: jest.fn(() => 1.0),
  calculateLevelOfDetail: jest.fn((zoom: number) => {
    if (zoom <= 3) return 0.2;
    if (zoom <= 6) return 0.4;
    if (zoom <= 10) return 0.6;
    if (zoom <= 17) return 0.8;
    return 1.0;
  }),
};

jest.mock('../services/fogService', () => ({
  FogService: jest.fn(() => mockFogService),
  getFogService: jest.fn(() => mockFogService),
  fogService: mockFogService,
}));

// Mock fog animation service
const mockFogAnimationService = {
  startFogClearingAnimation: jest.fn(() => 'animation_id_123'),
  cancelAnimation: jest.fn(),
  cancelAllAnimations: jest.fn(),
  getActiveAnimations: jest.fn(() => []),
  setAnimationUpdateCallback: jest.fn(),
  hasActiveAnimations: jest.fn(() => false),
  getPerformanceMode: jest.fn(() => false),
  setPerformanceMode: jest.fn(),
  updateConfig: jest.fn(),
};

jest.mock('../services/fogAnimationService', () => ({
  FogAnimationService: jest.fn(() => mockFogAnimationService),
  getFogAnimationService: jest.fn(() => mockFogAnimationService),
}));

// Mock exploration service
const mockExplorationService = {
  processManualLocation: jest.fn((lat, lng, accuracy = 10) => Promise.resolve({
    isNewArea: true,
    exploredArea: {
      id: 1,
      latitude: lat,
      longitude: lng,
      radius: 100,
      accuracy: accuracy,
      explored_at: new Date().toISOString(),
    },
    newAreaExplored: true,
    warnings: [],
  })),
  getAllExploredAreas: jest.fn(() => Promise.resolve([])),
  startExploration: jest.fn(() => Promise.resolve(true)),
  stopExploration: jest.fn(() => Promise.resolve()),
  getExplorationStatus: jest.fn(() => Promise.resolve({ isActive: false })),
  addExplorationListener: jest.fn(),
};

jest.mock('../services/explorationService', () => ({
  ExplorationService: jest.fn(() => mockExplorationService),
  explorationService: mockExplorationService,
}));

// Mock performance monitor service
const mockPerformanceMonitorService = {
  initialize: jest.fn(() => Promise.resolve()),
  forceMemoryCleanup: jest.fn(() => Promise.resolve()),
  getLODSettings: jest.fn(() => ({
    zoomLevel: 10,
    fogCellSize: 0.01,
    maxFogFeatures: 1000,
    cloudComplexity: 0.7,
    particleQuality: 'medium',
    enableAnimations: true,
  })),
  recordFrame: jest.fn(),
  getAverageFrameTime: jest.fn(() => 16.67),
  isPerformanceModeEnabled: jest.fn(() => false),
  enablePerformanceMode: jest.fn(),
  disablePerformanceMode: jest.fn(),
};

jest.mock('../services/performanceMonitorService', () => ({
  PerformanceMonitorService: jest.fn(() => mockPerformanceMonitorService),
  getPerformanceMonitorService: jest.fn(() => mockPerformanceMonitorService),
}));

// Mock memory management service
const mockMemoryManagementService = {
  initialize: jest.fn(() => Promise.resolve()),
  getMemoryUsage: jest.fn(() => ({ used: 50, total: 100 })),
  getStats: jest.fn(() => ({ memoryUsage: 50, cacheSize: 10 })),
  cleanupUnusedResources: jest.fn(),
  isMemoryLow: jest.fn(() => false),
  forceGarbageCollection: jest.fn(() => Promise.resolve()),
  clearCaches: jest.fn(() => Promise.resolve()),
};

jest.mock('../services/memoryManagementService', () => ({
  MemoryManagementService: jest.fn(() => mockMemoryManagementService),
  getMemoryManagementService: jest.fn(() => mockMemoryManagementService),
}));

// Mock device capability service
const mockDeviceCapabilityService = {
  initialize: jest.fn(() => Promise.resolve()),
  getPerformanceMetrics: jest.fn(() => Promise.resolve({
    memory: { used: 50, total: 100 },
    cpu: { usage: 30 },
    gpu: { usage: 25 }
  })),
  isLowEndDevice: jest.fn(() => false),
  getDeviceClass: jest.fn(() => 'high'),
};

jest.mock('../services/deviceCapabilityService', () => ({
  DeviceCapabilityService: jest.fn(() => mockDeviceCapabilityService),
  getDeviceCapabilityService: jest.fn(() => mockDeviceCapabilityService),
}));

// Mock WebGL context for shader tests
const mockWebGLContext = {
  VERTEX_SHADER: 35633,
  FRAGMENT_SHADER: 35632,
  COMPILE_STATUS: 35713,
  LINK_STATUS: 35714,
  
  createShader: jest.fn(() => ({})),
  shaderSource: jest.fn(),
  compileShader: jest.fn(),
  getShaderParameter: jest.fn(() => true),
  getShaderInfoLog: jest.fn(() => ''),
  createProgram: jest.fn(() => ({})),
  attachShader: jest.fn(),
  linkProgram: jest.fn(),
  getProgramParameter: jest.fn(() => true),
  getProgramInfoLog: jest.fn(() => ''),
  useProgram: jest.fn(),
  deleteShader: jest.fn(),
  deleteProgram: jest.fn(),
};

// Mock WebGL canvas context
if (typeof global.HTMLCanvasElement !== 'undefined') {
  global.HTMLCanvasElement.prototype.getContext = jest.fn((contextType) => {
    if (contextType === 'webgl' || contextType === 'experimental-webgl') {
      return mockWebGLContext as any;
    }
    return null;
  }) as any;
}

// Mock canvas for shader tests  
if (typeof global.document !== 'undefined') {
  global.document.createElement = jest.fn((tagName) => {
    if (tagName === 'canvas') {
      return {
        getContext: jest.fn(() => mockWebGLContext),
        width: 256,
        height: 256,
      } as any;
    }
    return {} as any;
  }) as any;
}

// Mock React Native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 667 })),
  },
  Alert: {
    alert: jest.fn(),
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  Linking: {
    openURL: jest.fn(() => Promise.resolve()),
    canOpenURL: jest.fn(() => Promise.resolve(true)),
  },
  StatusBar: {
    setBarStyle: jest.fn(),
    setBackgroundColor: jest.fn(),
  },
  Easing: {
    out: jest.fn((fn) => fn),
    in: jest.fn((fn) => fn),
    inOut: jest.fn((fn) => fn),
    linear: jest.fn(),
    ease: jest.fn(),
    quad: jest.fn(),
    cubic: jest.fn(),
    poly: jest.fn(),
    sin: jest.fn(),
    circle: jest.fn(),
    exp: jest.fn(),
    elastic: jest.fn(),
    back: jest.fn(),
    bounce: jest.fn(),
    bezier: jest.fn(),
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
  // Clean up any fake timers if they were used
  jest.clearAllTimers();
  jest.useRealTimers();
});

// Global test timeout
jest.setTimeout(30000); // 30 seconds for E2E tests
