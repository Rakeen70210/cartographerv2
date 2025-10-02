/**
 * Skia Uniform Batcher
 * Efficient uniform update system with batching, smart detection, and animation control
 */

import { AppState, AppStateStatus } from 'react-native';
import { SkiaCloudUniforms } from './SkiaCloudShader';

export interface UniformBatchConfig {
  batchSize: number;
  batchTimeout: number; // ms
  enableSmartUpdates: boolean;
  floatPrecision: number;
  enableAnimationPause: boolean;
  debugLogging: boolean;
}

export interface UniformUpdateRequest {
  id: string;
  uniforms: Partial<SkiaCloudUniforms>;
  timestamp: number;
  priority: 'low' | 'medium' | 'high';
}

export interface UniformBatchResult {
  success: boolean;
  processedCount: number;
  skippedCount: number;
  batchTime: number;
  error?: string;
}

export interface UniformChangeDetection {
  hasChanges: boolean;
  changedUniforms: string[];
  significantChanges: string[];
  minorChanges: string[];
}

export class SkiaUniformBatcher {
  private config: UniformBatchConfig;
  private pendingUpdates: Map<string, UniformUpdateRequest> = new Map();
  private lastKnownValues: Map<string, any> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private isAnimationPaused = false;
  private appState: AppStateStatus = AppState.currentState;
  private updateCallbacks: Array<(uniforms: Record<string, any>) => void> = [];
  private statsCallbacks: Array<(stats: UniformBatchStats) => void> = [];
  
  // Performance tracking
  private stats: UniformBatchStats = {
    totalBatches: 0,
    totalUpdates: 0,
    totalSkipped: 0,
    averageBatchTime: 0,
    lastBatchTime: 0,
    cacheHitRate: 0
  };

  constructor(config: Partial<UniformBatchConfig> = {}) {
    this.config = {
      batchSize: 10,
      batchTimeout: 16, // ~60fps
      enableSmartUpdates: true,
      floatPrecision: 0.001,
      enableAnimationPause: true,
      debugLogging: false,
      ...config
    };

    this.setupAppStateHandling();
  }

  /**
   * Queue uniform update for batching
   */
  public queueUpdate(
    id: string, 
    uniforms: Partial<SkiaCloudUniforms>, 
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): void {
    // Skip updates if animation is paused (except high priority)
    if (this.isAnimationPaused && priority !== 'high') {
      this.log('Skipping update due to paused animation:', id);
      return;
    }

    const request: UniformUpdateRequest = {
      id,
      uniforms,
      timestamp: Date.now(),
      priority
    };

    this.pendingUpdates.set(id, request);

    // Process immediately for high priority updates
    if (priority === 'high') {
      this.processBatch();
      return;
    }

    // Schedule batch processing if not already scheduled
    if (!this.batchTimer) {
      this.scheduleBatch();
    }

    // Process immediately if batch size reached
    if (this.pendingUpdates.size >= this.config.batchSize) {
      this.processBatch();
    }
  }

  /**
   * Force immediate processing of all pending updates
   */
  public flush(): UniformBatchResult {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    return this.processBatch();
  }

  /**
   * Pause animation updates (useful for background state)
   */
  public pauseAnimation(): void {
    if (!this.config.enableAnimationPause) return;

    this.isAnimationPaused = true;
    this.log('Animation paused');

    // Clear pending low/medium priority updates
    const highPriorityUpdates = new Map();
    for (const [id, request] of this.pendingUpdates) {
      if (request.priority === 'high') {
        highPriorityUpdates.set(id, request);
      }
    }
    this.pendingUpdates = highPriorityUpdates;
  }

  /**
   * Resume animation updates
   */
  public resumeAnimation(): void {
    if (!this.config.enableAnimationPause) return;

    this.isAnimationPaused = false;
    this.log('Animation resumed');
  }

  /**
   * Check if animation is currently paused
   */
  public isAnimationPaused(): boolean {
    return this.isAnimationPaused;
  }

