/**
 * FogSystemCompatibility - Provides backward compatibility with existing fog overlay system
 * Ensures smooth transition between traditional fog and cloud-based fog systems
 */

import { getFogService } from '../../fogService';
import { fogLocationIntegrationService } from '../../fogLocationIntegrationService';
import { ICloudRenderingEngine } from '../interfaces';
import { FogGeometry } from '../../../types/fog';
import { ExploredArea } from '../../../database/services';
import { store } from '../../../store';
import { setFogGeometry, setFogVisible } from '../../../store/slices/fogSlice';

export interface CompatibilityConfig {
  enableFallback: boolean;
  preferCloudSystem: boolean;
  syncBothSystems: boolean;
  fallbackThreshold: number; // Performance threshold for fallback
  debugMode: boolean;
}

export interface SystemStatus {
  cloudSystemActive: boolean;
  traditionalFogActive: boolean;
  currentSystem: 'cloud' | 'traditional' | 'both';
  performanceScore: number;
  lastFallbackTime: number;
}

/**
 * Manages compatibility between cloud system and traditional fog overlay
 */
export class FogSystemCompatibility {
  private static instance: FogSystemCompatibility;
  private fogService: ReturnType<typeof getFogService>;
  private cloudRenderingEngine: ICloudRenderingEngine | null = null;
  private config: CompatibilityConfig;
  private status: SystemStatus;
  private performanceMonitor: NodeJS.Timeout | null = null;

  private constructor() {
    this.fogService = getFogService();
    
    this.config = {
      enableFallback: true,
      preferCloudSystem: true,
      syncBothSystems: false,
      fallbackThreshold: 30, // 30 FPS threshold
      debugMode: false
    };

    this.status = {
      cloudSystemActive: false,
      traditionalFogActive: true, // Start with traditional fog
      currentSystem: 'traditional',
      performanceScore: 60, // Assume good performance initially
      lastFallbackTime: 0
    };

    this.initializeCompatibility();
  }

  public static getInstance(): FogSystemCompatibility {
    if (!FogSystemCompatibility.instance) {
      FogSystemCompatibility.instance = new FogSystemCompatibility();
    }
    return FogSystemCompatibility.instance;
  }

  /**
   * Initialize compatibility layer
   */
  private async initializeCompatibility(): Promise<void> {
    try {
      this.log('Initializing fog system compatibility...');

      // Ensure traditional fog system is running
      await this.ensureTraditionalFogActive();

      // Start performance monitoring
      this.startPerformanceMonitoring();

      this.log('Fog system compatibility initialized');

    } catch (error) {
      console.error('Failed to initialize fog system compatibility:', error);
    }
  }

  /**
   * Set cloud rendering engine
   */
  public setCloudRenderingEngine(engine: ICloudRenderingEngine): void {
    this.cloudRenderingEngine = engine;
    this.log('Cloud rendering engine set for compatibility');

    // Try to activate cloud system if preferred
    if (this.config.preferCloudSystem) {
      this.activateCloudSystem();
    }
  }

  /**
   * Activate cloud system
   */
  public async activateCloudSystem(): Promise<boolean> {
    try {
      if (!this.cloudRenderingEngine) {
        this.log('Cannot activate cloud system: engine not set');
        return false;
      }

      this.log('Activating cloud system...');

      // Initialize cloud system
      await this.cloudRenderingEngine.initialize();

      // Update status
      this.status.cloudSystemActive = true;
      this.status.currentSystem = this.config.syncBothSystems ? 'both' : 'cloud';

      // Deactivate traditional fog if not syncing both
      if (!this.config.syncBothSystems) {
        await this.deactivateTraditionalFog();
      }

      this.log(`Cloud system activated. Current system: ${this.status.currentSystem}`);
      return true;

    } catch (error) {
      console.error('Failed to activate cloud system:', error);
      
      // Fallback to traditional fog
      await this.fallbackToTraditionalFog();
      return false;
    }
  }

