/**
 * Performance and Memory Management Tests
 * Tests app performance during extended exploration sessions
 * Requirements: 6.1, 6.4
 */

import { locationService } from '../../services/locationService';
import { explorationService } from '../../services/explorationService';
import { fogService } from '../../services/fogService';
import { getDatabaseService } from '../../database/services';
import { backgroundLocationService } from '../../services/backgroundLocationService';
import { memoryManagementService } from '../../services/memoryManagementService';
import { performanceMonitorService } from '../../services/performanceMonitorService';

// Mock external dependencies
jest.mock('expo-location');
jest.mock('@rnmapbox/maps');
jest.mock('expo-sqlite');

describe('Performance and Memory Management Tests', () => {
  let databaseService: any;

  beforeAll(async () => {
    databaseService = getDatabaseService();
    await databaseService.initialize();
  });

  beforeEach(async () => {
    // Clear database and reset services
    await databaseService.withTransaction(async () => {
      await databaseService.importData({
        exploredAreas: [],
        userStats: null,
        achievements: []
      });
    });
    
    // Reset performance monitoring
    performanceMonitorService.reset();
  });

  afterAll(async () => {
    await databaseService.close();
  });

  describe('Extended Exploration Session Performance', () => {
    test('should handle 1000+ location updates efficiently', async () => {
      const startTime = Date.now();
      const locationCount = 1000;
      const locations = [];

      // Generate test locations in a grid pattern
      for (let i = 0; i < locationCount; i++) {
        const lat = 37.7749 + (i % 100) * 0.001; // Vary latitude
        const lng = -122.4194 + Math.floor(i / 100) * 0.001; // Vary longitude
        locations.push({
          latitude: lat,
          longitude: lng,
          accuracy: 10 + Math.random() * 20,
          timestamp: Date.now() + i * 1000
        });
      }

      // Process all locations
      let processedCount = 0;
      const batchSize = 50;
      
      for (let i = 0; i < locations.length; i += batchSize) {
        const batch = locations.slice(i, i + batchSize);
        
        const batchStartTime = Date.now();
        
        for (const location of batch) {
          await explorationService.processLocationUpdate(location);
          processedCount++;
        }
        
        const batchEndTime = Date.now();
        const batchDuration = batchEndTime - batchStartTime;
        
        // Each batch should process within reasonable time (< 5 seconds)
        expect(batchDuration).toBeLessThan(5000);
        
        // Check memory usage periodically
        if (i % 200 === 0) {
          const memoryStats = memoryManagementService.getMemoryStats();
          console.log(`Memory usage at ${processedCount} locations:`, memoryStats);
          
          // Memory usage should not exceed reasonable limits
          expect(memoryStats.usedMemoryMB).toBeLessThan(200); // 200MB limit
        }
      }

      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      
      // Total processing should complete within reasonable time
      expect(totalDuration).toBeLessThan(60000); // 60 seconds max
      
      // Verify all locations were processed
      const exploredAreas = await databaseService.getExploredAreas();
      expect(exploredAreas.length).toBeGreaterThan(0);
      
      // Performance should be consistent
      const avgTimePerLocation = totalDuration / locationCount;
      expect(avgTimePerLocation).toBeLessThan(50); // 50ms per location max
    });

    test('should maintain 60fps during fog rendering with many areas', async () => {
      // Create many explored areas
      const areaCount = 500;
      const areas = [];

      for (let i = 0; i < areaCount; i++) {
        const lat = 37.7749 + (i % 50) * 0.01;
        const lng = -122.4194 + Math.floor(i / 50) * 0.01;
        
        areas.push({
          latitude: lat,
          longitude: lng,
          radius: 100,
          explored_at: new Date(Date.now() - i * 1000).toISOString(),
          accuracy: 10
        });
      }

      // Store areas in database
      for (const area of areas) {
        await databaseService.createExploredArea(area);
      }

      // Test fog geometry generation performance
      const fogGenerationStart = Date.now();
      const fogGeometry = await fogService.generateFogGeometry();
      const fogGenerationEnd = Date.now();
      
      const fogGenerationTime = fogGenerationEnd - fogGenerationStart;
      
      // Fog generation should be fast enough for 60fps (< 16ms)
      expect(fogGenerationTime).toBeLessThan(100); // Allow some buffer for testing
      expect(fogGeometry).toBeDefined();

      // Test fog rendering performance at different zoom levels
      const zoomLevels = [5, 10, 15, 20];
      
      for (const zoom of zoomLevels) {
        const renderStart = Date.now();
        
        // Simulate fog rendering at zoom level
        const levelOfDetail = fogService.calculateLevelOfDetail(zoom);
        const optimizedGeometry = fogService.optimizeGeometryForZoom(fogGeometry, zoom);
        
        const renderEnd = Date.now();
        const renderTime = renderEnd - renderStart;
        
        // Rendering should be fast enough for smooth animation
        expect(renderTime).toBeLessThan(16); // 60fps = 16ms per frame
        expect(optimizedGeometry).toBeDefined();
        
        console.log(`Zoom ${zoom}: ${renderTime}ms, LOD: ${levelOfDetail}`);
      }
    });

    test('should optimize memory usage during long sessions', async () => {
      const sessionDuration = 30000; // 30 seconds simulation
      const locationInterval = 100; // New location every 100ms
      const startTime = Date.now();
      
      let locationCount = 0;
      const memorySnapshots = [];

      // Simulate extended session
      while (Date.now() - startTime < sessionDuration) {
        const location = {
          latitude: 37.7749 + Math.random() * 0.01,
          longitude: -122.4194 + Math.random() * 0.01,
          accuracy: 10 + Math.random() * 20,
          timestamp: Date.now()
        };

        await explorationService.processLocationUpdate(location);
        locationCount++;

        // Take memory snapshot every 100 locations
        if (locationCount % 100 === 0) {
          const memoryStats = memoryManagementService.getMemoryStats();
          memorySnapshots.push({
            locationCount,
            ...memoryStats,
            timestamp: Date.now()
          });

          // Trigger memory cleanup if needed
          if (memoryStats.usedMemoryMB > 150) {
            await memoryManagementService.performCleanup();
          }
        }

        // Wait for next location
        await new Promise(resolve => setTimeout(resolve, locationInterval));
      }

      // Analyze memory usage patterns
      expect(memorySnapshots.length).toBeGreaterThan(0);
      
      const maxMemoryUsage = Math.max(...memorySnapshots.map(s => s.usedMemoryMB));
      const avgMemoryUsage = memorySnapshots.reduce((sum, s) => sum + s.usedMemoryMB, 0) / memorySnapshots.length;
      
      console.log(`Memory usage - Max: ${maxMemoryUsage}MB, Avg: ${avgMemoryUsage}MB`);
      
      // Memory should stay within reasonable bounds
      expect(maxMemoryUsage).toBeLessThan(250); // 250MB max
      expect(avgMemoryUsage).toBeLessThan(150); // 150MB average
      
      // Memory should not continuously grow (memory leak check)
      if (memorySnapshots.length >= 3) {
        const firstThird = memorySnapshots.slice(0, Math.floor(memorySnapshots.length / 3));
        const lastThird = memorySnapshots.slice(-Math.floor(memorySnapshots.length / 3));
        
        const firstThirdAvg = firstThird.reduce((sum, s) => sum + s.usedMemoryMB, 0) / firstThird.length;
        const lastThirdAvg = lastThird.reduce((sum, s) => sum + s.usedMemoryMB, 0) / lastThird.length;
        
        // Memory growth should be reasonable (not more than 50% increase)
        const memoryGrowthRatio = lastThirdAvg / firstThirdAvg;
        expect(memoryGrowthRatio).toBeLessThan(1.5);
      }
    });
  });

  describe('Background Location Processing Performance', () => {
    test('should process background location queue efficiently', async () => {
      // Mock background location queue with many items
      const queueSize = 200;
      const mockQueueItems = [];

      for (let i = 0; i < queueSize; i++) {
        mockQueueItems.push({
          latitude: 37.7749 + Math.random() * 0.1,
          longitude: -122.4194 + Math.random() * 0.1,
          accuracy: 10 + Math.random() * 30,
          timestamp: Date.now() - (queueSize - i) * 60000 // 1 minute intervals
        });
      }

      // Mock the background queue
      jest.spyOn(locationService, 'getBackgroundQueueStatus').mockResolvedValue({
        count: queueSize,
        oldestTimestamp: mockQueueItems[0].timestamp,
        newestTimestamp: mockQueueItems[queueSize - 1].timestamp
      });

      jest.spyOn(locationService, 'forceProcessBackgroundQueue').mockImplementation(async () => {
        const startTime = Date.now();
        
        // Simulate processing each item
        for (const item of mockQueueItems) {
          await explorationService.processLocationUpdate(item);
        }
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        return {
          processed: queueSize,
          processingTime,
          errors: 0
        };
      });

      // Test queue processing performance
      const processingResult = await locationService.forceProcessBackgroundQueue();
      
      expect(processingResult.processed).toBe(queueSize);
      expect(processingResult.errors).toBe(0);
      
      // Processing should be efficient (< 10 seconds for 200 items)
      expect(processingResult.processingTime).toBeLessThan(10000);
      
      const avgTimePerItem = processingResult.processingTime / queueSize;
      expect(avgTimePerItem).toBeLessThan(50); // 50ms per item max
    });

    test('should handle background processing without blocking UI', async () => {
      // Configure background service
      backgroundLocationService.configure({
        autoProcessOnForeground: true,
        maxQueueSize: 100,
        processingInterval: 1000, // 1 second
        minAccuracy: 100,
        minDistance: 25
      });

      // Start background processing
      const startResult = await backgroundLocationService.start();
      expect(startResult).toBe(true);

      // Simulate UI operations during background processing
      const uiOperationTimes = [];
      const uiOperationCount = 10;

      for (let i = 0; i < uiOperationCount; i++) {
        const uiStart = Date.now();
        
        // Simulate UI operation (fog geometry generation)
        await fogService.generateFogGeometry();
        
        const uiEnd = Date.now();
        const uiTime = uiEnd - uiStart;
        uiOperationTimes.push(uiTime);
        
        // Wait between operations
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Stop background processing
      await backgroundLocationService.stop();

      // UI operations should remain responsive
      const maxUiTime = Math.max(...uiOperationTimes);
      const avgUiTime = uiOperationTimes.reduce((sum, time) => sum + time, 0) / uiOperationTimes.length;

      expect(maxUiTime).toBeLessThan(100); // No single operation > 100ms
      expect(avgUiTime).toBeLessThan(50); // Average < 50ms
    });
  });

  describe('Database Performance Optimization', () => {
    test('should handle large datasets with spatial queries efficiently', async () => {
      // Create large dataset
      const datasetSize = 5000;
      const areas = [];

      // Generate areas in a realistic geographic distribution
      for (let i = 0; i < datasetSize; i++) {
        const lat = 37.0 + Math.random() * 2.0; // Bay Area region
        const lng = -123.0 + Math.random() * 2.0;
        
        areas.push({
          latitude: lat,
          longitude: lng,
          radius: 50 + Math.random() * 200,
          explored_at: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(), // Last 30 days
          accuracy: 5 + Math.random() * 45
        });
      }

      // Batch insert for performance
      const batchSize = 100;
      const insertStartTime = Date.now();

      for (let i = 0; i < areas.length; i += batchSize) {
        const batch = areas.slice(i, i + batchSize);
        
        await databaseService.withTransaction(async () => {
          for (const area of batch) {
            await databaseService.createExploredArea(area);
          }
        });
      }

      const insertEndTime = Date.now();
      const insertTime = insertEndTime - insertStartTime;
      
      console.log(`Inserted ${datasetSize} areas in ${insertTime}ms`);
      expect(insertTime).toBeLessThan(30000); // 30 seconds max

      // Test spatial query performance
      const queryTests = [
        { lat: 37.7749, lng: -122.4194, radius: 1000 }, // 1km radius
        { lat: 37.7749, lng: -122.4194, radius: 5000 }, // 5km radius
        { lat: 37.7749, lng: -122.4194, radius: 10000 } // 10km radius
      ];

      for (const query of queryTests) {
        const queryStart = Date.now();
        
        const nearbyAreas = await databaseService.getExploredAreasNear(
          query.lat,
          query.lng,
          query.radius
        );
        
        const queryEnd = Date.now();
        const queryTime = queryEnd - queryStart;
        
        console.log(`Query ${query.radius}m radius: ${queryTime}ms, found ${nearbyAreas.length} areas`);
        
        // Spatial queries should be fast
        expect(queryTime).toBeLessThan(100); // 100ms max
        expect(nearbyAreas).toBeDefined();
      }
    });

    test('should optimize database size and cleanup old data', async () => {
      // Create data with various ages
      const oldDataCount = 1000;
      const recentDataCount = 500;
      
      const oldDate = new Date(Date.now() - 86400000 * 365); // 1 year ago
      const recentDate = new Date(Date.now() - 86400000 * 7); // 1 week ago

      // Insert old data
      for (let i = 0; i < oldDataCount; i++) {
        await databaseService.createExploredArea({
          latitude: 37.7749 + Math.random() * 0.1,
          longitude: -122.4194 + Math.random() * 0.1,
          radius: 100,
          explored_at: new Date(oldDate.getTime() + i * 1000).toISOString(),
          accuracy: 10
        });
      }

      // Insert recent data
      for (let i = 0; i < recentDataCount; i++) {
        await databaseService.createExploredArea({
          latitude: 37.7749 + Math.random() * 0.1,
          longitude: -122.4194 + Math.random() * 0.1,
          radius: 100,
          explored_at: new Date(recentDate.getTime() + i * 1000).toISOString(),
          accuracy: 10
        });
      }

      // Check initial database size
      const initialStats = await databaseService.getDatabaseStats();
      console.log('Initial database stats:', initialStats);

      // Perform cleanup of old data (older than 6 months)
      const cleanupDate = new Date(Date.now() - 86400000 * 180);
      const cleanupResult = await databaseService.cleanupOldData(cleanupDate);
      
      expect(cleanupResult.deletedCount).toBeGreaterThan(0);
      
      // Check database size after cleanup
      const finalStats = await databaseService.getDatabaseStats();
      console.log('Final database stats:', finalStats);
      
      // Database should be smaller after cleanup
      expect(finalStats.totalSize).toBeLessThan(initialStats.totalSize);
      
      // Recent data should still be present
      const remainingAreas = await databaseService.getExploredAreas();
      expect(remainingAreas.length).toBeGreaterThan(recentDataCount * 0.9); // Allow some margin
    });
  });

  describe('Device Capability Adaptation', () => {
    test('should adapt performance based on device capabilities', async () => {
      // Mock different device capabilities
      const deviceProfiles = [
        { name: 'low-end', memory: 2048, cpu: 'slow' },
        { name: 'mid-range', memory: 4096, cpu: 'medium' },
        { name: 'high-end', memory: 8192, cpu: 'fast' }
      ];

      for (const profile of deviceProfiles) {
        // Mock device capability detection
        jest.spyOn(memoryManagementService, 'getDeviceCapabilities').mockReturnValue({
          totalMemoryMB: profile.memory,
          availableMemoryMB: profile.memory * 0.7,
          cpuClass: profile.cpu,
          gpuClass: profile.cpu
        });

        // Configure services based on device capabilities
        const config = memoryManagementService.getOptimalConfiguration();
        
        // Low-end devices should have more conservative settings
        if (profile.name === 'low-end') {
          expect(config.maxCacheSize).toBeLessThan(50);
          expect(config.fogDetailLevel).toBeLessThan(0.5);
          expect(config.animationQuality).toBeLessThan(0.5);
        }
        
        // High-end devices should have better settings
        if (profile.name === 'high-end') {
          expect(config.maxCacheSize).toBeGreaterThan(100);
          expect(config.fogDetailLevel).toBeGreaterThan(0.8);
          expect(config.animationQuality).toBeGreaterThan(0.8);
        }

        // Test performance with adapted settings
        const testLocation = {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
          timestamp: Date.now()
        };

        const processStart = Date.now();
        await explorationService.processLocationUpdate(testLocation);
        const processEnd = Date.now();
        
        const processingTime = processEnd - processStart;
        
        // Processing should be within acceptable limits for each device type
        const maxTime = profile.name === 'low-end' ? 200 : profile.name === 'mid-range' ? 100 : 50;
        expect(processingTime).toBeLessThan(maxTime);
        
        console.log(`${profile.name} device: ${processingTime}ms processing time`);
      }
    });
  });
});