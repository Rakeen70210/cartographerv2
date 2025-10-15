/**
 * Skia Performance Monitoring Hook
 * React hook for integrating performance monitoring with SkiaFogOverlay
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { SkiaPerformanceMonitor, SkiaQualitySettings, SkiaPerformanceMetrics } from '../services/cloudSystem/performance/SkiaPerformanceMonitor';
import { getPerformanceMonitorService } from '../services/performanceMonitorService';

export interface UseSkiaPerformanceMonitoringOptions {
  enabled?: boolean;
  targetFPS?: number;
  adaptiveQuality?: boolean;
  enableDebugLogging?: boolean;
  logThrottleMs?: number;
  maxLogsPerWindow?: number;
  logWindowMs?: number;
  onQualityChange?: (quality: SkiaQualitySettings) => void;
  onPerformanceIssue?: (metrics: SkiaPerformanceMetrics) => void;
}

export interface SkiaPerformanceState {
  isInitialized: boolean;
  currentQuality: SkiaQualitySettings;
  metrics: SkiaPerformanceMetrics | null;
  isPerformanceAcceptable: boolean;
  debugInfo: string;
}

export const useSkiaPerformanceMonitoring = (
  options: UseSkiaPerformanceMonitoringOptions = {}
) => {
  const {
    enabled = true,
    targetFPS = 30,
    adaptiveQuality = true,
    enableDebugLogging = false,
    logThrottleMs,
    maxLogsPerWindow,
    logWindowMs,
    onQualityChange,
    onPerformanceIssue
  } = options;

  const [state, setState] = useState<SkiaPerformanceState>({
    isInitialized: false,
    currentQuality: {
      shaderComplexity: 'simple',
      cloudDensity: 0.5,
      animationSpeed: 0.8,
      blurRadius: 4,
      updateFrequency: 15,
      enableLayeredEffects: false
    },
    metrics: null,
    isPerformanceAcceptable: true,
    debugInfo: ''
  });

  const monitorRef = useRef<SkiaPerformanceMonitor | null>(null);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const performanceMonitorServiceRef = useRef(getPerformanceMonitorService());

  // Initialize performance monitor
  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    const initializeMonitor = async () => {
      try {
        const monitor = new SkiaPerformanceMonitor({
          targetFPS,
          adaptiveQuality,
          enableDebugLogging,
          performanceCheckInterval: 1000,
          qualityReductionThreshold: targetFPS * 0.8,
          qualityImprovementThreshold: targetFPS * 1.2,
          maxConsecutivePoorFrames: 3,
          ...(typeof logThrottleMs === 'number' ? { logThrottleMs } : {}),
          ...(typeof maxLogsPerWindow === 'number' ? { maxLogsPerWindow } : {}),
          ...(typeof logWindowMs === 'number' ? { logWindowMs } : {})
        });

        await monitor.initialize();
        
        if (isMounted) {
          monitorRef.current = monitor;
          
          // Set up quality change callback
          monitor.onQualityChange((quality) => {
            if (isMounted) {
              setState(prev => ({ ...prev, currentQuality: quality }));
              onQualityChange?.(quality);
            }
          });

          // Start monitoring
          monitor.start();

          setState(prev => ({
            ...prev,
            isInitialized: true,
            currentQuality: monitor.getCurrentQuality()
          }));
        }
      } catch (error) {
        console.error('Failed to initialize Skia performance monitor:', error);
        if (isMounted) {
          setState(prev => ({ ...prev, isInitialized: false }));
        }
      }
    };

    initializeMonitor();

    return () => {
      isMounted = false;
      if (monitorRef.current) {
        monitorRef.current.dispose();
        monitorRef.current = null;
      }
    };
  }, [enabled, targetFPS, adaptiveQuality, enableDebugLogging, logThrottleMs, maxLogsPerWindow, logWindowMs, onQualityChange]);

  // Set up metrics collection
  useEffect(() => {
    if (!state.isInitialized || !monitorRef.current) return;

    const updateMetrics = () => {
      const monitor = monitorRef.current;
      if (!monitor) return;

      const metrics = monitor.getMetrics();
      const isAcceptable = monitor.isPerformanceAcceptable();
      const debugInfo = monitor.getDebugInfo();

       const frameTime = metrics.frameTime > 0 ? metrics.frameTime : metrics.averageFrameTime;
       if (metrics.currentFPS > 0 && frameTime > 0) {
         performanceMonitorServiceRef.current.ingestFrameMetrics(metrics.currentFPS, frameTime);
       }

      setState(prev => ({
        ...prev,
        metrics,
        isPerformanceAcceptable: isAcceptable,
        debugInfo
      }));

      // Notify about performance issues
      if (!isAcceptable && onPerformanceIssue && metrics.totalFrames >= 30) {
        onPerformanceIssue(metrics);
      }
    };

    // Update metrics every 2 seconds
    metricsIntervalRef.current = setInterval(updateMetrics, 2000);
    
    // Initial update
    updateMetrics();

    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
        metricsIntervalRef.current = null;
      }
    };
  }, [state.isInitialized, onPerformanceIssue]);

  // Handle app state changes for performance optimization
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const monitor = monitorRef.current;
      if (!monitor) return;

      if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App going to background - pause monitoring
        monitor.stop();
      } else if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App coming to foreground - resume monitoring
        monitor.start();
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  // Manual quality control functions
  const setQuality = useCallback((quality: Partial<SkiaQualitySettings>) => {
    const monitor = monitorRef.current;
    if (!monitor) return;

    monitor.setQuality(quality);
  }, []);

  const adaptQuality = useCallback(() => {
    const monitor = monitorRef.current;
    if (!monitor) return false;

    return monitor.adaptQuality();
  }, []);

  const resetToBaseline = useCallback(() => {
    const monitor = monitorRef.current;
    if (!monitor) return;

    monitor.resetToBaseline();
  }, []);

  const forceQualityReduction = useCallback(() => {
    const monitor = monitorRef.current;
    if (!monitor) return;

    // Manually trigger quality reduction
    const currentQuality = monitor.getCurrentQuality();
    const reducedQuality: Partial<SkiaQualitySettings> = {};

    if (currentQuality.enableLayeredEffects) {
      reducedQuality.enableLayeredEffects = false;
    } else if (currentQuality.shaderComplexity === 'advanced') {
      reducedQuality.shaderComplexity = 'standard';
    } else if (currentQuality.shaderComplexity === 'standard') {
      reducedQuality.shaderComplexity = 'simple';
    } else if (currentQuality.cloudDensity > 0.3) {
      reducedQuality.cloudDensity = Math.max(0.3, currentQuality.cloudDensity - 0.2);
    }

    if (Object.keys(reducedQuality).length > 0) {
      monitor.setQuality(reducedQuality);
    }
  }, []);

  // Performance analysis functions
  const getPerformanceAnalysis = useCallback(() => {
    const monitor = monitorRef.current;
    if (!monitor || !state.metrics) return null;

    const metrics = state.metrics;
    const quality = state.currentQuality;

    return {
      performanceGrade: getPerformanceGrade(metrics.currentFPS, targetFPS),
      qualityLevel: metrics.qualityLevel,
      recommendations: metrics.recommendations,
      bottlenecks: identifyBottlenecks(metrics, quality),
      optimizationPotential: assessOptimizationPotential(metrics, quality)
    };
  }, [state.metrics, state.currentQuality, targetFPS]);

  const isLowEndDevice = useCallback(() => {
    const monitor = monitorRef.current;
    if (!monitor) return false;

    const quality = monitor.getCurrentQuality();
    return (
      quality.shaderComplexity === 'simple' &&
      quality.cloudDensity <= 0.4 &&
      !quality.enableLayeredEffects
    );
  }, []);

  return {
    // State
    ...state,
    
    // Control functions
    setQuality,
    adaptQuality,
    resetToBaseline,
    forceQualityReduction,
    
    // Analysis functions
    getPerformanceAnalysis,
    isLowEndDevice,
    
    // Direct monitor access (for advanced use cases)
    monitor: monitorRef.current
  };
};

// Helper functions
function getPerformanceGrade(currentFPS: number, targetFPS: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  const ratio = currentFPS / targetFPS;
  
  if (ratio >= 1.2) return 'A';
  if (ratio >= 1.0) return 'B';
  if (ratio >= 0.8) return 'C';
  if (ratio >= 0.6) return 'D';
  return 'F';
}

function identifyBottlenecks(
  metrics: SkiaPerformanceMetrics, 
  quality: SkiaQualitySettings
): string[] {
  const bottlenecks: string[] = [];

  if (metrics.currentFPS < 25 && quality.shaderComplexity === 'advanced') {
    bottlenecks.push('Complex shader causing GPU bottleneck');
  }

  if (metrics.currentFPS < 30 && quality.enableLayeredEffects) {
    bottlenecks.push('Layered effects causing rendering bottleneck');
  }

  if (metrics.averageFrameTime > 33 && quality.cloudDensity > 0.7) {
    bottlenecks.push('High cloud density causing fill rate bottleneck');
  }

  if (metrics.droppedFrames > metrics.totalFrames * 0.1) {
    bottlenecks.push('Frequent frame drops indicating CPU/GPU overload');
  }

  return bottlenecks;
}

function assessOptimizationPotential(
  metrics: SkiaPerformanceMetrics,
  quality: SkiaQualitySettings
): 'high' | 'medium' | 'low' {
  if (metrics.currentFPS < 25) return 'high';
  if (metrics.currentFPS < 40 && quality.shaderComplexity !== 'simple') return 'medium';
  if (metrics.currentFPS < 50 && quality.enableLayeredEffects) return 'medium';
  return 'low';
}