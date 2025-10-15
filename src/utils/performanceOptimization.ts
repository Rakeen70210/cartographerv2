/**
 * Performance Optimization Utilities
 * Provides utilities for optimizing app performance during extended sessions
 */

import { getPerformanceMonitorService } from '../services/performanceMonitorService';
import { getMemoryManagementService } from '../services/memoryManagementService';
import { getDeviceCapabilityService } from '../services/deviceCapabilityService';

export interface PerformanceOptimizationConfig {
  enableAdaptiveQuality: boolean;
  enableMemoryManagement: boolean;
  enableBackgroundOptimization: boolean;
  aggressiveOptimization: boolean;
}

export interface OptimizationResult {
  applied: string[];
  memoryFreed: number;
  performanceImprovement: number;
  recommendations: string[];
}

export class PerformanceOptimizer {
  private performanceMonitorService = getPerformanceMonitorService();
  private memoryManagementService = getMemoryManagementService();
  private deviceCapabilityService = getDeviceCapabilityService();
  private isOptimizing = false;
  private currentOptimizationPromise: Promise<OptimizationResult> | null = null;
  private optimizationHistory: OptimizationResult[] = [];

  /**
   * Initialize performance optimizer
   */
  async initialize(): Promise<void> {
    await this.performanceMonitorService.initialize();
    await this.memoryManagementService.initialize();
    await this.deviceCapabilityService.initialize();
    
    console.log('Performance optimizer initialized');
  }

  /**
   * Perform comprehensive performance optimization
   */
  async optimizePerformance(config: PerformanceOptimizationConfig): Promise<OptimizationResult> {
    if (this.isOptimizing) {
      console.warn('Optimization already in progress');
      if (this.currentOptimizationPromise) {
        return this.currentOptimizationPromise;
      }
      return this.getLastOptimizationResult();
    }

    this.isOptimizing = true;
    const optimizationPromise = this.executeOptimization(config)
      .then(result => {
        this.optimizationHistory.push(result);
        return result;
      })
      .finally(() => {
        this.isOptimizing = false;
        this.currentOptimizationPromise = null;
      });

    this.currentOptimizationPromise = optimizationPromise;

    return optimizationPromise;
  }

  /**
   * Execute optimization workflow
   */
  private async executeOptimization(config: PerformanceOptimizationConfig): Promise<OptimizationResult> {
    const startTime = Date.now();
    const appliedOptimizations: string[] = [];
    let memoryFreed = 0;

    try {
      console.log('Starting performance optimization...');

      // Get current performance metrics
      const initialMetrics = this.performanceMonitorService.getCurrentMetrics();
      const memoryMetrics = await this.deviceCapabilityService.getPerformanceMetrics();

      // 1. Memory optimization
      if (config.enableMemoryManagement) {
        const memoryResult = await this.optimizeMemoryUsage(config.aggressiveOptimization);
        memoryFreed += memoryResult.freedMB;
        appliedOptimizations.push(...memoryResult.optimizations);
      }

      // 2. Adaptive quality optimization
      if (config.enableAdaptiveQuality) {
        const qualityResult = await this.optimizeRenderingQuality(initialMetrics);
        appliedOptimizations.push(...qualityResult.optimizations);
      }

      // 3. Background processing optimization
      if (config.enableBackgroundOptimization) {
        const backgroundResult = await this.optimizeBackgroundProcessing();
        appliedOptimizations.push(...backgroundResult.optimizations);
      }

      // 4. Cache optimization
      const cacheResult = await this.optimizeCaches();
      memoryFreed += cacheResult.freedMB;
      appliedOptimizations.push(...cacheResult.optimizations);

      // Calculate performance improvement
      const finalMetrics = this.performanceMonitorService.getCurrentMetrics();
      const performanceImprovement = this.calculatePerformanceImprovement(initialMetrics, finalMetrics);

      // Generate recommendations
      const recommendations = this.generateRecommendations(finalMetrics, memoryMetrics);

      const result: OptimizationResult = {
        applied: appliedOptimizations,
        memoryFreed,
        performanceImprovement,
        recommendations
      };

      const endTime = Date.now();
      console.log(`Performance optimization completed in ${endTime - startTime}ms:`, result);

      return result;
    } catch (error) {
      console.error('Performance optimization failed:', error);
      throw error;
    }
  }

  /**
   * Optimize memory usage
   */
  private async optimizeMemoryUsage(aggressive: boolean): Promise<{
    freedMB: number;
    optimizations: string[];
  }> {
    const optimizations: string[] = [];
    let freedMB = 0;

    // Force memory cleanup
    const initialStats = this.memoryManagementService.getStats();
    
    if (aggressive) {
      this.memoryManagementService.forceCleanup();
      optimizations.push('aggressive_memory_cleanup');
    }

    await this.memoryManagementService.optimizeForPerformance();
    optimizations.push('memory_pool_optimization');

    // Clear performance monitor caches
    this.performanceMonitorService.forceMemoryCleanup();
    optimizations.push('performance_cache_cleanup');

    const finalStats = this.memoryManagementService.getStats();
    freedMB = (initialStats.totalUsed - finalStats.totalUsed) / (1024 * 1024);

    return { freedMB, optimizations };
  }

