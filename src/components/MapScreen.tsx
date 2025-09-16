import React, { useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, Text } from 'react-native';
import MapContainer from './MapContainer';
import { MAPBOX_CONFIG } from '../config/mapbox';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setUserLocation } from '../store/slices/mapSlice';
import { selectMapStatus, selectMapAndLocation } from '../store/selectors';

interface MapScreenProps {
  // Props can be expanded for additional functionality
}

const MapScreen: React.FC<MapScreenProps> = () => {
  const dispatch = useAppDispatch();
  const mapStatus = useAppSelector(selectMapStatus);
  const { viewport, userLocation, isTracking } = useAppSelector(selectMapAndLocation);

  const handleLocationUpdate = (location: [number, number]) => {
    // Update Redux state with new location
    dispatch(setUserLocation(location));
    console.log('Location updated:', location);
  };

  // Show error state if map failed to load
  if (mapStatus.hasError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Map Error</Text>
          <Text style={styles.errorMessage}>{mapStatus.error}</Text>
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
  },
});

export default MapScreen;