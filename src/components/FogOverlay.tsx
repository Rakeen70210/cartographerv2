import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Animated } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { FogOverlayProps, FogGeometry, CloudLayer, GenericExploredArea } from '../types/fog';
import { useAppSelector } from '../store/hooks';
import { getCloudAnimationService } from '../services/cloudAnimationService';
import { getFogAnimationService, FogClearingAnimation } from '../services/fogAnimationService';
import { fogLocationIntegrationService } from '../services/fogLocationIntegrationService';
import { getPerformanceMonitorService } from '../services/performanceMonitorService';
import CloudRenderer from './CloudRenderer';
import FogParticles from './FogParticles';

// Utility function to normalize explored areas from different sources
const normalizeExploredArea = (area: GenericExploredArea) => {
  // Handle both database format (latitude/longitude) and Redux format (center)
  const latitude = area.latitude ?? area.center?.[1] ?? 0;
  const longitude = area.longitude ?? area.center?.[0] ?? 0;
  const exploredAt = area.explored_at ?? (area.exploredAt ? new Date(area.exploredAt).toISOString() : new Date().toISOString());
  
  return {
    id: area.id ?? Math.random().toString(),
    latitude,
    longitude,
    radius: area.radius,
    explored_at: exploredAt,
    accuracy: area.accuracy,
  };
};