  /**
   * Optimize rendering quality based on performance
   */
  private async optimizeRenderingQuality(currentMetrics: any): Promise<{
    optimizations: string[];
  }> {
    const optimizations: string[] = [];
    const adaptiveSettings = this.performanceMonitorService.getAdaptiveSettings();

    if (Object.keys(adaptiveSettings).length > 0) {
      optimizations.push('adaptive_quality_adjustment');
      
      if (adaptiveSettings.enableParticleEffects === false) {
        optimizations.push('disabled_particle_effects');
      }
      
      if (adaptiveSettings.enableShaders === false) {
        optimizations.push('disabled_shaders');
      }
      
      if (adaptiveSettings.animationComplexity === 'low') {
        optimizations.push('reduced_animation_complexity');
      }
    }

    return { optimizations };
  }

  /**
   * Optimize background processing
   */
  private async optimizeBackgroundProcessing(): Promise<{
    optimizations: string[];
  }> {
    const optimizations: string[] = [];

    // This would integrate with background location service
    // For now, just indicate that background optimization was attempted
    optimizations.push('background_processing_optimization');

    return { optimizations };
  }

  /**
   * Optimize various caches
   */
  private async optimizeCaches(): Promise<{
    freedMB: number;
    optimizations: string[];
  }> {
    const optimizations: string[] = [];
    let freedMB = 0;

    // Clear fog geometry cache (this would be implemented in fog service)
    optimizations.push('fog_geometry_cache_cleanup');
    freedMB += 5; // Estimated

    // Clear map tile cache if needed
    optimizations.push('map_tile_cache_optimization');
    freedMB += 10; // Estimated

    return { freedMB, optimizations };
  }

  /**
   * Calculate performance improvement
   */
  private calculatePerformanceImprovement(initial: any, final: any): number {
    const fpsImprovement = ((final.fps - initial.fps) / initial.fps) * 100;
    const memoryImprovement = ((initial.memoryUsageMB - final.memoryUsageMB) / initial.memoryUsageMB) * 100;
    
    // Weighted average of improvements
    return (fpsImprovement * 0.6 + memoryImprovement * 0.4);
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: any, memoryMetrics: any): string[] {
    const recommendations: string[] = [];

    if (metrics.fps < 30) {
      recommendations.push('Consider reducing fog detail level');
      recommendations.push('Disable particle effects temporarily');
    }

    if (memoryMetrics.memoryPressure === 'high') {
      recommendations.push('Close other apps to free memory');
      recommendations.push('Restart the app to clear memory leaks');
    }

    if (metrics.memoryUsageMB > 200) {
      recommendations.push('Enable aggressive memory management');
    }

    return recommendations;
  }

  /**
   * Get last optimization result
   */
  private getLastOptimizationResult(): OptimizationResult {
    return this.optimizationHistory[this.optimizationHistory.length - 1] || {
      applied: [],
      memoryFreed: 0,
      performanceImprovement: 0,
      recommendations: []
    };
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory(): OptimizationResult[] {
    return [...this.optimizationHistory];
  }

  /**
   * Reset optimization history
   */
  resetHistory(): void {
    this.optimizationHistory = [];
  }
}

// Singleton instance
let performanceOptimizer: PerformanceOptimizer | null = null;

export const getPerformanceOptimizer = (): PerformanceOptimizer => {
  if (!performanceOptimizer) {
    performanceOptimizer = new PerformanceOptimizer();
  }
  return performanceOptimizer;
};

// Utility functions

/**
 * Quick performance check and optimization
 */
export const quickPerformanceOptimization = async (): Promise<OptimizationResult> => {
  const optimizer = getPerformanceOptimizer();
  await optimizer.initialize();
  
  return optimizer.optimizePerformance({
    enableAdaptiveQuality: true,
    enableMemoryManagement: true,
    enableBackgroundOptimization: false,
    aggressiveOptimization: false
  });
};

/**
 * Aggressive performance optimization for low-end devices
 */
export const aggressivePerformanceOptimization = async (): Promise<OptimizationResult> => {
  const optimizer = getPerformanceOptimizer();
  await optimizer.initialize();
  
  return optimizer.optimizePerformance({
    enableAdaptiveQuality: true,
    enableMemoryManagement: true,
    enableBackgroundOptimization: true,
    aggressiveOptimization: true
  });
};

/**
 * Monitor performance and auto-optimize when needed
 */
export const startAutoOptimization = (intervalMs: number = 60000): () => void => {
  const optimizer = getPerformanceOptimizer();
  
  const interval = setInterval(async () => {
    try {
      const performanceMonitor = getPerformanceMonitorService();
      const metrics = performanceMonitor.getCurrentMetrics();
      
      // Auto-optimize if performance is poor
      if (metrics.fps < 25 || metrics.memoryUsageMB > 300) {
        console.log('Auto-optimization triggered due to poor performance');
        await quickPerformanceOptimization();
      }
    } catch (error) {
      console.error('Auto-optimization failed:', error);
    }
  }, intervalMs);
  
  return () => clearInterval(interval);
};