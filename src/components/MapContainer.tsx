import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Alert, Text } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { MAPBOX_CONFIG, validateMapboxConfig } from '../config/mapbox';
import { MapContainerProps, MapContainerState } from '../types/map';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { getErrorRecoveryService } from '../services/errorRecoveryService';
import { 
  setMapReady, 
  setMapError, 
  updateViewport, 
  setUserLocation,
  setMapLoading
} from '../store/slices/mapSlice';
import { setFogGeometry, setFogVisible } from '../store/slices/fogSlice';
import { saveViewport, loadViewport } from '../store/persistence';
import FogOverlay from './FogOverlay';
import { getFogService } from '../services/fogService';
import { getDatabaseService } from '../database/services';
import { cloudFogIntegration } from '../services/cloudSystem/integration';
import { fogSystemCompatibility } from '../services/cloudSystem/integration';

// Set Mapbox access token from configuration
Mapbox.setAccessToken(MAPBOX_CONFIG.ACCESS_TOKEN);

const MapContainer: React.FC<MapContainerProps> = ({
  onLocationUpdate,
  initialCenter = MAPBOX_CONFIG.DEFAULT_CENTER,
  initialZoom = MAPBOX_CONFIG.DEFAULT_ZOOM
}) => {
  const dispatch = useAppDispatch();
  const { viewport, isMapReady, userLocation, followUserLocation } = useAppSelector(state => state.map);
  const { fogGeometry, isVisible: fogVisible, animationSpeed, cloudDensity } = useAppSelector(state => state.fog);
  const { exploredAreas } = useAppSelector(state => state.exploration);
  
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const fogService = getFogService();
  const databaseService = getDatabaseService();
  const errorRecoveryService = getErrorRecoveryService();
  const [cloudSystemInitialized, setCloudSystemInitialized] = useState(false);
  const [cloudSystemError, setCloudSystemError] = useState<string | null>(null);
  
  const [localMapState, setLocalMapState] = useState<MapContainerState>({
    mapReady: false,
    userLocation: null
  });

  useEffect(() => {
    let isMounted = true;
    
    // Initialize Mapbox when component mounts
    const initializeMapbox = async () => {
      try {
        if (!isMounted) return;
        
        dispatch(setMapLoading(true));
        
        // Validate Mapbox configuration
        if (!validateMapboxConfig()) {
          if (!isMounted) return;
          dispatch(setMapError('Mapbox access token is not configured. Please check the configuration file.'));
          Alert.alert(
            'Configuration Error', 
            'Mapbox access token is not configured. Please check the configuration file.'
          );
          return;
        }
        
        // Load persisted viewport
        const savedViewport = await loadViewport();
        if (savedViewport && isMounted) {
          dispatch(updateViewport(savedViewport));
        }
        
        // Initialize fog overlay with explored areas
        if (isMounted) {
          await initializeFogOverlay();
        }

        // Initialize cloud system integration
        if (isMounted) {
          await initializeCloudSystem();
        }
        
        // Request location permissions if needed
        // This will be handled by the location service in later tasks
        if (isMounted) {
          setLocalMapState(prev => ({ ...prev, mapReady: true }));
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to initialize Mapbox:', error);
        dispatch(setMapError('Failed to initialize map. Please check your internet connection.'));
        Alert.alert('Map Error', 'Failed to initialize map. Please check your internet connection.');
      }
    };

    initializeMapbox();
    
    return () => {
      isMounted = false;
      
      // Cleanup cloud system
      if (cloudSystemInitialized) {
        cloudFogIntegration.stopCloudSystem().catch(error => {
          console.error('🌥️ Error stopping cloud system:', error);
        });
      }
    };
  }, [dispatch]);

  // Watch for viewport changes from Redux and update camera
  useEffect(() => {
    if (isMapReady && cameraRef.current) {
      // Debounce camera updates to prevent excessive re-renders
      const timeoutId = setTimeout(() => {
        if (cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: viewport.center,
            zoomLevel: viewport.zoom,
            ...(viewport.bearing !== undefined && { bearing: viewport.bearing }),
            ...(viewport.pitch !== undefined && { pitch: viewport.pitch }),
            animationDuration: MAPBOX_CONFIG.ANIMATION_DURATION,
          });
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [viewport.center, viewport.zoom, viewport.bearing, viewport.pitch, isMapReady]);

  // Initialize cloud system integration
  const initializeCloudSystem = async () => {
    try {
      console.log('🌥️ Initializing cloud system integration...');
      
      // Configure cloud fog integration
      cloudFogIntegration.configure({
        enableCloudSystem: true,
        fallbackToTraditionalFog: true,
        debugMode: true // Enable debug mode for development
      });

      // Configure fog system compatibility
      fogSystemCompatibility.configure({
        enableFallback: true,
        preferCloudSystem: true,
        syncBothSystems: false, // Use cloud system primarily
        debugMode: true
      });

      // Wait for the integration to be ready
      let attempts = 0;
      const maxAttempts = 10;
      while (!cloudFogIntegration.isReady() && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }

      if (!cloudFogIntegration.isReady()) {
        console.warn('🌥️ Cloud integration not ready after waiting, proceeding anyway...');
      }

      // Start cloud system (will fallback to traditional fog if cloud system fails)
      const cloudStarted = await cloudFogIntegration.startCloudSystem();
      
      if (cloudStarted) {
        console.log('🌥️ Cloud system started successfully');
        setCloudSystemInitialized(true);
        setCloudSystemError(null);
      } else {
        console.log('🌥️ Cloud system failed to start, using traditional fog');
        setCloudSystemError('Cloud system unavailable, using traditional fog');
      }

    } catch (error) {
      console.error('🌥️ Failed to initialize cloud system:', error);
      setCloudSystemError(`Cloud system error: ${error}`);
      
      // Ensure traditional fog is working as fallback
      try {
        await fogSystemCompatibility.fallbackToTraditionalFog();
        console.log('🌥️ Fallback to traditional fog successful');
      } catch (fallbackError) {
        console.error('🌥️ Fallback to traditional fog failed:', fallbackError);
      }
    }
  };

  // Initialize fog overlay with explored areas from database
  const initializeFogOverlay = async () => {
    try {
      console.log('🌫️ Initializing fog overlay...');
      const exploredAreas = await databaseService.getAllExploredAreas();
      console.log('🌫️ Retrieved explored areas:', exploredAreas.length);
      
      // Generate fog geometry with current zoom level
      const fogGeometry = fogService.generateFogGeometry(exploredAreas, viewport.zoom);
      console.log('🌫️ Generated fog geometry with', fogGeometry.features.length, 'features');
      
      dispatch(setFogGeometry(fogGeometry));
    } catch (error) {
      console.error('🌫️ Failed to initialize fog overlay:', error);
      
      // Create fallback fog geometry to ensure something is visible
      try {
        console.log('🌫️ Creating fallback fog geometry...');
        const fallbackGeometry = fogService.generateFogGeometry([], viewport.zoom);
        dispatch(setFogGeometry(fallbackGeometry));
      } catch (fallbackError) {
        console.error('🌫️ Failed to create fallback fog geometry:', fallbackError);
      }
      
      // Handle database error through recovery service
      const recovered = await errorRecoveryService.handleDatabaseError(
        error as Error,
        'initializeFogOverlay'
      );
      
      if (recovered) {
        // Retry initialization after recovery
        try {
          const exploredAreas = await databaseService.getAllExploredAreas();
          const fogGeometry = fogService.generateFogGeometry(exploredAreas, viewport.zoom);
          dispatch(setFogGeometry(fogGeometry));
        } catch (retryError) {
          console.error('🌫️ Failed to initialize fog overlay after recovery:', retryError);
        }
      }
    }
  };

  // Update fog when explored areas change (now handled by integration service)
  useEffect(() => {
    // The fog geometry is now managed by the fogLocationIntegrationService
    // This effect is kept for backward compatibility but the integration service
    // will handle real-time fog updates
    if (exploredAreas && exploredAreas.length >= 0) {
      console.log(`Fog overlay updated with ${exploredAreas.length} explored areas`);
    }
  }, [exploredAreas.length]); // Only depend on length to prevent unnecessary re-renders

  const handleRegionDidChange = useCallback((feature: any) => {
    // Handle map region changes for viewport persistence
    const { geometry, properties } = feature;
    if (geometry && geometry.coordinates && properties) {
      const [longitude, latitude] = geometry.coordinates;
      const newViewport = {
        center: [longitude, latitude] as [number, number],
        zoom: properties.zoom || viewport.zoom,
        bearing: properties.bearing || viewport.bearing,
        pitch: properties.pitch || viewport.pitch,
      };
      
      // Only update if the viewport has actually changed significantly
      const centerChanged = Math.abs(newViewport.center[0] - viewport.center[0]) > 0.001 || 
                           Math.abs(newViewport.center[1] - viewport.center[1]) > 0.001;
      const zoomChanged = Math.abs(newViewport.zoom - viewport.zoom) > 0.1;
      
      if (centerChanged || zoomChanged) {
        dispatch(updateViewport(newViewport));
        
        // Save viewport to persistence
        saveViewport(newViewport).catch(error => {
          console.error('Failed to save viewport:', error);
        });
      }
      
      if (onLocationUpdate) {
        onLocationUpdate([longitude, latitude]);
      }
    }
  }, [viewport.center, viewport.zoom, viewport.bearing, viewport.pitch, dispatch, onLocationUpdate]);

  const handleMapReady = () => {
    console.log('🗺️ Map is ready - dispatching setMapReady(true)');
    dispatch(setMapReady(true));
    setLocalMapState(prev => ({ ...prev, mapReady: true }));
  };

  const handleMapError = async (error?: any) => {
    console.error('Map error occurred:', error);
    
    // Handle error through recovery service
    const errorObj = error || new Error('Map loading failed');
    const recovered = await errorRecoveryService.handleMapboxError(
      errorObj,
      'mapLoading',
      { viewport, mapReady: isMapReady }
    );
    
    if (!recovered) {
      dispatch(setMapError('An error occurred while loading the map.'));
      Alert.alert(
        'Map Error', 
        'An error occurred while loading the map. Please check your internet connection and try again.',
        [
          { text: 'Retry', onPress: () => window.location.reload() },
          { text: 'OK', style: 'cancel' }
        ]
      );
    }
  };

  const handleUserLocationUpdate = useCallback((location: Mapbox.Location) => {
    if (location.coords) {
      const coordinates: [number, number] = [location.coords.longitude, location.coords.latitude];
      
      // Check if location has changed significantly to prevent excessive updates
      if (userLocation) {
        const distance = Math.sqrt(
          Math.pow(coordinates[0] - userLocation[0], 2) + 
          Math.pow(coordinates[1] - userLocation[1], 2)
        );
        
        // Only update if location changed by more than ~10 meters (rough calculation)
        if (distance < 0.0001) {
          return;
        }
      }
      
      dispatch(setUserLocation(coordinates));
      setLocalMapState(prev => ({ ...prev, userLocation: coordinates }));
      
      // Update cloud system with new map bounds if active
      if (cloudSystemInitialized) {
        updateCloudSystemBounds(coordinates);
      }
      
      if (onLocationUpdate) {
        onLocationUpdate(coordinates);
      }
    }
  }, [userLocation, dispatch, onLocationUpdate, cloudSystemInitialized]);

  // Update cloud system with current map bounds
  const updateCloudSystemBounds = useCallback((center?: [number, number]) => {
    try {
      const mapCenter = center || viewport.center;
      
      // Calculate approximate bounds based on zoom level
      const zoomFactor = Math.pow(2, 15 - viewport.zoom);
      const latDelta = zoomFactor * 0.01;
      const lngDelta = zoomFactor * 0.01;
      
      const bounds = {
        north: mapCenter[1] + latDelta,
        south: mapCenter[1] - latDelta,
        east: mapCenter[0] + lngDelta,
        west: mapCenter[0] - lngDelta
      };

      // Update cloud system bounds
      cloudFogIntegration.updateMapBounds(bounds);
      cloudFogIntegration.setZoomLevel(viewport.zoom);

    } catch (error) {
      console.error('🌥️ Error updating cloud system bounds:', error);
    }
  }, [viewport.center, viewport.zoom]);

  // Handle cloud system lifecycle when map viewport changes
  useEffect(() => {
    if (cloudSystemInitialized && isMapReady) {
      // Debounce cloud system updates
      const timeoutId = setTimeout(() => {
        updateCloudSystemBounds();
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [viewport.center, viewport.zoom, cloudSystemInitialized, isMapReady, updateCloudSystemBounds]);



  // Handle cloud system errors and fallback
  const handleCloudSystemError = useCallback(async (error: Error) => {
    console.error('🌥️ Cloud system error:', error);
    setCloudSystemError(error.message);
    
    try {
      // Attempt fallback to traditional fog
      await fogSystemCompatibility.fallbackToTraditionalFog();
      console.log('🌥️ Successfully fell back to traditional fog');
      
      // Update Redux state to show traditional fog
      dispatch(setFogVisible(true));
      
    } catch (fallbackError) {
      console.error('🌥️ Fallback to traditional fog failed:', fallbackError);
      
      // Show error to user
      Alert.alert(
        'Fog System Error',
        'Both cloud and traditional fog systems failed. Map exploration may not work correctly.',
        [{ text: 'OK' }]
      );
    }
  }, [dispatch]);

  // Monitor cloud system status
  useEffect(() => {
    if (cloudSystemInitialized) {
      const statusInterval = setInterval(() => {
        const status = cloudFogIntegration.getStatus();
        
        if (status.hasError && !cloudSystemError) {
          handleCloudSystemError(new Error(status.errorMessage || 'Unknown cloud system error'));
        }
      }, 5000); // Check every 5 seconds
      
      return () => clearInterval(statusInterval);
    }
  }, [cloudSystemInitialized, cloudSystemError, handleCloudSystemError]);

  console.log('🗺️ MapContainer rendering, isMapReady:', isMapReady, 'cloudSystemInitialized:', cloudSystemInitialized);

  return (
    <View style={styles.container}>
      {/* Cloud System Status Indicator (Development Only) */}
      {__DEV__ && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Cloud System: {cloudSystemInitialized ? '✅' : '❌'}
          </Text>
          {cloudSystemError && (
            <Text style={styles.debugError}>
              Error: {cloudSystemError}
            </Text>
          )}
        </View>
      )}
      
      <Mapbox.MapView
        ref={mapRef}
        style={styles.map}
        onDidFinishLoadingMap={handleMapReady}
        onDidFailLoadingMap={handleMapError}
        styleURL={Mapbox.StyleURL.Street} // Google Maps-like street style
        compassEnabled={MAPBOX_CONFIG.COMPASS_ENABLED}
        compassViewPosition={3} // Top right
        compassViewMargins={{ x: 16, y: 64 }}
        scaleBarEnabled={MAPBOX_CONFIG.SCALE_BAR_ENABLED}
        attributionEnabled={MAPBOX_CONFIG.ATTRIBUTION_ENABLED}
        attributionPosition={{ bottom: 8, left: 8 }}
        logoEnabled={MAPBOX_CONFIG.LOGO_ENABLED}
        logoPosition={{ bottom: 8, right: 8 }}
      >
        <Mapbox.Camera
          ref={cameraRef}
          centerCoordinate={viewport.center}
          zoomLevel={viewport.zoom}
          animationMode="flyTo"
          animationDuration={MAPBOX_CONFIG.ANIMATION_DURATION}
        />

        {/* User location tracking */}
        <Mapbox.UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
          minDisplacement={10}
          onUpdate={handleUserLocationUpdate}
        />

        {/* WORKING CLOUD FOG OVERLAY */}
        {isMapReady && fogVisible && (
          <FogOverlay
            exploredAreas={exploredAreas}
            animationSpeed={animationSpeed}
            cloudDensity={cloudDensity}
            visible={fogVisible}
            zoomLevel={viewport.zoom}
            onFogCleared={(area) => {
              console.log('🌫️ Fog cleared in area:', area);
            }}
          />
        )}

        {/* Original Beautiful Cloud-Based Fog Overlay - commented out for testing */}
        {/* {isMapReady && fogVisible && (
          <FogOverlay
            exploredAreas={exploredAreas}
            animationSpeed={animationSpeed}
            cloudDensity={cloudDensity}
            visible={fogVisible}
            zoomLevel={viewport.zoom}
            onFogCleared={(area) => {
              console.log('🌫️ Fog cleared in area:', area);
            }}
          />
        )} */}
      </Mapbox.MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  debugInfo: {
    position: 'absolute',
    top: 100,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 4,
    zIndex: 1000,
  },
  debugText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  debugError: {
    color: '#ff6b6b',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 4,
  },
});

export default MapContainer;