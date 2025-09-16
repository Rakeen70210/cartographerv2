import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { MAPBOX_CONFIG, validateMapboxConfig } from '../config/mapbox';
import { MapContainerProps, MapContainerState } from '../types/map';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  setMapReady, 
  setMapError, 
  updateViewport, 
  setUserLocation 
} from '../store/slices/mapSlice';
import { setFogGeometry } from '../store/slices/fogSlice';
import { saveViewport, loadViewport } from '../store/persistence';
import FogOverlay from './FogOverlay';
import { getFogService } from '../services/fogService';
import { getDatabaseService } from '../database/services';

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
  
  const [localMapState, setLocalMapState] = useState<MapContainerState>({
    mapReady: false,
    userLocation: null
  });

  useEffect(() => {
    // Initialize Mapbox when component mounts
    const initializeMapbox = async () => {
      try {
        // Validate Mapbox configuration
        if (!validateMapboxConfig()) {
          dispatch(setMapError('Mapbox access token is not configured. Please check the configuration file.'));
          Alert.alert(
            'Configuration Error', 
            'Mapbox access token is not configured. Please check the configuration file.'
          );
          return;
        }
        
        // Load persisted viewport
        const savedViewport = await loadViewport();
        if (savedViewport) {
          dispatch(updateViewport(savedViewport));
        }
        
        // Initialize fog overlay with explored areas
        await initializeFogOverlay();
        
        // Request location permissions if needed
        // This will be handled by the location service in later tasks
        setLocalMapState(prev => ({ ...prev, mapReady: true }));
      } catch (error) {
        console.error('Failed to initialize Mapbox:', error);
        dispatch(setMapError('Failed to initialize map. Please check your internet connection.'));
        Alert.alert('Map Error', 'Failed to initialize map. Please check your internet connection.');
      }
    };

    initializeMapbox();
  }, [dispatch]);

  // Initialize fog overlay with explored areas from database
  const initializeFogOverlay = async () => {
    try {
      const exploredAreas = await databaseService.getAllExploredAreas();
      const fogGeometry = fogService.generateFogGeometry(exploredAreas);
      dispatch(setFogGeometry(fogGeometry));
    } catch (error) {
      console.error('Failed to initialize fog overlay:', error);
      // Continue without fog overlay if initialization fails
    }
  };

  // Update fog when explored areas change
  useEffect(() => {
    if (exploredAreas && exploredAreas.length >= 0) {
      const fogGeometry = fogService.generateFogGeometry(exploredAreas);
      dispatch(setFogGeometry(fogGeometry));
    }
  }, [exploredAreas, dispatch, fogService]);

  const handleRegionDidChange = (feature: any) => {
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
      
      dispatch(updateViewport(newViewport));
      
      // Save viewport to persistence
      saveViewport(newViewport).catch(error => {
        console.error('Failed to save viewport:', error);
      });
      
      if (onLocationUpdate) {
        onLocationUpdate([longitude, latitude]);
      }
    }
  };

  const handleMapReady = () => {
    console.log('Map is ready');
    dispatch(setMapReady(true));
    setLocalMapState(prev => ({ ...prev, mapReady: true }));
  };

  const handleMapError = () => {
    console.error('Map error occurred');
    dispatch(setMapError('An error occurred while loading the map.'));
    Alert.alert('Map Error', 'An error occurred while loading the map.');
  };

  const handleUserLocationUpdate = (location: Mapbox.Location) => {
    if (location.coords) {
      const coordinates: [number, number] = [location.coords.longitude, location.coords.latitude];
      dispatch(setUserLocation(coordinates));
      setLocalMapState(prev => ({ ...prev, userLocation: coordinates }));
      
      if (onLocationUpdate) {
        onLocationUpdate(coordinates);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        ref={mapRef}
        style={styles.map}
        onDidFinishLoadingMap={handleMapReady}
        onDidFailLoadingMap={handleMapError}
        onRegionDidChange={handleRegionDidChange}
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

        {/* Fog overlay */}
        {fogGeometry && (
          <FogOverlay
            exploredAreas={exploredAreas || []}
            animationSpeed={animationSpeed}
            cloudDensity={cloudDensity}
            visible={fogVisible}
            onFogCleared={(area) => {
              console.log('Fog cleared for area:', area);
            }}
          />
        )}
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
});

export default MapContainer;