  /**
   * Deactivate cloud system
   */
  public async deactivateCloudSystem(): Promise<void> {
    try {
      this.log('Deactivating cloud system...');

      if (this.cloudRenderingEngine) {
        this.cloudRenderingEngine.dispose();
      }

      this.status.cloudSystemActive = false;

      // Ensure traditional fog is active
      await this.ensureTraditionalFogActive();
      this.status.currentSystem = 'traditional';

      this.log('Cloud system deactivated, traditional fog active');

    } catch (error) {
      console.error('Error deactivating cloud system:', error);
    }
  }

  /**
   * Ensure traditional fog system is active
   */
  private async ensureTraditionalFogActive(): Promise<void> {
    try {
      // Check if fog location integration is running
      const integrationStatus = await fogLocationIntegrationService.getStatus();
      
      if (!integrationStatus.isActive) {
        this.log('Starting traditional fog system...');
        await fogLocationIntegrationService.start();
      }

      // Update fog geometry
      await fogLocationIntegrationService.refreshFogGeometry();

      this.status.traditionalFogActive = true;
      this.log('Traditional fog system is active');

    } catch (error) {
      console.error('Failed to ensure traditional fog active:', error);
      this.status.traditionalFogActive = false;
    }
  }

  /**
   * Deactivate traditional fog system
   */
  private async deactivateTraditionalFog(): Promise<void> {
    try {
      this.log('Deactivating traditional fog system...');

      // Hide traditional fog overlay
      store.dispatch(setFogVisible(false));

      this.status.traditionalFogActive = false;
      this.log('Traditional fog system deactivated');

    } catch (error) {
      console.error('Error deactivating traditional fog:', error);
    }
  }

  /**
   * Fallback to traditional fog system
   */
  public async fallbackToTraditionalFog(): Promise<void> {
    try {
      this.log('Falling back to traditional fog system...');

      // Deactivate cloud system
      if (this.status.cloudSystemActive) {
        await this.deactivateCloudSystem();
      }

      // Ensure traditional fog is active
      await this.ensureTraditionalFogActive();

      // Show traditional fog overlay
      store.dispatch(setFogVisible(true));

      // Update status
      this.status.currentSystem = 'traditional';
      this.status.lastFallbackTime = Date.now();

      this.log('Fallback to traditional fog completed');

    } catch (error) {
      console.error('Error during fallback to traditional fog:', error);
    }
  }

  /**
   * Update fog geometry for both systems
   */
  public async updateFogGeometry(exploredAreas: ExploredArea[]): Promise<void> {
    try {
      // Update traditional fog system
      if (this.status.traditionalFogActive) {
        const fogGeometry = this.fogService.generateFogGeometry(exploredAreas);
        store.dispatch(setFogGeometry(fogGeometry));
      }

      // Update cloud system
      if (this.status.cloudSystemActive && this.cloudRenderingEngine) {
        const explorationAreas = exploredAreas.map(area => ({
          id: area.id?.toString() || `area_${Date.now()}`,
          center: [area.longitude, area.latitude] as [number, number],
          radius: area.radius,
          exploredAt: new Date(area.explored_at).getTime(),
          accuracy: area.accuracy
        }));

        this.cloudRenderingEngine.updateClouds(explorationAreas);
      }

      this.log(`Fog geometry updated for ${this.status.currentSystem} system(s)`);

    } catch (error) {
      console.error('Error updating fog geometry:', error);
    }
  }

