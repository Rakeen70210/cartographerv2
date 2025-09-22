/**
 * CloudDissipationIntegration - Bridge between cloud dissipation and exploration systems
 * Connects cloud dissipation animations to GPS location updates and exploration detection
 */

import { 
  CloudGeographicArea, 
  DissipationAnimation,
  PerformanceMode 
} from '../../../types/cloud';
import { LocationUpdate } from '../../../types/location';
import { ExplorationResult, explorationService } from '../../explorationService';
import { ExploredArea } from '../../../database/services';
import { DissipationAnimator, DissipationUtils } from '../animation/DissipationAnimator';
import { ProgressiveRevelationAnimator, ProgressiveRevelationUtils } from '../animation/ProgressiveRevelationAnimator';

export interface CloudDissipationConfig {
  enableDissipation: boolean;
  dissipationMode: 'instant' | 'progressive' | 'adaptive';
  defaultRadius: number; // meters
  defaultDuration: number; // milliseconds
  performanceMode: PerformanceMode;
  adaptiveRadiusMultiplier: number; // Multiplier for exploration radius
  minDissipationRadius: number; // Minimum dissipation radius
  maxDissipationRadius: number; // Maximum dissipation radius
}

export interface DissipationEvent {
  type: 'dissipation_started' | 'dissipation_completed' | 'dissipation_failed';
  explorationId: number;
  center: [number, number];
  radius: number;
  duration: number;
  timestamp: number;
}

export interface CloudExplorationState {
  exploredAreas: ExploredArea[];
  activeDissipations: Map<string, DissipationAnimation>;
  pendingDissipations: ExplorationResult[];
  lastLocationUpdate: LocationUpdate | null;
  isProcessing: boolean;
}

/**
 * CloudDissipationIntegration manages the connection between exploration and cloud dissipation
 */
export class CloudDissipationIntegration {
  private config: CloudDissipationConfig;
  private dissipationAnimator: DissipationAnimator;
  private progressiveAnimator: ProgressiveRevelationAnimator;
  private state: CloudExplorationState;
  private isDisposed: boolean = false;

  // Event callbacks
  private onDissipationEvent?: (event: DissipationEvent) => void;
  private onStateChange?: (state: CloudExplorationState) => void;
  private onUniformUpdate?: (uniforms: Record<string, any>) => void;

  constructor(config: Partial<CloudDissipationConfig> = {}) {
    this.config = {
      enableDissipation: true,
      dissipationMode: 'progressive',
      defaultRadius: 100,
      defaultDuration: 2500,
      performanceMode: 'high',
      adaptiveRadiusMultiplier: 1.2,
      minDissipationRadius: 50,
      maxDissipationRadius: 200,
      ...config
    };

    // Initialize animators
    this.dissipationAnimator = new DissipationAnimator({
      defaultDuration: this.config.defaultDuration,
      maxRadius: this.config.defaultRadius
    });

    this.progressiveAnimator = new ProgressiveRevelationAnimator();

    // Initialize state
    this.state = {
      exploredAreas: [],
      activeDissipations: new Map(),
      pendingDissipations: [],
      lastLocationUpdate: null,
      isProcessing: false
    };

    this.setupAnimatorCallbacks();
    this.setupExplorationListener();
  }

  /**
   * Initialize the integration system
   */
  async initialize(): Promise<void> {
    if (this.isDisposed) {
      throw new Error('CloudDissipationIntegration has been disposed');
    }

    try {
      // Load existing explored areas
      this.state.exploredAreas = await explorationService.getAllExploredAreas();
      
      // Start exploration detection if not already active
      const status = await explorationService.getExplorationStatus();
      if (!status.isActive) {
        await explorationService.startExploration();
      }

      console.log('CloudDissipationIntegration initialized');
    } catch (error) {
      console.error('Failed to initialize CloudDissipationIntegration:', error);
      throw error;
    }
  }

  /**
   * Handle new exploration detection
   */
  private async handleExplorationResult(result: ExplorationResult): Promise<void> {
    if (!this.config.enableDissipation || this.isDisposed) {
      return;
    }

    if (result.isNewArea && result.exploredArea) {
      try {
        this.state.isProcessing = true;
        
        // Add to explored areas
        this.state.exploredAreas.push(result.exploredArea);
        
        // Calculate dissipation parameters
        const dissipationCenter: [number, number] = [
          result.exploredArea.longitude,
          result.exploredArea.latitude
        ];
        
        const dissipationRadius = this.calculateDissipationRadius(
          result.exploredArea.radius,
          result.explorationRadius
        );
        
        const dissipationDuration = this.calculateDissipationDuration(dissipationRadius);

        // Start appropriate dissipation animation
        await this.startDissipationAnimation(
          dissipationCenter,
          dissipationRadius,
          dissipationDuration,
          result.exploredArea.id
        );

        // Emit dissipation event
        this.emitDissipationEvent({
          type: 'dissipation_started',
          explorationId: result.exploredArea.id,
          center: dissipationCenter,
          radius: dissipationRadius,
          duration: dissipationDuration,
          timestamp: Date.now()
        });

        // Update state
        this.notifyStateChange();

      } catch (error) {
        console.error('Error handling exploration result:', error);
        
        this.emitDissipationEvent({
          type: 'dissipation_failed',
          explorationId: result.exploredArea?.id || 0,
          center: [0, 0],
          radius: 0,
          duration: 0,
          timestamp: Date.now()
        });
      } finally {
        this.state.isProcessing = false;
      }
    }
  }

