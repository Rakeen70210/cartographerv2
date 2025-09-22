/**
 * DissipationAnimator - Handles cloud dissipation animations with radial clearing patterns
 * Implements smooth falloff calculations for natural dissipation edges
 */

import { 
  DissipationAnimation, 
  DissipationState, 
  CloudGeographicArea, 
  Vector2,
  EasingFunction 
} from '../../../types/cloud';
import { EasingFunctions } from './EasingFunctions';

export interface DissipationConfig {
  defaultDuration: number; // Default animation duration in ms
  maxRadius: number; // Maximum dissipation radius in meters
  falloffDistance: number; // Distance over which dissipation fades in meters
  edgeSoftness: number; // Softness of dissipation edges (0-1)
  minOpacity: number; // Minimum opacity during dissipation (0-1)
  radiusGrowthCurve: EasingFunction; // How radius grows over time
  opacityFalloffCurve: EasingFunction; // How opacity fades at edges
}

export interface DissipationPoint {
  center: [number, number]; // Geographic coordinates [lng, lat]
  worldPosition: [number, number]; // World space coordinates
  radius: number; // Current dissipation radius in meters
  maxRadius: number; // Maximum radius for this dissipation
  progress: number; // Animation progress (0-1)
  startTime: number; // Animation start time
  duration: number; // Animation duration in ms
  easing: EasingFunction; // Easing function for this dissipation
}

export interface RadialFalloff {
  distance: number; // Distance from dissipation center
  opacity: number; // Calculated opacity (0-1)
  inDissipationZone: boolean; // Whether point is within dissipation area
}

/**
 * DissipationAnimator class for managing cloud clearing animations
 */
export class DissipationAnimator {
  private config: DissipationConfig;
  private activeDissipations: Map<string, DissipationPoint> = new Map();
  private animationFrameId: number | null = null;
  private isDisposed: boolean = false;
  
  // Callbacks
  private onDissipationUpdate?: (dissipations: DissipationPoint[]) => void;
  private onDissipationComplete?: (dissipationId: string) => void;
  private onUniformUpdate?: (uniforms: Record<string, any>) => void;

  constructor(config: Partial<DissipationConfig> = {}) {
    this.config = {
      defaultDuration: 2500, // 2.5 seconds
      maxRadius: 100, // 100 meters
      falloffDistance: 20, // 20 meter falloff
      edgeSoftness: 0.8, // Soft edges
      minOpacity: 0.0, // Complete clearing
      radiusGrowthCurve: EasingFunctions.cloud.dissipation,
      opacityFalloffCurve: EasingFunctions.cubic.out,
      ...config
    };
  }

  /**
   * Start a new dissipation animation at the specified location
   */
  startDissipation(
    center: [number, number],
    options: Partial<{
      maxRadius: number;
      duration: number;
      easing: EasingFunction;
      id: string;
    }> = {}
  ): string {
    if (this.isDisposed) {
      throw new Error('DissipationAnimator has been disposed');
    }

    const dissipationId = options.id || this.generateDissipationId();
    const maxRadius = options.maxRadius || this.config.maxRadius;
    const duration = options.duration || this.config.defaultDuration;
    const easing = options.easing || this.config.radiusGrowthCurve;

    const dissipationPoint: DissipationPoint = {
      center,
      worldPosition: this.geographicToWorld(center),
      radius: 0,
      maxRadius,
      progress: 0,
      startTime: performance.now(),
      duration,
      easing
    };

    this.activeDissipations.set(dissipationId, dissipationPoint);

    // Start animation loop if not already running
    if (!this.animationFrameId) {
      this.startAnimationLoop();
    }

    return dissipationId;
  }

