import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Animated } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { ExploredArea } from '../database/services';
import { FogOverlayProps, FogGeometry, CloudLayer } from '../types/fog';
import { useAppSelector } from '../store/hooks';
import { getCloudAnimationService } from '../services/cloudAnimationService';
import { getFogAnimationService, FogClearingAnimation } from '../services/fogAnimationService';
import CloudRenderer from './CloudRenderer';
import FogParticles from './FogParticles';

const FogOverlay: React.FC<FogOverlayProps> = ({
  exploredAreas,
  animationSpeed = 1.0,
  cloudDensity = 0.7,
  onFogCleared,
  visible = true
}) => {
  const layerRef = useRef<Mapbox.RasterLayer>(null);
  const fogGeometry = useAppSelector(state => state.fog.fogGeometry);
  const animationInProgress = useAppSelector(state => state.fog.animationInProgress);
  const [cloudLayers, setCloudLayers] = useState<CloudLayer[]>([]);
  const [cloudGeometries, setCloudGeometries] = useState<FogGeometry[]>([]);
  const [fogClearingAnimations, setFogClearingAnimations] = useState<FogClearingAnimation[]>([]);
  const [fogOpacity] = useState(new Animated.Value(0.8));
  
  const cloudAnimationService = getCloudAnimationService();
  const fogAnimationService = getFogAnimationService();

  // Fog geometry is now managed by Redux store and passed via props

  // Handle cloud animation updates
  const handleCloudUpdate = useCallback((layerGeometries: FogGeometry[]) => {
    setCloudGeometries(layerGeometries);
  }, []);

  // Handle fog clearing animation updates
  const handleFogAnimationUpdate = useCallback((animations: FogClearingAnimation[]) => {
    setFogClearingAnimations(animations);
  }, []);

  // Initialize fog animation service
  useEffect(() => {
    fogAnimationService.setAnimationUpdateCallback(handleFogAnimationUpdate);
    
    // Configure animation settings based on performance
    fogAnimationService.updateConfig({
      clearingDuration: 2000,
      particleCount: 15,
      particleLifetime: 1500,
      performanceMode: false,
    });

    return () => {
      fogAnimationService.cancelAllAnimations();
    };
  }, [fogAnimationService, handleFogAnimationUpdate]);

  // Initialize and start cloud animation
  useEffect(() => {
    if (!visible) return;

    // Update cloud animation configuration
    cloudAnimationService.updateConfig({
      speed: animationSpeed,
      density: cloudDensity,
      layers: 3,
      windDirection: 45,
      turbulence: 0.3
    });

    // Get initial cloud layers
    const layers = cloudAnimationService.getCloudLayers();
    setCloudLayers(layers);

    // Start animation
    cloudAnimationService.startAnimation(handleCloudUpdate);

    // Cleanup on unmount or when visibility changes
    return () => {
      cloudAnimationService.stopAnimation();
    };
  }, [visible, animationSpeed, cloudDensity, cloudAnimationService, handleCloudUpdate]);

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

  if (!visible || !fogGeometry) {
    return null;
  }

  return (
    <>
      {/* Base fog layer with animated opacity */}
      {fogGeometry && (
        <Mapbox.ShapeSource id="fog-source" shape={fogGeometry}>
          <Mapbox.FillLayer
            id="fog-layer"
            style={{
              fillColor: [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, '#B0C4DE', // Light steel blue at low zoom
                5, '#87CEEB', // Sky blue at medium zoom
                10, '#778899', // Light slate gray at high zoom
              ],
              fillOpacity: [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, animationInProgress ? 0.4 : 0.8,
                5, animationInProgress ? 0.3 : 0.6,
                15, animationInProgress ? 0.2 : 0.4,
              ],
            }}
          />
        </Mapbox.ShapeSource>
      )}

      {/* Animated cloud layers */}
      <CloudRenderer
        cloudGeometries={cloudGeometries}
        cloudOpacities={cloudLayers.map(layer => 
          animationInProgress ? layer.opacity * 0.5 : layer.opacity
        )}
        visible={visible}
        performanceMode={fogAnimationService.getPerformanceMode()}
      />

      {/* Fog clearing particle effects */}
      <FogParticles
        animations={fogClearingAnimations}
        visible={visible && animationInProgress}
      />
    </>
  );
};

export default FogOverlay;