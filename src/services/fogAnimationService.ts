import { Animated, Easing } from 'react-native';
import { FogGeometry, FogFeature, GeographicArea, GridCell } from '../types/fog';

export interface FogClearingAnimation {
  id: string;
  area: GeographicArea;
  startTime: number;
  duration: number;
  animatedValue: Animated.Value;
  particleAnimations: ParticleAnimation[];
  onComplete: () => void;
}

export interface ParticleAnimation {
  id: string;
  position: Animated.ValueXY;
  opacity: Animated.Value;
  scale: Animated.Value;
  rotation: Animated.Value;
}

export interface FogAnimationConfig {
  clearingDuration: number;
  particleCount: number;
  particleLifetime: number;
  easingFunction: (value: number) => number;
  performanceMode: boolean;
}

export class FogAnimationService {
  private activeAnimations: Map<string, FogClearingAnimation> = new Map();
  private animationFrameId: number | null = null;
  private config: FogAnimationConfig;
  private onAnimationUpdate?: (animations: FogClearingAnimation[]) => void;

  constructor() {
    this.config = {
      clearingDuration: 2000, // 2 seconds
      particleCount: 20,
      particleLifetime: 1500,
      easingFunction: Easing.out(Easing.cubic),
      performanceMode: false,
    };
  }

