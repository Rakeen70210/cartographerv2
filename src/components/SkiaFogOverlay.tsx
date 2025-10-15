import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Canvas, Fill, Path, useClock, Shader, Group } from '@shopify/react-native-skia';
import { StyleSheet, Dimensions, AppState, AppStateStatus } from 'react-native';
import { SkiaFogViewport, DissipationAnimation } from '../types/skiaFog';
import { GenericExploredArea } from '../types/fog';
import { WindConfig } from '../types/cloud';
import { useAppSelector } from '../store/hooks';
import { SkiaShaderSystem } from '../services/cloudSystem/shaders/SkiaShaderSystem';
import { SkiaCloudUniforms, UNIFORM_MASK_FLOAT_COUNT } from '../services/cloudSystem/shaders/SkiaCloudShader';
import { FogMaskingSystem, DEFAULT_FOG_MASKING_CONFIG } from '../services/cloudSystem/integration/FogMaskingSystem';
import { getFogMaskUniformService, FogMaskMode } from '../services/cloudSystem/FogMaskUniformService';
import { fogDissipationService } from '../services/fogDissipationService';
import { useSkiaPerformanceMonitoring } from '../hooks/useSkiaPerformanceMonitoring';
import { SkiaPerformanceMetrics, SkiaQualitySettings } from '../services/cloudSystem/performance/SkiaPerformanceMonitor';
import { WindSystem, createWindSystem } from '../services/cloudSystem/wind';

// Utility function to normalize explored areas from different sources
const normalizeExploredArea = (area: GenericExploredArea): {
  id: string;
  latitude: number;
  longitude: number;
  radius: number;
  exploredAt: number;
  accuracy?: number;
} => {
  // Handle both database format (latitude/longitude) and Redux format (center)
  const latitude = area.latitude ?? area.center?.[1] ?? 0;
  const longitude = area.longitude ?? area.center?.[0] ?? 0;
  
  // Handle different timestamp formats
  let exploredAt: number;
  if (area.exploredAt) {
    exploredAt = typeof area.exploredAt === 'number' ? area.exploredAt : new Date(area.exploredAt).getTime();
  } else if (area.explored_at) {
    exploredAt = new Date(area.explored_at).getTime();
  } else {
    exploredAt = Date.now();
  }
  
  return {
    id: area.id?.toString() ?? `area_${latitude}_${longitude}_${exploredAt}`,
    latitude,
    longitude,
    radius: area.radius,
    exploredAt,
    accuracy: area.accuracy,
  };
};