  /**
   * Detect changes in uniform values
   */
  public detectChanges(uniforms: Partial<SkiaCloudUniforms>): UniformChangeDetection {
    const result: UniformChangeDetection = {
      hasChanges: false,
      changedUniforms: [],
      significantChanges: [],
      minorChanges: []
    };

    for (const [key, value] of Object.entries(uniforms)) {
      const lastValue = this.lastKnownValues.get(key);
      
      if (lastValue === undefined) {
        // New uniform
        result.hasChanges = true;
        result.changedUniforms.push(key);
        result.significantChanges.push(key);
        continue;
      }

      const hasChanged = this.hasValueChanged(lastValue, value, key);
      if (hasChanged) {
        result.hasChanges = true;
        result.changedUniforms.push(key);

        // Categorize change significance
        if (this.isSignificantChange(lastValue, value, key)) {
          result.significantChanges.push(key);
        } else {
          result.minorChanges.push(key);
        }
      }
    }

    return result;
  }

  /**
   * Register callback for uniform updates
   */
  public onUniformUpdate(callback: (uniforms: Record<string, any>) => void): void {
    this.updateCallbacks.push(callback);
  }

  /**
   * Register callback for batch statistics
   */
  public onBatchStats(callback: (stats: UniformBatchStats) => void): void {
    this.statsCallbacks.push(callback);
  }

  /**
   * Remove update callback
   */
  public removeUpdateCallback(callback: (uniforms: Record<string, any>) => void): void {
    const index = this.updateCallbacks.indexOf(callback);
    if (index > -1) {
      this.updateCallbacks.splice(index, 1);
    }
  }

  /**
   * Get current batch statistics
   */
  public getStats(): UniformBatchStats {
    return { ...this.stats };
  }

  /**
   * Clear all cached values and pending updates
   */
  public clear(): void {
    this.pendingUpdates.clear();
    this.lastKnownValues.clear();
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    this.log('Uniform batcher cleared');
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.clear();
    this.updateCallbacks.length = 0;
    this.statsCallbacks.length = 0;
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatch(): void {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.config.batchTimeout);
  }

  /**
   * Process pending uniform updates in batch
   */
  private processBatch(): UniformBatchResult {
    const startTime = performance.now();
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.pendingUpdates.size === 0) {
      return {
        success: true,
        processedCount: 0,
        skippedCount: 0,
        batchTime: 0
      };
    }

    let processedCount = 0;
    let skippedCount = 0;
    const batchedUniforms: Record<string, any> = {};

