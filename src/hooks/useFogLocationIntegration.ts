import { useEffect, useState } from 'react';
import { fogLocationIntegrationService } from '../services/fogLocationIntegrationService';
import { LocationUpdate } from '../types';

export interface FogLocationIntegrationStatus {
  isActive: boolean;
  activeAnimations: number;
  lastProcessedLocation: LocationUpdate | null;
  hasPermissions: boolean;
  isProcessing: boolean;
}

/**
 * Hook to monitor fog-location integration status
 */
export const useFogLocationIntegration = () => {
  const [status, setStatus] = useState<FogLocationIntegrationStatus>({
    isActive: false,
    activeAnimations: 0,
    lastProcessedLocation: null,
    hasPermissions: false,
    isProcessing: false,
  });

  useEffect(() => {
    const updateStatus = async () => {
      const integrationStatus = await fogLocationIntegrationService.getStatus();
      
      setStatus({
        isActive: integrationStatus.isActive,
        activeAnimations: integrationStatus.activeAnimations,
        lastProcessedLocation: integrationStatus.lastProcessedLocation,
        hasPermissions: integrationStatus.isActive, // Simplified - if active, has permissions
        isProcessing: integrationStatus.activeAnimations > 0,
      });
    };

    // Update status immediately
    updateStatus();

    // Set up periodic status updates
    const statusInterval = setInterval(updateStatus, 2000); // Every 2 seconds

    return () => {
      clearInterval(statusInterval);
    };
  }, []);

  /**
   * Manually refresh fog geometry
   */
  const refreshFog = async () => {
    try {
      await fogLocationIntegrationService.refreshFogGeometry();
    } catch (error) {
      console.error('Error refreshing fog geometry:', error);
    }
  };

  /**
   * Manually trigger fog clearing at a location (for testing)
   */
  const manualFogClear = async (latitude: number, longitude: number, radius?: number) => {
    try {
      await fogLocationIntegrationService.manualFogClear(latitude, longitude, radius);
    } catch (error) {
      console.error('Error with manual fog clear:', error);
    }
  };

  return {
    status,
    refreshFog,
    manualFogClear,
  };
};