interface SkiaFogOverlayProps {
  exploredAreas: GenericExploredArea[];
  zoomLevel: number;
  viewport?: SkiaFogViewport;
  enablePerformanceMonitoring?: boolean;
  targetFPS?: number;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const SkiaFogOverlay: React.FC<SkiaFogOverlayProps> = ({
  exploredAreas,
  zoomLevel,
  viewport = {
    width: screenWidth,
    height: screenHeight,
    bounds: { north: 0, south: 0, east: 0, west: 0 }
  },
  enablePerformanceMonitoring = true,
  targetFPS = 30
}) => {
  // Redux state subscriptions for clearingAreas and animationInProgress
  const clearingAreas = useAppSelector(state => state.fog.clearingAreas);
  const animationInProgress = useAppSelector(state => state.fog.animationInProgress);
  const fogOpacity = useAppSelector(state => state.fog.opacity);
  const baseAnimationSpeed = useAppSelector(state => state.fog.animationSpeed);
  const baseCloudDensity = useAppSelector(state => state.fog.cloudDensity);
  
  // Wind configuration from Redux state
  const windDirection = useAppSelector(state => state.fog.windDirection);
  const windSpeed = useAppSelector(state => state.fog.windSpeed);
  const windEnabled = useAppSelector(state => state.fog.windEnabled);
  const windTurbulence = useAppSelector(state => state.fog.windTurbulence);

  // Skia animated values
  const clock = useClock();
  
  // Wind system state
  const [windSystem] = useState(() => createWindSystem({
    direction: windDirection,
    speed: windSpeed,
    enabled: windEnabled,
    turbulence: windTurbulence,
  }));
  const [windOffset, setWindOffset] = useState<[number, number]>([0, 0]);

  const fogMaskService = useMemo(() => getFogMaskUniformService(), []);

  // Shader system state with performance-aware configuration
  const [shaderSystem] = useState(() => new SkiaShaderSystem({
    enablePerformanceMonitoring: true,
    autoRecovery: true,
    maxInitializationAttempts: 3,
    shaderComplexity: 'simple' // Force simple shaders for Android emulator
  }));
  const [shaderInitialized, setShaderInitialized] = useState(false);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [maskMode, setMaskMode] = useState<FogMaskMode>('cpu_fallback');
  const lastUpdateTime = useRef(0);
  const lastQualityLogTimeRef = useRef(0);
  const lastPerformanceLogTimeRef = useRef(0);
  const latestMetricsRef = useRef<SkiaPerformanceMetrics | null>(null);

  const shouldLogWithThrottle = useCallback((ref: React.MutableRefObject<number>, intervalMs: number) => {
    if (!__DEV__) {
      return false;
    }

    const now = Date.now();
    if (now - ref.current < intervalMs) {
      return false;
    }

    ref.current = now;
    return true;
  }, []);

  const handleQualityChange = useCallback((quality: SkiaQualitySettings) => {
    if (shouldLogWithThrottle(lastQualityLogTimeRef, 60000)) {
      console.debug('🌫️ Performance-driven quality change:', quality);
    }

    const notificationService = shaderSystem.getNotificationService?.();
    if (notificationService && quality.shaderComplexity === 'simple') {
      notificationService.reportPerformanceIssue(
        'low_fps',
        'medium',
        'Quality automatically reduced to maintain performance',
        latestMetricsRef.current || undefined
      );
    }
  }, [shaderSystem, shouldLogWithThrottle]);

  const handlePerformanceIssue = useCallback((performanceMetrics: SkiaPerformanceMetrics) => {
    if (performanceMetrics.totalFrames < 30) {
      return;
    }

    const severity = performanceMetrics.currentFPS < 15 ? 'critical'
      : performanceMetrics.currentFPS < 20 ? 'high'
      : performanceMetrics.currentFPS < 25 ? 'medium'
      : 'low';

    const logInterval = severity === 'critical' || severity === 'high' ? 15000 : 45000;
    if (severity !== 'low' && shouldLogWithThrottle(lastPerformanceLogTimeRef, logInterval)) {
      const logFn = severity === 'critical' || severity === 'high' ? console.warn : console.debug;
      logFn('🌫️ Performance issue detected:', {
        fps: performanceMetrics.currentFPS,
        target: targetFPS,
        recommendations: performanceMetrics.recommendations,
        severity
      });
    }

    const notificationService = shaderSystem.getNotificationService?.();
    if (notificationService && severity !== 'low') {
      notificationService.reportPerformanceIssue(
        'low_fps',
        severity,
        `Frame rate dropped to ${performanceMetrics.currentFPS.toFixed(1)} FPS`,
        performanceMetrics
      );
    }
  }, [shaderSystem, shouldLogWithThrottle, targetFPS]);

  const {
    isInitialized: performanceInitialized,
    currentQuality,
    metrics,
    isPerformanceAcceptable,
    debugInfo,
    forceQualityReduction
  } = useSkiaPerformanceMonitoring({
    enabled: enablePerformanceMonitoring,
    targetFPS,
    adaptiveQuality: true,
    enableDebugLogging: false,
    onQualityChange: handleQualityChange,
    onPerformanceIssue: handlePerformanceIssue
  });

  useEffect(() => {
    latestMetricsRef.current = metrics;
  }, [metrics]);

  const animationSpeed = enablePerformanceMonitoring ?
    currentQuality.animationSpeed : baseAnimationSpeed;
  const cloudDensity = enablePerformanceMonitoring ?
    currentQuality.cloudDensity : baseCloudDensity;

  const shaderUniforms = useMemo<SkiaCloudUniforms>(() => ({
    u_time: (clock.current ?? 0) * 0.001,
    u_resolution: [viewport.width, viewport.height],
    u_zoom: zoomLevel,
    u_wind_offset: windOffset,
    u_cloud_density: cloudDensity,
    u_animation_speed: animationSpeed
  }), [clock.current, viewport.width, viewport.height, zoomLevel, windOffset, cloudDensity, animationSpeed]);

  // Masking system state with performance-aware configuration
  const [maskingSystem] = useState(() => new FogMaskingSystem({
    ...DEFAULT_FOG_MASKING_CONFIG,
    performanceMode: 'mid',
    enableAdaptiveBlur: true,
    enableLayeredBlur: false
  }));

  // Update masking system configuration based on performance quality
  useEffect(() => {
    if (!enablePerformanceMonitoring) return;

    const performanceMode: 'low' | 'mid' | 'high' =
      currentQuality.shaderComplexity === 'simple'
        ? 'low'
        : currentQuality.shaderComplexity === 'advanced'
        ? 'high'
        : 'mid';

    maskingSystem.updateConfig({
      performanceMode,
      enableAdaptiveBlur: currentQuality.blurRadius > 4,
      enableLayeredBlur: currentQuality.enableLayeredEffects,
      blurConfig: {
        ...DEFAULT_FOG_MASKING_CONFIG.blurConfig,
        blurRadius: currentQuality.blurRadius,
      },
    });
  }, [currentQuality, enablePerformanceMonitoring, maskingSystem]);

  // Initialize shader system
  useEffect(() => {
    let isMounted = true;

    const initializeShader = async () => {
      try {
        console.log('🌫️ Initializing Skia shader system...');
        const success = await shaderSystem.initialize();
        
        if (isMounted) {
          setShaderInitialized(success);
          const systemState = shaderSystem.getSystemState();
          setIsUsingFallback(systemState.isUsingFallback);
          
          if (success) {
            console.log('🌫️ Shader system initialized successfully', {
              fallbackMode: systemState.isUsingFallback
            });
          } else {
            console.warn('🌫️ Shader system initialization failed, using basic fog');
          }
        }
      } catch (error) {
        console.error('🌫️ Error initializing shader system:', error);
        if (isMounted) {
          setShaderInitialized(false);
        }
      }
    };

    initializeShader();

    return () => {
      isMounted = false;
      shaderSystem.dispose();
      maskingSystem.clearCaches();
    };
  }, [maskingSystem, shaderSystem]);

  // Update wind system configuration when Redux state changes
  useEffect(() => {
    const windConfig: WindConfig = {
      direction: windDirection,
      speed: windSpeed,
      enabled: windEnabled,
      turbulence: windTurbulence,
    };
    windSystem.updateConfig(windConfig);
  }, [windDirection, windSpeed, windEnabled, windTurbulence, windSystem]);

  useEffect(() => {
    if (!shaderInitialized) return;

    const now = Date.now();

    if (enablePerformanceMonitoring) {
      shaderSystem.setShaderComplexity(currentQuality.shaderComplexity);
    }

    const result = shaderSystem.updateUniforms(shaderUniforms);
    if (result.success) {
      lastUpdateTime.current = now;
    } else {
      console.warn('🌫️ Failed to update shader uniforms:', result.error);
    }
  }, [shaderSystem, shaderInitialized, shaderUniforms, currentQuality, enablePerformanceMonitoring]);

  // Periodic health check for shader system with performance monitoring integration
  useEffect(() => {
    if (!shaderInitialized) return;

    const healthCheckInterval = setInterval(async () => {
      const isHealthy = await shaderSystem.performHealthCheck();
      const systemState = shaderSystem.getSystemState();
      
      if (systemState.isUsingFallback !== isUsingFallback) {
        setIsUsingFallback(systemState.isUsingFallback);
        console.log('🌫️ Shader system fallback state changed:', systemState.isUsingFallback);
        
        // Force quality reduction if shader system is struggling
        if (systemState.isUsingFallback && enablePerformanceMonitoring) {
          forceQualityReduction();
        }
      }
      
      if (!isHealthy) {
        console.warn('🌫️ Shader system health check failed');
        
        // Additional performance intervention if health check fails repeatedly
        if (enablePerformanceMonitoring && !isPerformanceAcceptable) {
          console.log('🌫️ Triggering emergency quality reduction due to poor health');
          forceQualityReduction();
        }
      }
    }, 5000);

    return () => clearInterval(healthCheckInterval);
  }, [shaderInitialized, shaderSystem, isUsingFallback, enablePerformanceMonitoring, isPerformanceAcceptable, forceQualityReduction]);

  // Get active dissipation animations from the service
  const dissipationAnimations = useMemo<DissipationAnimation[]>(() => {
    const activeAnimations = fogDissipationService.getActiveAnimations();
    const resolveRadius = (radiusValue: unknown): number => {
      if (typeof radiusValue === 'number') {
        return radiusValue;
      }
      if (radiusValue && typeof (radiusValue as { __getValue?: () => number }).__getValue === 'function') {
        try {
          return (radiusValue as { __getValue: () => number }).__getValue();
        } catch (error) {
          return 0;
        }
      }
      if (radiusValue && typeof (radiusValue as { value?: number }).value === 'number') {
        return (radiusValue as { value: number }).value;
      }
      if (radiusValue && typeof (radiusValue as { _value?: number })._value === 'number') {
        return (radiusValue as { _value: number })._value;
      }
      return 0;
    };

    return activeAnimations.map(anim => ({
      id: anim.id,
      center: anim.center,
      radius: resolveRadius(anim.radius),
      startTime: anim.startTime,
      duration: anim.duration
    }));
  }, [clearingAreas, animationInProgress]); // Re-compute when Redux state changes

  // Sync dissipation service with Redux state changes
  useEffect(() => {
    fogDissipationService.syncWithReduxState();
  }, [clearingAreas, animationInProgress]);

  // Handle app state changes for animation pause/resume
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Pause animations when app goes to background
        shaderSystem.pauseAnimation();
        console.log('🌫️ Paused fog animations due to app state:', nextAppState);
      } else if (nextAppState === 'active') {
        // Resume animations when app becomes active
        shaderSystem.resumeAnimation();
        windSystem.resetTiming(); // Reset wind timing when resuming
        console.log('🌫️ Resumed fog animations due to app state:', nextAppState);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [shaderSystem, windSystem]);

