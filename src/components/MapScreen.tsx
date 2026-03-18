import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import MapContainer from './MapContainer';
import { MAPBOX_CONFIG } from '../config/mapbox';
import { explorationService, ExplorationResult } from '../services/explorationService';
import { fogLocationIntegrationService } from '../services/fogLocationIntegrationService';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loadMapStyle } from '../store/persistence';
import {
  setMapStyle,
  resetViewport,
} from '../store/slices/mapSlice';
import { fetchProfileStats } from '../store/slices/profileSlice';
import { selectMapStatus, selectMapAndLocation } from '../store/selectors';
import { cartographerTheme } from './cartographerTheme';
import { appExperienceService } from '../services/appExperienceService';

const MapScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const mapStatus = useAppSelector(selectMapStatus);
  const { isTracking, isMapReady, hasPermission } = useAppSelector(selectMapAndLocation);
  const { stats, progress, lastUpdated } = useAppSelector((state) => state.profile);
  const integrationStarted = useRef(false);
  const [discoveryToast, setDiscoveryToast] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let retryTimeout: NodeJS.Timeout | null = null;

    const initializeIntegration = async () => {
      if (integrationStarted.current || !isMounted) {
        return;
      }

      const { getDatabaseService } = await import('../database/services');
      const dbService = getDatabaseService();

      if (!dbService.isReady()) {
        retryTimeout = setTimeout(() => {
          if (isMounted) {
            initializeIntegration();
          }
        }, 500);
        return;
      }

      try {
        const success = await fogLocationIntegrationService.start();

        if (success && isMounted) {
          integrationStarted.current = true;
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error initializing fog-location integration:', error);
        }
      }
    };

    initializeIntegration();

    return () => {
      isMounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (integrationStarted.current) {
        fogLocationIntegrationService.stop();
        integrationStarted.current = false;
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const restoreMapStyle = async () => {
      const savedMapStyle = await loadMapStyle();
      if (!isMounted || !savedMapStyle) {
        return;
      }

      dispatch(setMapStyle(savedMapStyle));
    };

    restoreMapStyle().catch((error) => {
      console.error('Failed to restore map style:', error);
    });

    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  useEffect(() => {
    if (!lastUpdated) {
      dispatch(fetchProfileStats());
    }
  }, [dispatch, lastUpdated]);

  useEffect(() => {
    if (!progress && !stats) {
      return;
    }

    appExperienceService.saveBootstrapSnapshot({
      activeTab: 'explore',
      updatedAt: Date.now(),
      progress: {
        percentageExplored: progress?.percentage ?? 0,
        currentStreak: stats?.current_streak ?? 0,
        areasExploredToday: stats?.areasExploredToday ?? 0,
      },
    }).catch(() => {});
  }, [progress, stats]);

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;

    const handleExploration = (result: ExplorationResult) => {
      if (!result.isNewArea || !result.exploredArea) {
        return;
      }

      setDiscoveryToast(`New ground revealed · +${result.discoveredTileCount ?? 0} tiles`);
      dispatch(fetchProfileStats());

      timeout = setTimeout(() => {
        setDiscoveryToast(null);
      }, 2800);
    };

    explorationService.addExplorationListener(handleExploration);

    return () => {
      explorationService.removeExplorationListener(handleExploration);
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [dispatch]);

  const handleResetView = () => {
    dispatch(resetViewport());
  };

  const nextTargetText = hasPermission
    ? progress?.percentage
      ? `Push past ${Math.max(1, Math.ceil(progress.percentage / 5) * 5)}% next.`
      : 'Head toward the nearest fog edge to start your map.'
    : 'Enable location access to start revealing the map.';

  if (mapStatus.hasError) {
    return (
      <View style={styles.container}>
        <View style={styles.stateCard}>
          <Text style={styles.stateEyebrow}>Explore</Text>
          <Text style={styles.stateTitle}>Map unavailable</Text>
          <Text style={styles.stateBody}>{mapStatus.error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleResetView}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapWrapper}>
        <MapContainer
          initialCenter={MAPBOX_CONFIG.DEFAULT_CENTER}
          initialZoom={MAPBOX_CONFIG.DEFAULT_ZOOM}
        />

        {!isMapReady && (
          <View style={styles.loadingOverlay}>
            <View style={styles.stateCard}>
              <Text style={styles.stateEyebrow}>Preparing your map</Text>
              <ActivityIndicator size="large" color={cartographerTheme.colors.accent} />
              <Text style={styles.stateTitle}>Calibrating exploration</Text>
              <Text style={styles.stateBody}>
                Loading your fog, frontier, and last known progress.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.topHud}>
          <View style={styles.hudChip}>
            <View style={[styles.statusDot, { backgroundColor: isTracking ? cartographerTheme.colors.accentSuccess : cartographerTheme.colors.accentDanger }]} />
            <Text style={styles.hudChipText}>{isTracking ? 'Tracking live' : 'Tracking paused'}</Text>
          </View>
          <View style={styles.hudChip}>
            <Text style={styles.hudChipText}>{hasPermission ? 'Location ready' : 'Location needed'}</Text>
          </View>
        </View>

        <View style={styles.bottomHud}>
          <View style={styles.progressHudCard}>
            <Text style={styles.progressLabel}>Explore</Text>
            <View style={styles.progressHudRow}>
              <View style={styles.progressMetric}>
                <Text style={styles.progressValue}>{progress?.percentage?.toFixed(1) ?? '0.0'}%</Text>
                <Text style={styles.progressMetricLabel}>Revealed</Text>
              </View>
              <View style={styles.progressMetric}>
                <Text style={styles.progressValue}>{stats?.current_streak ?? 0}</Text>
                <Text style={styles.progressMetricLabel}>Streak</Text>
              </View>
              <View style={styles.progressMetric}>
                <Text style={styles.progressValue}>{stats?.areasExploredToday ?? 0}</Text>
                <Text style={styles.progressMetricLabel}>Today</Text>
              </View>
            </View>
            <Text style={styles.progressHint}>{nextTargetText}</Text>
          </View>

          <TouchableOpacity style={styles.fab} onPress={handleResetView}>
            <Text style={styles.fabText}>Recenter</Text>
          </TouchableOpacity>
        </View>

        {discoveryToast ? (
          <View style={styles.discoveryToast}>
            <Text style={styles.discoveryToastText}>{discoveryToast}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: cartographerTheme.colors.background,
  },
  mapWrapper: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: cartographerTheme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: cartographerTheme.spacing.lg,
  },
  stateCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: cartographerTheme.colors.surface,
    borderWidth: 1,
    borderColor: cartographerTheme.colors.border,
    borderRadius: cartographerTheme.radius.lg,
    padding: cartographerTheme.spacing.xl,
    alignItems: 'center',
  },
  stateEyebrow: {
    color: cartographerTheme.colors.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: cartographerTheme.spacing.md,
  },
  stateTitle: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    marginTop: cartographerTheme.spacing.md,
    textAlign: 'center',
  },
  stateBody: {
    color: cartographerTheme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: cartographerTheme.spacing.sm,
  },
  primaryButton: {
    marginTop: cartographerTheme.spacing.lg,
    backgroundColor: cartographerTheme.colors.accent,
    borderRadius: cartographerTheme.radius.pill,
    paddingHorizontal: cartographerTheme.spacing.lg,
    paddingVertical: cartographerTheme.spacing.sm,
  },
  primaryButtonText: {
    color: cartographerTheme.colors.background,
    fontSize: 14,
    fontWeight: '700',
  },
  topHud: {
    position: 'absolute',
    top: cartographerTheme.spacing.xl,
    left: cartographerTheme.spacing.lg,
    right: cartographerTheme.spacing.lg,
    flexDirection: 'row',
    gap: cartographerTheme.spacing.sm,
  },
  hudChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: cartographerTheme.colors.surface,
    borderWidth: 1,
    borderColor: cartographerTheme.colors.border,
    borderRadius: cartographerTheme.radius.pill,
    paddingHorizontal: cartographerTheme.spacing.md,
    paddingVertical: cartographerTheme.spacing.sm,
  },
  hudChipText: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: cartographerTheme.spacing.sm,
  },
  bottomHud: {
    position: 'absolute',
    left: cartographerTheme.spacing.lg,
    right: cartographerTheme.spacing.lg,
    bottom: cartographerTheme.spacing.xl,
    gap: cartographerTheme.spacing.md,
  },
  progressHudCard: {
    backgroundColor: cartographerTheme.colors.surface,
    borderWidth: 1,
    borderColor: cartographerTheme.colors.border,
    borderRadius: cartographerTheme.radius.lg,
    padding: cartographerTheme.spacing.lg,
  },
  progressLabel: {
    color: cartographerTheme.colors.accentWarm,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    marginBottom: cartographerTheme.spacing.sm,
  },
  progressHudRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: cartographerTheme.spacing.sm,
  },
  progressMetric: {
    flex: 1,
  },
  progressValue: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  progressMetricLabel: {
    color: cartographerTheme.colors.textSecondary,
    fontSize: 12,
    marginTop: cartographerTheme.spacing.xs,
  },
  progressHint: {
    color: cartographerTheme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: cartographerTheme.spacing.md,
  },
  fab: {
    alignSelf: 'flex-end',
    backgroundColor: cartographerTheme.colors.accent,
    borderRadius: cartographerTheme.radius.pill,
    paddingHorizontal: cartographerTheme.spacing.lg,
    paddingVertical: cartographerTheme.spacing.md,
  },
  fabText: {
    color: cartographerTheme.colors.background,
    fontSize: 14,
    fontWeight: '700',
  },
  discoveryToast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 188,
    backgroundColor: 'rgba(132, 241, 186, 0.2)',
    borderColor: 'rgba(132, 241, 186, 0.35)',
    borderWidth: 1,
    borderRadius: cartographerTheme.radius.pill,
    paddingHorizontal: cartographerTheme.spacing.lg,
    paddingVertical: cartographerTheme.spacing.sm,
  },
  discoveryToastText: {
    color: cartographerTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});

export default MapScreen;
