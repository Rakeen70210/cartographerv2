import { Animated, Easing } from 'react-native';
import { DissipationAnimation } from '../../../types/skiaFog';

export interface DissipationAnimationConfig {
  center: [number, number];
  maxRadius: number;
  duration: number;
  easing?: 'easeOut' | 'easeInOut' | 'linear' | 'bounce';
  onComplete?: (animationId: string) => void;
}

export interface AnimatedDissipation extends DissipationAnimation {
  radius: Animated.Value;
  progress: Animated.Value;
  isActive: boolean;
}

/**
 * Manages radial dissipation animations for fog clearing effects
 * Provides smooth, eased animations with proper timing and cleanup
 */
export class DissipationAnimator {
  private activeAnimations = new Map<string, AnimatedDissipation>();
  private animationCounter = 0;

  /**
   * Creates and starts a new dissipation animation
   */
  createAnimation(config: DissipationAnimationConfig): AnimatedDissipation {
    const animationId = `dissipation_${++this.animationCounter}_${Date.now()}`;
    
    // Create animated values for animation
    const radiusValue = new Animated.Value(0);
    const progressValue = new Animated.Value(0);

    const animation: AnimatedDissipation = {
      id: animationId,
      center: config.center,
      radius: radiusValue,
      progress: progressValue,
      startTime: Date.now(),
      duration: config.duration,
      isActive: true,
    };

    // Store animation reference
    this.activeAnimations.set(animationId, animation);

    // Start the animation with proper easing
    const easingFunction = this.getEasingFunction(config.easing || 'easeOut');
    
    // Animate radius from 0 to maxRadius
    Animated.timing(radiusValue, {
      toValue: config.maxRadius,
      duration: config.duration,
      easing: easingFunction,
      useNativeDriver: false,
    }).start((finished) => {
      if (finished) {
        this.completeAnimation(animationId, config.onComplete);
      }
    });

    // Animate progress from 0 to 1 (for additional effects)
    Animated.timing(progressValue, {
      toValue: 1,
      duration: config.duration,
      easing: easingFunction,
      useNativeDriver: false,
    }).start();

    return animation;
  }

  /**
   * Gets the appropriate easing function for the animation
   */
  private getEasingFunction(easing: string) {
    switch (easing) {
      case 'easeOut':
        return Easing.out(Easing.cubic);
      case 'easeInOut':
        return Easing.inOut(Easing.cubic);
      case 'linear':
        return Easing.linear;
      case 'bounce':
        return Easing.bounce;
      default:
        return Easing.out(Easing.cubic);
    }
  }

  /**
   * Completes an animation and performs cleanup
   */
  private completeAnimation = (animationId: string, onComplete?: (id: string) => void) => {
    const animation = this.activeAnimations.get(animationId);
    if (animation) {
      animation.isActive = false;
      this.activeAnimations.delete(animationId);
      
      if (onComplete) {
        onComplete(animationId);
      }
    }
  };

  /**
   * Cancels an active animation
   */
  cancelAnimation(animationId: string): boolean {
    const animation = this.activeAnimations.get(animationId);
    if (animation && animation.isActive) {
      animation.isActive = false;
      animation.radius.stopAnimation();
      animation.progress.stopAnimation();
      animation.radius.setValue(0);
      animation.progress.setValue(0);
      this.activeAnimations.delete(animationId);
      return true;
    }
    return false;
  }

  /**
   * Gets all currently active animations
   */
  getActiveAnimations(): AnimatedDissipation[] {
    return Array.from(this.activeAnimations.values()).filter(anim => anim.isActive);
  }

  /**
   * Gets a specific animation by ID
   */
  getAnimation(animationId: string): AnimatedDissipation | undefined {
    return this.activeAnimations.get(animationId);
  }

  /**
   * Cancels all active animations
   */
  cancelAllAnimations(): void {
    for (const [id, animation] of this.activeAnimations) {
      if (animation.isActive) {
        animation.isActive = false;
        animation.radius.stopAnimation();
        animation.progress.stopAnimation();
        animation.radius.setValue(0);
        animation.progress.setValue(0);
      }
    }
    this.activeAnimations.clear();
  }

  /**
   * Gets the count of active animations
   */
  getActiveAnimationCount(): number {
    return Array.from(this.activeAnimations.values()).filter(anim => anim.isActive).length;
  }

  /**
   * Cleans up completed animations (garbage collection)
   */
  cleanup(): void {
    const now = Date.now();
    const expiredAnimations: string[] = [];

    for (const [id, animation] of this.activeAnimations) {
      // Remove animations that have been inactive for more than 5 seconds
      if (!animation.isActive && (now - animation.startTime) > 5000) {
        expiredAnimations.push(id);
      }
    }

    expiredAnimations.forEach(id => {
      this.activeAnimations.delete(id);
    });
  }

  /**
   * Disposes of all resources
   */
  dispose(): void {
    this.cancelAllAnimations();
    this.activeAnimations.clear();
  }
}

/**
 * Singleton instance for global access
 */
export const dissipationAnimator = new DissipationAnimator();