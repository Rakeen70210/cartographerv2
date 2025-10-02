/**
 * Performance Notification Service
 * Handles user notifications for performance issues and provides suggested settings
 */

import { Alert, Platform } from 'react-native';
import { SkiaPerformanceMetrics, SkiaQualitySettings } from './SkiaPerformanceMonitor';

export interface PerformanceIssue {
  type: 'low_fps' | 'high_memory' | 'shader_error' | 'rendering_lag' | 'battery_drain';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  suggestions: string[];
  timestamp: number;
  metrics?: Partial<SkiaPerformanceMetrics>;
}

export interface NotificationConfig {
  enableUserNotifications: boolean;
  enableDiagnosticLogging: boolean;
  notificationThreshold: 'low' | 'medium' | 'high';
  maxNotificationsPerSession: number;
  notificationCooldownMs: number;
}

export interface SuggestedSettings {
  quality: Partial<SkiaQualitySettings>;
  description: string;
  expectedImprovement: string;
  tradeoffs: string[];
}

export class PerformanceNotificationService {
  private config: NotificationConfig;
  private notificationCount: number = 0;
  private lastNotificationTime: number = 0;
  private performanceIssues: PerformanceIssue[] = [];
  private diagnosticLog: string[] = [];
  private maxLogEntries: number = 100;

  constructor(config: Partial<NotificationConfig> = {}) {
    this.config = {
      enableUserNotifications: true,
      enableDiagnosticLogging: true,
      notificationThreshold: 'medium',
      maxNotificationsPerSession: 3,
      notificationCooldownMs: 60000, // 1 minute
      ...config
    };
  }

  /**
   * Report a performance issue and potentially notify the user
   */
  reportPerformanceIssue(
    type: PerformanceIssue['type'],
    severity: PerformanceIssue['severity'],
    message: string,
    metrics?: Partial<SkiaPerformanceMetrics>
  ): void {
    const issue: PerformanceIssue = {
      type,
      severity,
      message,
      suggestions: this.generateSuggestions(type, severity, metrics),
      timestamp: Date.now(),
      metrics
    };

    this.performanceIssues.push(issue);
    this.logDiagnostic(`Performance Issue: ${severity.toUpperCase()} - ${message}`, { type, metrics });

    // Keep only recent issues (last 50)
    if (this.performanceIssues.length > 50) {
      this.performanceIssues = this.performanceIssues.slice(-50);
    }

    // Check if we should notify the user
    if (this.shouldNotifyUser(issue)) {
      this.showUserNotification(issue);
    }
  }

  /**
   * Generate suggested settings for performance improvement
   */
  generateSuggestedSettings(
    currentQuality: SkiaQualitySettings,
    metrics: SkiaPerformanceMetrics
  ): SuggestedSettings[] {
    const suggestions: SuggestedSettings[] = [];

    // Low FPS suggestions
    if (metrics.currentFPS < 25) {
      if (currentQuality.enableLayeredEffects) {
        suggestions.push({
          quality: { enableLayeredEffects: false },
          description: 'Disable layered fog effects',
          expectedImprovement: '15-25% FPS improvement',
          tradeoffs: ['Reduced visual depth', 'Less atmospheric detail']
        });
      }

      if (currentQuality.shaderComplexity === 'advanced') {
        suggestions.push({
          quality: { shaderComplexity: 'standard' },
          description: 'Use standard shader complexity',
          expectedImprovement: '20-30% FPS improvement',
          tradeoffs: ['Less detailed cloud patterns', 'Simpler animations']
        });
      }

      if (currentQuality.cloudDensity > 0.6) {
        suggestions.push({
          quality: { cloudDensity: 0.5 },
          description: 'Reduce cloud density',
          expectedImprovement: '10-20% FPS improvement',
          tradeoffs: ['Less dense fog coverage', 'More transparent areas']
        });
      }
    }

    // Memory optimization suggestions
    if (metrics.qualityLevel < 50) {
      suggestions.push({
        quality: { 
          updateFrequency: Math.max(15, currentQuality.updateFrequency - 5),
          animationSpeed: Math.max(0.5, currentQuality.animationSpeed - 0.2)
        },
        description: 'Reduce animation frequency and speed',
        expectedImprovement: '10-15% performance improvement',
        tradeoffs: ['Slower fog movement', 'Less smooth animations']
      });
    }

    // Battery optimization suggestions
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      suggestions.push({
        quality: {
          shaderComplexity: 'simple',
          cloudDensity: 0.4,
          animationSpeed: 0.7,
          enableLayeredEffects: false
        },
        description: 'Battery saver mode',
        expectedImprovement: '30-40% battery life improvement',
        tradeoffs: ['Simplified visuals', 'Basic fog effects only']
      });
    }

