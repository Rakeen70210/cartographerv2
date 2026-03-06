import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { MAPBOX_CONFIG, validateMapboxConfig } from '../config/mapbox';
import { MapContainerProps } from '../types/map';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setMapError,
  setMapLoading,
  setMapReady,
  setUserLocation,
  updateViewport,
} from '../store/slices/mapSlice';
import { setExploredAreas } from '../store/slices';
import { saveViewport, loadViewport } from '../store/persistence';
import { getDatabaseService } from '../database/services';
import { spatialCacheService } from '../services/spatialCacheService';
import { getFogService } from '../services/fogService';
import { BoundingBox, FogGeometry } from '../types/fog';
import { MapboxCloudLayer } from '../services/cloudSystem/integration';
import { cloudFogIntegration, fogSystemCompatibility } from '../services/cloudSystem/integration';
import { getMockCloudRenderingEngine } from '../services/cloudSystem/MockCloudRenderingEngine';
import { ShaderSystem } from '../services/cloudSystem/shaders/ShaderSystem';
import { WebTextureManager } from '../services/cloudSystem/textures/WebTextureManager';
import { WebGLFeatureDetector } from '../services/cloudSystem/performance/WebGLFeatureDetector';
import { ExplorationArea } from '../types/exploration';
import { fogLocationIntegrationService } from '../services';

type MapboxMap = {
  addControl: (control: unknown, position?: string) => void;
  addLayer: (layer: Record<string, unknown>) => void;
  addSource: (id: string, source: Record<string, unknown>) => void;
  easeTo: (options: {
    center?: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
    duration?: number;
  }) => void;
  getBounds: () => {
    getNorth: () => number;
    getSouth: () => number;
    getEast: () => number;
    getWest: () => number;
  };
  getCenter: () => { lng: number; lat: number };
  getLayer: (id: string) => Record<string, unknown> | undefined;
  getSource: (id: string) => { setData: (data: FogGeometry) => void } | undefined;
  getZoom: () => number;
  getBearing: () => number;
  getPitch: () => number;
  on: (event: string, handler: (...args: any[]) => void) => void;
  remove: () => void;
  removeLayer: (id: string) => void;
  removeSource: (id: string) => void;
  setLayoutProperty: (layerId: string, name: string, value: unknown) => void;
  setPaintProperty: (layerId: string, name: string, value: unknown) => void;
};

type MapboxGL = {
  accessToken: string;
  supported?: (options?: { failIfMajorPerformanceCaveat?: boolean }) => boolean;
  setTelemetryEnabled?: (enabled: boolean) => void;
  Map: new (options: {
    container: HTMLElement;
    style: string;
    center: [number, number];
    zoom: number;
    bearing?: number;
    pitch?: number;
  }) => MapboxMap;
  NavigationControl: new () => unknown;
  ScaleControl: new (options: { maxWidth: number; unit: 'metric' | 'imperial' }) => unknown;
  GeolocateControl: new (options: {
    positionOptions: { enableHighAccuracy: boolean };
    trackUserLocation: boolean;
  }) => {
    on: (event: string, handler: (...args: any[]) => void) => void;
  };
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
const CLOUD_LAYER_ID = 'cloud-system-layer';
const MAX_MERCATOR_LATITUDE = 85.051129;
const MOVE_REFRESH_THROTTLE_MS = 100;
const FOG_COVERAGE_BUFFER_RATIO = 0.75;
const EXPLORATION_COVERAGE_BUFFER_RATIO = 0.5;
const COVERAGE_REFRESH_THRESHOLD_RATIO = 0.2;

type QueryBounds = { minX: number; minY: number; maxX: number; maxY: number };
type ExplorationStateArea = {
  id: string;
  center: [number, number];
  radius: number;
  exploredAt: number;
  accuracy?: number;
};

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

const waitForStylesheet = (link: HTMLLinkElement) =>
  new Promise<boolean>((resolve) => {
    if (link.sheet) {
      resolve(true);
      return;
    }

    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      link.removeEventListener('load', onLoad);
      link.removeEventListener('error', onError);
      clearTimeout(timeoutId);
      resolve(ok);
    };

    const onLoad = () => finish(true);
    const onError = () => finish(false);
    const timeoutId = window.setTimeout(() => finish(!!link.sheet), 3000);

    link.addEventListener('load', onLoad);
    link.addEventListener('error', onError);
  });

