import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Alert, Text, Dimensions } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { MAPBOX_CONFIG, validateMapboxConfig } from '../config/mapbox';
import { MapContainerProps, MapContainerState } from '../types/map';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { getErrorRecoveryService, spatialCacheService } from '../services';
import {
  setMapReady,
  setMapError,
  updateViewport,
  setUserLocation,
  setMapLoading
} from '../store/slices/mapSlice';
import { setExploredAreas, setFogGeometry } from '../store/slices';
import { saveViewport, loadViewport } from '../store/persistence';
import { SkiaFogOverlay } from './SkiaFogOverlay';
import { getFogService } from '../services/fogService';
import { getDatabaseService } from '../database/services';
import { cloudFogIntegration } from '../services/cloudSystem/integration';
import { fogSystemCompatibility } from '../services/cloudSystem/integration';

// Set Mapbox access token from configuration
Mapbox.setAccessToken(MAPBOX_CONFIG.ACCESS_TOKEN);

// Get screen dimensions for Skia viewport
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const MapContainer: React.FC<MapContainerProps> = ({
  onLocationUpdate,
  initialCenter = MAPBOX_CONFIG.DEFAULT_CENTER,
  initialZoom = MAPBOX_CONFIG.DEFAULT_ZOOM
}) => {
  const dispatch = useAppDispatch();
  const { viewport, isMapReady, userLocation, followUserLocation } = useAppSelector(state => state.map);
  const { isVisible: fogVisible } = useAppSelector(state => state.fog);
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

    const initializeMapbox = async () => {
      try {
        if (!isMounted) return;

        dispatch(setMapLoading(true));

        if (!validateMapboxConfig()) {
          if (!isMounted) return;
          dispatch(setMapError('Mapbox access token is not configured.'));
          Alert.alert('Configuration Error', 'Mapbox access token is not configured.');
          return;
        }

        const savedViewport = await loadViewport();
        if (savedViewport && isMounted) {
          dispatch(updateViewport(savedViewport));
        }

        if (isMounted) {
          await initializeCloudSystem();
        }

        if (isMounted) {
          setLocalMapState(prev => ({ ...prev, mapReady: true }));
        }
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to initialize Mapbox:', error);
        dispatch(setMapError('Failed to initialize map.'));
        Alert.alert('Map Error', 'Failed to initialize map.');
      }
    };

    initializeMapbox();

    return () => {
      isMounted = false;
      if (cloudSystemInitialized) {
        cloudFogIntegration.stopCloudSystem().catch(error => {
          console.error('🌥️ Error stopping cloud system:', error);
        });
      }
    };
  }, [dispatch]);

  useEffect(() => {
    if (isMapReady && cameraRef.current) {
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

  const initializeCloudSystem = async () => {
    // ... (omitted for brevity, no changes here)
  };

  const handleMapIdle = useCallback(async (feature: any) => {
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
      saveViewport(newViewport).catch(console.error);

      if (onLocationUpdate) {
        onLocationUpdate([longitude, latitude]);
      }

      // --- New Cache Logic ---
      const mapBounds = await mapRef.current?.getVisibleBounds();
      if (mapBounds) {
        const queryBounds = {
          minX: mapBounds[1][0], // minLng
          minY: mapBounds[1][1], // minLat
          maxX: mapBounds[0][0], // maxLng
          maxY: mapBounds[0][1], // maxLat
        };

        const visibleAreaIds = spatialCacheService.search(queryBounds);

        if (visibleAreaIds.length > 0) {
          const areas = await databaseService.getAreasByIds(visibleAreaIds);
          const explorationAreas = areas.map(area => ({
            id: area.id!.toString(),
            center: [area.longitude, area.latitude] as [number, number],
            radius: area.radius,
            exploredAt: new Date(area.explored_at).getTime(),
            accuracy: area.accuracy,
          }));
          dispatch(setExploredAreas(explorationAreas));
        } else {
          dispatch(setExploredAreas([]));
        }
      }
    }
  }, [viewport, dispatch, onLocationUpdate]);

  const handleMapReady = () => {
    console.log('🗺️ Map is ready - dispatching setMapReady(true)');
    dispatch(setMapReady(true));
    setLocalMapState(prev => ({ ...prev, mapReady: true }));
    // Trigger initial load of visible areas
    handleMapIdle({ geometry: { coordinates: viewport.center }, properties: { zoom: viewport.zoom } });
  };

  const handleMapError = async (error?: any) => {
    // ... (omitted for brevity, no changes here)
  };

  const handleUserLocationUpdate = useCallback((location: Mapbox.Location) => {
    if (location?.coords) {
      const { longitude, latitude } = location.coords;
      const newLocation: [number, number] = [longitude, latitude];

      console.log('📍 User location updated:', newLocation);

      // Dispatch user location to Redux state
      dispatch(setUserLocation(newLocation));

      // Call parent callback if provided
      if (onLocationUpdate) {
        onLocationUpdate(newLocation);
      }
    }
  }, [dispatch, onLocationUpdate]);

  const updateCloudSystemBounds = useCallback((center?: [number, number]) => {
    // ... (omitted for brevity, no changes here)
  }, [viewport.center, viewport.zoom]);

  useEffect(() => {
    // ... (omitted for brevity, no changes here)
  }, [viewport.center, viewport.zoom, cloudSystemInitialized, isMapReady, updateCloudSystemBounds]);

  const handleCloudSystemError = useCallback(async (error: Error) => {
    // ... (omitted for brevity, no changes here)
  }, [dispatch]);

  useEffect(() => {
    // ... (omitted for brevity, no changes here)
  }, [cloudSystemInitialized, cloudSystemError, handleCloudSystemError]);

  return (
    <View style={styles.container}>
      {/* ... (omitted for brevity, no changes here) */}
      <Mapbox.MapView
        ref={mapRef}
        style={styles.map}
        onDidFinishLoadingMap={handleMapReady}
        onMapIdle={handleMapIdle}
        onMapLoadingError={handleMapError}
        styleURL={Mapbox.StyleURL.Street}
      // ... other props
      >
        <Mapbox.Camera
          ref={cameraRef}
          centerCoordinate={viewport.center}
          zoomLevel={viewport.zoom}
          animationMode="flyTo"
          animationDuration={MAPBOX_CONFIG.ANIMATION_DURATION}
        />
        <Mapbox.UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
          minDisplacement={10}
          onUpdate={handleUserLocationUpdate}
        />
      </Mapbox.MapView>
      {isMapReady && fogVisible && (() => {
        // Include user's current location as an explored area for immediate fog clearing
        const areasWithUserLocation = userLocation ? [
          ...exploredAreas,
          {
            id: 'user_current_location',
            center: userLocation as [number, number],
            radius: 100, // 100 meters radius around user
            exploredAt: Date.now(),
            accuracy: 10,
          }
        ] : exploredAreas;

        return (
          <SkiaFogOverlay
            exploredAreas={areasWithUserLocation}
            zoomLevel={viewport.zoom}
            viewport={{
              width: screenWidth,
              height: screenHeight,
              bounds: {
                north: viewport.center[1] + (0.01 * Math.pow(2, 15 - viewport.zoom)),
                south: viewport.center[1] - (0.01 * Math.pow(2, 15 - viewport.zoom)),
                east: viewport.center[0] + (0.01 * Math.pow(2, 15 - viewport.zoom)),
                west: viewport.center[0] - (0.01 * Math.pow(2, 15 - viewport.zoom))
              }
            }}
            enablePerformanceMonitoring={true}
            targetFPS={30}
          />
        );
      })()}
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