    return suggestions;
  }

  /**
   * Get diagnostic information for troubleshooting
   */
  getDiagnosticReport(): {
    issues: PerformanceIssue[];
    log: string[];
    summary: {
      totalIssues: number;
      criticalIssues: number;
      recentIssues: number;
      commonIssueTypes: string[];
    };
  } {
    const recentIssues = this.performanceIssues.filter(
      issue => Date.now() - issue.timestamp < 300000 // Last 5 minutes
    );

    const criticalIssues = this.performanceIssues.filter(
      issue => issue.severity === 'critical'
    );

    const issueTypeCounts: Record<string, number> = {};
    this.performanceIssues.forEach(issue => {
      issueTypeCounts[issue.type] = (issueTypeCounts[issue.type] || 0) + 1;
    });

    const commonIssueTypes = Object.entries(issueTypeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type]) => type);

    return {
      issues: this.performanceIssues,
      log: this.diagnosticLog,
      summary: {
        totalIssues: this.performanceIssues.length,
        criticalIssues: criticalIssues.length,
        recentIssues: recentIssues.length,
        commonIssueTypes
      }
    };
  }

  /**
   * Export diagnostic data for support
   */
  exportDiagnosticData(): string {
    const report = this.getDiagnosticReport();
    const timestamp = new Date().toISOString();
    
    const exportData = {
      timestamp,
      platform: Platform.OS,
      version: Platform.Version,
      config: this.config,
      summary: report.summary,
      recentIssues: report.issues.slice(-10), // Last 10 issues
      recentLog: report.log.slice(-20) // Last 20 log entries
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Clear diagnostic data
   */
  clearDiagnosticData(): void {
    this.performanceIssues = [];
    this.diagnosticLog = [];
    this.notificationCount = 0;
    this.lastNotificationTime = 0;
    this.logDiagnostic('Diagnostic data cleared');
  }

  /**
   * Update notification configuration
   */
  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config };
    this.logDiagnostic('Notification config updated', config);
  }

  /**
   * Check if user should be notified about an issue
   */
  private shouldNotifyUser(issue: PerformanceIssue): boolean {
    if (!this.config.enableUserNotifications) return false;
    
    // Check notification count limit
    if (this.notificationCount >= this.config.maxNotificationsPerSession) return false;
    
    // Check cooldown period
    if (Date.now() - this.lastNotificationTime < this.config.notificationCooldownMs) return false;
    
    // Check severity threshold
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    const thresholdLevel = severityLevels[this.config.notificationThreshold];
    const issueSeverityLevel = severityLevels[issue.severity];
    
    return issueSeverityLevel >= thresholdLevel;
  }

  /**
   * Show user notification for performance issue
   */
  private showUserNotification(issue: PerformanceIssue): void {
    const title = this.getNotificationTitle(issue.type, issue.severity);
    const message = this.getNotificationMessage(issue);
    
    Alert.alert(
      title,
      message,
      [
        {
          text: 'Ignore',
          style: 'cancel',
          onPress: () => this.logDiagnostic('User ignored performance notification')
        },
        {
          text: 'Optimize',
          onPress: () => this.handleOptimizeRequest(issue)
        },
        {
          text: 'Settings',
          onPress: () => this.handleSettingsRequest(issue)
        }
      ],
      { cancelable: true }
    );

    this.notificationCount++;
    this.lastNotificationTime = Date.now();
    this.logDiagnostic(`User notification shown: ${title}`);
  }

  /**
   * Generate notification title based on issue type and severity
   */
  private getNotificationTitle(type: PerformanceIssue['type'], severity: PerformanceIssue['severity']): string {
    const severityPrefix = severity === 'critical' ? '⚠️ Critical: ' : 
                          severity === 'high' ? '⚠️ ' : '';

    switch (type) {
      case 'low_fps':
        return `${severityPrefix}Fog Performance Issue`;
      case 'high_memory':
        return `${severityPrefix}Memory Usage High`;
      case 'shader_error':
        return `${severityPrefix}Graphics Issue`;
      case 'rendering_lag':
        return `${severityPrefix}Rendering Lag Detected`;
      case 'battery_drain':
        return `${severityPrefix}High Battery Usage`;
      default:
        return `${severityPrefix}Performance Issue`;
    }
  }

  /**
   * Generate notification message with suggestions
   */
  private getNotificationMessage(issue: PerformanceIssue): string {
    let message = issue.message;
    
    if (issue.suggestions.length > 0) {
      message += '\n\nSuggested fixes:\n';
      message += issue.suggestions.slice(0, 2).map(s => `• ${s}`).join('\n');
      
      if (issue.suggestions.length > 2) {
        message += `\n• And ${issue.suggestions.length - 2} more...`;
      }
    }

    return message;
  }

  /**
   * Handle user request to optimize performance
   */
  private handleOptimizeRequest(issue: PerformanceIssue): void {
    this.logDiagnostic('User requested performance optimization', { issueType: issue.type });
    
    // This would typically trigger automatic optimization
    // For now, we just log the request
    console.log('🔧 Performance optimization requested for:', issue.type);
  }

  /**
   * Handle user request to open settings
   */
  private handleSettingsRequest(issue: PerformanceIssue): void {
    this.logDiagnostic('User requested to open settings', { issueType: issue.type });
    
    // This would typically navigate to settings screen
    // For now, we just log the request
    console.log('⚙️ Settings requested for performance issue:', issue.type);
  }

  /**
   * Generate suggestions based on issue type and severity
   */
  private generateSuggestions(
    type: PerformanceIssue['type'],
    severity: PerformanceIssue['severity'],
    metrics?: Partial<SkiaPerformanceMetrics>
  ): string[] {
    const suggestions: string[] = [];

    switch (type) {
      case 'low_fps':
        suggestions.push('Reduce fog quality settings');
        suggestions.push('Disable layered effects');
        if (severity === 'high' || severity === 'critical') {
          suggestions.push('Switch to simple shader mode');
        }
        break;

      case 'high_memory':
        suggestions.push('Reduce cloud density');
        suggestions.push('Lower animation frequency');
        suggestions.push('Clear fog cache');
        break;

      case 'shader_error':
        suggestions.push('Restart the app');
        suggestions.push('Use fallback rendering mode');
        suggestions.push('Update graphics drivers');
        break;

      case 'rendering_lag':
        suggestions.push('Reduce blur effects');
        suggestions.push('Lower update frequency');
        suggestions.push('Close other apps');
        break;

      case 'battery_drain':
        suggestions.push('Enable battery saver mode');
        suggestions.push('Reduce animation speed');
        suggestions.push('Use static fog mode');
        break;
    }

    // Add device-specific suggestions
    if (Platform.OS === 'android') {
      suggestions.push('Check device temperature');
    } else if (Platform.OS === 'ios') {
      suggestions.push('Check Low Power Mode setting');
    }

    return suggestions;
  }

  /**
   * Log diagnostic information
   */
  private logDiagnostic(message: string, data?: any): void {
    if (!this.config.enableDiagnosticLogging) return;

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}${data ? ` | ${JSON.stringify(data)}` : ''}`;
    
    this.diagnosticLog.push(logEntry);
    
    // Keep only recent log entries
    if (this.diagnosticLog.length > this.maxLogEntries) {
      this.diagnosticLog = this.diagnosticLog.slice(-this.maxLogEntries);
    }

    // Also log to console in development
    if (__DEV__) {
      console.log(`[PerformanceNotification] ${message}`, data || '');
    }
  }
}