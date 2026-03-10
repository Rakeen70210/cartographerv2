import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import MapContainer from './MapContainer';
import { MAPBOX_CONFIG } from '../config/mapbox';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loadMapStyle } from '../store/persistence';
import {
  setUserLocation,
  setMapStyle,
  resetViewport,
} from '../store/slices/mapSlice';
import { selectMapStatus, selectMapAndLocation } from '../store/selectors';

interface MapScreenProps {
  // Props can be expanded for additional functionality
}

const MapScreen: React.FC<MapScreenProps> = () => {
  const dispatch = useAppDispatch();
  const mapStatus = useAppSelector(selectMapStatus);
  const { viewport, isTracking, isMapReady } = useAppSelector(selectMapAndLocation);
  const integrationStarted = useRef(false);

  // Initialize fog-location integration
  useEffect(() => {
    let isMounted = true;
    let retryTimeout: NodeJS.Timeout | null = null;

    const initializeIntegration = async () => {
      if (integrationStarted.current || !isMounted) return;

      // Import database service to check if ready
      const { getDatabaseService } = await import('../database/services');
      const dbService = getDatabaseService();

      // Check if database is ready, if not, wait and retry
      if (!dbService.isReady()) {
        console.log('Database not ready yet, waiting to start fog-location integration...');
        retryTimeout = setTimeout(() => {
          if (isMounted) {
            initializeIntegration();
          }
        }, 500); // Retry after 500ms
        return;
      }

      try {
        console.log('Initializing fog-location integration...');
        const success = await fogLocationIntegrationService.start();

        if (success && isMounted) {
          integrationStarted.current = true;
          console.log('Fog-location integration started successfully');
        } else if (isMounted) {
          console.warn('Failed to start fog-location integration');
        }
      } catch (error) {
        if (isMounted) {
          console.error('Error initializing fog-location integration:', error);
        }
      }
    };

    initializeIntegration();

    // Cleanup on unmount
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
  }, []); // Empty dependency array is correct here

  useEffect(() => {
    let isMounted = true;

    const restoreMapStyle = async () => {
      const savedMapStyle = await loadMapStyle();
      if (!isMounted || !savedMapStyle) {
        return;
      }

      dispatch(setMapStyle(savedMapStyle));
    };

    restoreMapStyle().catch(error => {
      console.error('Failed to restore map style:', error);
    });

    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  const handleLocationUpdate = (location: [number, number]) => {
    // Update Redux state with new location
    dispatch(setUserLocation(location));
    console.log('Location updated:', location);
  };

  const handleResetView = () => {
    dispatch(resetViewport());
  };

  // Show error state if map failed to load
  if (mapStatus.hasError) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Map Error</Text>
          <Text style={styles.errorMessage}>{mapStatus.error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleResetView}>
            <Text style={styles.retryButtonText}>Retry</Text>
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

        {/* Show loading overlay while map is initializing */}
        {!isMapReady && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={styles.loadingText}>Loading Map...</Text>
              <Text style={styles.loadingSubtext}>Initializing your exploration experience</Text>
            </View>
          </View>
        )}

        {/* Status Indicators */}
        <View style={styles.statusContainer}>
          {isTracking && (
            <View style={styles.trackingIndicator}>
              <View style={styles.trackingDot} />
              <Text style={styles.trackingText}>Tracking</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Dark background for loading
  },
  mapWrapper: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1a1a1a',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1a1a1a',
    zIndex: 1000,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1a1a1a',
  },
  errorText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff6b6b',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  statusContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    zIndex: 1000,
  },
  trackingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  trackingText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default MapScreen;
