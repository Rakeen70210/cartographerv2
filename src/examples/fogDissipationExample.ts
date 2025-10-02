/**
 * Example usage of the fog dissipation animation system
 * This demonstrates how to integrate the new Skia-based dissipation animations
 */

import { useFogDissipation } from '../hooks/useFogDissipation';
import { fogDissipationService } from '../services/fogDissipationService';

/**
 * Example: Using the fog dissipation hook in a React component
 */
export const ExampleFogComponent = () => {
  const {
    startClearingAnimation,
    cancelAllAnimations,
    clearFogAtLocation,
    clearFogInPattern,
    hasActiveAnimations,
    animationCount,
    getAnimationStats
  } = useFogDissipation();

  // Example: Clear fog at user's current location
  const handleLocationExplored = (latitude: number, longitude: number) => {
    const animationId = clearFogAtLocation(latitude, longitude, 150, {
      duration: 3000,
      easing: 'easeOut'
    });
    
    console.log('Started fog clearing animation:', animationId);
  };

  // Example: Clear fog in a pattern (e.g., breadcrumb trail)
  const handleTrailExplored = (locations: Array<[number, number]>) => {
    const animationIds = clearFogInPattern(locations, 100, {
      duration: 2500,
      easing: 'easeOut',
      staggerDelay: 200 // 200ms delay between each animation
    });
    
    console.log('Started trail clearing animations:', animationIds);
  };

  // Example: Get animation statistics for debugging
  const logAnimationStats = () => {
    const stats = getAnimationStats();
    console.log('Animation Statistics:', {
      activeCount: stats.activeCount,
      totalStarted: stats.totalStarted,
      averageDuration: stats.averageDuration
    });
  };

  return null; // This is just an example, not a real component
};

/**
 * Example: Direct service usage (for non-React contexts)
 */
export class FogDissipationExample {
  
  /**
   * Example: Start a single clearing animation
   */
  static startSingleAnimation() {
    const center: [number, number] = [-122.4194, 37.7749]; // San Francisco
    const radius = 200; // 200 meter radius
    
    const animationId = fogDissipationService.startClearingAnimation(center, radius, {
      duration: 2500,
      easing: 'easeOut',
      bounds: {
        north: 37.7849,
        south: 37.7649,
        east: -122.4094,
        west: -122.4294
      }
    });
    
    return animationId;
  }

  /**
   * Example: Start multiple animations efficiently
   */
  static startMultipleAnimations() {
    const areas = [
      {
        center: [-122.4194, 37.7749] as [number, number],
        radius: 150,
        duration: 2000,
        easing: 'easeOut' as const
      },
      {
        center: [-122.4094, 37.7849] as [number, number],
        radius: 120,
        duration: 2500,
        easing: 'bounce' as const
      },
      {
        center: [-122.4294, 37.7649] as [number, number],
        radius: 180,
        duration: 3000,
        easing: 'easeInOut' as const
      }
    ];

    const animationIds = fogDissipationService.startMultipleClearingAnimations(areas);
    
    console.log('Started batch animations:', animationIds);
    return animationIds;
  }

  /**
   * Example: Monitor and manage animations
   */
  static monitorAnimations() {
    // Get current active animations
    const activeAnimations = fogDissipationService.getActiveAnimations();
    console.log('Active animations:', activeAnimations.length);

    // Get statistics
    const stats = fogDissipationService.getAnimationStats();
    console.log('Animation stats:', stats);

    // Cancel all if too many are running
    if (stats.activeCount > 10) {
      fogDissipationService.cancelAllAnimations();
      console.log('Cancelled all animations due to high count');
    }
  }

  /**
   * Example: Sync with Redux state (useful for debugging)
   */
  static syncWithRedux() {
    fogDissipationService.syncWithReduxState();
    console.log('Synced dissipation service with Redux state');
  }

  /**
   * Example: Cleanup expired animations
   */
  static performCleanup() {
    fogDissipationService.cleanup();
    console.log('Performed animation cleanup');
  }
}

/**
 * Example: Integration with location service
 */
export const integrateWithLocationService = () => {
  // This would typically be called when the user enters a new area
  const handleLocationUpdate = (latitude: number, longitude: number, accuracy: number) => {
    // Only start animation if accuracy is good enough
    if (accuracy < 50) { // Within 50 meters
      const animationId = fogDissipationService.startClearingAnimation(
        [longitude, latitude], 
        Math.max(100, accuracy * 2), // Radius based on accuracy
        {
          duration: 2500,
          easing: 'easeOut'
        }
      );
      
      console.log('Location-triggered fog clearing:', {
        animationId,
        location: [latitude, longitude],
        accuracy,
        radius: Math.max(100, accuracy * 2)
      });
    }
  };

  return handleLocationUpdate;
};

/**
 * Example: Performance monitoring
 */
export const monitorPerformance = () => {
  const checkPerformance = () => {
    const stats = fogDissipationService.getAnimationStats();
    
    // If too many animations are running, we might want to reduce quality
    if (stats.activeCount > 5) {
      console.warn('High animation count detected:', stats.activeCount);
      // Could trigger performance mode or cancel some animations
    }
    
    // Monitor average duration to detect performance issues
    if (stats.averageDuration > 5000) {
      console.warn('Long-running animations detected:', stats.averageDuration);
      // Could indicate performance issues
    }
  };

  // Check performance every 5 seconds
  setInterval(checkPerformance, 5000);
};