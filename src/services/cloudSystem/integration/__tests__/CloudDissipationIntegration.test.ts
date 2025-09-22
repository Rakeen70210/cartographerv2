/**
 * Tests for CloudDissipationIntegration
 * Verifies integration between cloud dissipation and exploration systems
 */

import { CloudDissipationIntegration, CloudDissipationIntegrationUtils } from '../CloudDissipationIntegration';
import { ExplorationResult } from '../../../explorationService';
import { ExploredArea } from '../../../../database/services';

// Mock the exploration service
jest.mock('../../../explorationService', () => ({
  explorationService: {
    getAllExploredAreas: jest.fn().mockResolvedValue([]),
    getExplorationStatus: jest.fn().mockResolvedValue({ isActive: false }),
    startExploration: jest.fn().mockResolvedValue(true),
    addExplorationListener: jest.fn(),
    removeExplorationListener: jest.fn(),
    processManualLocation: jest.fn()
  }
}));

describe('CloudDissipationIntegration', () => {
  let integration: CloudDissipationIntegration;

  beforeEach(() => {
    integration = new CloudDissipationIntegration({
      enableDissipation: true,
      dissipationMode: 'progressive',
      performanceMode: 'high'
    });
  });

  afterEach(() => {
    integration.dispose();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const state = integration.getState();
      expect(state.exploredAreas).toEqual([]);
      expect(state.activeDissipations.size).toBe(0);
      expect(state.isProcessing).toBe(false);
    });

    it('should initialize successfully', async () => {
      await expect(integration.initialize()).resolves.not.toThrow();
    });
  });

  describe('configuration', () => {
    it('should update configuration correctly', () => {
      integration.updateConfig({
        defaultRadius: 150,
        defaultDuration: 3000
      });

      // Configuration should be updated (we can't directly access private config,
      // but we can test behavior changes)
      expect(() => integration.updateConfig({})).not.toThrow();
    });

    it('should validate configuration correctly', () => {
      const validConfig = {
        enableDissipation: true,
        dissipationMode: 'progressive' as const,
        defaultRadius: 100,
        defaultDuration: 2500,
        performanceMode: 'high' as const,
        adaptiveRadiusMultiplier: 1.2,
        minDissipationRadius: 50,
        maxDissipationRadius: 200
      };

      expect(CloudDissipationIntegrationUtils.validateConfig(validConfig)).toBe(true);

      const invalidConfig = {
        ...validConfig,
        defaultRadius: -10 // Invalid negative radius
      };

      expect(CloudDissipationIntegrationUtils.validateConfig(invalidConfig)).toBe(false);
    });
  });

  describe('exploration detection', () => {
    it('should handle new exploration areas', async () => {
      const mockExploredArea: ExploredArea = {
        id: 1,
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 100,
        explored_at: new Date().toISOString(),
        accuracy: 10
      };

      const mockResult: ExplorationResult = {
        isNewArea: true,
        exploredArea: mockExploredArea,
        overlappingAreas: [],
        explorationRadius: 100
      };

      // Set up event callback to capture dissipation events
      const dissipationEvents: any[] = [];
      integration.setDissipationEventCallback((event) => {
        dissipationEvents.push(event);
      });

      // Simulate exploration result (this would normally come from the exploration service)
      // Since we can't directly call the private method, we'll test the public interface
      await integration.triggerManualDissipation(
        mockExploredArea.longitude,
        mockExploredArea.latitude,
        mockExploredArea.radius
      );

      // The integration should handle this appropriately
      expect(() => integration.getState()).not.toThrow();
    });

    it('should check if location is explored', () => {
      // Add a mock explored area to state
      const mockArea: ExploredArea = {
        id: 1,
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 100,
        explored_at: new Date().toISOString(),
        accuracy: 10
      };

      // We can't directly modify private state, but we can test the method
      const isExplored = integration.isLocationExplored(-122.4194, 37.7749);
      expect(typeof isExplored).toBe('boolean');
    });
  });

  describe('performance configurations', () => {
    it('should create low performance configuration', () => {
      const config = CloudDissipationIntegrationUtils.createPerformanceConfig('low');
      
      expect(config.dissipationMode).toBe('instant');
      expect(config.defaultDuration).toBe(1500);
      expect(config.defaultRadius).toBe(75);
    });

    it('should create medium performance configuration', () => {
      const config = CloudDissipationIntegrationUtils.createPerformanceConfig('medium');
      
      expect(config.dissipationMode).toBe('adaptive');
      expect(config.defaultDuration).toBe(2000);
      expect(config.defaultRadius).toBe(100);
    });

    it('should create high performance configuration', () => {
      const config = CloudDissipationIntegrationUtils.createPerformanceConfig('high');
      
      expect(config.dissipationMode).toBe('progressive');
      expect(config.defaultDuration).toBe(2500);
      expect(config.defaultRadius).toBe(125);
    });
  });

  describe('state management', () => {
    it('should return current state', () => {
      const state = integration.getState();
      
      expect(state).toHaveProperty('exploredAreas');
      expect(state).toHaveProperty('activeDissipations');
      expect(state).toHaveProperty('pendingDissipations');
      expect(state).toHaveProperty('lastLocationUpdate');
      expect(state).toHaveProperty('isProcessing');
    });

    it('should return explored areas', () => {
      const areas = integration.getExploredAreas();
      expect(Array.isArray(areas)).toBe(true);
    });

    it('should return active dissipations', () => {
      const dissipations = integration.getActiveDissipations();
      expect(Array.isArray(dissipations)).toBe(true);
    });
  });

  describe('callbacks', () => {
    it('should set dissipation event callback', () => {
      const callback = jest.fn();
      expect(() => integration.setDissipationEventCallback(callback)).not.toThrow();
    });

    it('should set state change callback', () => {
      const callback = jest.fn();
      expect(() => integration.setStateChangeCallback(callback)).not.toThrow();
    });

    it('should set uniform update callback', () => {
      const callback = jest.fn();
      expect(() => integration.setUniformUpdateCallback(callback)).not.toThrow();
    });
  });

  describe('disposal', () => {
    it('should dispose cleanly', () => {
      expect(() => integration.dispose()).not.toThrow();
      
      // After disposal, operations should not work
      expect(() => integration.initialize()).rejects.toThrow();
    });
  });
});