  /**
   * Update animation configuration
   */
  updateConfig(newConfig: Partial<FogAnimationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Start fog clearing animation for a specific area
   */
  startFogClearingAnimation(
    area: GeographicArea,
    onComplete: () => void
  ): string {
    const animationId = `fog_clear_${Date.now()}_${Math.random()}`;
    
    // Create main fog clearing animation
    const animatedValue = new Animated.Value(1); // Start with full opacity
    
    // Create particle animations
    const particleAnimations = this.createParticleAnimations(area);
    
    const animation: FogClearingAnimation = {
      id: animationId,
      area,
      startTime: Date.now(),
      duration: this.config.clearingDuration,
      animatedValue,
      particleAnimations,
      onComplete,
    };

    this.activeAnimations.set(animationId, animation);

    // Start the main fog clearing animation
    this.animateFogClearing(animation);

    // Start particle animations
    this.animateParticles(animation);

    // Start animation loop if not already running
    if (!this.animationFrameId) {
      this.startAnimationLoop();
    }

    return animationId;
  }

  /**
   * Create particle animations for fog clearing effect
   */
  private createParticleAnimations(area: GeographicArea): ParticleAnimation[] {
    const particles: ParticleAnimation[] = [];
    const particleCount = this.config.performanceMode 
      ? Math.min(this.config.particleCount, 10) 
      : this.config.particleCount;

    for (let i = 0; i < particleCount; i++) {
      // Random position within the area bounds
      const randomX = area.bounds.west + Math.random() * (area.bounds.east - area.bounds.west);
      const randomY = area.bounds.south + Math.random() * (area.bounds.north - area.bounds.south);

      const particle: ParticleAnimation = {
        id: `particle_${i}`,
        position: new Animated.ValueXY({ x: randomX, y: randomY }),
        opacity: new Animated.Value(0.8),
        scale: new Animated.Value(0.5 + Math.random() * 0.5),
        rotation: new Animated.Value(Math.random() * 360),
      };

      particles.push(particle);
    }

    return particles;
  }

  /**
   * Animate the main fog clearing effect
   */
  private animateFogClearing(animation: FogClearingAnimation): void {
    Animated.timing(animation.animatedValue, {
      toValue: 0, // Fade to transparent
      duration: this.config.clearingDuration,
      easing: this.config.easingFunction,
      useNativeDriver: true,
    }).start(() => {
      // Animation completed
      this.completeAnimation(animation.id);
    });
  }

  /**
   * Animate particles for visual effect
   */
  private animateParticles(animation: FogClearingAnimation): void {
    animation.particleAnimations.forEach((particle, index) => {
      // Stagger particle animations for more natural effect
      const delay = index * 50;

      // Animate particle movement (upward drift)
      const currentX = (particle.position.x as any)._value || 0;
      const currentY = (particle.position.y as any)._value || 0;
      
      Animated.timing(particle.position, {
        toValue: {
          x: currentX + (Math.random() - 0.5) * 0.001, // Small horizontal drift
          y: currentY + 0.002, // Upward movement
        },
        duration: this.config.particleLifetime,
        delay,
        useNativeDriver: false, // Position animations can't use native driver
      }).start();

      // Animate particle opacity (fade out)
      Animated.timing(particle.opacity, {
        toValue: 0,
        duration: this.config.particleLifetime,
        delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      // Animate particle scale (grow slightly)
      const currentScale = (particle.scale as any)._value || 1;
      Animated.timing(particle.scale, {
        toValue: currentScale * 1.5,
        duration: this.config.particleLifetime,
        delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      // Animate particle rotation
      const currentRotation = (particle.rotation as any)._value || 0;
      Animated.timing(particle.rotation, {
        toValue: currentRotation + 180 + Math.random() * 180,
        duration: this.config.particleLifetime,
        delay,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    });
  }

  /**
   * Complete and cleanup animation
   */
  private completeAnimation(animationId: string): void {
    const animation = this.activeAnimations.get(animationId);
    if (animation) {
      animation.onComplete();
      this.activeAnimations.delete(animationId);

      // Stop animation loop if no more animations
      if (this.activeAnimations.size === 0 && this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }
  }

  /**
   * Start animation loop for performance monitoring
   */
  private startAnimationLoop(): void {
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let fpsSum = 0;

    const loop = (currentTime: number) => {
      const deltaTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;

      // Calculate FPS for performance monitoring
      if (deltaTime > 0) {
        const fps = 1000 / deltaTime;
        fpsSum += fps;
        frameCount++;

        // Check performance every 60 frames
        if (frameCount >= 60) {
          const averageFps = fpsSum / frameCount;
          
          // Enable performance mode if FPS drops below 45
          if (averageFps < 45 && !this.config.performanceMode) {
            this.config.performanceMode = true;
            console.warn('Fog animation performance mode enabled due to low FPS:', averageFps);
          }
          
          frameCount = 0;
          fpsSum = 0;
        }
      }

      // Notify about animation updates
      if (this.onAnimationUpdate) {
        this.onAnimationUpdate(Array.from(this.activeAnimations.values()));
      }

      // Continue loop if there are active animations
      if (this.activeAnimations.size > 0) {
        this.animationFrameId = requestAnimationFrame(loop);
      } else {
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * Cancel a specific animation
   */
  cancelAnimation(animationId: string): void {
    const animation = this.activeAnimations.get(animationId);
    if (animation) {
      // Stop all animated values
      animation.animatedValue.stopAnimation();
      animation.particleAnimations.forEach(particle => {
        particle.position.stopAnimation();
        particle.opacity.stopAnimation();
        particle.scale.stopAnimation();
        particle.rotation.stopAnimation();
      });

      this.activeAnimations.delete(animationId);
    }
  }

  /**
   * Cancel all active animations
   */
  cancelAllAnimations(): void {
    this.activeAnimations.forEach((_, id) => {
      this.cancelAnimation(id);
    });

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Get active animations
   */
  getActiveAnimations(): FogClearingAnimation[] {
    return Array.from(this.activeAnimations.values());
  }

  /**
   * Set animation update callback
   */
  setAnimationUpdateCallback(callback: (animations: FogClearingAnimation[]) => void): void {
    this.onAnimationUpdate = callback;
  }

  /**
   * Check if any animations are currently running
   */
  hasActiveAnimations(): boolean {
    return this.activeAnimations.size > 0;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMode(): boolean {
    return this.config.performanceMode;
  }

  /**
   * Manually enable/disable performance mode
   */
  setPerformanceMode(enabled: boolean): void {
    this.config.performanceMode = enabled;
  }
}

// Singleton instance
let fogAnimationService: FogAnimationService | null = null;

export const getFogAnimationService = (): FogAnimationService => {
  if (!fogAnimationService) {
    fogAnimationService = new FogAnimationService();
  }
  return fogAnimationService;
};