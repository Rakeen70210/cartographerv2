/**
 * Skia Shader System
 * Comprehensive shader management system that integrates compilation, error handling, and uniform management
 */

import { SkRuntimeEffect } from '@shopify/react-native-skia';
import { SkiaShaderManager, ShaderCompilationResult, UniformUpdateResult } from './SkiaShaderManager';
import { SkiaShaderErrorHandler, ShaderError, ShaderErrorHandlerConfig } from './SkiaShaderErrorHandler';
import { SkiaCloudUniforms, validateSkiaCloudUniforms, getLODSettings, LODSettings } from './SkiaCloudShader';
import { SkiaUniformBatcher, UniformBatchConfig, UniformBatchStats } from './SkiaUniformBatcher';
import { PerformanceNotificationService, PerformanceIssue, NotificationConfig } from '../performance/PerformanceNotificationService';

export interface SkiaShaderSystemConfig {
  errorHandler?: Partial<ShaderErrorHandlerConfig>;
  enablePerformanceMonitoring?: boolean;
  autoRecovery?: boolean;
  maxInitializationAttempts?: number;
  uniformBatcher?: Partial<UniformBatchConfig>;
  shaderComplexity?: 'simple' | 'standard' | 'advanced' | 'adaptive';
  notifications?: Partial<NotificationConfig>;
}

export interface ShaderSystemState {
  initialized: boolean;
  hasActiveShader: boolean;
  isUsingFallback: boolean;
  errorCount: number;
  performanceMode: 'low' | 'medium' | 'high';
  lastUpdateTime: number;
}

export interface PerformanceMetrics {
  averageFrameTime: number;
  uniformUpdateCount: number;
  shaderSwitchCount: number;
  errorRecoveryCount: number;
  batchStats: UniformBatchStats;
}

export class SkiaShaderSystem {
  private shaderManager: SkiaShaderManager;
  private errorHandler: SkiaShaderErrorHandler;
  private uniformBatcher: SkiaUniformBatcher;
  private notificationService: PerformanceNotificationService;
  private config: SkiaShaderSystemConfig;
  private state: ShaderSystemState;
  private performanceMetrics: PerformanceMetrics;
  private initializationAttempts: number = 0;
  private currentShaderComplexity: 'simple' | 'standard' | 'advanced' = 'standard';
  private performanceDegradationCount: number = 0;
  private lastPerformanceCheck: number = 0;

  constructor(config: SkiaShaderSystemConfig = {}) {
    this.config = {
      enablePerformanceMonitoring: true,
      autoRecovery: true,
      maxInitializationAttempts: 3,
      shaderComplexity: 'standard',
      ...config,
    };

    this.shaderManager = new SkiaShaderManager();
    this.errorHandler = new SkiaShaderErrorHandler(config.errorHandler);
    this.uniformBatcher = new SkiaUniformBatcher({
      enableSmartUpdates: true,
      enableAnimationPause: true,
      debugLogging: config.enablePerformanceMonitoring,
      ...config.uniformBatcher
    });
    this.notificationService = new PerformanceNotificationService({
      enableUserNotifications: config.enablePerformanceMonitoring,
      enableDiagnosticLogging: config.enablePerformanceMonitoring,
      ...config.notifications
    });

    // Set initial shader complexity
    if (config.shaderComplexity && config.shaderComplexity !== 'adaptive') {
      this.currentShaderComplexity = config.shaderComplexity;
    }
    
    this.state = {
      initialized: false,
      hasActiveShader: false,
      isUsingFallback: false,
      errorCount: 0,
      performanceMode: 'medium',
      lastUpdateTime: 0,
    };

    this.performanceMetrics = {
      averageFrameTime: 16.67, // 60fps baseline
      uniformUpdateCount: 0,
      shaderSwitchCount: 0,
      errorRecoveryCount: 0,
      batchStats: {
        totalBatches: 0,
        totalUpdates: 0,
        totalSkipped: 0,
        averageBatchTime: 0,
        lastBatchTime: 0,
        cacheHitRate: 0
      }
    };

    // Setup uniform batcher callbacks
    this.setupUniformBatcherCallbacks();

    this.setupErrorRecoveryStrategies();
  }

