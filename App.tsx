import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { Provider } from 'react-redux';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from './src/store/store';
import { TabNavigation, ErrorBoundary } from './src/components';
import { validateAppConfiguration } from './src/config';
import { initializeDatabaseOnFirstLaunch, InitializationResult } from './src/database';
import { backgroundLocationService, getPerformanceMonitorService, getMemoryManagementService, initializeServices, compactionService, spatialCacheService, fogLocationIntegrationService } from './src/services';
import { getDatabaseService } from './src/database/services';
import { EXPLORATION_RENDER_SOURCE, EXPLORATION_TILE_ZOOM } from './src/config';
import { tilesForCircle } from './src/utils/tiles';
import { cartographerTheme } from './src/components/cartographerTheme';
import { appExperienceService } from './src/services/appExperienceService';

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [initializationStep, setInitializationStep] = useState('Preparing your map');
  const [snapshotHint, setSnapshotHint] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let compactionInterval: NodeJS.Timeout;

    const initializeApp = async () => {
      if (!isMounted) return;

      try {
        const bootstrapSnapshot = await appExperienceService.loadBootstrapSnapshot();
        if (bootstrapSnapshot?.progress && isMounted) {
          setSnapshotHint(
            `${bootstrapSnapshot.progress.percentageExplored.toFixed(1)}% explored · ${bootstrapSnapshot.progress.currentStreak} day streak`
          );
        }

        setInitializationStep('Checking environment');
        // Validate configuration on app startup
        validateAppConfiguration();

        setInitializationStep('Linking core services');
        // Initialize cross-service dependencies
        initializeServices();

        setInitializationStep('Preparing local map data');
        // Initialize database and default data on first launch
        const result: InitializationResult = await initializeDatabaseOnFirstLaunch();

        if (!isMounted) return;

        if (result.errors.length > 0) {
          console.warn('Database initialization completed with warnings:', result.errors);
        }

        if (result.isFirstLaunch) {
          console.log('First launch setup completed successfully');
        }

        setInitializationStep('Warming exploration cache');
        // Initialize the spatial cache with data from the database
        await spatialCacheService.initialize();

        setInitializationStep('Reconciling explored tiles');
        // Backfill tile-based exploration coverage from existing explored areas (one-time best effort).
        // This enables tile-based rendering/sync even if the app previously stored only explored_areas.
        try {
          const dbService = getDatabaseService();
          const existingTiles = await dbService.getAllVisitedTiles().catch(() => []);

          if (existingTiles.length === 0) {
            const exploredAreas = await dbService.getAllExploredAreas();

            if (exploredAreas.length > 0) {
              const tiles = exploredAreas.flatMap(area =>
                tilesForCircle(area.latitude, area.longitude, area.radius, EXPLORATION_TILE_ZOOM)
                  .map(tile => ({ ...tile, explored_at: area.explored_at }))
              );

              // If rendering depends on tiles, block until backfill completes.
              if (EXPLORATION_RENDER_SOURCE === 'tiles') {
                await dbService.upsertVisitedTiles(tiles);
              } else {
                dbService.upsertVisitedTiles(tiles).catch(() => {});
              }
            }
          }
        } catch (error) {
          console.warn('Visited-tiles backfill skipped/failed:', error);
        }

        // Configure background location service
        backgroundLocationService.configure({
          autoProcessOnForeground: true,
          maxQueueSize: 500,
          processingInterval: 60000, // 1 minute
          minAccuracy: 100, // Match foreground acceptance rules
          minDistance: 50, // 50 meters
        });

        console.log('Background location service configured');

        setInitializationStep('Tuning device performance');
        // Initialize performance monitoring services
        const performanceMonitorService = getPerformanceMonitorService();
        const memoryManagementService = getMemoryManagementService();

        await performanceMonitorService.initialize();
        await memoryManagementService.initialize();

        // Start performance monitoring
        performanceMonitorService.startMonitoring();

        console.log('Performance monitoring services initialized');

        setInitializationStep('Calibrating live exploration');
        // Start fog-location integration (location -> exploration -> fog)
        await fogLocationIntegrationService.start();
        console.log('Fog-location integration started');

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
        <View style={styles.loadingCard}>
          <Text style={styles.loadingEyebrow}>Cartographer</Text>
          <ActivityIndicator size="large" color={cartographerTheme.colors.accent} />
          <Text style={styles.loadingText}>{initializationStep}</Text>
          <Text style={styles.loadingSubtext}>
            {snapshotHint || 'Unfolding your fog-of-war world.'}
          </Text>
        </View>
        <StatusBar style="light" />
      </View>
    );
  }

  // Show error screen if initialization failed
  if (initializationError) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.loadingCard}>
          <Text style={styles.loadingEyebrow}>Cartographer</Text>
          <Text style={styles.errorText}>Initialization blocked</Text>
          <Text style={styles.errorDetails}>{initializationError}</Text>
        </View>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <Provider store={store}>
          <View style={styles.container}>
            <TabNavigation />
            <StatusBar style="light" />
          </View>
        </Provider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: cartographerTheme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: cartographerTheme.colors.background,
  },
  loadingCard: {
    width: '86%',
    maxWidth: 360,
    backgroundColor: cartographerTheme.colors.surface,
    borderRadius: cartographerTheme.radius.lg,
    borderWidth: 1,
    borderColor: cartographerTheme.colors.border,
    padding: cartographerTheme.spacing.xl,
    alignItems: 'center',
  },
  loadingEyebrow: {
    color: cartographerTheme.colors.accentWarm,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: cartographerTheme.spacing.md,
  },
  loadingText: {
    fontSize: 24,
    fontWeight: '700',
    color: cartographerTheme.colors.textPrimary,
    marginTop: cartographerTheme.spacing.lg,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    lineHeight: 20,
    color: cartographerTheme.colors.textSecondary,
    textAlign: 'center',
    marginTop: cartographerTheme.spacing.sm,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700',
    color: cartographerTheme.colors.accentDanger,
    marginBottom: cartographerTheme.spacing.sm,
    textAlign: 'center',
  },
  errorDetails: {
    fontSize: 14,
    color: cartographerTheme.colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
