import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text } from 'react-native';
import { Provider } from 'react-redux';
import { useEffect, useState } from 'react';
import { store } from './src/store/store';
import { TabNavigation, ErrorBoundary } from './src/components';
import { validateAppConfiguration } from './src/config';
import { initializeDatabaseOnFirstLaunch, InitializationResult } from './src/database';
import { backgroundLocationService, getPerformanceMonitorService, getMemoryManagementService, initializeServices, compactionService, spatialCacheService } from './src/services';
import { explorationStateSynchronizer } from './src/services/cloudSystem/integration';

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let compactionInterval: NodeJS.Timeout;

    const initializeApp = async () => {
      if (!isMounted) return;

      try {
        // Validate configuration on app startup
        validateAppConfiguration();

        // Initialize cross-service dependencies
        initializeServices();

        // Initialize database and default data on first launch
        const result: InitializationResult = await initializeDatabaseOnFirstLaunch();

        if (!isMounted) return;

        if (result.errors.length > 0) {
          console.warn('Database initialization completed with warnings:', result.errors);
        }

        if (result.isFirstLaunch) {
          console.log('First launch setup completed successfully');
        }

        // Initialize the spatial cache with data from the database
        await spatialCacheService.initialize();

        // Configure background location service
        backgroundLocationService.configure({
          autoProcessOnForeground: true,
          maxQueueSize: 500,
          processingInterval: 60000, // 1 minute
          minAccuracy: 200, // 200 meters
          minDistance: 50, // 50 meters
        });

        console.log('Background location service configured');

        // Initialize performance monitoring services
        const performanceMonitorService = getPerformanceMonitorService();
        const memoryManagementService = getMemoryManagementService();

        await performanceMonitorService.initialize();
        await memoryManagementService.initialize();

        // Start performance monitoring
        performanceMonitorService.startMonitoring();

        console.log('Performance monitoring services initialized');

        // Initialize and start exploration state synchronization
        explorationStateSynchronizer.configure({
          autoSync: true,
          syncInterval: 5000, // 5 seconds for development
          batchSize: 50,
          enableConflictResolution: true,
          debugMode: true
        });

        // Perform initial sync to load explored areas from database
        await explorationStateSynchronizer.performFullSync();
        explorationStateSynchronizer.startAutoSync();

        console.log('Exploration state synchronizer initialized');

        // Start periodic database compaction
        compactionInterval = setInterval(() => {
          compactionService.runCompaction().catch(err => console.error("Compaction failed:", err));
        }, 5 * 60 * 1000); // Every 5 minutes

      } catch (error) {
        if (!isMounted) return;
        console.error('App initialization failed:', error);
        setInitializationError(`Initialization failed: ${error}`);
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    initializeApp();

    return () => {
      isMounted = false;
      if (compactionInterval) {
        clearInterval(compactionInterval);
      }
    };
  }, []); // Empty dependency array is correct for initialization

  // Show loading screen during initialization
  if (isInitializing) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Initializing Cartographer...</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  // Show error screen if initialization failed
  if (initializationError) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Failed to initialize app</Text>
        <Text style={styles.errorDetails}>{initializationError}</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <Provider store={store}>
        <View style={styles.container}>
          <TabNavigation />
          <StatusBar style="auto" />
        </View>
      </Provider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d32f2f',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorDetails: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