const ensureMapboxCss = async (href: string): Promise<boolean> => {
  const existing = document.querySelector<HTMLLinkElement>(`link[href="${href}"]`);
  if (existing) {
    return await waitForStylesheet(existing);
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
  return await waitForStylesheet(link);
};

const ensureMapboxFallbackCss = () => {
  const STYLE_ID = 'mapboxgl-fallback-css';
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .mapboxgl-map{position:relative;width:100%;height:100%;overflow:hidden;-webkit-tap-highlight-color:rgba(0,0,0,0)}
    .mapboxgl-canvas{position:absolute;left:0;top:0}
    .mapboxgl-canvas-container{height:100%;width:100%}
    .mapboxgl-canary{background-color:salmon}
    .mapboxgl-control-container{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none}
    .mapboxgl-ctrl-top-right{position:absolute;top:0;right:0;pointer-events:auto}
    .mapboxgl-ctrl-bottom-right{position:absolute;bottom:0;right:0;pointer-events:auto}
    .mapboxgl-ctrl{margin:10px}
  `;
  document.head.appendChild(style);
};

const detectWebGLSupport = (): { supported: boolean; reason?: string } => {
  try {
    const canvas = document.createElement('canvas');
    const webgl2 = canvas.getContext('webgl2');
    if (webgl2) {
      return { supported: true };
    }

    const webgl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (webgl) {
      return { supported: true };
    }

    return { supported: false, reason: 'No WebGL context could be created by the browser.' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown WebGL capability error.';
    return { supported: false, reason };
  }
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const normalizeFogBounds = (bounds: {
  getNorth: () => number;
  getSouth: () => number;
  getEast: () => number;
  getWest: () => number;
}): BoundingBox => {
  const north = clamp(bounds.getNorth(), -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
  const south = clamp(bounds.getSouth(), -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
  const east = bounds.getEast();
  const west = bounds.getWest();

  // At low zoom, Mapbox can return world-copy longitudes outside [-180, 180].
  // Generate fog in canonical world bounds to keep polygons renderable.
  if (!Number.isFinite(east) || !Number.isFinite(west) || east <= west || east > 180 || west < -180) {
    return {
      north,
      south,
      east: 180,
      west: -180,
    };
  }

  return {
    north,
    south,
    east: clamp(east, -180, 180),
    west: clamp(west, -180, 180),
  };
};

const expandBounds = (bounds: BoundingBox, ratio: number): BoundingBox => {
  const latSpan = Math.max(0.0001, bounds.north - bounds.south);
  const lngSpan = Math.max(0.0001, bounds.east - bounds.west);
  const latPadding = latSpan * ratio;
  const lngPadding = lngSpan * ratio;
  return {
    north: clamp(bounds.north + latPadding, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE),
    south: clamp(bounds.south - latPadding, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE),
    east: clamp(bounds.east + lngPadding, -180, 180),
    west: clamp(bounds.west - lngPadding, -180, 180),
  };
};

const boundsToQueryBounds = (bounds: BoundingBox): QueryBounds => ({
  minX: bounds.west,
  minY: bounds.south,
  maxX: bounds.east,
  maxY: bounds.north,
});

const shouldRefreshCoverage = (
  viewportBounds: BoundingBox,
  currentCoverage: BoundingBox | null,
  thresholdRatio: number
): boolean => {
  if (!currentCoverage) {
    return true;
  }

  const latSpan = currentCoverage.north - currentCoverage.south;
  const lngSpan = currentCoverage.east - currentCoverage.west;
  const latMargin = latSpan * thresholdRatio;
  const lngMargin = lngSpan * thresholdRatio;

  return (
    viewportBounds.north >= currentCoverage.north - latMargin ||
    viewportBounds.south <= currentCoverage.south + latMargin ||
    viewportBounds.east >= currentCoverage.east - lngMargin ||
    viewportBounds.west <= currentCoverage.west + lngMargin
  );
};

const MapContainer: React.FC<MapContainerProps> = ({
  onLocationUpdate,
  initialCenter = MAPBOX_CONFIG.DEFAULT_CENTER,
  initialZoom = MAPBOX_CONFIG.DEFAULT_ZOOM,
}) => {
  const dispatch = useAppDispatch();
  const { viewport, followUserLocation } = useAppSelector(state => state.map);
  const { exploredAreas } = useAppSelector(state => state.exploration);
  const fogVisible = useAppSelector(state => state.fog.isVisible);
  const fogOpacity = useAppSelector(state => state.fog.opacity);
  const cloudSystemEnabled = useAppSelector(state => state.fog.cloudSystemEnabled);
  const cloudSystemError = useAppSelector(state => state.fog.cloudSystemError);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const mapLoadedRef = useRef(false);
  const isApplyingViewportRef = useRef(false);
  const initRequestIdRef = useRef(0);
  const lastBoundsRef = useRef<QueryBounds | null>(null);
  const cacheRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cacheRefreshRequestIdRef = useRef(0);
  const lastMoveRefreshTimeRef = useRef(0);
  const fogCoverageBoundsRef = useRef<BoundingBox | null>(null);
  const explorationCoverageBoundsRef = useRef<BoundingBox | null>(null);
  const databaseService = getDatabaseService();
  const fogServiceRef = useRef(getFogService());
  const cloudLayerRef = useRef<MapboxCloudLayer | null>(null);
  const cloudEngineRef = useRef(getMockCloudRenderingEngine());
  const shaderSystemRef = useRef(new ShaderSystem());
  const textureManagerRef = useRef(new WebTextureManager());
  const [cloudSystemInitialized, setCloudSystemInitialized] = useState(false);

  const mapStyle = useMemo(() => MAPBOX_CONFIG.DEFAULT_STYLE, []);

  const followUserLocationRef = useRef(followUserLocation);
  const onLocationUpdateRef = useRef(onLocationUpdate);
  const exploredAreasRef = useRef(exploredAreas);
  const fogVisibleRef = useRef(fogVisible);
  const fogOpacityRef = useRef(fogOpacity);
  const cloudSystemEnabledRef = useRef(cloudSystemEnabled);
  const cloudSystemErrorRef = useRef(cloudSystemError);
  const viewportRef = useRef(viewport);

  useEffect(() => {
    followUserLocationRef.current = followUserLocation;
  }, [followUserLocation]);

  useEffect(() => {
    onLocationUpdateRef.current = onLocationUpdate;
  }, [onLocationUpdate]);

  useEffect(() => {
    exploredAreasRef.current = exploredAreas;
  }, [exploredAreas]);

  useEffect(() => {
    fogVisibleRef.current = fogVisible;
  }, [fogVisible]);

  useEffect(() => {
    fogOpacityRef.current = fogOpacity;
  }, [fogOpacity]);

  useEffect(() => {
    cloudSystemEnabledRef.current = cloudSystemEnabled;
  }, [cloudSystemEnabled]);

  useEffect(() => {
    cloudSystemErrorRef.current = cloudSystemError;
  }, [cloudSystemError]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  const loadExplorationAreasForBounds = useCallback(async (bounds: QueryBounds): Promise<ExplorationStateArea[]> => {
    const requestId = ++cacheRefreshRequestIdRef.current;
    const visibleAreaIds = spatialCacheService.search(bounds);

    if (visibleAreaIds.length > 0) {
      const areas = await databaseService.getAreasByIds(visibleAreaIds);
      if (requestId !== cacheRefreshRequestIdRef.current) {
        return exploredAreasRef.current;
      }

      const explorationAreas = areas.map(area => ({
        id: area.id!.toString(),
        center: [area.longitude, area.latitude] as [number, number],
        radius: area.radius,
        exploredAt: new Date(area.explored_at).getTime(),
        accuracy: area.accuracy,
      }));
      exploredAreasRef.current = explorationAreas;
      dispatch(setExploredAreas(explorationAreas));
      return explorationAreas;
    } else if (requestId === cacheRefreshRequestIdRef.current) {
      exploredAreasRef.current = [];
      dispatch(setExploredAreas([]));
      return [];
    }
    return exploredAreasRef.current;
  }, [databaseService, dispatch]);

  const applyFogVisibility = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(FOG_LAYER_ID)) {
      return;
    }
    map.setLayoutProperty(FOG_LAYER_ID, 'visibility', fogVisibleRef.current ? 'visible' : 'none');
    map.setPaintProperty(FOG_LAYER_ID, 'fill-opacity', ['*', ['coalesce', ['get', 'opacity'], 1], fogOpacityRef.current]);
  }, []);

  const updateFogLayer = useCallback((fogBoundsOverride?: BoundingBox, exploredAreasOverride?: ExplorationStateArea[]) => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;

    const zoom = map.getZoom();
    const fogBounds = fogBoundsOverride ?? normalizeFogBounds(map.getBounds());
    const fogGeometry = fogServiceRef.current.generateFogGeometry(
      exploredAreasOverride ?? exploredAreasRef.current,
      zoom,
      fogBounds
    );

    const existingSource = map.getSource(FOG_SOURCE_ID);
    if (existingSource) {
      existingSource.setData(fogGeometry);
      applyFogVisibility();
      return;
    }

    map.addSource(FOG_SOURCE_ID, {
      type: 'geojson',
      data: fogGeometry,
    });

    map.addLayer({
      id: FOG_LAYER_ID,
      type: 'fill',
      source: FOG_SOURCE_ID,
      layout: {
        'visibility': fogVisibleRef.current ? 'visible' : 'none',
      },
      paint: {
        'fill-antialias': false,
        'fill-color': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, '#263341',
          6, '#1f2a36',
          12, '#18222d',
        ],
        'fill-opacity': ['*', ['coalesce', ['get', 'opacity'], 1], fogOpacityRef.current],
      },
    });

    applyFogVisibility();
  }, [applyFogVisibility]);

  const refreshCoverage = useCallback(async (forceRefresh: boolean = false): Promise<boolean> => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) {
      return false;
    }

    const viewportBounds = normalizeFogBounds(map.getBounds());
    const needsExplorationRefresh = forceRefresh || shouldRefreshCoverage(
      viewportBounds,
      explorationCoverageBoundsRef.current,
      COVERAGE_REFRESH_THRESHOLD_RATIO
    );
    const needsFogRefresh = forceRefresh || shouldRefreshCoverage(
      viewportBounds,
      fogCoverageBoundsRef.current,
      COVERAGE_REFRESH_THRESHOLD_RATIO
    );

    if (!needsExplorationRefresh && !needsFogRefresh) {
      return false;
    }

    const nextExplorationCoverage = expandBounds(viewportBounds, EXPLORATION_COVERAGE_BUFFER_RATIO);
    const nextFogCoverage = expandBounds(viewportBounds, FOG_COVERAGE_BUFFER_RATIO);

    let nextAreas = exploredAreasRef.current;
    if (needsExplorationRefresh) {
      explorationCoverageBoundsRef.current = nextExplorationCoverage;
      const queryBounds = boundsToQueryBounds(nextExplorationCoverage);
      lastBoundsRef.current = queryBounds;
      nextAreas = await loadExplorationAreasForBounds(queryBounds);
    }

    if (needsFogRefresh || needsExplorationRefresh) {
      fogCoverageBoundsRef.current = nextFogCoverage;
      updateFogLayer(nextFogCoverage, nextAreas);
    }

    return true;
  }, [loadExplorationAreasForBounds, updateFogLayer]);

  const initializeCloudLayer = useCallback(() => {
    if (!mapRef.current || cloudLayerRef.current) {
      return;
    }

    const detector = WebGLFeatureDetector.getInstance();
    const capabilities = detector.detectCapabilities();
    if (!capabilities) {
      fogSystemCompatibility.configure({ preferCloudSystem: false });
      return;
    }

    try {
      const cloudLayer = new MapboxCloudLayer({
        id: CLOUD_LAYER_ID,
        cloudEngine: cloudEngineRef.current,
        shaderSystem: shaderSystemRef.current,
        textureManager: textureManagerRef.current,
        zIndex: 110,
      });

      mapRef.current.addLayer(cloudLayer as unknown as Record<string, unknown>);
      cloudLayerRef.current = cloudLayer;

      const shouldUseCloudSystem = cloudSystemEnabledRef.current && !cloudSystemErrorRef.current;
      cloudLayer.setVisible(shouldUseCloudSystem);
      cloudFogIntegration.configure({ enableCloudSystem: shouldUseCloudSystem });
      fogSystemCompatibility.configure({ preferCloudSystem: shouldUseCloudSystem });

      cloudFogIntegration.setCloudRenderingEngine(cloudEngineRef.current);
      fogSystemCompatibility.setCloudRenderingEngine(cloudEngineRef.current);

      setCloudSystemInitialized(true);
    } catch (error) {
      console.error('Failed to initialize cloud layer:', error);
      fogSystemCompatibility.configure({ preferCloudSystem: false });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initId = ++initRequestIdRef.current;

    const initialize = async () => {
      try {
        dispatch(setMapLoading(true));

        if (!validateMapboxConfig()) {
          dispatch(setMapError('Mapbox access token is not configured.'));
          Alert.alert('Configuration Error', 'Mapbox access token is not configured.');
          return;
        }

        const savedViewport = await loadViewport();
        if (cancelled || initId !== initRequestIdRef.current) return;

        if (savedViewport) {
          dispatch(updateViewport(savedViewport));
        }

        // Always inject a minimal fallback, including Mapbox's CSS canary rule.
        ensureMapboxFallbackCss();

        const cssLoaded = await ensureMapboxCss(MAPBOX_GL_CSS_URL);
        if (!cssLoaded) {
          console.warn('Mapbox GL CSS failed to load; continuing with fallback CSS only.');
        }
        await loadScript(MAPBOX_GL_JS_URL);
        if (cancelled || initId !== initRequestIdRef.current) return;

        const mapboxgl = window.mapboxgl;
        if (!mapboxgl) {
          dispatch(setMapError('Mapbox GL JS is unavailable.'));
          return;
        }

        const browserWebGL = detectWebGLSupport();
        if (!browserWebGL.supported) {
          dispatch(setMapError('WebGL is unavailable in this browser/environment. Enable hardware acceleration or use a WebGL-capable browser.'));
          console.error('WebGL preflight failed:', browserWebGL.reason);
          return;
        }

        if (typeof mapboxgl.supported === 'function' && !mapboxgl.supported()) {
          dispatch(setMapError('Mapbox GL JS reports this environment as unsupported for WebGL rendering.'));
          return;
        }

        mapboxgl.accessToken = MAPBOX_CONFIG.ACCESS_TOKEN;
        if (typeof mapboxgl.setTelemetryEnabled === 'function') {
          mapboxgl.setTelemetryEnabled(false);
        }

        const container = mapContainerRef.current;
        if (!container) {
          dispatch(setMapError('Unable to initialize map container.'));
          return;
        }

        container.innerHTML = '';

        const startCenter = savedViewport?.center ?? initialCenter;
        const startZoom = savedViewport?.zoom ?? initialZoom;

        // Give the browser a tick to lay out the container before Mapbox initializes.
        await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));

        const map = new mapboxgl.Map({
          container,
          style: mapStyle,
          center: startCenter,
          zoom: startZoom,
          bearing: savedViewport?.bearing ?? 0,
          pitch: savedViewport?.pitch ?? 0,
        });

        mapRef.current = map;
        mapLoadedRef.current = false;

        if (cancelled || initId !== initRequestIdRef.current) {
          map.remove();
          mapRef.current = null;
          return;
        }

        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-right');

        const geolocate = new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
        });
        geolocate.on('geolocate', (event: { coords: { latitude: number; longitude: number } }) => {
          const newLocation: [number, number] = [event.coords.longitude, event.coords.latitude];
          dispatch(setUserLocation(newLocation));
          onLocationUpdateRef.current?.(newLocation);

          if (followUserLocationRef.current && mapRef.current) {
            mapRef.current.easeTo({
              center: newLocation,
              duration: MAPBOX_CONFIG.ANIMATION_DURATION,
            });
          }
        });
        map.addControl(geolocate, 'top-right');

        let readyTimeoutId: number | null = window.setTimeout(() => {
          if (!mapLoadedRef.current) {
            dispatch(setMapError('Map load timed out. Check network blockers (adblock/CSP) and Mapbox CSS loading.'));
          }
        }, 15000);

        const markReady = async () => {
          if (cancelled || initId !== initRequestIdRef.current) return;
          mapLoadedRef.current = true;
          if (readyTimeoutId !== null) {
            clearTimeout(readyTimeoutId);
            readyTimeoutId = null;
          }
          dispatch(setMapReady(true));
          dispatch(setMapError(null));
          await refreshCoverage(true);
          initializeCloudLayer();
        };

        map.on('load', () => {
          markReady().catch(error => console.error('Failed to mark map ready:', error));
        });
        map.on('idle', () => {
          if (!mapLoadedRef.current) {
            markReady().catch(error => console.error('Failed to mark map ready (idle):', error));
          }
        });

        map.on('move', () => {
          if (cancelled || initId !== initRequestIdRef.current) return;
          if (!mapLoadedRef.current) return;

          const now = Date.now();
          if (now - lastMoveRefreshTimeRef.current < MOVE_REFRESH_THROTTLE_MS) {
            return;
          }
          lastMoveRefreshTimeRef.current = now;

          refreshCoverage(false).catch(error => {
            console.error('Failed to refresh fog coverage during move:', error);
          });
        });

        map.on('moveend', async () => {
          if (cancelled || initId !== initRequestIdRef.current) return;
          if (!mapLoadedRef.current) return;

          const center = map.getCenter();
          const zoom = map.getZoom();
          const bearing = map.getBearing();
          const pitch = map.getPitch();

          dispatch(updateViewport({
            center: [center.lng, center.lat],
            zoom,
            bearing,
            pitch,
          }));
          saveViewport({
            center: [center.lng, center.lat],
            zoom,
            bearing,
            pitch,
          }).catch(console.error);
          await refreshCoverage(false);
          updateFogLayer(fogCoverageBoundsRef.current ?? undefined);
        });

        map.on('click', (event: { lngLat: { lat: number; lng: number } }) => {
          if (!__DEV__) {
            return;
          }

          // Dev-only helper: allow manual fog clearing even when browser geolocation accuracy is poor.
          fogLocationIntegrationService
            .manualFogClear(event.lngLat.lat, event.lngLat.lng, 150)
            .catch(error => console.error('Manual fog clear failed:', error));
        });

        map.on('error', (event) => {
          console.warn('Mapbox GL JS error:', event.error ?? event);
          dispatch(setMapError('Map failed to load.'));
        });
      } catch (error) {
        console.error('Failed to initialize Mapbox GL JS:', error);
        if (error instanceof Error && error.message.includes('Failed to initialize WebGL')) {
          dispatch(setMapError('Failed to initialize WebGL. Enable hardware acceleration, disable strict privacy/add-on blocking for WebGL, or try another browser.'));
        } else {
          dispatch(setMapError('Failed to initialize map.'));
        }
      } finally {
        dispatch(setMapLoading(false));
      }
    };

    initialize();

    return () => {
      cancelled = true;
      mapLoadedRef.current = false;
      lastMoveRefreshTimeRef.current = 0;
      fogCoverageBoundsRef.current = null;
      explorationCoverageBoundsRef.current = null;
      if (mapRef.current) {
        if (mapRef.current.getLayer(CLOUD_LAYER_ID)) {
          mapRef.current.removeLayer(CLOUD_LAYER_ID);
        }
        if (mapRef.current.getLayer(FOG_LAYER_ID)) {
          mapRef.current.removeLayer(FOG_LAYER_ID);
        }
        if (mapRef.current.getSource(FOG_SOURCE_ID)) {
          mapRef.current.removeSource(FOG_SOURCE_ID);
        }
        mapRef.current.remove();
        mapRef.current = null;
      }
      cloudLayerRef.current = null;
      cloudFogIntegration.stopCloudSystem().catch(error => {
        console.error('Error stopping cloud system:', error);
      });
    };
  }, [dispatch, initializeCloudLayer, initialCenter, initialZoom, mapStyle, refreshCoverage, updateFogLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const currentBearing = map.getBearing();
    const currentPitch = map.getPitch();

    const targetCenter = viewport.center;
    const targetZoom = viewport.zoom;
    const targetBearing = viewport.bearing ?? 0;
    const targetPitch = viewport.pitch ?? 0;

    const epsilon = 1e-7;
    const shouldMove = (
      Math.abs(currentCenter.lng - targetCenter[0]) > epsilon ||
      Math.abs(currentCenter.lat - targetCenter[1]) > epsilon ||
      Math.abs(currentZoom - targetZoom) > 1e-6 ||
      Math.abs(currentBearing - targetBearing) > 1e-4 ||
      Math.abs(currentPitch - targetPitch) > 1e-4
    );

    if (!shouldMove) {
      return;
    }

    isApplyingViewportRef.current = true;
    map.easeTo({
      center: targetCenter,
      zoom: targetZoom,
      bearing: targetBearing,
      pitch: targetPitch,
      duration: MAPBOX_CONFIG.ANIMATION_DURATION,
    });
  }, [viewport.center, viewport.zoom, viewport.bearing, viewport.pitch]);

  useEffect(() => {
    if (!mapRef.current) return;
    updateFogLayer(fogCoverageBoundsRef.current ?? undefined, exploredAreas);
  }, [exploredAreas, updateFogLayer]);

  useEffect(() => {
    if (!mapRef.current) return;
    applyFogVisibility();
  }, [applyFogVisibility, fogVisible, fogOpacity]);

  useEffect(() => {
    if (!cloudLayerRef.current) return;

    const mappedExplorationAreas: ExplorationArea[] = exploredAreas.map(area => ({
      id: area.id,
      center: area.center,
      radius: area.radius,
      exploredAt: new Date(area.exploredAt),
      clearingProgress: 1,
    }));

    cloudLayerRef.current.updateExploredAreas(mappedExplorationAreas);
  }, [exploredAreas]);

  useEffect(() => {
    if (!cloudLayerRef.current) return;
    const shouldShow = cloudSystemEnabled && !cloudSystemError;
    cloudLayerRef.current.setVisible(shouldShow);
    cloudFogIntegration.configure({ enableCloudSystem: shouldShow });
    fogSystemCompatibility.configure({ preferCloudSystem: shouldShow });

    if (shouldShow) {
      cloudFogIntegration.startCloudSystem().catch(error => {
        console.error('Failed to start cloud system:', error);
      });
      return;
    }

    cloudFogIntegration.stopCloudSystem().catch(error => {
      console.error('Failed to stop cloud system:', error);
    });
  }, [cloudSystemEnabled, cloudSystemError]);

  useEffect(() => {
    let isMounted = true;

    const handleCacheUpdate = () => {
      if (!isMounted) return;
      if (cacheRefreshTimeoutRef.current) {
        clearTimeout(cacheRefreshTimeoutRef.current);
      }
      cacheRefreshTimeoutRef.current = setTimeout(() => {
        if (!isMounted) return;
        const bounds = lastBoundsRef.current;
        if (!bounds) return;
        loadExplorationAreasForBounds(bounds).catch(error => {
          console.error('Failed to refresh exploration areas from cache update:', error);
        });
      }, 200);
    };

    const unsubscribe = spatialCacheService.subscribe(handleCacheUpdate);

    return () => {
      isMounted = false;
      if (cacheRefreshTimeoutRef.current) {
        clearTimeout(cacheRefreshTimeoutRef.current);
      }
      unsubscribe();
    };
  }, [loadExplorationAreasForBounds]);

  return (
    <View style={styles.container}>
      <div ref={mapContainerRef} style={mapDivStyle} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
});

export default MapContainer;

const mapDivStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