  // Cleanup dissipation service and wind system on unmount
  useEffect(() => {
    return () => {
      fogDissipationService.cleanup();
      windSystem.dispose();
    };
  }, [windSystem]);

  // Normalize explored areas to ensure compatibility with both SQLite and Redux formats
  const normalizedExploredAreas = useMemo(() => {
    try {
      return exploredAreas.map(normalizeExploredArea);
    } catch (error) {
      console.warn('🌫️ Error normalizing explored areas:', error);
      return [];
    }
  }, [exploredAreas]);

  const fogMaskBuildResult = useMemo(() => {
    try {
      return fogMaskService.buildFogMaskUniforms({
        exploredAreas: normalizedExploredAreas,
        dissipationAnimations,
        viewport,
        zoom: zoomLevel,
      });
    } catch (error) {
      console.warn('🌫️ Error building fog mask uniforms:', error);
      return null;
    }
  }, [fogMaskService, normalizedExploredAreas, dissipationAnimations, viewport, zoomLevel]);

  useEffect(() => {
    if (!fogMaskBuildResult) {
      setMaskMode('cpu_fallback');
      if (shaderInitialized) {
        shaderSystem.updateUniforms({
          u_maskMode: 2,
          u_circleCount: 0,
          u_circleData: null,
          u_circleUniforms: new Float32Array(UNIFORM_MASK_FLOAT_COUNT),
        }, 'high');
      }
      return;
    }

    setMaskMode(fogMaskBuildResult.mode);

    if (!shaderInitialized) {
      return;
    }

    const update = shaderSystem.updateUniforms(fogMaskBuildResult.uniforms, 'high');
    if (!update.success && fogMaskBuildResult.mode !== 'cpu_fallback') {
      console.warn('🌫️ Failed to update fog mask uniforms:', update.error);
    }
  }, [fogMaskBuildResult, shaderInitialized, shaderSystem]);

