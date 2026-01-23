import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getFogService } from './src/services/fogService';
import { MAPBOX_CONFIG, validateMapboxConfig } from './src/config/mapbox';
import { FogGeometry } from './src/types/fog';

type MapboxMap = {
  addControl: (control: unknown, position?: string) => void;
  addLayer: (layer: Record<string, unknown>) => void;
  addSource: (id: string, source: Record<string, unknown>) => void;
  easeTo: (options: { center: [number, number]; zoom: number; duration: number }) => void;
  getBounds: () => {
    getNorth: () => number;
    getSouth: () => number;
    getEast: () => number;
    getWest: () => number;
  };
  getLayer: (id: string) => Record<string, unknown> | undefined;
  getSource: (id: string) => { setData: (data: FogGeometry) => void } | undefined;
  getZoom: () => number;
  on: (event: string, handler: (...args: any[]) => void) => void;
  remove: () => void;
  removeLayer: (id: string) => void;
  removeSource: (id: string) => void;
};

type MapboxGL = {
  accessToken: string;
  Map: new (options: {
    container: HTMLElement;
    style: string;
    center: [number, number];
    zoom: number;
  }) => MapboxMap;
  NavigationControl: new () => unknown;
  ScaleControl: new (options: { maxWidth: number; unit: 'metric' | 'imperial' }) => unknown;
  GeolocateControl: new (options: {
    positionOptions: { enableHighAccuracy: boolean };
    trackUserLocation: boolean;
  }) => unknown;
};

type WebExploredArea = {
  latitude: number;
  longitude: number;
  radius: number;
  explored_at: string;
  accuracy?: number;
};

declare global {
  interface Window {
    mapboxgl?: MapboxGL;
  }
}

const MAPBOX_GL_JS_URL = 'https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.js';
const MAPBOX_GL_CSS_URL = 'https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.css';
const FOG_SOURCE_ID = 'fog-overlay';
const FOG_LAYER_ID = 'fog-overlay-layer';

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (window.mapboxgl) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Mapbox GL JS'));
    document.body.appendChild(script);
  });

const loadCss = (href: string) => {
  const existing = document.querySelector<HTMLLinkElement>(`link[href="${href}"]`);
  if (existing) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
};

const getRadiusForZoom = (zoom: number) => {
  if (zoom >= 15) return 75;
  if (zoom >= 12) return 120;
  if (zoom >= 9) return 200;
  return 300;
};