  /**
   * Stop a specific dissipation animation
   */
  stopDissipation(dissipationId: string): boolean {
    const removed = this.activeDissipations.delete(dissipationId);
    
    // Stop animation loop if no active dissipations
    if (this.activeDissipations.size === 0 && this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    return removed;
  }

  /**
   * Stop all active dissipation animations
   */
  stopAllDissipations(): void {
    this.activeDissipations.clear();
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Calculate radial falloff for a point relative to all active dissipations
   */
  calculateRadialFalloff(worldPosition: [number, number]): RadialFalloff {
    let minOpacity = 1.0;
    let inAnyDissipationZone = false;
    let closestDistance = Infinity;

    for (const dissipation of this.activeDissipations.values()) {
      const distance = this.calculateDistance(worldPosition, dissipation.worldPosition);
      
      if (distance < dissipation.radius + this.config.falloffDistance) {
        inAnyDissipationZone = true;
        closestDistance = Math.min(closestDistance, distance);
        
        const opacity = this.calculateOpacityAtDistance(distance, dissipation);
        minOpacity = Math.min(minOpacity, opacity);
      }
    }

    return {
      distance: closestDistance === Infinity ? 0 : closestDistance,
      opacity: minOpacity,
      inDissipationZone: inAnyDissipationZone
    };
  }

  /**
   * Get all active dissipation points
   */
  getActiveDissipations(): DissipationPoint[] {
    return Array.from(this.activeDissipations.values());
  }

  /**
   * Check if any dissipations are currently active
   */
  hasActiveDissipations(): boolean {
    return this.activeDissipations.size > 0;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DissipationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Set callback for dissipation updates
   */
  setDissipationUpdateCallback(callback: (dissipations: DissipationPoint[]) => void): void {
    this.onDissipationUpdate = callback;
  }

  /**
   * Set callback for dissipation completion
   */
  setDissipationCompleteCallback(callback: (dissipationId: string) => void): void {
    this.onDissipationComplete = callback;
  }

  /**
   * Set callback for uniform updates
   */
  setUniformUpdateCallback(callback: (uniforms: Record<string, any>) => void): void {
    this.onUniformUpdate = callback;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.isDisposed = true;
    this.stopAllDissipations();
    this.onDissipationUpdate = undefined;
    this.onDissipationComplete = undefined;
    this.onUniformUpdate = undefined;
  }

  /**
   * Start the animation loop
   */
  private startAnimationLoop(): void {
    const animate = () => {
      if (this.isDisposed || this.activeDissipations.size === 0) {
        this.animationFrameId = null;
        return;
      }

      this.updateDissipations();
      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Update all active dissipations
   */
  private updateDissipations(): void {
    const currentTime = performance.now();
    const completedDissipations: string[] = [];
    const uniforms: Record<string, any> = {};

    // Collect dissipation data for shader uniforms
    const dissipationCenters: number[] = [];
    const dissipationRadii: number[] = [];
    const dissipationOpacities: number[] = [];

    for (const [id, dissipation] of this.activeDissipations.entries()) {
      const elapsed = currentTime - dissipation.startTime;
      const progress = Math.min(elapsed / dissipation.duration, 1);
      
      // Apply easing to progress
      const easedProgress = dissipation.easing(progress);
      
      // Update dissipation properties
      dissipation.progress = progress;
      dissipation.radius = dissipation.maxRadius * easedProgress;

      // Collect data for shaders
      dissipationCenters.push(dissipation.worldPosition[0], dissipation.worldPosition[1]);
      dissipationRadii.push(dissipation.radius);
      dissipationOpacities.push(this.calculateDissipationOpacity(progress));

      // Check if animation is complete
      if (progress >= 1) {
        completedDissipations.push(id);
      }
    }

    // Update shader uniforms
    if (this.onUniformUpdate) {
      uniforms.u_dissipationCenters = new Float32Array(dissipationCenters);
      uniforms.u_dissipationRadii = new Float32Array(dissipationRadii);
      uniforms.u_dissipationOpacities = new Float32Array(dissipationOpacities);
      uniforms.u_dissipationCount = this.activeDissipations.size;
      uniforms.u_dissipationFalloff = this.config.falloffDistance;
      uniforms.u_dissipationSoftness = this.config.edgeSoftness;
      
      this.onUniformUpdate(uniforms);
    }

    // Remove completed dissipations
    for (const id of completedDissipations) {
      this.activeDissipations.delete(id);
      if (this.onDissipationComplete) {
        this.onDissipationComplete(id);
      }
    }

    // Notify about dissipation updates
    if (this.onDissipationUpdate) {
      this.onDissipationUpdate(this.getActiveDissipations());
    }
  }

  /**
   * Calculate opacity at a specific distance from dissipation center
   */
  private calculateOpacityAtDistance(distance: number, dissipation: DissipationPoint): number {
    if (distance <= dissipation.radius) {
      // Inside dissipation radius - fully cleared
      return this.config.minOpacity;
    }

    const falloffStart = dissipation.radius;
    const falloffEnd = dissipation.radius + this.config.falloffDistance;

    if (distance >= falloffEnd) {
      // Outside falloff range - no dissipation effect
      return 1.0;
    }

    // Calculate falloff
    const falloffProgress = (distance - falloffStart) / this.config.falloffDistance;
    const easedFalloff = this.config.opacityFalloffCurve(falloffProgress);
    
    // Apply edge softness
    const softness = this.config.edgeSoftness;
    const softFalloff = this.applySoftness(easedFalloff, softness);
    
    return this.config.minOpacity + (1.0 - this.config.minOpacity) * softFalloff;
  }

  /**
   * Calculate dissipation opacity based on animation progress
   */
  private calculateDissipationOpacity(progress: number): number {
    // Opacity decreases as dissipation progresses
    return Math.max(this.config.minOpacity, 1.0 - progress);
  }

  /**
   * Apply softness to falloff calculation
   */
  private applySoftness(value: number, softness: number): number {
    if (softness <= 0) return value;
    if (softness >= 1) return EasingFunctions.sine.inOut(value);
    
    // Blend between linear and smooth curves based on softness
    const smooth = EasingFunctions.sine.inOut(value);
    return value * (1 - softness) + smooth * softness;
  }

  /**
   * Calculate distance between two world positions
   */
  private calculateDistance(pos1: [number, number], pos2: [number, number]): number {
    const dx = pos1[0] - pos2[0];
    const dy = pos1[1] - pos2[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Convert geographic coordinates to world space
   * This is a simplified conversion - in practice, this would use proper map projection
   */
  private geographicToWorld(geographic: [number, number]): [number, number] {
    // Simplified Mercator-like projection
    // In a real implementation, this would use the map's projection system
    const [lng, lat] = geographic;
    const x = lng * 111320; // Approximate meters per degree longitude at equator
    const y = lat * 110540; // Approximate meters per degree latitude
    return [x, y];
  }

  /**
   * Generate a unique dissipation ID
   */
  private generateDissipationId(): string {
    return `dissipation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Utility functions for dissipation calculations
 */
export class DissipationUtils {
  /**
   * Create a standard dissipation animation configuration
   */
  static createStandardDissipation(
    center: [number, number],
    radius: number = 100,
    duration: number = 2500
  ): DissipationAnimation {
    return {
      startTime: performance.now(),
      duration,
      center,
      maxRadius: radius,
      easing: EasingFunctions.cloud.dissipation
    };
  }

  /**
   * Create a fast dissipation for immediate clearing
   */
  static createFastDissipation(
    center: [number, number],
    radius: number = 50
  ): DissipationAnimation {
    return {
      startTime: performance.now(),
      duration: 1000, // 1 second
      center,
      maxRadius: radius,
      easing: EasingFunctions.quad.out
    };
  }

  /**
   * Create a slow, dramatic dissipation
   */
  static createSlowDissipation(
    center: [number, number],
    radius: number = 150
  ): DissipationAnimation {
    return {
      startTime: performance.now(),
      duration: 4000, // 4 seconds
      center,
      maxRadius: radius,
      easing: EasingFunctions.cubic.out
    };
  }

  /**
   * Calculate optimal dissipation radius based on exploration area
   */
  static calculateOptimalRadius(explorationArea: CloudGeographicArea): number {
    // Base radius on the exploration area size with some padding
    const baseRadius = explorationArea.radius;
    const padding = Math.max(20, baseRadius * 0.2); // 20% padding, minimum 20m
    return baseRadius + padding;
  }

  /**
   * Calculate dissipation duration based on radius
   */
  static calculateOptimalDuration(radius: number): number {
    // Larger areas take longer to dissipate for better visual effect
    const baseDuration = 2000; // 2 seconds base
    const radiusFactor = Math.min(radius / 100, 2); // Scale up to 2x for large areas
    return baseDuration * (0.8 + radiusFactor * 0.4); // 1.6s to 3.2s range
  }

  /**
   * Validate dissipation parameters
   */
  static validateDissipationParams(
    center: [number, number],
    radius: number,
    duration: number
  ): boolean {
    return (
      Array.isArray(center) &&
      center.length === 2 &&
      typeof center[0] === 'number' &&
      typeof center[1] === 'number' &&
      !isNaN(center[0]) &&
      !isNaN(center[1]) &&
      typeof radius === 'number' &&
      radius > 0 &&
      radius <= 1000 && // Reasonable maximum
      typeof duration === 'number' &&
      duration > 0 &&
      duration <= 10000 // Maximum 10 seconds
    );
  }
}