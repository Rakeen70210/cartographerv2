import React, { useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  SafeAreaView, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import MapContainer from './MapContainer';
import { MAPBOX_CONFIG } from '../config/mapbox';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  setUserLocation, 
  setFollowUserLocation, 
  centerOnLocation,
  setZoom,
  resetViewport 
} from '../store/slices/mapSlice';
import { selectMapStatus, selectMapAndLocation } from '../store/selectors';
import { fogLocationIntegrationService } from '../services';

interface MapScreenProps {
  // Props can be expanded for additional functionality
}

const MapScreen: React.FC<MapScreenProps> = () => {
  const dispatch = useAppDispatch();
  const mapStatus = useAppSelector(selectMapStatus);
  const { viewport, userLocation, isTracking, hasPermission, isMapReady } = useAppSelector(selectMapAndLocation);
  const integrationStarted = useRef(false);

  // Initialize fog-location integration
  useEffect(() => {
    let isMounted = true;
    
    const initializeIntegration = async () => {
      if (integrationStarted.current || !isMounted) return;
      
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
      if (integrationStarted.current) {
        fogLocationIntegrationService.stop();
        integrationStarted.current = false;
      }
    };
  }, []); // Empty dependency array is correct here

  const handleLocationUpdate = (location: [number, number]) => {
    // Update Redux state with new location
    dispatch(setUserLocation(location));
    console.log('Location updated:', location);
  };

  // Navigation control handlers
  const handleCenterOnUser = () => {
    if (userLocation) {
      dispatch(centerOnLocation(userLocation));
      dispatch(setFollowUserLocation(true));
    } else {
      Alert.alert('Location Not Available', 'Unable to find your current location. Please ensure location services are enabled.');
    }
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(viewport.zoom + 1, MAPBOX_CONFIG.MAX_ZOOM || 20);
    dispatch(setZoom(newZoom));
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(viewport.zoom - 1, MAPBOX_CONFIG.MIN_ZOOM || 0);
    dispatch(setZoom(newZoom));
  };

  const handleResetView = () => {
    dispatch(resetViewport());
  };

  console.log('🗺️ MapScreen render - isMapReady:', isMapReady, 'hasError:', mapStatus.hasError);

  // Show error state if map failed to load
  if (mapStatus.hasError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Map Error</Text>
          <Text style={styles.errorMessage}>{mapStatus.error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleResetView}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapWrapper}>
        <MapContainer
          onLocationUpdate={handleLocationUpdate}
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
        
        {/* Navigation Controls */}
        <View style={styles.controlsContainer}>
          {/* Zoom Controls */}
          <View style={styles.zoomControls}>
            <TouchableOpacity 
              style={styles.controlButton} 
              onPress={handleZoomIn}
              accessibilityLabel="Zoom in"
            >
              <Text style={styles.controlButtonText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.controlButton} 
              onPress={handleZoomOut}
              accessibilityLabel="Zoom out"
            >
              <Text style={styles.controlButtonText}>−</Text>
            </TouchableOpacity>
          </View>

          {/* Location Controls */}
          <View style={styles.locationControls}>
            <TouchableOpacity 
              style={[
                styles.controlButton, 
                styles.locationButton,
                userLocation ? styles.locationButtonActive : styles.locationButtonInactive
              ]} 
              onPress={handleCenterOnUser}
              accessibilityLabel="Center on current location"
            >
              <Text style={styles.locationButtonText}>📍</Text>
            </TouchableOpacity>
          </View>
        </View>

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
    </SafeAreaView>
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
  controlsContainer: {
    position: 'absolute',
    right: 16,
    top: 60,
    zIndex: 1000,
  },
  zoomControls: {
    marginBottom: 16,
  },
  locationControls: {
    // Positioned below zoom controls
  },
  controlButton: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  controlButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  locationButton: {
    // Additional styles for location button
  },
  locationButtonActive: {
    backgroundColor: 'rgba(74, 144, 226, 0.95)',
  },
  locationButtonInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  locationButtonText: {
    fontSize: 20,
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