export default function App() {
  const mapContainerRef = useRef<View>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const fogServiceRef = useRef(getFogService());
  const exploredAreasRef = useRef<WebExploredArea[]>([]);

  const [isMapReady, setIsMapReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exploredAreas, setExploredAreas] = useState<WebExploredArea[]>([]);

  const mapStyle = useMemo(() => MAPBOX_CONFIG.DEFAULT_STYLE, []);

  useEffect(() => {
    exploredAreasRef.current = exploredAreas;
  }, [exploredAreas]);

  useEffect(() => {
    if (!validateMapboxConfig()) {
      setErrorMessage('Mapbox access token is missing or invalid.');
      return;
    }

    loadCss(MAPBOX_GL_CSS_URL);

    const initialize = async () => {
      try {
        await loadScript(MAPBOX_GL_JS_URL);
      } catch (error) {
        console.warn('Failed to load Mapbox GL JS:', error);
        setErrorMessage('Unable to load Mapbox GL JS.');
        return;
      }

      const mapboxgl = window.mapboxgl;
      if (!mapboxgl) {
        setErrorMessage('Mapbox GL JS is unavailable.');
        return;
      }

      mapboxgl.accessToken = MAPBOX_CONFIG.ACCESS_TOKEN;

      const container = mapContainerRef.current as unknown as HTMLDivElement | null;
      if (!container) {
        setErrorMessage('Unable to initialize map container.');
        return;
      }

      const map = new mapboxgl.Map({
        container,
        style: mapStyle,
        center: MAPBOX_CONFIG.DEFAULT_CENTER,
        zoom: MAPBOX_CONFIG.DEFAULT_ZOOM,
      });

      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-right');
      map.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
        }),
        'top-right'
      );

      const updateFog = () => {
        const mapInstance = mapRef.current;
        if (!mapInstance) return;

        const bounds = mapInstance.getBounds();
        const zoom = mapInstance.getZoom();
        const fogGeometry = fogServiceRef.current.generateFogGeometry(exploredAreasRef.current, zoom, {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        });

        const existingSource = mapInstance.getSource(FOG_SOURCE_ID);
        if (existingSource) {
          existingSource.setData(fogGeometry);
          return;
        }

        mapInstance.addSource(FOG_SOURCE_ID, {
          type: 'geojson',
          data: fogGeometry,
        });

        mapInstance.addLayer({
          id: FOG_LAYER_ID,
          type: 'fill',
          source: FOG_SOURCE_ID,
          paint: {
            'fill-color': '#0f172a',
            'fill-opacity': ['get', 'opacity'],
          },
        });
      };

      map.on('load', () => {
        setIsMapReady(true);
        updateFog();
      });

      map.on('moveend', () => {
        updateFog();
      });

      map.on('click', (event: { lngLat: { lat: number; lng: number } }) => {
        const zoom = map.getZoom();
        const radius = getRadiusForZoom(zoom);
        const nextArea: WebExploredArea = {
          latitude: event.lngLat.lat,
          longitude: event.lngLat.lng,
          radius,
          explored_at: new Date().toISOString(),
          accuracy: 12,
        };
        setExploredAreas(prev => [...prev, nextArea]);
        updateFog();
      });

      map.on('error', (event) => {
        console.warn('Mapbox GL JS error:', event.error ?? event);
        setErrorMessage('Map failed to load.');
      });

      mapRef.current = map;
    };

    initialize();

    return () => {
      if (mapRef.current) {
        if (mapRef.current.getLayer(FOG_LAYER_ID)) {
          mapRef.current.removeLayer(FOG_LAYER_ID);
        }
        if (mapRef.current.getSource(FOG_SOURCE_ID)) {
          mapRef.current.removeSource(FOG_SOURCE_ID);
        }
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapStyle]);

  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;
    const bounds = mapRef.current.getBounds();
    const zoom = mapRef.current.getZoom();
    const fogGeometry = fogServiceRef.current.generateFogGeometry(exploredAreas, zoom, {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
    const source = mapRef.current.getSource(FOG_SOURCE_ID);
    if (source) {
      source.setData(fogGeometry);
    }
  }, [exploredAreas, isMapReady]);

  const handleResetView = () => {
    if (!mapRef.current) return;
    mapRef.current.easeTo({
      center: MAPBOX_CONFIG.DEFAULT_CENTER,
      zoom: MAPBOX_CONFIG.DEFAULT_ZOOM,
      duration: MAPBOX_CONFIG.ANIMATION_DURATION,
    });
  };

  const handleClearExploration = () => {
    setExploredAreas([]);
  };

  return (
    <View style={styles.container}>
      <View ref={mapContainerRef} style={styles.map} />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.header}>
          <Text style={styles.title}>Cartographer Web</Text>
          <Text style={styles.subtitle}>
            Click the map to clear fog using the existing fog geometry system. Use the
            controls to zoom, locate, and explore.
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={handleResetView} style={styles.resetButton}>
            <Text style={styles.resetButtonText}>Reset view</Text>
          </Pressable>
          <Pressable onPress={handleClearExploration} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Reset fog</Text>
          </Pressable>
        </View>
        {!isMapReady && !errorMessage && (
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>Loading map...</Text>
          </View>
        )}
        {errorMessage && (
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>{errorMessage}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  map: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  header: {
    maxWidth: 420,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#cbd5f5',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  resetButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 14,
  },
  statusCard: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusText: {
    color: '#e2e8f0',
    fontSize: 13,
  },
});
