/**
 * useCloudSettings Hook
 * React hook for managing cloud settings with real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import { CloudSettings } from '../types/cloud';
import { CloudSettingsManager } from '../services/cloudSystem/settings';

let settingsManagerInstance: CloudSettingsManager | null = null;

const getSettingsManager = (): CloudSettingsManager => {
  if (!settingsManagerInstance) {
    settingsManagerInstance = new CloudSettingsManager();
  }
  return settingsManagerInstance;
};

export interface UseCloudSettingsReturn {
  settings: CloudSettings;
  loading: boolean;
  error: string | null;
  updateSetting: <K extends keyof CloudSettings>(key: K, value: CloudSettings[K]) => Promise<void>;
  updateSettings: (newSettings: Partial<CloudSettings>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  isValidSetting: <K extends keyof CloudSettings>(key: K, value: CloudSettings[K]) => boolean;
}

export const useCloudSettings = (): UseCloudSettingsReturn => {
  const [settings, setSettings] = useState<CloudSettings>(() => 
    getSettingsManager().getDefaultSettings()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const settingsManager = getSettingsManager();

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        const loadedSettings = await settingsManager.loadSettings();
        setSettings(loadedSettings);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
        console.error('Failed to load cloud settings:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [settingsManager]);

  // Listen for settings changes
  useEffect(() => {
    const handleSettingsChange = (newSettings: CloudSettings) => {
      setSettings(newSettings);
    };

    settingsManager.addSettingsListener(handleSettingsChange);

    return () => {
      settingsManager.removeSettingsListener(handleSettingsChange);
    };
  }, [settingsManager]);

  // Update a single setting
  const updateSetting = useCallback(async <K extends keyof CloudSettings>(
    key: K,
    value: CloudSettings[K]
  ): Promise<void> => {
    try {
      setError(null);
      await settingsManager.updateSetting(key, value);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update setting';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [settingsManager]);

  // Update multiple settings
  const updateSettings = useCallback(async (newSettings: Partial<CloudSettings>): Promise<void> => {
    try {
      setError(null);
      const mergedSettings = { ...settings, ...newSettings };
      await settingsManager.saveSettings(mergedSettings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update settings';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [settings, settingsManager]);

  // Reset to default settings
  const resetToDefaults = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await settingsManager.resetToDefaults();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset settings';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [settingsManager]);

  // Validate a setting value
  const isValidSetting = useCallback(<K extends keyof CloudSettings>(
    key: K,
    value: CloudSettings[K]
  ): boolean => {
    const testSettings = { [key]: value };
    return settingsManager.validateSettings(testSettings);
  }, [settingsManager]);

  return {
    settings,
    loading,
    error,
    updateSetting,
    updateSettings,
    resetToDefaults,
    isValidSetting,
  };
};