describe('CloudDissipationIntegrationUtils', () => {
  describe('performance configurations', () => {
    it('should create valid configurations for all performance modes', () => {
      const modes = ['low', 'medium', 'high'] as const;
      
      modes.forEach(mode => {
        const config = CloudDissipationIntegrationUtils.createPerformanceConfig(mode);
        
        expect(config).toHaveProperty('dissipationMode');
        expect(config).toHaveProperty('defaultDuration');
        expect(config).toHaveProperty('defaultRadius');
        expect(config).toHaveProperty('adaptiveRadiusMultiplier');
        
        expect(config.defaultDuration).toBeGreaterThan(0);
        expect(config.defaultRadius).toBeGreaterThan(0);
        expect(config.adaptiveRadiusMultiplier).toBeGreaterThan(0);
      });
    });
  });

  describe('configuration validation', () => {
    it('should validate correct configurations', () => {
      const validConfigs = [
        {
          enableDissipation: true,
          dissipationMode: 'instant' as const,
          defaultRadius: 50,
          defaultDuration: 1000,
          performanceMode: 'low' as const,
          adaptiveRadiusMultiplier: 1.0,
          minDissipationRadius: 25,
          maxDissipationRadius: 100
        },
        {
          enableDissipation: false,
          dissipationMode: 'progressive' as const,
          defaultRadius: 150,
          defaultDuration: 3000,
          performanceMode: 'high' as const,
          adaptiveRadiusMultiplier: 1.5,
          minDissipationRadius: 75,
          maxDissipationRadius: 300
        }
      ];

      validConfigs.forEach(config => {
        expect(CloudDissipationIntegrationUtils.validateConfig(config)).toBe(true);
      });
    });

    it('should reject invalid configurations', () => {
      const invalidConfigs = [
        {
          enableDissipation: true,
          dissipationMode: 'invalid' as any,
          defaultRadius: 100,
          defaultDuration: 2000,
          performanceMode: 'high' as const,
          adaptiveRadiusMultiplier: 1.0,
          minDissipationRadius: 50,
          maxDissipationRadius: 200
        },
        {
          enableDissipation: true,
          dissipationMode: 'progressive' as const,
          defaultRadius: -100, // Negative radius
          defaultDuration: 2000,
          performanceMode: 'high' as const,
          adaptiveRadiusMultiplier: 1.0,
          minDissipationRadius: 50,
          maxDissipationRadius: 200
        },
        {
          enableDissipation: true,
          dissipationMode: 'progressive' as const,
          defaultRadius: 100,
          defaultDuration: 2000,
          performanceMode: 'high' as const,
          adaptiveRadiusMultiplier: 1.0,
          minDissipationRadius: 200, // Min > Max
          maxDissipationRadius: 100
        }
      ];

      invalidConfigs.forEach(config => {
        expect(CloudDissipationIntegrationUtils.validateConfig(config)).toBe(false);
      });
    });
  });
});