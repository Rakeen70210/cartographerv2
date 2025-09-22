/**
 * Frame Rate Monitor
 * Monitors rendering performance and frame timing
 */

export interface FrameRateMetrics {
  currentFPS: number;
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
  frameTime: number;
  averageFrameTime: number;
  droppedFrames: number;
  totalFrames: number;
}

export class FrameRateMonitor {
  private isRunning = false;
  private frameCount = 0;
  private lastFrameTime = 0;
  private startTime = 0;
  private frameTimes: number[] = [];
  private fpsHistory: number[] = [];
  private droppedFrames = 0;
  private animationFrameId: number | null = null;
  
  // Configuration
  private readonly maxHistorySize = 60; // Keep 60 frames of history
  private readonly targetFrameTime = 16.67; // 60 FPS target (1000ms / 60fps)
  private readonly droppedFrameThreshold = 33.33; // 30 FPS threshold for dropped frames

  constructor() {
    this.reset();
  }

  /**
   * Start monitoring frame rate
   */
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.reset();
    this.scheduleNextFrame();
  }

  /**
   * Stop monitoring frame rate
   */
  public stop(): void {
    this.isRunning = false;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Get current FPS
   */
  public getCurrentFPS(): number {
    if (this.fpsHistory.length === 0) return 0;
    return this.fpsHistory[this.fpsHistory.length - 1];
  }

  /**
   * Get average FPS over recent history
   */
  public getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 0;
    
    const sum = this.fpsHistory.reduce((acc, fps) => acc + fps, 0);
    return sum / this.fpsHistory.length;
  }

  /**
   * Get minimum FPS from recent history
   */
  public getMinFPS(): number {
    if (this.fpsHistory.length === 0) return 0;
    return Math.min(...this.fpsHistory);
  }

  /**
   * Get maximum FPS from recent history
   */
  public getMaxFPS(): number {
    if (this.fpsHistory.length === 0) return 0;
    return Math.max(...this.fpsHistory);
  }

  /**
   * Get current frame time in milliseconds
   */
  public getCurrentFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    return this.frameTimes[this.frameTimes.length - 1];
  }

  /**
   * Get average frame time over recent history
   */
  public getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    
    const sum = this.frameTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.frameTimes.length;
  }

  /**
   * Get number of dropped frames
   */
  public getDroppedFrames(): number {
    return this.droppedFrames;
  }

  /**
   * Get total frame count
   */
  public getTotalFrames(): number {
    return this.frameCount;
  }

  /**
   * Get comprehensive frame rate metrics
   */
  public getMetrics(): FrameRateMetrics {
    return {
      currentFPS: this.getCurrentFPS(),
      averageFPS: this.getAverageFPS(),
      minFPS: this.getMinFPS(),
      maxFPS: this.getMaxFPS(),
      frameTime: this.getCurrentFrameTime(),
      averageFrameTime: this.getAverageFrameTime(),
      droppedFrames: this.droppedFrames,
      totalFrames: this.frameCount
    };
  }

  /**
   * Check if performance is currently stable
   */
  public isPerformanceStable(): boolean {
    if (this.fpsHistory.length < 10) return false; // Need enough data
    
    const recentFPS = this.fpsHistory.slice(-10);
    const avgFPS = recentFPS.reduce((acc, fps) => acc + fps, 0) / recentFPS.length;
    const variance = recentFPS.reduce((acc, fps) => acc + Math.pow(fps - avgFPS, 2), 0) / recentFPS.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Performance is stable if standard deviation is low
    return standardDeviation < 5; // Less than 5 FPS variation
  }

  /**
   * Get performance trend (improving, stable, degrading)
   */
  public getPerformanceTrend(): 'improving' | 'stable' | 'degrading' {
    if (this.fpsHistory.length < 20) return 'stable';
    
    const firstHalf = this.fpsHistory.slice(0, Math.floor(this.fpsHistory.length / 2));
    const secondHalf = this.fpsHistory.slice(Math.floor(this.fpsHistory.length / 2));
    
    const firstHalfAvg = firstHalf.reduce((acc, fps) => acc + fps, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((acc, fps) => acc + fps, 0) / secondHalf.length;
    
    const difference = secondHalfAvg - firstHalfAvg;
    
    if (difference > 2) return 'improving';
    if (difference < -2) return 'degrading';
    return 'stable';
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.startTime = this.lastFrameTime;
    this.frameTimes = [];
    this.fpsHistory = [];
    this.droppedFrames = 0;
  }

  /**
   * Schedule next frame for monitoring
   */
  private scheduleNextFrame(): void {
    if (!this.isRunning) return;

    this.animationFrameId = requestAnimationFrame((currentTime) => {
      this.recordFrame(currentTime);
      this.scheduleNextFrame();
    });
  }

  /**
   * Record frame timing data
   */
  private recordFrame(currentTime: number): void {
    const frameTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    this.frameCount++;

    // Record frame time
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxHistorySize) {
      this.frameTimes.shift();
    }

    // Calculate FPS
    const fps = frameTime > 0 ? 1000 / frameTime : 0;
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > this.maxHistorySize) {
      this.fpsHistory.shift();
    }

    // Check for dropped frames
    if (frameTime > this.droppedFrameThreshold) {
      this.droppedFrames++;
    }
  }

  /**
   * Get frame rate statistics for debugging
   */
  public getDebugInfo(): string {
    const metrics = this.getMetrics();
    const trend = this.getPerformanceTrend();
    const stable = this.isPerformanceStable();
    
    return `FPS: ${metrics.currentFPS.toFixed(1)} (avg: ${metrics.averageFPS.toFixed(1)}, min: ${metrics.minFPS.toFixed(1)}, max: ${metrics.maxFPS.toFixed(1)}) | ` +
           `Frame Time: ${metrics.frameTime.toFixed(2)}ms (avg: ${metrics.averageFrameTime.toFixed(2)}ms) | ` +
           `Dropped: ${metrics.droppedFrames}/${metrics.totalFrames} | ` +
           `Trend: ${trend} | Stable: ${stable}`;
  }

  /**
   * Check if frame rate is below acceptable threshold
   */
  public isBelowThreshold(threshold: number = 30): boolean {
    const currentFPS = this.getCurrentFPS();
    return currentFPS > 0 && currentFPS < threshold;
  }

  /**
   * Get frame rate category
   */
  public getFrameRateCategory(): 'excellent' | 'good' | 'acceptable' | 'poor' | 'unacceptable' {
    const fps = this.getCurrentFPS();
    
    if (fps >= 55) return 'excellent';
    if (fps >= 45) return 'good';
    if (fps >= 30) return 'acceptable';
    if (fps >= 20) return 'poor';
    return 'unacceptable';
  }

  /**
   * Export metrics for analysis
   */
  public exportMetrics(): {
    timestamp: number;
    metrics: FrameRateMetrics;
    trend: string;
    stable: boolean;
    category: string;
  } {
    return {
      timestamp: Date.now(),
      metrics: this.getMetrics(),
      trend: this.getPerformanceTrend(),
      stable: this.isPerformanceStable(),
      category: this.getFrameRateCategory()
    };
  }
}