  // Get active shader, texture, and uniforms for rendering
  const activeShader = shaderInitialized ? shaderSystem.getActiveShader() : null;
  const shouldUseCpuMask = !shaderInitialized || !activeShader || maskMode === 'cpu_fallback' || isUsingFallback;
  const uniformsForSkia = shaderInitialized ? shaderSystem.getUniformsForSkia() : {};

  const fogMasking = useMemo(() => {
    if (!shouldUseCpuMask) {
      return null;
    }

    try {
      return maskingSystem.generateFogMask(
        normalizedExploredAreas,
        dissipationAnimations,
        viewport,
        zoomLevel
      );
    } catch (error) {
      console.warn('🌫️ Error generating fog mask:', error);
      return null;
    }
  }, [shouldUseCpuMask, maskingSystem, normalizedExploredAreas, dissipationAnimations, viewport, zoomLevel]);

  // Performance logging in development
  if (__DEV__ && enablePerformanceMonitoring) {
    console.log('🌫️ SkiaFogOverlay render:', {
      exploredAreasCount: exploredAreas.length,
      normalizedAreasCount: normalizedExploredAreas.length,
      clearingAreasCount: clearingAreas.length,
      animationInProgress,
      zoomLevel,
      shaderInitialized,
      isUsingFallback,
      maskMode,
      gpuMaskDiagnostics: fogMaskBuildResult?.diagnostics,
      shouldUseCpuMask,
      hasFogMasking: fogMasking !== null,
      viewport: { width: viewport.width, height: viewport.height },
      performance: {
        initialized: performanceInitialized,
        acceptable: isPerformanceAcceptable,
        quality: currentQuality,
        fps: metrics?.currentFPS,
        debugInfo
      }
    });
  }