    try {
      // Sort updates by priority and timestamp
      const sortedUpdates = Array.from(this.pendingUpdates.values()).sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.timestamp - b.timestamp; // Earlier timestamps first
      });

      // Process updates
      for (const request of sortedUpdates) {
        const changeDetection = this.detectChanges(request.uniforms);
        
        if (!changeDetection.hasChanges && this.config.enableSmartUpdates) {
          skippedCount++;
          this.log(`Skipping unchanged uniforms for ${request.id}`);
          continue;
        }

        // Merge uniforms into batch
        for (const [key, value] of Object.entries(request.uniforms)) {
          if (changeDetection.changedUniforms.includes(key) || !this.config.enableSmartUpdates) {
            batchedUniforms[key] = value;
            this.lastKnownValues.set(key, this.cloneValue(value));
          }
        }

        processedCount++;
      }

      // Clear processed updates
      this.pendingUpdates.clear();

      // Notify callbacks if we have updates to apply
      if (Object.keys(batchedUniforms).length > 0) {
        this.notifyUpdateCallbacks(batchedUniforms);
      }

      const batchTime = performance.now() - startTime;
      this.updateStats(processedCount, skippedCount, batchTime);

      this.log(`Batch processed: ${processedCount} updates, ${skippedCount} skipped, ${batchTime.toFixed(2)}ms`);

      return {
        success: true,
        processedCount,
        skippedCount,
        batchTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown batch processing error';
      console.error('Error processing uniform batch:', errorMessage);

      return {
        success: false,
        processedCount,
        skippedCount,
        batchTime: performance.now() - startTime,
        error: errorMessage
      };
    }
  }

  /**
   * Check if a value has changed significantly
   */
  private hasValueChanged(oldValue: any, newValue: any, key: string): boolean {
    if (typeof oldValue === 'number' && typeof newValue === 'number') {
      return Math.abs(oldValue - newValue) > this.config.floatPrecision;
    }

    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      if (oldValue.length !== newValue.length) return true;
      
      for (let i = 0; i < oldValue.length; i++) {
        if (Math.abs(oldValue[i] - newValue[i]) > this.config.floatPrecision) {
          return true;
        }
      }
      return false;
    }

    return oldValue !== newValue;
  }

  /**
   * Determine if a change is significant enough to warrant immediate processing
   */
  private isSignificantChange(oldValue: any, newValue: any, key: string): boolean {
    // Time-based uniforms are always significant for smooth animation
    if (key === 'u_time') return true;
    
    // Resolution changes are significant
    if (key === 'u_resolution') return true;

    // Large changes in numeric values are significant
    if (typeof oldValue === 'number' && typeof newValue === 'number') {
      const change = Math.abs(newValue - oldValue);
      const relative = oldValue !== 0 ? change / Math.abs(oldValue) : change;
      return relative > 0.1; // 10% change threshold
    }

    // Array changes - check for significant component changes
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      for (let i = 0; i < Math.min(oldValue.length, newValue.length); i++) {
        const change = Math.abs(newValue[i] - oldValue[i]);
        const relative = oldValue[i] !== 0 ? change / Math.abs(oldValue[i]) : change;
        if (relative > 0.1) return true;
      }
      return false;
    }

    return true; // Default to significant for non-numeric values
  }

  /**
   * Clone a value for caching
   */
  private cloneValue(value: any): any {
    if (Array.isArray(value)) {
      return [...value];
    }
    return value;
  }

  /**
   * Setup app state handling for animation pause/resume
   */
  private setupAppStateHandling(): void {
    if (!this.config.enableAnimationPause) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (this.appState === 'active' && nextAppState.match(/inactive|background/)) {
        this.pauseAnimation();
      } else if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
        this.resumeAnimation();
      }
      this.appState = nextAppState;
    };

    AppState.addEventListener('change', handleAppStateChange);
  }

  /**
   * Update performance statistics
   */
  private updateStats(processed: number, skipped: number, batchTime: number): void {
    this.stats.totalBatches++;
    this.stats.totalUpdates += processed;
    this.stats.totalSkipped += skipped;
    this.stats.lastBatchTime = batchTime;
    
    // Update average batch time using exponential moving average
    this.stats.averageBatchTime = this.stats.averageBatchTime * 0.9 + batchTime * 0.1;
    
    // Calculate cache hit rate
    const totalRequests = this.stats.totalUpdates + this.stats.totalSkipped;
    this.stats.cacheHitRate = totalRequests > 0 ? (this.stats.totalSkipped / totalRequests) * 100 : 0;

    // Notify stats callbacks
    this.notifyStatsCallbacks();
  }

  /**
   * Notify update callbacks
   */
  private notifyUpdateCallbacks(uniforms: Record<string, any>): void {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(uniforms);
      } catch (error) {
        console.error('Error in uniform update callback:', error);
      }
    });
  }

  /**
   * Notify stats callbacks
   */
  private notifyStatsCallbacks(): void {
    this.statsCallbacks.forEach(callback => {
      try {
        callback(this.stats);
      } catch (error) {
        console.error('Error in batch stats callback:', error);
      }
    });
  }

  /**
   * Log debug information
   */
  private log(message: string, data?: any): void {
    if (this.config.debugLogging) {
      console.log(`[SkiaUniformBatcher] ${message}`, data || '');
    }
  }
}

export interface UniformBatchStats {
  totalBatches: number;
  totalUpdates: number;
  totalSkipped: number;
  averageBatchTime: number;
  lastBatchTime: number;
  cacheHitRate: number;
}