  /**
   * Handle performance-based system switching
   */
  private async handlePerformanceSwitch(performanceScore: number): Promise<void> {
    // If performance drops below threshold and cloud system is active
    if (performanceScore < this.config.fallbackThreshold && 
        this.status.cloudSystemActive && 
        this.config.enableFallback) {
      
      this.log(`Performance below threshold (${performanceScore}), falling back to traditional fog`);
      await this.fallbackToTraditionalFog();
    }
    
    // If performance improves and we're using traditional fog, try cloud system again
    else if (performanceScore > this.config.fallbackThreshold + 10 && 
             !this.status.cloudSystemActive && 
             this.config.preferCloudSystem &&
             this.cloudRenderingEngine) {
      
      // Don't switch back too quickly
      const timeSinceLastFallback = Date.now() - this.status.lastFallbackTime;
      if (timeSinceLastFallback > 30000) { // 30 seconds
        this.log(`Performance improved (${performanceScore}), trying cloud system again`);
        await this.activateCloudSystem();
      }
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    if (this.performanceMonitor) {
      clearInterval(this.performanceMonitor);
    }

    this.performanceMonitor = setInterval(() => {
      // Simple performance monitoring - in real implementation, 
      // this would use actual frame rate monitoring
      const performanceScore = this.estimatePerformance();
      this.status.performanceScore = performanceScore;

      this.handlePerformanceSwitch(performanceScore).catch(error => {
        console.error('Error handling performance switch:', error);
      });

    }, 5000); // Check every 5 seconds

    this.log('Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  private stopPerformanceMonitoring(): void {
    if (this.performanceMonitor) {
      clearInterval(this.performanceMonitor);
      this.performanceMonitor = null;
      this.log('Performance monitoring stopped');
    }
  }

  /**
   * Estimate current performance (simplified)
   */
  private estimatePerformance(): number {
    // This is a simplified performance estimation
    // In a real implementation, this would measure actual frame rates,
    // memory usage, and other performance metrics
    
    // For now, return a random value that simulates performance fluctuation
    const basePerformance = 60;
    const variation = (Math.random() - 0.5) * 20; // ±10 FPS variation
    return Math.max(10, Math.min(60, basePerformance + variation));
  }

  /**
   * Get current system status
   */
  public getStatus(): SystemStatus {
    return { ...this.status };
  }

  /**
   * Configure compatibility layer
   */
  public configure(config: Partial<CompatibilityConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };

    // Handle configuration changes
    if (oldConfig.preferCloudSystem !== this.config.preferCloudSystem) {
      if (this.config.preferCloudSystem && this.cloudRenderingEngine) {
        this.activateCloudSystem();
      } else if (!this.config.preferCloudSystem && this.status.cloudSystemActive) {
        this.deactivateCloudSystem();
      }
    }

    this.log('Configuration updated:', this.config);
  }

  /**
   * Force switch to specific system
   */
  public async switchToSystem(system: 'cloud' | 'traditional'): Promise<boolean> {
    try {
      this.log(`Switching to ${system} system...`);

      if (system === 'cloud') {
        return await this.activateCloudSystem();
      } else {
        await this.fallbackToTraditionalFog();
        return true;
      }

    } catch (error) {
      console.error(`Error switching to ${system} system:`, error);
      return false;
    }
  }

  /**
   * Check if cloud system is available
   */
  public isCloudSystemAvailable(): boolean {
    return !!this.cloudRenderingEngine;
  }

  /**
   * Check if traditional fog system is available
   */
  public isTraditionalFogAvailable(): boolean {
    return true; // Traditional fog is always available
  }

  /**
   * Get recommended system based on current conditions
   */
  public getRecommendedSystem(): 'cloud' | 'traditional' {
    if (!this.isCloudSystemAvailable()) {
      return 'traditional';
    }

    if (this.status.performanceScore < this.config.fallbackThreshold) {
      return 'traditional';
    }

    return this.config.preferCloudSystem ? 'cloud' : 'traditional';
  }

  /**
   * Debug logging
   */
  private log(message: string, data?: any): void {
    if (this.config.debugMode) {
      console.log(`[FogSystemCompatibility] ${message}`, data || '');
    }
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.stopPerformanceMonitoring();
    
    if (this.cloudRenderingEngine) {
      this.cloudRenderingEngine.dispose();
    }

    this.log('FogSystemCompatibility disposed');
  }
}

// Export singleton instance
export const fogSystemCompatibility = FogSystemCompatibility.getInstance();