  const overlayOpacity = Math.max(0.05, Math.min(fogOpacity * cloudDensity, 0.75));

  return (
    <Canvas style={[styles.canvas, { opacity: overlayOpacity }]}>
      <Group>
        {shaderInitialized && activeShader ? (
          // Render with cloud shader (main or fallback shader)
          <Fill>
            <Shader 
              source={activeShader}
              uniforms={uniformsForSkia}
            />
          </Fill>
        ) : (
          // Ultimate fallback to basic fog fill when nothing else works
          <Fill 
            color={`rgba(139, 157, 195, ${Math.min(fogOpacity * cloudDensity, 0.8)})`}
          />
        )}
        
        {/* Apply exploration area masking */}
        {fogMasking && (
          <Group>
            {/* Apply layered blur effects if enabled */}
            {fogMasking.layeredEffects?.map((layer, index) => (
              <Path 
                key={`layer_${index}`}
                path={layer.path}
                paint={layer.paint}
              />
            ))}
            
            {/* Apply main mask */}
            <Path 
              path={fogMasking.combinedMaskPath}
              paint={fogMasking.maskPaint}
            />
          </Group>
        )}
      </Group>
    </Canvas>
  );
};

const styles = StyleSheet.create({
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1, // Position between map and UI controls
    pointerEvents: 'none', // Allow touch events to pass through to map
  },
});