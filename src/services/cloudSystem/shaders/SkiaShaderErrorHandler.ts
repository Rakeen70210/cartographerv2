/**
 * Skia Shader Error Handler
 * Comprehensive error handling and recovery system for Skia shader compilation
 */

export interface ShaderError {
  type: 'compilation' | 'uniform_binding' | 'runtime' | 'fallback_failure';
  message: string;
  timestamp: number;
  recoverable: boolean;
  context?: Record<string, any>;
}

export interface ErrorRecoveryStrategy {
  name: string;
  description: string;
  execute: () => Promise<boolean>;
  priority: number; // Lower number = higher priority
}

export interface ShaderErrorHandlerConfig {
  maxRetryAttempts: number;
  retryDelayMs: number;
  enableFallbackMode: boolean;
  logErrors: boolean;
}

export class SkiaShaderErrorHandler {
  private errors: ShaderError[] = [];
  private config: ShaderErrorHandlerConfig;
  private recoveryStrategies: ErrorRecoveryStrategy[] = [];
  private isRecovering: boolean = false;

  constructor(config: Partial<ShaderErrorHandlerConfig> = {}) {
    this.config = {
      maxRetryAttempts: 3,
      retryDelayMs: 1000,
      enableFallbackMode: true,
      logErrors: true,
      ...config,
    };

    this.initializeRecoveryStrategies();
  }

  /**
   * Initialize recovery strategies in order of priority
   */
  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies = [
      {
        name: 'retry_compilation',
        description: 'Retry shader compilation with same source',
        execute: async () => {
          // This will be implemented by the caller
          return false;
        },
        priority: 1,
      },
      {
        name: 'reduce_complexity',
        description: 'Reduce shader complexity and retry',
        execute: async () => {
          // This will be implemented by the caller
          return false;
        },
        priority: 2,
      },
      {
        name: 'fallback_mode',
        description: 'Switch to fallback shader',
        execute: async () => {
          // This will be implemented by the caller
          return false;
        },
        priority: 3,
      },
      {
        name: 'disable_shaders',
        description: 'Disable shader rendering entirely',
        execute: async () => {
          console.warn('Disabling shader rendering due to persistent errors');
          return true; // Always succeeds by disabling functionality
        },
        priority: 4,
      },
    ];
  }

  /**
   * Handle a shader compilation error
   */
  handleCompilationError(error: string, context?: Record<string, any>): ShaderError {
    const shaderError: ShaderError = {
      type: 'compilation',
      message: error,
      timestamp: Date.now(),
      recoverable: true,
      context,
    };

    this.addError(shaderError);

    if (this.config.logErrors) {
      console.error('Shader compilation error:', {
        message: error,
        context,
        errorCount: this.errors.length,
      });
    }

    return shaderError;
  }

  /**
   * Handle uniform binding errors
   */
  handleUniformError(uniformName: string, value: any, error: string): ShaderError {
    const shaderError: ShaderError = {
      type: 'uniform_binding',
      message: `Failed to bind uniform '${uniformName}': ${error}`,
      timestamp: Date.now(),
      recoverable: true,
      context: { uniformName, value },
    };

    this.addError(shaderError);

    if (this.config.logErrors) {
      console.error('Uniform binding error:', shaderError);
    }

    return shaderError;
  }

  /**
   * Handle runtime shader errors
   */
  handleRuntimeError(error: string, context?: Record<string, any>): ShaderError {
    const shaderError: ShaderError = {
      type: 'runtime',
      message: error,
      timestamp: Date.now(),
      recoverable: false, // Runtime errors are typically not recoverable
      context,
    };

    this.addError(shaderError);

    if (this.config.logErrors) {
      console.error('Shader runtime error:', shaderError);
    }

    return shaderError;
  }

  /**
   * Handle fallback shader failure
   */
  handleFallbackFailure(error: string): ShaderError {
    const shaderError: ShaderError = {
      type: 'fallback_failure',
      message: `Fallback shader failed: ${error}`,
      timestamp: Date.now(),
      recoverable: false, // Fallback failure is critical
      context: { critical: true },
    };

    this.addError(shaderError);

    if (this.config.logErrors) {
      console.error('Critical: Fallback shader failure:', shaderError);
    }

    return shaderError;
  }

  /**
   * Attempt automatic error recovery
   */
  async attemptRecovery(): Promise<boolean> {
    if (this.isRecovering) {
      console.warn('Recovery already in progress, skipping');
      return false;
    }

    this.isRecovering = true;

    try {
      // Sort strategies by priority
      const sortedStrategies = [...this.recoveryStrategies].sort((a, b) => a.priority - b.priority);

      for (const strategy of sortedStrategies) {
        console.log(`Attempting recovery strategy: ${strategy.name}`);
        
        try {
          const success = await strategy.execute();
          if (success) {
            console.log(`Recovery successful using strategy: ${strategy.name}`);
            this.clearRecoverableErrors();
            return true;
          }
        } catch (strategyError) {
          console.warn(`Recovery strategy '${strategy.name}' failed:`, strategyError);
        }

        // Add delay between strategies
        await this.delay(this.config.retryDelayMs);
      }

      console.error('All recovery strategies failed');
      return false;

    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * Register a custom recovery strategy
   */
  registerRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
    this.recoveryStrategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: ShaderError[];
    hasRecoverableErrors: boolean;
    hasCriticalErrors: boolean;
  } {
    const errorsByType: Record<string, number> = {};
    let hasRecoverableErrors = false;
    let hasCriticalErrors = false;

    for (const error of this.errors) {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      
      if (error.recoverable) {
        hasRecoverableErrors = true;
      } else {
        hasCriticalErrors = true;
      }
    }

    // Get recent errors (last 10)
    const recentErrors = this.errors.slice(-10);

    return {
      totalErrors: this.errors.length,
      errorsByType,
      recentErrors,
      hasRecoverableErrors,
      hasCriticalErrors,
    };
  }

  /**
   * Check if system should use fallback mode
   */
  shouldUseFallback(): boolean {
    if (!this.config.enableFallbackMode) {
      return false;
    }

    // Use fallback if there are recent compilation errors
    const recentCompilationErrors = this.errors.filter(
      error => error.type === 'compilation' && 
      Date.now() - error.timestamp < 30000 // Last 30 seconds
    );

    return recentCompilationErrors.length >= 2;
  }

  /**
   * Generate user-friendly error message
   */
  getUserFriendlyMessage(): string {
    const stats = this.getErrorStats();

    if (stats.hasCriticalErrors) {
      return 'Fog rendering is temporarily unavailable due to graphics issues. The app will continue to work with reduced visual effects.';
    }

    if (stats.hasRecoverableErrors) {
      return 'Fog effects may appear simplified due to graphics compatibility issues.';
    }

    return '';
  }

  /**
   * Clear recoverable errors after successful recovery
   */
  private clearRecoverableErrors(): void {
    this.errors = this.errors.filter(error => !error.recoverable);
  }

  /**
   * Add error to the error list
   */
  private addError(error: ShaderError): void {
    this.errors.push(error);

    // Keep only the last 50 errors to prevent memory issues
    if (this.errors.length > 50) {
      this.errors = this.errors.slice(-50);
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear all errors (useful for testing or manual reset)
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Get diagnostic information for debugging
   */
  getDiagnostics(): object {
    return {
      config: this.config,
      errorCount: this.errors.length,
      isRecovering: this.isRecovering,
      recoveryStrategies: this.recoveryStrategies.map(s => ({
        name: s.name,
        description: s.description,
        priority: s.priority,
      })),
      errorStats: this.getErrorStats(),
    };
  }
}