  /**
   * Initialize the shader system
   */
  async initialize(): Promise<boolean> {
    if (this.state.initialized) {
      return true;
    }

    this.initializationAttempts++;

    try {
      console.log(`Initializing Skia shader system (attempt ${this.initializationAttempts})`);
      
      const result = await this.shaderManager.initialize();
      
      if (result.success) {
        this.state.initialized = true;
        this.state.hasActiveShader = true;
        this.state.isUsingFallback = result.fallbackMode;
        this.state.lastUpdateTime = Date.now();
        
        console.log('Skia shader system initialized successfully', {
          fallbackMode: result.fallbackMode,
          attempt: this.initializationAttempts,
        });
        
        return true;
      } else {
        // Handle initialization failure
        this.errorHandler.handleCompilationError(
          result.error || 'Unknown initialization error',
          { attempt: this.initializationAttempts }
        );

        // Attempt recovery if enabled and we haven't exceeded max attempts
        if (this.config.autoRecovery && this.initializationAttempts < this.config.maxInitializationAttempts!) {
          console.log('Attempting automatic recovery...');
          const recoverySuccess = await this.errorHandler.attemptRecovery();
          
          if (recoverySuccess) {
            this.performanceMetrics.errorRecoveryCount++;
            return await this.initialize(); // Retry initialization
          }
        }

        console.error('Shader system initialization failed after all attempts');
        return false;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      this.errorHandler.handleCompilationError(errorMessage, { 
        attempt: this.initializationAttempts,
        critical: true 
      });
      
      console.error('Critical error during shader system initialization:', errorMessage);
      return false;
    }
  }

  /**
   * Update shader uniforms with batching and performance monitoring
   */
  updateUniforms(uniforms: Partial<SkiaCloudUniforms>, priority: 'low' | 'medium' | 'high' = 'medium'): UniformUpdateResult {
    if (!this.state.initialized) {
      return {
        success: false,
        updatedUniforms: this.shaderManager.getCurrentUniforms(),
        error: 'Shader system not initialized',
      };
    }

    try {
      // Apply performance-based optimizations
      const optimizedUniforms = this.applyPerformanceOptimizations(uniforms);
      
      // Queue update through batcher for efficient processing
      this.uniformBatcher.queueUpdate(
        `update_${Date.now()}`,
        optimizedUniforms,
        priority
      );

      this.performanceMetrics.uniformUpdateCount++;
      this.state.lastUpdateTime = Date.now();

      return {
        success: true,
        updatedUniforms: this.shaderManager.getCurrentUniforms(),
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown uniform update error';
      this.errorHandler.handleRuntimeError(errorMessage, { uniforms });
      this.state.errorCount++;
      
      return {
        success: false,
        updatedUniforms: this.shaderManager.getCurrentUniforms(),
        error: errorMessage,
      };
    }
  }

  /**
   * Force immediate processing of all pending uniform updates
   */
  flushUniforms(): UniformUpdateResult {
    if (!this.state.initialized) {
      return {
        success: false,
        updatedUniforms: this.shaderManager.getCurrentUniforms(),
        error: 'Shader system not initialized',
      };
    }

    try {
      const batchResult = this.uniformBatcher.flush();
      
      return {
        success: batchResult.success,
        updatedUniforms: this.shaderManager.getCurrentUniforms(),
        error: batchResult.error
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown flush error';
      return {
        success: false,
        updatedUniforms: this.shaderManager.getCurrentUniforms(),
        error: errorMessage,
      };
    }
  }

  /**
   * Get the active shader for rendering
   */
  getActiveShader(): SkRuntimeEffect | null {
    if (!this.state.initialized) {
      return null;
    }

    return this.shaderManager.getActiveShader();
  }

  /**
   * Get current uniforms formatted for Skia
   */
  getUniformsForSkia(): Record<string, number | number[]> {
    return this.shaderManager.createUniformsForSkia();
  }

  /**
   * Check system health and attempt recovery if needed
   */
  async performHealthCheck(): Promise<boolean> {
    const errorStats = this.errorHandler.getErrorStats();
    const now = Date.now();
    
    // Perform performance degradation check
    if (now - this.lastPerformanceCheck > 5000) { // Check every 5 seconds
      this.checkPerformanceDegradation();
      this.lastPerformanceCheck = now;
    }
    
    // Check if we need to switch to fallback mode
    if (this.errorHandler.shouldUseFallback() && !this.state.isUsingFallback) {
      console.log('🔄 Switching to fallback mode due to errors');
      
      // Report shader error to notification service
      this.notificationService.reportPerformanceIssue(
        'shader_error',
        'high',
        'Shader compilation errors detected, switching to fallback mode',
        {
          errorRecoveryCount: this.performanceMetrics.errorRecoveryCount,
          adaptationCount: 0,
          qualityLevel: 50
        }
      );
      
      const fallbackResult = await this.shaderManager.forceFallbackMode();
      
      if (fallbackResult.success) {
        this.state.isUsingFallback = true;
        this.performanceMetrics.shaderSwitchCount++;
        return true;
      } else {
        this.errorHandler.handleFallbackFailure(fallbackResult.error || 'Unknown fallback error');
        
        // Report critical failure
        this.notificationService.reportPerformanceIssue(
          'shader_error',
          'critical',
          'Both main and fallback shaders failed to compile',
          {
            errorRecoveryCount: this.performanceMetrics.errorRecoveryCount,
            adaptationCount: 0,
            qualityLevel: 0
          }
        );
        
        return false;
      }
    }

    // Attempt recovery from fallback mode if errors have cleared
    if (this.state.isUsingFallback && !errorStats.hasRecoverableErrors) {
      console.log('🔄 Attempting to recover from fallback mode');
      const recoveryResult = await this.shaderManager.attemptRecovery();
      
      if (recoveryResult.success) {
        this.state.isUsingFallback = false;
        this.performanceMetrics.shaderSwitchCount++;
        this.performanceMetrics.errorRecoveryCount++;
        console.log('✅ Successfully recovered from fallback mode');
        return true;
      }
    }

    return this.state.hasActiveShader;
  }

  /**
   * Check for performance degradation and handle accordingly
   */
  private checkPerformanceDegradation(): void {
    const frameTime = this.performanceMetrics.averageFrameTime;
    const targetFrameTime = 1000 / 30; // 30 FPS target
    
    // Check if performance is consistently poor
    if (frameTime > targetFrameTime * 1.5) { // 50% worse than target
      this.performanceDegradationCount++;
      
      if (this.performanceDegradationCount >= 3) { // 3 consecutive poor checks
        this.handlePerformanceDegradation(frameTime, targetFrameTime);
        this.performanceDegradationCount = 0; // Reset counter
      }
    } else if (frameTime < targetFrameTime * 1.2) { // Performance is acceptable
      this.performanceDegradationCount = 0; // Reset counter
    }
  }

  /**
   * Handle performance degradation with automatic quality reduction
   */
  private handlePerformanceDegradation(currentFrameTime: number, targetFrameTime: number): void {
    const performanceRatio = currentFrameTime / targetFrameTime;
    const currentFPS = 1000 / currentFrameTime;
    
    console.warn(`⚠️ Performance degradation detected: ${currentFPS.toFixed(1)} FPS (target: 30 FPS)`);
    
    // Determine severity based on performance ratio
    let severity: PerformanceIssue['severity'] = 'medium';
    if (performanceRatio > 2.5) severity = 'critical'; // Less than 12 FPS
    else if (performanceRatio > 2.0) severity = 'high'; // Less than 15 FPS
    else if (performanceRatio > 1.8) severity = 'medium'; // Less than 17 FPS
    else severity = 'low';
    
    // Report performance issue
    this.notificationService.reportPerformanceIssue(
      'low_fps',
      severity,
      `Frame rate dropped to ${currentFPS.toFixed(1)} FPS (target: 30 FPS)`,
      {
        currentFPS,
        averageFrameTime: currentFrameTime,
        qualityLevel: this.calculateCurrentQualityLevel(),
        adaptationCount: this.performanceMetrics.shaderSwitchCount,
        isStable: false,
        recommendations: this.generatePerformanceRecommendations(currentFPS)
      }
    );
    
    // Automatically reduce quality if enabled
    if (this.config.autoRecovery) {
      this.automaticallyReduceQuality(severity);
    }
  }

  /**
   * Automatically reduce quality based on performance issues
   */
  private automaticallyReduceQuality(severity: PerformanceIssue['severity']): void {
    console.log(`🔧 Automatically reducing quality due to ${severity} performance issue`);
    
    // Force quality reduction based on severity
    switch (severity) {
      case 'critical':
        // Emergency quality reduction
        this.setShaderComplexity('simple');
        this.state.performanceMode = 'low';
        break;
        
      case 'high':
        // Significant quality reduction
        if (this.currentShaderComplexity === 'advanced') {
          this.setShaderComplexity('standard');
        } else if (this.currentShaderComplexity === 'standard') {
          this.setShaderComplexity('simple');
        }
        this.state.performanceMode = 'low';
        break;
        
      case 'medium':
        // Moderate quality reduction
        if (this.currentShaderComplexity === 'advanced') {
          this.setShaderComplexity('standard');
        }
        if (this.state.performanceMode === 'high') {
          this.state.performanceMode = 'medium';
        }
        break;
        
      case 'low':
        // Minor quality reduction
        if (this.state.performanceMode === 'high') {
          this.state.performanceMode = 'medium';
        }
        break;
    }
    
    this.performanceMetrics.shaderSwitchCount++;
  }

  /**
   * Calculate current quality level as percentage
   */
  private calculateCurrentQualityLevel(): number {
    let qualityScore = 0;
    
    // Shader complexity score (0-40 points)
    switch (this.currentShaderComplexity) {
      case 'advanced': qualityScore += 40; break;
      case 'standard': qualityScore += 25; break;
      case 'simple': qualityScore += 10; break;
    }
    
    // Performance mode score (0-30 points)
    switch (this.state.performanceMode) {
      case 'high': qualityScore += 30; break;
      case 'medium': qualityScore += 20; break;
      case 'low': qualityScore += 10; break;
    }
    
    // Fallback mode penalty (0-30 points)
    if (!this.state.isUsingFallback) {
      qualityScore += 30;
    } else if (this.shaderManager.isInTextureMode()) {
      qualityScore += 10; // Texture mode is better than no fog
    }
    
    return Math.min(100, qualityScore);
  }

  /**
   * Generate performance recommendations based on current FPS
   */
  private generatePerformanceRecommendations(currentFPS: number): string[] {
    const recommendations: string[] = [];
    
    if (currentFPS < 15) {
      recommendations.push('Critical: Switch to simple shader mode');
      recommendations.push('Reduce cloud density to minimum');
      recommendations.push('Disable all advanced effects');
    } else if (currentFPS < 20) {
      recommendations.push('Use standard shader complexity');
      recommendations.push('Reduce animation frequency');
      recommendations.push('Lower cloud density');
    } else if (currentFPS < 25) {
      recommendations.push('Consider reducing shader complexity');
      recommendations.push('Optimize animation settings');
    }
    
    recommendations.push('Close other apps to free memory');
    recommendations.push('Check device temperature');
    
    return recommendations;
  }

  /**
   * Get performance notification service for external access
   */
  getNotificationService(): PerformanceNotificationService {
    return this.notificationService;
  }

  /**
   * Apply performance-based optimizations to uniforms
   */
  private applyPerformanceOptimizations(uniforms: Partial<SkiaCloudUniforms>): Partial<SkiaCloudUniforms> {
    const optimized = { ...uniforms };
    
    // Get current zoom level for LOD calculations
    const currentUniforms = this.shaderManager.getCurrentUniforms();
    const zoom = optimized.u_zoom ?? currentUniforms.u_zoom;
    const lodSettings = getLODSettings(zoom);
    
    // Adjust animation speed based on performance mode
    if (optimized.u_animation_speed !== undefined) {
      switch (this.state.performanceMode) {
        case 'low':
          optimized.u_animation_speed = Math.min(optimized.u_animation_speed, 0.5);
          break;
        case 'medium':
          optimized.u_animation_speed = Math.min(optimized.u_animation_speed, 1.0);
          break;
        case 'high':
          // No restrictions
          break;
      }
    }

    // Adjust cloud density for performance
    if (optimized.u_cloud_density !== undefined && this.state.performanceMode === 'low') {
      optimized.u_cloud_density = Math.min(optimized.u_cloud_density, 0.6);
    }

    return optimized;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(updateTime: number): void {
    // Update average frame time using exponential moving average
    this.performanceMetrics.averageFrameTime = 
      this.performanceMetrics.averageFrameTime * 0.9 + updateTime * 0.1;

    // Adjust performance mode based on metrics
    if (this.performanceMetrics.averageFrameTime > 33.33) { // Below 30fps
      this.state.performanceMode = 'low';
    } else if (this.performanceMetrics.averageFrameTime > 20) { // Below 50fps
      this.state.performanceMode = 'medium';
    } else {
      this.state.performanceMode = 'high';
    }
  }

  /**
   * Setup error recovery strategies
   */
  private setupErrorRecoveryStrategies(): void {
    // Register custom recovery strategy for shader recompilation
    this.errorHandler.registerRecoveryStrategy({
      name: 'recompile_shader',
      description: 'Recompile the main shader',
      execute: async () => {
        const result = await this.shaderManager.attemptRecovery();
        return result.success;
      },
      priority: 1,
    });

    // Register strategy to reduce shader complexity
    this.errorHandler.registerRecoveryStrategy({
      name: 'reduce_quality',
      description: 'Reduce shader quality and retry',
      execute: async () => {
        this.state.performanceMode = 'low';
        const result = await this.shaderManager.attemptRecovery();
        return result.success;
      },
      priority: 2,
    });

    // Register fallback strategy
    this.errorHandler.registerRecoveryStrategy({
      name: 'enable_fallback',
      description: 'Enable fallback shader mode',
      execute: async () => {
        const result = await this.shaderManager.forceFallbackMode();
        if (result.success) {
          this.state.isUsingFallback = true;
          return true;
        }
        return false;
      },
      priority: 3,
    });
  }

  /**
   * Get system state for debugging and monitoring
   */
  getSystemState(): ShaderSystemState {
    return { ...this.state };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    // Update batch stats from uniform batcher
    this.performanceMetrics.batchStats = this.uniformBatcher.getStats();
    return { ...this.performanceMetrics };
  }

  /**
   * Set shader complexity level
   */
  setShaderComplexity(complexity: 'simple' | 'standard' | 'advanced'): void {
    if (this.currentShaderComplexity === complexity) return;

    this.currentShaderComplexity = complexity;
    console.log(`Shader complexity set to: ${complexity}`);

    // Apply complexity-based optimizations
    this.applyShaderComplexityOptimizations(complexity);
  }

  /**
   * Get current shader complexity
   */
  getShaderComplexity(): 'simple' | 'standard' | 'advanced' {
    return this.currentShaderComplexity;
  }

  /**
   * Pause animation updates (useful for background state)
   */
  pauseAnimation(): void {
    this.uniformBatcher.pauseAnimation();
  }

  /**
   * Resume animation updates
   */
  resumeAnimation(): void {
    this.uniformBatcher.resumeAnimation();
  }

  /**
   * Check if animation is currently paused
   */
  isAnimationPaused(): boolean {
    return this.uniformBatcher.isAnimationPaused();
  }

  /**
   * Get comprehensive diagnostics
   */
  getDiagnostics(): object {
    return {
      state: this.getSystemState(),
      performance: this.getPerformanceMetrics(),
      shaderManager: this.shaderManager.getDiagnostics(),
      errorHandler: this.errorHandler.getDiagnostics(),
      notifications: this.notificationService.getDiagnosticReport(),
      config: this.config,
      performanceDegradationCount: this.performanceDegradationCount,
      lastPerformanceCheck: this.lastPerformanceCheck,
    };
  }

  /**
   * Get user-friendly status message
   */
  getStatusMessage(): string {
    if (!this.state.initialized) {
      return 'Fog system is initializing...';
    }

    if (this.state.isUsingFallback) {
      return 'Fog effects are running in compatibility mode.';
    }

    const errorMessage = this.errorHandler.getUserFriendlyMessage();
    if (errorMessage) {
      return errorMessage;
    }

    return 'Fog system is running normally.';
  }

  /**
   * Setup uniform batcher callbacks
   */
  private setupUniformBatcherCallbacks(): void {
    // Handle batched uniform updates
    this.uniformBatcher.onUniformUpdate((uniforms) => {
      try {
        const result = this.shaderManager.updateUniforms(uniforms);
        if (!result.success) {
          this.errorHandler.handleUniformError(
            'batch_update',
            uniforms,
            result.error || 'Batch update failed'
          );
          this.state.errorCount++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown batch callback error';
        this.errorHandler.handleRuntimeError(errorMessage, { uniforms });
        this.state.errorCount++;
      }
    });

    // Track batch statistics
    this.uniformBatcher.onBatchStats((stats) => {
      this.performanceMetrics.batchStats = stats;
    });
  }

  /**
   * Apply shader complexity optimizations
   */
  private applyShaderComplexityOptimizations(complexity: 'simple' | 'standard' | 'advanced'): void {
    // Adjust performance mode based on complexity
    switch (complexity) {
      case 'simple':
        this.state.performanceMode = 'low';
        break;
      case 'standard':
        this.state.performanceMode = 'medium';
        break;
      case 'advanced':
        this.state.performanceMode = 'high';
        break;
    }

    // Update uniform batcher configuration based on complexity
    const batcherConfig = {
      batchTimeout: complexity === 'simple' ? 33 : complexity === 'standard' ? 16 : 8, // Adjust batching frequency
      enableSmartUpdates: complexity !== 'simple', // Disable smart updates for simple mode
    };

    // Note: In a real implementation, you would update the batcher configuration here
    // For now, we'll just log the intended changes
    console.log('Applied shader complexity optimizations:', {
      complexity,
      performanceMode: this.state.performanceMode,
      batcherConfig
    });
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.uniformBatcher.dispose();
    this.shaderManager.dispose();
    this.errorHandler.clearErrors();
    this.notificationService.clearDiagnosticData();
    
    this.state.initialized = false;
    this.state.hasActiveShader = false;
    this.initializationAttempts = 0;
    this.performanceDegradationCount = 0;
    this.lastPerformanceCheck = 0;
    
    console.log('✅ Skia shader system disposed');
  }
}