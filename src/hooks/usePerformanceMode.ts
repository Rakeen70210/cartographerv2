/**
 * usePerformanceMode Hook
 * React hook for managing cloud system performance modes
 */

import { useState, useEffect, useCallback } from 'react';
import { PerformanceMode } from '../types/cloud';
import { 
  PerformanceModeSelector, 
  PerformanceModeInfo, 
  PerformanceModeSettings 
} from '../services/cloudSystem/settings/PerformanceModeSelector';

let selectorInstance: PerformanceModeSelector | null = null;

const getSelector = (): PerformanceModeSelector => {
  if (!selectorInstance) {
    selectorInstance = new PerformanceModeSelector();
  }
  return selectorInstance;
};

export interface UsePerformanceModeReturn {
  currentMode: PerformanceMode;
  availableModes: PerformanceModeInfo[];
  settings: PerformanceModeSettings;
  loading: boolean;
  error: string | null;
  suggestions: string[];
  setPerformanceMode: (mode: PerformanceMode, manual?: boolean) => Promise<void>;
  setAutoDetection: (enabled: boolean) => Promise<void>;
  performAutoDetection: () => Promise<PerformanceMode>;
  isModeSupported: (mode: PerformanceMode) => boolean;
  getModeCompatibility: (mode: PerformanceMode) => {
    supported: boolean;
    warnings: string[];
    requirements: string[];
  };
}

export const usePerformanceMode = (): UsePerformanceModeReturn => {
  const [settings, setSettings] = useState<PerformanceModeSettings>({
    currentMode: 'medium',
    autoDetect: true,
    manualOverride: false,
    lastAutoDetection: 0,
  });
  const [availableModes, setAvailableModes] = useState<PerformanceModeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const selector = getSelector();

  // Initialize selector and load data
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        setError(null);
        
        await selector.initialize();
        
        const currentSettings = selector.getCurrentSettings();
        const modes = selector.getAvailablePerformanceModes();
        const currentSuggestions = selector.getPerformanceSuggestions();
        
        setSettings(currentSettings);
        setAvailableModes(modes);
        setSuggestions(currentSuggestions);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize performance mode';
        setError(errorMessage);
        console.error('Failed to initialize performance mode:', err);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [selector]);

  // Listen for settings changes
  useEffect(() => {
    const handleSettingsChange = (newSettings: PerformanceModeSettings) => {
      setSettings(newSettings);
      
      // Update available modes to reflect new recommendations
      const modes = selector.getAvailablePerformanceModes();
      setAvailableModes(modes);
      
      // Update suggestions
      const currentSuggestions = selector.getPerformanceSuggestions();
      setSuggestions(currentSuggestions);
    };

    selector.addListener(handleSettingsChange);

    return () => {
      selector.removeListener(handleSettingsChange);
    };
  }, [selector]);

  // Set performance mode
  const setPerformanceMode = useCallback(async (
    mode: PerformanceMode, 
    manual: boolean = true
  ): Promise<void> => {
    try {
      setError(null);
      await selector.setPerformanceMode(mode, manual);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set performance mode';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [selector]);

  // Set auto-detection
  const setAutoDetection = useCallback(async (enabled: boolean): Promise<void> => {
    try {
      setError(null);
      await selector.setAutoDetection(enabled);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set auto-detection';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [selector]);

  // Perform auto-detection
  const performAutoDetection = useCallback(async (): Promise<PerformanceMode> => {
    try {
      setError(null);
      return await selector.performAutoDetection();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Auto-detection failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [selector]);

  // Check if mode is supported
  const isModeSupported = useCallback((mode: PerformanceMode): boolean => {
    return selector.isModeSupported(mode);
  }, [selector]);

  // Get mode compatibility info
  const getModeCompatibility = useCallback((mode: PerformanceMode) => {
    return selector.getModeCompatibility(mode);
  }, [selector]);

  return {
    currentMode: settings.currentMode,
    availableModes,
    settings,
    loading,
    error,
    suggestions,
    setPerformanceMode,
    setAutoDetection,
    performAutoDetection,
    isModeSupported,
    getModeCompatibility,
  };
};