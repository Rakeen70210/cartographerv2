/**
 * useVisualCustomization Hook
 * React hook for managing cloud visual customization
 */

import { useState, useEffect, useCallback } from 'react';
import { CloudSettings } from '../types/cloud';
import { 
  VisualCustomizationManager,
  VisualCustomizationSettings,
  CloudColorScheme,
  CloudStylePreset
} from '../services/cloudSystem/settings/VisualCustomizationManager';

let managerInstance: VisualCustomizationManager | null = null;

const getManager = (): VisualCustomizationManager => {
  if (!managerInstance) {
    managerInstance = new VisualCustomizationManager();
  }
  return managerInstance;
};

export interface UseVisualCustomizationReturn {
  settings: VisualCustomizationSettings;
  colorSchemes: CloudColorScheme[];
  stylePresets: CloudStylePreset[];
  currentColorScheme: CloudColorScheme | null;
  currentStylePreset: CloudStylePreset | null;
  loading: boolean;
  error: string | null;
  setColorScheme: (schemeId: string) => Promise<void>;
  setCustomColorScheme: (colors: CloudColorScheme) => Promise<void>;
  setStylePreset: (presetId: string) => Promise<void>;
  updateVisualProperty: <K extends keyof VisualCustomizationSettings>(
    key: K,
    value: VisualCustomizationSettings[K]
  ) => Promise<void>;
  getAppliedCloudSettings: (baseSettings: CloudSettings) => CloudSettings;
  getVisualUniforms: () => Record<string, any>;
  createCustomPreset: (preset: Omit<CloudStylePreset, 'id'>) => Promise<string>;
  deleteCustomPreset: (presetId: string) => Promise<void>;
  exportSettings: () => string;
  importSettings: (settingsJson: string) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

export const useVisualCustomization = (): UseVisualCustomizationReturn => {
  const [settings, setSettings] = useState<VisualCustomizationSettings>(() =>
    getManager().getDefaultSettings()
  );
  const [colorSchemes, setColorSchemes] = useState<CloudColorScheme[]>([]);
  const [stylePresets, setStylePresets] = useState<CloudStylePreset[]>([]);
  const [currentColorScheme, setCurrentColorScheme] = useState<CloudColorScheme | null>(null);
  const [currentStylePreset, setCurrentStylePreset] = useState<CloudStylePreset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const manager = getManager();

  // Initialize manager and load data
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        setError(null);
        
        await manager.initialize();
        
        const currentSettings = manager.getCurrentSettings();
        const schemes = manager.getColorSchemes();
        const presets = manager.getStylePresets();
        const currentScheme = manager.getCurrentColorScheme();
        const currentPreset = manager.getCurrentStylePreset();
        
        setSettings(currentSettings);
        setColorSchemes(schemes);
        setStylePresets(presets);
        setCurrentColorScheme(currentScheme);
        setCurrentStylePreset(currentPreset);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize visual customization';
        setError(errorMessage);
        console.error('Failed to initialize visual customization:', err);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [manager]);

  // Listen for settings changes
  useEffect(() => {
    const handleSettingsChange = (newSettings: VisualCustomizationSettings) => {
      setSettings(newSettings);
      setCurrentColorScheme(manager.getCurrentColorScheme());
      setCurrentStylePreset(manager.getCurrentStylePreset());
      
      // Update presets list in case custom presets were added/removed
      setStylePresets(manager.getStylePresets());
    };

    manager.addListener(handleSettingsChange);

    return () => {
      manager.removeListener(handleSettingsChange);
    };
  }, [manager]);

  // Set color scheme
  const setColorScheme = useCallback(async (schemeId: string): Promise<void> => {
    try {
      setError(null);
      await manager.setColorScheme(schemeId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set color scheme';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [manager]);

  // Set custom color scheme
  const setCustomColorScheme = useCallback(async (colors: CloudColorScheme): Promise<void> => {
    try {
      setError(null);
      await manager.setCustomColorScheme(colors);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set custom color scheme';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [manager]);

  // Set style preset
  const setStylePreset = useCallback(async (presetId: string): Promise<void> => {
    try {
      setError(null);
      await manager.setStylePreset(presetId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set style preset';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [manager]);

  // Update visual property
  const updateVisualProperty = useCallback(async <K extends keyof VisualCustomizationSettings>(
    key: K,
    value: VisualCustomizationSettings[K]
  ): Promise<void> => {
    try {
      setError(null);
      await manager.updateVisualProperty(key, value);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update visual property';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [manager]);

  // Get applied cloud settings
  const getAppliedCloudSettings = useCallback((baseSettings: CloudSettings): CloudSettings => {
    return manager.getAppliedCloudSettings(baseSettings);
  }, [manager]);

  // Get visual uniforms
  const getVisualUniforms = useCallback((): Record<string, any> => {
    return manager.getVisualUniforms();
  }, [manager]);

  // Create custom preset
  const createCustomPreset = useCallback(async (preset: Omit<CloudStylePreset, 'id'>): Promise<string> => {
    try {
      setError(null);
      return await manager.createCustomPreset(preset);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create custom preset';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [manager]);

  // Delete custom preset
  const deleteCustomPreset = useCallback(async (presetId: string): Promise<void> => {
    try {
      setError(null);
      await manager.deleteCustomPreset(presetId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete custom preset';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [manager]);

  // Export settings
  const exportSettings = useCallback((): string => {
    return manager.exportSettings();
  }, [manager]);

  // Import settings
  const importSettings = useCallback(async (settingsJson: string): Promise<void> => {
    try {
      setError(null);
      await manager.importSettings(settingsJson);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import settings';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [manager]);

  // Reset to defaults
  const resetToDefaults = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await manager.resetToDefaults();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset to defaults';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [manager]);

  return {
    settings,
    colorSchemes,
    stylePresets,
    currentColorScheme,
    currentStylePreset,
    loading,
    error,
    setColorScheme,
    setCustomColorScheme,
    setStylePreset,
    updateVisualProperty,
    getAppliedCloudSettings,
    getVisualUniforms,
    createCustomPreset,
    deleteCustomPreset,
    exportSettings,
    importSettings,
    resetToDefaults,
  };
};