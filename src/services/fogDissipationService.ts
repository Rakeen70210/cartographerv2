import { store } from '../store';
import { 
  startFogClearingAnimation, 
  completeFogClearingAnimation,
  setFogGeometry,
  batchStartClearingAnimations,
  batchCompleteClearingAnimations,
  updateAnimationProgress
} from '../store/slices/fogSlice';
import { 
  DissipationAnimator, 
  DissipationAnimationConfig,
  AnimatedDissipation 
} from './cloudSystem/animation/DissipationAnimator';
import { GeographicArea } from '../types/fog';

/**
 * Service that integrates dissipation animations with Redux state management
 * Bridges the gap between Skia animations and application state
 */
export class FogDissipationService {
  private dissipationAnimator: DissipationAnimator;
  private activeAnimationIds = new Set<string>();

  constructor() {
    this.dissipationAnimator = new DissipationAnimator();
  }

  /**
   * Starts a fog clearing animation at the specified location
   * Integrates with Redux state and Skia animation system
   */
  startClearingAnimation(
    center: [number, number], 
    radius: number,
    options: {
      duration?: number;
      easing?: 'easeOut' | 'easeInOut' | 'linear' | 'bounce';
      bounds?: {
        north: number;
        south: number;
        east: number;
        west: number;
      };
    } = {}
  ): string {
    const animationId = `fog_clearing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate bounds if not provided
    const bounds = options.bounds || this.calculateBounds(center, radius);
    
    // Create geographic area for Redux state
    const area: GeographicArea = {
      center,
      radius,
      bounds
    };

    // Dispatch Redux action to start animation
    store.dispatch(startFogClearingAnimation({
      animationId,
      area
    }));

    // Create Skia animation configuration
    const animationConfig: DissipationAnimationConfig = {
      center,
      maxRadius: radius,
      duration: options.duration || 2500, // Default 2.5 seconds
      easing: options.easing || 'easeOut',
      onComplete: (completedAnimationId: string) => {
        this.handleAnimationComplete(completedAnimationId);
      }
    };

    // Start the Skia animation
    const animation = this.dissipationAnimator.createAnimation(animationConfig);
    this.activeAnimationIds.add(animationId);

    console.log('🌫️ Started fog clearing animation:', {
      animationId,
      center,
      radius,
      duration: animationConfig.duration,
      easing: animationConfig.easing
    });

    return animationId;
  }

  /**
   * Handles animation completion and Redux state cleanup
   */
  private handleAnimationComplete = (animationId: string): void => {
    if (this.activeAnimationIds.has(animationId)) {
      // Dispatch Redux action to complete animation
      store.dispatch(completeFogClearingAnimation(animationId));
      
      // Remove from active animations
      this.activeAnimationIds.delete(animationId);

      console.log('🌫️ Completed fog clearing animation:', animationId);
    }
  };

  /**
   * Starts multiple clearing animations at once for better performance
   */
  startMultipleClearingAnimations(
    areas: Array<{
      center: [number, number];
      radius: number;
      duration?: number;
      easing?: 'easeOut' | 'easeInOut' | 'linear' | 'bounce';
      bounds?: {
        north: number;
        south: number;
        east: number;
        west: number;
      };
    }>
  ): string[] {
    const animationIds: string[] = [];
    const reduxAreas: Array<{
      animationId: string;
      area: GeographicArea;
    }> = [];

    // Create all animations
    areas.forEach(areaConfig => {
      const animationId = `fog_clearing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const bounds = areaConfig.bounds || this.calculateBounds(areaConfig.center, areaConfig.radius);
      
      const area: GeographicArea = {
        center: areaConfig.center,
        radius: areaConfig.radius,
        bounds
      };

      reduxAreas.push({ animationId, area });
      animationIds.push(animationId);

      // Create Skia animation
      const animationConfig: DissipationAnimationConfig = {
        center: areaConfig.center,
        maxRadius: areaConfig.radius,
        duration: areaConfig.duration || 2500,
        easing: areaConfig.easing || 'easeOut',
        onComplete: (completedAnimationId: string) => {
          this.handleAnimationComplete(completedAnimationId);
        }
      };

      const animation = this.dissipationAnimator.createAnimation(animationConfig);
      this.activeAnimationIds.add(animationId);
    });

    // Batch dispatch to Redux for better performance
    store.dispatch(batchStartClearingAnimations(reduxAreas));

    console.log('🌫️ Started multiple fog clearing animations:', {
      count: animationIds.length,
      animationIds
    });

    return animationIds;
  }

  /**
   * Cancels an active clearing animation
   */
  cancelClearingAnimation(animationId: string): boolean {
    if (this.activeAnimationIds.has(animationId)) {
      // Cancel the Skia animation
      const cancelled = this.dissipationAnimator.cancelAnimation(animationId);
      
      if (cancelled) {
        // Dispatch Redux action to complete animation (cleanup)
        store.dispatch(completeFogClearingAnimation(animationId));
        this.activeAnimationIds.delete(animationId);
        
        console.log('🌫️ Cancelled fog clearing animation:', animationId);
        return true;
      }
    }
    return false;
  }

  /**
   * Gets all currently active dissipation animations
   */
  getActiveAnimations(): AnimatedDissipation[] {
    return this.dissipationAnimator.getActiveAnimations();
  }

  /**
   * Gets a specific animation by ID
   */
  getAnimation(animationId: string): AnimatedDissipation | undefined {
    return this.dissipationAnimator.getAnimation(animationId);
  }

  /**
   * Cancels all active animations
   */
  cancelAllAnimations(): void {
    const activeIds = Array.from(this.activeAnimationIds);
    
    // Cancel all Skia animations
    this.dissipationAnimator.cancelAllAnimations();
    
    // Clean up Redux state for each animation
    activeIds.forEach(animationId => {
      store.dispatch(completeFogClearingAnimation(animationId));
    });
    
    this.activeAnimationIds.clear();
    
    console.log('🌫️ Cancelled all fog clearing animations');
  }

  /**
   * Synchronizes with Redux state changes
   * Call this when Redux clearingAreas state changes externally
   */
  syncWithReduxState(): void {
    const state = store.getState();
    const reduxClearingAreas = state.fog.clearingAreas;
    const activeAnimations = this.dissipationAnimator.getActiveAnimations();

    // Check for animations that should be cancelled based on Redux state
    activeAnimations.forEach(animation => {
      const matchingArea = reduxClearingAreas.find(area => 
        area.center[0] === animation.center[0] && 
        area.center[1] === animation.center[1]
      );

      if (!matchingArea) {
        // Animation exists in Skia but not in Redux - cancel it
        this.dissipationAnimator.cancelAnimation(animation.id);
        this.activeAnimationIds.delete(animation.id);
      }
    });

    // Check for new areas in Redux that don't have animations
    reduxClearingAreas.forEach(area => {
      const matchingAnimation = activeAnimations.find(animation =>
        animation.center[0] === area.center[0] && 
        animation.center[1] === area.center[1]
      );

      if (!matchingAnimation) {
        // Redux has an area but no Skia animation - start one
        this.startClearingAnimation(area.center, area.radius, {
          bounds: area.bounds
        });
      }
    });
  }

  /**
   * Calculates geographic bounds for a circular area
   */
  private calculateBounds(center: [number, number], radius: number): {
    north: number;
    south: number;
    east: number;
    west: number;
  } {
    // Convert radius from meters to approximate degrees
    // This is a rough approximation - 1 degree ≈ 111,000 meters at equator
    const radiusInDegrees = radius / 111000;
    
    return {
      north: center[1] + radiusInDegrees,
      south: center[1] - radiusInDegrees,
      east: center[0] + radiusInDegrees,
      west: center[0] - radiusInDegrees
    };
  }

  /**
   * Gets statistics about active animations
   */
  getAnimationStats(): {
    activeCount: number;
    totalStarted: number;
    averageDuration: number;
  } {
    const activeAnimations = this.dissipationAnimator.getActiveAnimations();
    const now = Date.now();
    
    let totalDuration = 0;
    activeAnimations.forEach(animation => {
      totalDuration += (now - animation.startTime);
    });

    return {
      activeCount: activeAnimations.length,
      totalStarted: this.activeAnimationIds.size,
      averageDuration: activeAnimations.length > 0 ? totalDuration / activeAnimations.length : 0
    };
  }

  /**
   * Performs cleanup of expired animations
   */
  cleanup(): void {
    this.dissipationAnimator.cleanup();
    
    // Remove any stale animation IDs
    const activeAnimations = this.dissipationAnimator.getActiveAnimations();
    const activeSkiaIds = new Set(activeAnimations.map(anim => anim.id));
    
    for (const id of this.activeAnimationIds) {
      if (!activeSkiaIds.has(id)) {
        this.activeAnimationIds.delete(id);
      }
    }
  }

  /**
   * Disposes of all resources
   */
  dispose(): void {
    this.cancelAllAnimations();
    this.dissipationAnimator.dispose();
    this.activeAnimationIds.clear();
  }
}

/**
 * Singleton instance for global access
 */
export const fogDissipationService = new FogDissipationService();