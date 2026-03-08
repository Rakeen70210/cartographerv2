import { useEffect, useMemo, useState } from 'react';
import {
  CloudFogVisualParams,
  deriveCloudFogVisualParams,
  getSoftCloudVisualSettingsBaseline,
} from '../services/cloudSystem/settings/CloudFogVisualAdapter';
import {
  CloudColorScheme,
  CloudStylePreset,
  VisualCustomizationManager,
  VisualCustomizationSettings,
} from '../services/cloudSystem/settings/VisualCustomizationManager';

let visualCustomizationManagerInstance: VisualCustomizationManager | null = null;

const getVisualCustomizationManager = (): VisualCustomizationManager => {
  if (!visualCustomizationManagerInstance) {
    visualCustomizationManagerInstance = new VisualCustomizationManager();
  }
  return visualCustomizationManagerInstance;
};

export const useCloudFogVisualParams = (baseFogOpacity: number): CloudFogVisualParams => {
  const manager = getVisualCustomizationManager();
  const [visualSettings, setVisualSettings] = useState<VisualCustomizationSettings>(() => getSoftCloudVisualSettingsBaseline());
  const [currentScheme, setCurrentScheme] = useState<CloudColorScheme | null>(() => manager.getCurrentColorScheme());
  const [currentPreset, setCurrentPreset] = useState<CloudStylePreset | null>(() => manager.getCurrentStylePreset());

  useEffect(() => {
    let mounted = true;

    const syncFromManager = () => {
      if (!mounted) {
        return;
      }

      setVisualSettings(manager.getCurrentSettings());
      setCurrentScheme(manager.getCurrentColorScheme());
      setCurrentPreset(manager.getCurrentStylePreset());
    };

    manager.initialize().then(syncFromManager).catch(error => {
      console.error('Failed to initialize cloud fog visual params:', error);
      syncFromManager();
    });

    manager.addListener(syncFromManager);
    return () => {
      mounted = false;
      manager.removeListener(syncFromManager);
    };
  }, [manager]);

  return useMemo(() => deriveCloudFogVisualParams({
    visualSettings,
    currentScheme,
    currentPreset,
    baseFogOpacity,
  }), [baseFogOpacity, currentPreset, currentScheme, visualSettings]);
};
