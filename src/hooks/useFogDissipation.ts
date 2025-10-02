import { useCallback, useEffect, useState } from 'react';
import { useAppSelector } from '../store/hooks';
import { fogDissipationService, FogDissipationService } from '../services/fogDissipationService';
import { AnimatedDissipation } from '../services/cloudSystem/animation/DissipationAnimator';

/**
 * Custom hook for managing fog dissipation animations
 * Provides easy access to dissipation functionality with Redux integration
 */
export const useFogDissipation = () => {
  // Redux state
  const clearingAreas = useAppSelector(state => state.fog.clearingAreas);
  const animationInProgress = useAppSelector(state => state.fog.animationInProgress);
  const activeAnimationIds = useAppSelector(state => state.fog.activeAnimations);

  // Local state for active animations
  const [activeAnimations, setActiveAnimations] = useState<AnimatedDissipation[]>([]);

  // Update active animations when Redux state changes
  useEffect(() => {
    const animations = fogDissipationService.getActiveAnimations();
    setActiveAnimations(animations);
  }, [clearingAreas, animationInProgress, activeAnimationIds]);

  // Sync service with Redux state
  useEffect(() => {
    fogDissipationService.syncWithReduxState();
  }, [clearingAreas]);

  /**
   * Starts a new fog clearing animation
   */
  const startClearingAnimation = useCallback((
    center: [number, number],
    radius: number,
    options?: {
      duration?: number;
      easing?: 'easeOut' | 'easeInOut' | 'linear' | 'bounce';
      bounds?: {
        north: number;
        south: number;
        east: number;
        west: number;
      };
    }
  ): string => {
    return fogDissipationService.startClearingAnimation(center, radius, options);
  }, []);

  /**
   * Cancels an active clearing animation
   */
  const cancelClearingAnimation = useCallback((animationId: string): boolean => {
    return fogDissipationService.cancelClearingAnimation(animationId);
  }, []);

  /**
   * Cancels all active animations
   */
  const cancelAllAnimations = useCallback((): void => {
    fogDissipationService.cancelAllAnimations();
  }, []);

  /**
   * Gets a specific animation by ID
   */
  const getAnimation = useCallback((animationId: string): AnimatedDissipation | undefined => {
    return fogDissipationService.getAnimation(animationId);
  }, []);

  /**
   * Gets animation statistics
   */
  const getAnimationStats = useCallback(() => {
    return fogDissipationService.getAnimationStats();
  }, []);

  /**
   * Starts a clearing animation at the user's current location
   */
  const clearFogAtLocation = useCallback((
    latitude: number,
    longitude: number,
    radius: number = 100,
    options?: {
      duration?: number;
      easing?: 'easeOut' | 'easeInOut' | 'linear' | 'bounce';
    }
  ): string => {
    return startClearingAnimation([longitude, latitude], radius, options);
  }, [startClearingAnimation]);

  /**
   * Starts multiple clearing animations in a pattern
   */
  const clearFogInPattern = useCallback((
    centers: Array<[number, number]>,
    radius: number = 100,
    options?: {
      duration?: number;
      easing?: 'easeOut' | 'easeInOut' | 'linear' | 'bounce';
      staggerDelay?: number; // Delay between each animation start
    }
  ): string[] => {
    const animationIds: string[] = [];
    const staggerDelay = options?.staggerDelay || 0;

    centers.forEach((center, index) => {
      const startAnimation = () => {
        const animationId = startClearingAnimation(center, radius, {
          duration: options?.duration,
          easing: options?.easing
        });
        animationIds.push(animationId);
      };

      if (staggerDelay > 0 && index > 0) {
        setTimeout(startAnimation, staggerDelay * index);
      } else {
        startAnimation();
      }
    });

    return animationIds;
  }, [startClearingAnimation]);

  return {
    // State
    activeAnimations,
    animationInProgress,
    clearingAreas,
    activeAnimationIds,
    
    // Actions
    startClearingAnimation,
    cancelClearingAnimation,
    cancelAllAnimations,
    clearFogAtLocation,
    clearFogInPattern,
    
    // Queries
    getAnimation,
    getAnimationStats,
    
    // Computed values
    hasActiveAnimations: activeAnimations.length > 0,
    animationCount: activeAnimations.length,
  };
};

/**
 * Hook for accessing the fog dissipation service directly
 * Use this when you need direct access to the service instance
 */
export const useFogDissipationService = (): FogDissipationService => {
  return fogDissipationService;
};