const FogOverlay: React.FC<FogOverlayProps> = ({
  exploredAreas,
  animationSpeed = 1.0,
  cloudDensity = 0.7,
  onFogCleared,
  visible = true,
  zoomLevel = 10
}) => {
  console.log('🌫️ FogOverlay rendering with visible:', visible);
  const layerRef = useRef<Mapbox.RasterLayer>(null);
  const fogGeometry = useAppSelector(state => state.fog.fogGeometry);
  const animationInProgress = useAppSelector(state => state.fog.animationInProgress);
  const activeAnimations = useAppSelector(state => state.fog.activeAnimations);
  const clearingAreas = useAppSelector(state => state.fog.clearingAreas);
  const [cloudLayers, setCloudLayers] = useState<CloudLayer[]>([]);
  const [cloudGeometries, setCloudGeometries] = useState<FogGeometry[]>([]);
  const [fogClearingAnimations, setFogClearingAnimations] = useState<FogClearingAnimation[]>([]);
  const [fogOpacity] = useState(new Animated.Value(0.8));
  const [optimizedFogGeometry, setOptimizedFogGeometry] = useState<FogGeometry | null>(null);
  
  const cloudAnimationService = getCloudAnimationService();
  const fogAnimationService = getFogAnimationService();
  const performanceMonitorService = getPerformanceMonitorService();

  // Level-of-detail optimization based on zoom level
  const optimizeFogGeometry = useCallback((geometry: FogGeometry, zoom: number) => {
    if (!geometry || !geometry.features) {
      console.warn('🌫️ Invalid geometry for optimization:', geometry);
      return geometry;
    }

    console.log('🌫️ Optimizing geometry with', geometry.features.length, 'features at zoom', zoom);

    const lodSettings = performanceMonitorService.getLODSettings(zoom);
    const maxFeatures = lodSettings.maxFogFeatures;
    
    // If we have fewer features than the limit, return as-is but validate coordinates
    if (geometry.features.length <= maxFeatures) {
      const validatedFeatures = geometry.features.filter(feature => {
        if (feature.geometry.type === 'Polygon') {
          const coords = feature.geometry.coordinates[0];
          return coords && coords.length >= 4;
        }
        return false;
      });
      
      console.log('🌫️ Validated features:', validatedFeatures.length, 'of', geometry.features.length);
      
      return {
        ...geometry,
        features: validatedFeatures
      };
    }

    // Simplify geometry based on zoom level - be less aggressive
    const simplificationFactor = Math.max(0.3, Math.min(1.0, zoom / 15)); // Increased minimum from 0.1 to 0.3
    const featuresToKeep = Math.floor(maxFeatures * simplificationFactor);
    
    console.log('🌫️ Keeping', featuresToKeep, 'features (factor:', simplificationFactor, ')');
    
    // Sort features by size/importance and keep the most significant ones
    const sortedFeatures = [...geometry.features].sort((a, b) => {
      // Calculate approximate feature area for prioritization
      const areaA = calculateFeatureArea(a);
      const areaB = calculateFeatureArea(b);
      return areaB - areaA; // Larger features first
    });

    const optimizedFeatures = sortedFeatures.slice(0, featuresToKeep);
    
    // Validate and optionally simplify geometry coordinates
    const simplifiedFeatures = optimizedFeatures.map(feature => {
      if (feature.geometry.type === 'Polygon') {
        const originalCoords = feature.geometry.coordinates[0];
        
        // Only simplify if we have many coordinates and zoom is low
        if (originalCoords.length > 10 && zoom < 8) {
          const simplified = simplifyCoordinates(originalCoords, zoom);
          return {
            ...feature,
            geometry: {
              ...feature.geometry,
              coordinates: [simplified]
            }
          };
        } else {
          // Just validate the coordinates
          if (originalCoords.length >= 4) {
            return feature;
          } else {
            console.warn('🌫️ Skipping feature with invalid coordinates:', originalCoords.length);
            return null;
          }
        }
      }
      return feature;
    }).filter(Boolean) as FogFeature[];

    console.log('🌫️ Final optimized features:', simplifiedFeatures.length);

    return {
      ...geometry,
      features: simplifiedFeatures
    };
  }, [performanceMonitorService, calculateFeatureArea, simplifyCoordinates]);

  // Helper function to calculate approximate feature area
  const calculateFeatureArea = useCallback((feature: any) => {
    if (!feature.geometry || !feature.geometry.coordinates) return 0;
    
    const coords = feature.geometry.coordinates[0];
    if (!coords || coords.length < 3) return 0;
    
    // Simple bounding box area calculation
    let minLat = coords[0][1], maxLat = coords[0][1];
    let minLng = coords[0][0], maxLng = coords[0][0];
    
    coords.forEach(([lng, lat]: [number, number]) => {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });
    
    return (maxLat - minLat) * (maxLng - minLng);
  }, []);

  // Helper function to simplify coordinates based on zoom level
  const simplifyCoordinates = useCallback((coordinates: number[][], zoom: number) => {
    if (!coordinates || coordinates.length < 4) {
      console.warn('🌫️ Invalid coordinates for simplification:', coordinates);
      return coordinates;
    }
    
    if (zoom >= 12) return coordinates; // No simplification at high zoom
    
    const tolerance = zoom < 6 ? 0.01 : zoom < 10 ? 0.005 : 0.001;
    const simplified: number[][] = [];
    
    // Ensure we keep at least 4 points for a valid polygon
    const step = Math.max(1, Math.floor((coordinates.length - 1) / Math.max(4, Math.floor(15 - zoom))));
    
    for (let i = 0; i < coordinates.length - 1; i += step) {
      const coord = coordinates[i];
      if (coord && coord.length >= 2) {
        simplified.push([
          Math.round(coord[0] / tolerance) * tolerance,
          Math.round(coord[1] / tolerance) * tolerance
        ]);
      }
    }
    
    // Always include the last coordinate if it's not already included
    const lastCoord = coordinates[coordinates.length - 1];
    if (lastCoord && simplified.length > 0) {
      const lastSimplified = simplified[simplified.length - 1];
      if (lastSimplified[0] !== lastCoord[0] || lastSimplified[1] !== lastCoord[1]) {
        simplified.push([
          Math.round(lastCoord[0] / tolerance) * tolerance,
          Math.round(lastCoord[1] / tolerance) * tolerance
        ]);
      }
    }
    
    // Ensure we have at least 4 points and polygon is closed
    if (simplified.length < 4) {
      console.warn('🌫️ Simplified coordinates too few, returning original:', simplified.length);
      return coordinates;
    }
    
    // Ensure polygon is closed
    const first = simplified[0];
    const last = simplified[simplified.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      simplified.push([first[0], first[1]]);
    }
    
    return simplified;
  }, []);

  // Optimize fog geometry when zoom level or geometry changes
  useEffect(() => {
    console.log('🌫️ FogOverlay useEffect - fogGeometry changed:', {
      hasFogGeometry: !!fogGeometry,
      featureCount: fogGeometry?.features?.length || 0,
      zoomLevel
    });
    
    if (fogGeometry) {
      // Debounce geometry optimization to prevent excessive re-renders
      const timeoutId = setTimeout(() => {
        console.log('🌫️ Optimizing fog geometry...');
        const optimized = optimizeFogGeometry(fogGeometry, zoomLevel);
        console.log('🌫️ Optimized geometry:', {
          originalFeatures: fogGeometry.features.length,
          optimizedFeatures: optimized.features.length
        });
        setOptimizedFogGeometry(optimized);
        
        // Register cache entry for performance monitoring
        const geometrySize = JSON.stringify(optimized).length;
        performanceMonitorService.registerCacheEntry(
          `fog-geometry-${zoomLevel}`,
          geometrySize,
          3 // Medium priority
        );
      }, 200);
      
      return () => clearTimeout(timeoutId);
    } else {
      console.log('🌫️ No fog geometry available, clearing optimized geometry');
      setOptimizedFogGeometry(null);
    }
  }, [fogGeometry, zoomLevel, optimizeFogGeometry, performanceMonitorService]);

  // Handle cloud animation updates
  const handleCloudUpdate = useCallback((layerGeometries: FogGeometry[]) => {
    setCloudGeometries(layerGeometries);
    performanceMonitorService.recordFrame(); // Record frame for performance monitoring
  }, [performanceMonitorService]);

  // Handle fog clearing animation updates
  const handleFogAnimationUpdate = useCallback((animations: FogClearingAnimation[]) => {
    setFogClearingAnimations(animations);
  }, []);

  // Monitor integration service for real-time updates
  useEffect(() => {
    let isMounted = true;
    
    const checkIntegrationStatus = async () => {
      if (!isMounted) return;
      
      try {
        const status = await fogLocationIntegrationService.getStatus();
        
        // Update fog clearing animations based on active animations from Redux
        if (activeAnimations.length > 0 && isMounted) {
          const currentAnimations = fogAnimationService.getActiveAnimations();
          setFogClearingAnimations(currentAnimations);
        }
      } catch (error) {
        console.error('Error checking integration status:', error);
      }
    };

    // Check status periodically, but less frequently to reduce load
    const statusInterval = setInterval(checkIntegrationStatus, 2000);
    
    return () => {
      isMounted = false;
      clearInterval(statusInterval);
    };
  }, [activeAnimations.length, fogAnimationService]); // Only depend on length

  // Initialize fog animation service with adaptive settings
  useEffect(() => {
    let isMounted = true;
    
    const initializeAnimations = () => {
      if (!isMounted) return;
      
      fogAnimationService.setAnimationUpdateCallback(handleFogAnimationUpdate);
      
      // Get adaptive settings based on current performance and zoom level
      const lodSettings = performanceMonitorService.getLODSettings(zoomLevel);
      const adaptiveSettings = performanceMonitorService.getAdaptiveSettings();
      
      // Configure animation settings based on performance and zoom level
      fogAnimationService.updateConfig({
        clearingDuration: lodSettings.enableAnimations ? 2000 : 500,
        particleCount: adaptiveSettings.maxParticles || 15,
        particleLifetime: lodSettings.enableAnimations ? 1500 : 500,
        performanceMode: !lodSettings.enableAnimations,
      });
    };
    
    // Debounce initialization to prevent rapid re-configurations
    const timeoutId = setTimeout(initializeAnimations, 100);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      fogAnimationService.cancelAllAnimations();
    };
  }, [fogAnimationService, handleFogAnimationUpdate, zoomLevel, performanceMonitorService]);

  // Initialize and start cloud animation with adaptive settings
  useEffect(() => {
    if (!visible) return;
    
    let isMounted = true;

    const initializeCloudAnimation = () => {
      if (!isMounted) return;
      
      // Get level-of-detail settings for current zoom
      const lodSettings = performanceMonitorService.getLODSettings(zoomLevel);
      const adaptiveSettings = performanceMonitorService.getAdaptiveSettings();
      
      // Update cloud animation configuration based on zoom and performance
      cloudAnimationService.updateConfig({
        speed: animationSpeed * (lodSettings.enableAnimations ? 1.0 : 0.5),
        density: Math.min(cloudDensity, lodSettings.cloudComplexity),
        layers: adaptiveSettings.cloudLayers || (lodSettings.enableAnimations ? 3 : 2),
        windDirection: 45,
        turbulence: lodSettings.cloudComplexity * 0.3
      });

      // Get initial cloud layers
      const layers = cloudAnimationService.getCloudLayers();
      if (isMounted) {
        setCloudLayers(layers);
      }

      // Start animation only if enabled for this zoom level
      if (lodSettings.enableAnimations && isMounted) {
        cloudAnimationService.startAnimation(handleCloudUpdate);
      }
    };
    
    // Debounce cloud animation initialization
    const timeoutId = setTimeout(initializeCloudAnimation, 150);

    // Cleanup on unmount or when visibility changes
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      cloudAnimationService.stopAnimation();
    };
  }, [visible, animationSpeed, cloudDensity, zoomLevel, cloudAnimationService, handleCloudUpdate, performanceMonitorService]);

  // Handle fog opacity animation based on clearing state
  useEffect(() => {
    if (animationInProgress) {
      // Animate fog opacity during clearing
      Animated.timing(fogOpacity, {
        toValue: 0.3, // Reduce opacity during clearing
        duration: 1000,
        useNativeDriver: false,
      }).start();
    } else {
      // Return to normal opacity
      Animated.timing(fogOpacity, {
        toValue: 0.8,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }
  }, [animationInProgress, fogOpacity]);

  if (!visible) {
    return null;
  }

  // Get current LOD settings for opacity and styling adjustments
  const lodSettings = performanceMonitorService.getLODSettings(zoomLevel);

  // Debug logging
  console.log('🌫️ FogOverlay render:', {
    visible,
    hasOptimizedGeometry: !!optimizedFogGeometry,
    geometryFeatureCount: optimizedFogGeometry?.features?.length || 0,
    exploredAreasCount: exploredAreas?.length || 0,
    zoomLevel,
    animationInProgress
  });

  // Debug: Log first few coordinates to verify they're valid
  if (optimizedFogGeometry?.features?.length > 0) {
    const firstFeature = optimizedFogGeometry.features[0];
    console.log('🌫️ First feature coordinates sample:', {
      type: firstFeature.geometry.type,
      coordinateCount: firstFeature.geometry.coordinates[0]?.length,
      firstFewCoords: firstFeature.geometry.coordinates[0]?.slice(0, 3)
    });
  }

  // Create a test fog geometry if no geometry exists but we should show fog
  let renderGeometry = optimizedFogGeometry;
  if (!renderGeometry || !renderGeometry.features || renderGeometry.features.length === 0) {
    console.log('🌫️ No fog geometry found, creating large test geometry covering Bay Area');
    // Create a large fog area covering the entire San Francisco Bay Area
    renderGeometry = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            opacity: 0.8,
            type: 'fog' as const,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[ // Large area covering the entire Bay Area
              [-123.0, 36.5], // Southwest corner (covers entire Bay Area)
              [-121.0, 36.5], // Southeast corner  
              [-121.0, 38.5], // Northeast corner
              [-123.0, 38.5], // Northwest corner
              [-123.0, 36.5]  // Close the polygon (must repeat first point)
            ]]
          }
        }
      ]
    };
  }

  // Validate geometry before rendering
  if (renderGeometry && renderGeometry.features) {
    renderGeometry.features = renderGeometry.features.filter(feature => {
      if (feature.geometry.type === 'Polygon') {
        const coords = feature.geometry.coordinates[0];
        if (!coords || coords.length < 4) {
          console.warn('🌫️ Invalid polygon: less than 4 coordinates', coords);
          return false;
        }
        // Ensure polygon is closed (first and last points are the same)
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          console.warn('🌫️ Polygon not closed, fixing...', { first, last });
          coords.push([first[0], first[1]]);
        }
        return true;
      }
      return false;
    });
  }

  // WORKING CLOUD FOG OVERLAY
  console.log('🌫️ Rendering cloud fog overlay with', {
    visible,
    hasOptimizedGeometry: !!optimizedFogGeometry,
    geometryFeatureCount: optimizedFogGeometry?.features?.length || 0,
    exploredAreasCount: exploredAreas?.length || 0,
    zoomLevel
  });

  // Use the optimized fog geometry if available, otherwise create a default fog coverage
  let cloudRenderGeometry = optimizedFogGeometry;
  
  if (!cloudRenderGeometry || !cloudRenderGeometry.features || cloudRenderGeometry.features.length === 0) {
    console.log('🌫️ Creating default cloud fog coverage');
    // Create a comprehensive fog coverage that covers unexplored areas
    cloudRenderGeometry = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            opacity: 0.6,
            type: 'cloud-fog' as const,
            layer: 'base'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[ 
              // Large area covering the San Francisco Bay Area and beyond
              [-123.5, 36.0], // Southwest corner
              [-120.5, 36.0], // Southeast corner  
              [-120.5, 39.0], // Northeast corner
              [-123.5, 39.0], // Northwest corner
              [-123.5, 36.0]  // Close the polygon
            ]]
          }
        }
      ]
    };
  }

  // Validate and ensure all polygons are properly closed
  if (cloudRenderGeometry && cloudRenderGeometry.features) {
    cloudRenderGeometry.features = cloudRenderGeometry.features.filter(feature => {
      if (feature.geometry.type === 'Polygon') {
        const coords = feature.geometry.coordinates[0];
        if (!coords || coords.length < 4) {
          console.warn('🌫️ Invalid polygon: less than 4 coordinates');
          return false;
        }
        // Ensure polygon is closed
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          coords.push([first[0], first[1]]);
        }
        return true;
      }
      return false;
    });
  }

  console.log('🌫️ Final render geometry:', {
    featureCount: cloudRenderGeometry?.features?.length || 0,
    firstFeature: cloudRenderGeometry?.features?.[0]?.geometry?.coordinates?.[0]?.slice(0, 3)
  });

  return (
    <>
      {/* Main cloud fog layer */}
      <Mapbox.ShapeSource 
        id="cloud-fog-main"
        shape={cloudRenderGeometry}
      >
        <Mapbox.FillLayer
          id="cloud-fog-fill"
          style={{
            fillColor: [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, '#8B9DC3', // Light blue-gray at low zoom
              10, '#6B7B9A', // Darker blue-gray at medium zoom
              15, '#4A5568'  // Dark gray at high zoom
            ],
            fillOpacity: [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 0.4,  // Lower opacity at low zoom
              10, 0.6, // Medium opacity at medium zoom
              15, 0.8  // Higher opacity at high zoom
            ],
          }}
        />
        <Mapbox.LineLayer
          id="cloud-fog-border"
          style={{
            lineColor: '#2D3748',
            lineWidth: [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 1,
              10, 2,
              15, 3
            ],
            lineOpacity: 0.3,
          }}
        />
      </Mapbox.ShapeSource>

      {/* Cloud texture overlay for more realistic appearance */}
      <Mapbox.ShapeSource 
        id="cloud-fog-texture"
        shape={cloudRenderGeometry}
      >
        <Mapbox.FillLayer
          id="cloud-fog-texture-fill"
          style={{
            fillColor: '#FFFFFF',
            fillOpacity: [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 0.1,
              10, 0.2,
              15, 0.3
            ],
            fillPattern: 'cloud-pattern', // This would need a custom pattern
          }}
        />
      </Mapbox.ShapeSource>

      {/* Animated cloud particles for dynamic effect */}
      {lodSettings.enableAnimations && cloudLayers.length > 0 && (
        <CloudRenderer
          layers={cloudLayers}
          animationSpeed={animationSpeed}
          density={cloudDensity}
          zoomLevel={zoomLevel}
        />
      )}

      {/* Fog clearing animations */}
      {fogClearingAnimations.length > 0 && (
        <FogParticles
          animations={fogClearingAnimations}
          zoomLevel={zoomLevel}
        />
      )}
    </>
  );
};

export default FogOverlay;