  /**
   * Start dissipation animation based on configuration
   */
  private async startDissipationAnimation(
    center: [number, number],
    radius: number,
    duration: number,
    explorationId: number
  ): Promise<void> {
    const animationId = `exploration_${explorationId}`;

    switch (this.config.dissipationMode) {
      case 'instant':
        // Use fast dissipation
        this.dissipationAnimator.startDissipation(center, {
          maxRadius: radius,
          duration: Math.min(duration, 1000), // Max 1 second for instant
          id: animationId
        });
        break;

      case 'progressive':
        // Use progressive revelation
        const revelationConfig = this.createProgressiveConfig(duration, radius);
        this.progressiveAnimator.startRevelation(center, {
          config: revelationConfig,
          id: animationId,
          onComplete: () => {
            this.handleDissipationComplete(animationId, explorationId);
          }
        });
        break;

      case 'adaptive':
        // Choose based on performance and area size
        if (this.config.performanceMode === 'low' || radius < 75) {
          // Use simple dissipation for low performance or small areas
          this.dissipationAnimator.startDissipation(center, {
            maxRadius: radius,
            duration: duration,
            id: animationId
          });
        } else {
          // Use progressive revelation for better performance and larger areas
          const adaptiveConfig = this.createAdaptiveConfig(duration, radius);
          this.progressiveAnimator.startRevelation(center, {
            config: adaptiveConfig,
            id: animationId,
            onComplete: () => {
              this.handleDissipationComplete(animationId, explorationId);
            }
          });
        }
        break;
    }
  }

  /**
   * Handle dissipation animation completion
   */
  private handleDissipationComplete(animationId: string, explorationId: number): void {
    // Remove from active dissipations
    this.state.activeDissipations.delete(animationId);

    // Find the exploration area
    const exploredArea = this.state.exploredAreas.find(area => area.id === explorationId);
    
    if (exploredArea) {
      this.emitDissipationEvent({
        type: 'dissipation_completed',
        explorationId,
        center: [exploredArea.longitude, exploredArea.latitude],
        radius: exploredArea.radius,
        duration: 0,
        timestamp: Date.now()
      });
    }

    this.notifyStateChange();
  }

  /**
   * Calculate optimal dissipation radius
   */
  private calculateDissipationRadius(
    exploredRadius: number,
    explorationRadius: number
  ): number {
    // Use the larger of the two radii with adaptive multiplier
    const baseRadius = Math.max(exploredRadius, explorationRadius);
    const adaptiveRadius = baseRadius * this.config.adaptiveRadiusMultiplier;
    
    // Clamp to configured bounds
    return Math.max(
      this.config.minDissipationRadius,
      Math.min(adaptiveRadius, this.config.maxDissipationRadius)
    );
  }

  /**
   * Calculate optimal dissipation duration
   */
  private calculateDissipationDuration(radius: number): number {
    // Base duration on radius and performance mode
    let baseDuration = this.config.defaultDuration;
    
    // Adjust for performance mode
    switch (this.config.performanceMode) {
      case 'low':
        baseDuration *= 0.7; // Faster animations for low performance
        break;
      case 'medium':
        baseDuration *= 0.85;
        break;
      case 'high':
        // Use full duration
        break;
    }

    // Adjust for radius (larger areas take slightly longer)
    const radiusFactor = Math.min(radius / 100, 1.5); // Max 1.5x for large areas
    return Math.round(baseDuration * (0.8 + radiusFactor * 0.4));
  }

  /**
   * Create progressive revelation configuration
   */
  private createProgressiveConfig(duration: number, radius: number): any {
    if (duration <= 1500) {
      return ProgressiveRevelationAnimator.createFastRevelation();
    } else if (duration >= 3500) {
      return ProgressiveRevelationAnimator.createDramaticRevelation();
    } else {
      return ProgressiveRevelationUtils.createCustomRevelation(duration, 3);
    }
  }

  /**
   * Create adaptive revelation configuration
   */
  private createAdaptiveConfig(duration: number, radius: number): any {
    const stageCount = radius > 150 ? 4 : 3; // More stages for larger areas
    return ProgressiveRevelationUtils.createCustomRevelation(duration, stageCount);
  }

  /**
   * Get current cloud exploration state
   */
  getState(): CloudExplorationState {
    return { ...this.state };
  }

