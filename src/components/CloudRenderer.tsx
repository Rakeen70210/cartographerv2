import React, { useMemo, useEffect, useRef, useCallback, ReactElement } from 'react';
import Mapbox from '@rnmapbox/maps';
import { FogGeometry, CloudLayer } from '../types/fog';
import { getCloudAnimationService } from '../services/cloudAnimationService';

interface CloudRendererProps {
  cloudGeometries: FogGeometry[];
  cloudOpacities: number[];
  visible: boolean;
  performanceMode?: boolean;
  animationEnabled?: boolean;
  windDirection?: number;
  windSpeed?: number;
}

const CloudRenderer: React.FC<CloudRendererProps> = ({
  cloudGeometries,
  cloudOpacities,
  visible,
  performanceMode = false,
  animationEnabled = true,
  windDirection = 45,
  windSpeed = 1.0
}) => {
  const cloudAnimationService = useRef(getCloudAnimationService());
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const fpsCounterRef = useRef({ frameCount: 0, fpsSum: 0, lastCheck: Date.now() });

  // Performance monitoring and adaptive quality
  const monitorPerformance = useCallback(() => {
    const now = Date.now();
    const deltaTime = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;

    if (deltaTime > 0) {
      const fps = 1000 / deltaTime;
      const counter = fpsCounterRef.current;
      
      counter.fpsSum += fps;
      counter.frameCount++;

      // Check performance every 60 frames (approximately 2 seconds at 30fps)
      if (counter.frameCount >= 60) {
        const averageFps = counter.fpsSum / counter.frameCount;
        
        // Auto-enable performance mode if FPS drops below 25
        if (averageFps < 25 && !performanceMode) {
          console.warn('CloudRenderer: Low FPS detected, enabling performance optimizations');
          cloudAnimationService.current.updateConfig({
            layers: 2, // Reduce layers
            density: 0.5, // Reduce density
          });
        }
        
        // Reset counters
        counter.frameCount = 0;
        counter.fpsSum = 0;
        counter.lastCheck = now;
      }
    }
  }, [performanceMode]);

  // Optimize cloud rendering based on performance mode and zoom level
  const optimizedCloudGeometries = useMemo(() => {
    if (!visible || cloudGeometries.length === 0) return [];

    let optimizedGeometries = [...cloudGeometries];

    if (performanceMode) {
      // In performance mode, apply aggressive optimizations
      optimizedGeometries = cloudGeometries.map(geometry => {
        const maxFeatures = Math.max(1, Math.ceil(geometry.features.length * 0.3));
        return {
          ...geometry,
          features: geometry.features
            .slice(0, maxFeatures)
            .map(feature => ({
              ...feature,
              // Simplify geometry by reducing coordinate precision
              geometry: {
                ...feature.geometry,
                coordinates: feature.geometry.coordinates.map(ring =>
                  ring.map(coord => [
                    Math.round(coord[0] * 100) / 100, // Reduce precision to 2 decimal places
                    Math.round(coord[1] * 100) / 100
                  ])
                )
              }
            }))
        };
      });
    }

    return optimizedGeometries;
  }, [cloudGeometries, visible, performanceMode]);

  // Create cloud layers with enhanced styling and animation support
  const cloudLayers = useMemo(() => {
    if (!optimizedCloudGeometries.length) return [];

    const layers: ReactElement[] = [];

    optimizedCloudGeometries.forEach((cloudGeometry, index) => {
      const baseOpacity = cloudOpacities[index] || 0.3;
      const layerDepth = index / Math.max(1, optimizedCloudGeometries.length - 1);
      
      // Create unique layer styling based on depth
      const layerStyle = {
        fillColor: [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, layerDepth > 0.5 ? '#E6F3FF' : '#F0F8FF', // Deeper layers are slightly bluer
          5, layerDepth > 0.5 ? '#F5F5F5' : '#FFFFFF',
          15, '#FFFFFF',
        ],
        fillOpacity: [
          'case',
          ['has', 'opacity', ['get', 'properties']],
          ['*', ['get', 'opacity', ['get', 'properties']], baseOpacity],
          [
            'interpolate',
            ['linear'],
            ['zoom'],
            0, baseOpacity * (0.6 + layerDepth * 0.2), // Vary opacity by layer depth
            5, baseOpacity * (0.8 + layerDepth * 0.1),
            10, baseOpacity,
            15, baseOpacity * 1.1,
          ]
        ],
        fillAntialias: true,
      };

      const shapeSource = (
        <Mapbox.ShapeSource 
          key={`cloud-source-${index}`} 
          id={`cloud-source-${index}`} 
          shape={cloudGeometry}
          cluster={false}
          clusterRadius={0}
        >
          <Mapbox.FillLayer
            id={`cloud-layer-${index}`}
            style={layerStyle}
          />
        </Mapbox.ShapeSource>
      );

      layers.push(shapeSource);
    });

    return layers;
  }, [optimizedCloudGeometries, cloudOpacities, animationEnabled, performanceMode]);

  // Setup cloud animation service configuration
  useEffect(() => {
    if (animationEnabled) {
      cloudAnimationService.current.updateConfig({
        windDirection,
        speed: windSpeed,
        layers: performanceMode ? 2 : 3,
        density: performanceMode ? 0.5 : 0.7,
        turbulence: performanceMode ? 0.1 : 0.3,
      });
    }
  }, [animationEnabled, windDirection, windSpeed, performanceMode]);

  // Performance monitoring effect
  useEffect(() => {
    if (!visible || !animationEnabled) return;

    const startMonitoring = () => {
      const monitor = () => {
        monitorPerformance();
        animationFrameRef.current = requestAnimationFrame(monitor);
      };
      animationFrameRef.current = requestAnimationFrame(monitor);
    };

    startMonitoring();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [visible, animationEnabled, monitorPerformance]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cloudAnimationService.current.stopAnimation();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  if (!visible) {
    return null;
  }

  return <>{cloudLayers}</>;
};

export default React.memo(CloudRenderer);