  /**
   * Get all explored areas
   */
  getExploredAreas(): ExploredArea[] {
    return [...this.state.exploredAreas];
  }

  /**
   * Check if a location is within any explored area
   */
  isLocationExplored(longitude: number, latitude: number): boolean {
    return this.state.exploredAreas.some(area => {
      const distance = this.calculateDistance(
        latitude, longitude,
        area.latitude, area.longitude
      );
      return distance <= area.radius;
    });
  }

  /**
   * Get active dissipation animations
   */
  getActiveDissipations(): DissipationAnimation[] {
    return Array.from(this.state.activeDissipations.values());
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CloudDissipationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update animator configurations
    this.dissipationAnimator.updateConfig({
      defaultDuration: this.config.defaultDuration,
      maxRadius: this.config.defaultRadius
    });
  }

  /**
   * Set event callback
   */
  setDissipationEventCallback(callback: (event: DissipationEvent) => void): void {
    this.onDissipationEvent = callback;
  }

  /**
   * Set state change callback
   */
  setStateChangeCallback(callback: (state: CloudExplorationState) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Set uniform update callback
   */
  setUniformUpdateCallback(callback: (uniforms: Record<string, any>) => void): void {
    this.onUniformUpdate = callback;
  }

  /**
   * Force trigger dissipation at a location (for testing)
   */
  async triggerManualDissipation(
    longitude: number,
    latitude: number,
    radius: number = this.config.defaultRadius
  ): Promise<void> {
    const result = await explorationService.processManualLocation(latitude, longitude);
    if (result.isNewArea) {
      await this.handleExplorationResult(result);
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.isDisposed = true;
    
    // Remove exploration listener
    explorationService.removeExplorationListener(this.handleExplorationResult.bind(this));
    
    // Dispose animators
    this.dissipationAnimator.dispose();
    this.progressiveAnimator.dispose();
    
    // Clear state
    this.state.activeDissipations.clear();
    this.state.exploredAreas = [];
    this.state.pendingDissipations = [];
    
    // Clear callbacks
    this.onDissipationEvent = undefined;
    this.onStateChange = undefined;
    this.onUniformUpdate = undefined;
  }

  /**
   * Setup animator callbacks
   */
  private setupAnimatorCallbacks(): void {
    // Dissipation animator callbacks
    this.dissipationAnimator.setDissipationCompleteCallback((dissipationId: string) => {
      const explorationId = this.extractExplorationId(dissipationId);
      if (explorationId) {
        this.handleDissipationComplete(dissipationId, explorationId);
      }
    });

    this.dissipationAnimator.setUniformUpdateCallback((uniforms: Record<string, any>) => {
      if (this.onUniformUpdate) {
        this.onUniformUpdate(uniforms);
      }
    });

    // Progressive animator callbacks
    this.progressiveAnimator.setUniformUpdateCallback((uniforms: Record<string, any>) => {
      if (this.onUniformUpdate) {
        this.onUniformUpdate(uniforms);
      }
    });
  }

  /**
   * Setup exploration service listener
   */
  private setupExplorationListener(): void {
    explorationService.addExplorationListener(this.handleExplorationResult.bind(this));
  }

  /**
   * Extract exploration ID from animation ID
   */
  private extractExplorationId(animationId: string): number | null {
    const match = animationId.match(/exploration_(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Calculate distance between two geographic points
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Emit dissipation event
   */
  private emitDissipationEvent(event: DissipationEvent): void {
    if (this.onDissipationEvent) {
      this.onDissipationEvent(event);
    }
  }

  /**
   * Notify state change
   */
  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }
}

/**
 * Utility functions for cloud dissipation integration
 */
export class CloudDissipationIntegrationUtils {
  /**
   * Create integration configuration for different performance modes
   */
  static createPerformanceConfig(mode: PerformanceMode): Partial<CloudDissipationConfig> {
    switch (mode) {
      case 'low':
        return {
          dissipationMode: 'instant',
          defaultDuration: 1500,
          defaultRadius: 75,
          adaptiveRadiusMultiplier: 1.0
        };
      
      case 'medium':
        return {
          dissipationMode: 'adaptive',
          defaultDuration: 2000,
          defaultRadius: 100,
          adaptiveRadiusMultiplier: 1.1
        };
      
      case 'high':
        return {
          dissipationMode: 'progressive',
          defaultDuration: 2500,
          defaultRadius: 125,
          adaptiveRadiusMultiplier: 1.2
        };
    }
  }

  /**
   * Validate integration configuration
   */
  static validateConfig(config: CloudDissipationConfig): boolean {
    return (
      typeof config.enableDissipation === 'boolean' &&
      ['instant', 'progressive', 'adaptive'].includes(config.dissipationMode) &&
      config.defaultRadius > 0 &&
      config.defaultDuration > 0 &&
      config.adaptiveRadiusMultiplier > 0 &&
      config.minDissipationRadius > 0 &&
      config.maxDissipationRadius > config.minDissipationRadius
    );
  }
}