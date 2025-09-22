/**
 * CloudSystemSettingsManager
 * Comprehensive settings manager that coordinates all cloud system settings
 */

import { CloudSettings, PerformanceMode } from '../../../types/cloud';
import { CloudSettingsManager } from './CloudSettingsManager';
import { PerformanceModeSelector } from './PerformanceModeSelector';
import { VisualCustomizationManager, VisualCustomizationSettings } from './VisualCustomizationManager';

export interface CloudSystemSettings {
  core: CloudSettings;
  performance: {
    mode: PerformanceMode;
    autoDetect: boolean;
    manualOverride: boolean;
  };
  visual: VisualCustomizationSettings;
}

export interface CloudSystemSettingsEvents {
  onSettingsChange: (settings: CloudSystemSettings) => void;
  onPerformanceChange: (mode: PerformanceMode) => void;
  onVisualChange: (visual: VisualCustomizationSettings) => void;
  onError: (error: Error) => void;
}

export class CloudSystemSettingsManager {
  private coreSettingsManager: CloudSettingsManager;
  private performanceModeSelector: PerformanceModeSelector;
  private visualCustomizationManager: VisualCustomizationManager;
  private events: CloudSystemSettingsEvents;
  private isInitialized = false;

  constructor(events: CloudSystemSettingsEvents) {
    this.events = events;
    this.coreSettingsManager = new CloudSettingsManager();
    this.performanceModeSelector = new PerformanceModeSelector();
    this.visualCustomizationManager = new VisualCustomizationManager();
    
    this.setupEventListeners();
  }

  /**
   * Initialize all settings managers
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await Promise.all([
        this.coreSettingsManager.loadSettings(),
        this.performanceModeSelector.initialize(),
        this.visualCustomizationManager.initialize(),
      ]);

      this.isInitialized = true;
      this.notifySettingsChange();
      
      console.log('CloudSystemSettingsManager initialized');
    } catch (error) {
      console.error('Failed to initialize CloudSystemSettingsManager:', error);
      this.events.onError(error instanceof Error ? error : new Error('Initialization failed'));
      throw error;
    }
  }

  /**
   * Get all current settings
   */
  getAllSettings(): CloudSystemSettings {
    const performanceSettings = this.performanceModeSelector.getCurrentSettings();
    
    return {
      core: this.coreSettingsManager.getCurrentSettings(),
      performance: {
        mode: performanceSettings.currentMode,
        autoDetect: performanceSettings.autoDetect,
        manualOverride: performanceSettings.manualOverride,
      },
      visual: this.visualCustomizationManager.getCurrentSettings(),
    };
  }

  /**
   * Get final cloud settings with all customizations applied
   */
  getFinalCloudSettings(): CloudSettings {
    const coreSettings = this.coreSettingsManager.getCurrentSettings();
    const performanceSettings = this.performanceModeSelector.getCurrentSettings();
    
    // Apply performance mode adjustments
    const performanceAdjustedSettings = this.applyPerformanceAdjustments(
      coreSettings, 
      performanceSettings.currentMode
    );
    
    // Apply visual customizations
    const finalSettings = this.visualCustomizationManager.getAppliedCloudSettings(
      performanceAdjustedSettings
    );
    
    return finalSettings;
  }

  /**
   * Get shader uniforms with all visual customizations
   */
  getShaderUniforms(): Record<string, any> {
    const finalSettings = this.getFinalCloudSettings();
    const visualUniforms = this.visualCustomizationManager.getVisualUniforms();
    
    return {
      // Core settings uniforms
      u_cloudDensity: finalSettings.density,
      u_animationSpeed: finalSettings.animationSpeed,
      u_cloudOpacity: finalSettings.opacity,
      u_cloudContrast: finalSettings.contrast,
      
      // Visual customization uniforms
      ...visualUniforms,
      
      // Performance mode indicator
      u_performanceMode: this.getPerformanceModeValue(this.performanceModeSelector.getCurrentSettings().currentMode),
    };
  }

  /**
   * Update core cloud settings
   */
  async updateCoreSettings(settings: Partial<CloudSettings>): Promise<void> {
    try {
      const currentSettings = this.coreSettingsManager.getCurrentSettings();
      const newSettings = { ...currentSettings, ...settings };
      await this.coreSettingsManager.saveSettings(newSettings);
    } catch (error) {
      this.events.onError(error instanceof Error ? error : new Error('Failed to update core settings'));
      throw error;
    }
  }

  /**
   * Update performance mode
   */
  async updatePerformanceMode(mode: PerformanceMode, manual: boolean = true): Promise<void> {
    try {
      await this.performanceModeSelector.setPerformanceMode(mode, manual);
    } catch (error) {
      this.events.onError(error instanceof Error ? error : new Error('Failed to update performance mode'));
      throw error;
    }
  }

  /**
   * Update visual customization
   */
  async updateVisualCustomization(updates: Partial<VisualCustomizationSettings>): Promise<void> {
    try {
      for (const [key, value] of Object.entries(updates)) {
        await this.visualCustomizationManager.updateVisualProperty(
          key as keyof VisualCustomizationSettings,
          value
        );
      }
    } catch (error) {
      this.events.onError(error instanceof Error ? error : new Error('Failed to update visual customization'));
      throw error;
    }
  }

  /**
   * Enable/disable auto performance detection
   */
  async setAutoPerformanceDetection(enabled: boolean): Promise<void> {
    try {
      await this.performanceModeSelector.setAutoDetection(enabled);
    } catch (error) {
      this.events.onError(error instanceof Error ? error : new Error('Failed to set auto detection'));
      throw error;
    }
  }

  /**
   * Perform auto performance detection
   */
  async performAutoDetection(): Promise<PerformanceMode> {
    try {
      return await this.performanceModeSelector.performAutoDetection();
    } catch (error) {
      this.events.onError(error instanceof Error ? error : new Error('Auto detection failed'));
      throw error;
    }
  }

  /**
   * Get performance suggestions
   */
  getPerformanceSuggestions(): string[] {
    return this.performanceModeSelector.getPerformanceSuggestions();
  }

  /**
   * Get available performance modes
   */
  getAvailablePerformanceModes() {
    return this.performanceModeSelector.getAvailablePerformanceModes();
  }

  /**
   * Get available color schemes
   */
  getColorSchemes() {
    return this.visualCustomizationManager.getColorSchemes();
  }

  /**
   * Get available style presets
   */
  getStylePresets() {
    return this.visualCustomizationManager.getStylePresets();
  }

  /**
   * Export all settings
   */
  exportAllSettings(): string {
    const allSettings = this.getAllSettings();
    return JSON.stringify({
      settings: allSettings,
      timestamp: Date.now(),
      version: '1.0',
    });
  }

  /**
   * Import all settings
   */
  async importAllSettings(settingsJson: string): Promise<void> {
    try {
      const imported = JSON.parse(settingsJson);
      
      if (!imported.settings) {
        throw new Error('Invalid settings format');
      }
      
      const { core, performance, visual } = imported.settings;
      
      // Import core settings
      if (core) {
        await this.coreSettingsManager.saveSettings(core);
      }
      
      // Import performance settings
      if (performance) {
        await this.performanceModeSelector.setPerformanceMode(performance.mode, performance.manualOverride);
        if (performance.autoDetect !== undefined) {
          await this.performanceModeSelector.setAutoDetection(performance.autoDetect);
        }
      }
      
      // Import visual settings
      if (visual) {
        await this.visualCustomizationManager.importSettings(JSON.stringify({ settings: visual }));
      }
      
      this.notifySettingsChange();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Import failed';
      this.events.onError(new Error(`Failed to import settings: ${errorMessage}`));
      throw error;
    }
  }

  /**
   * Reset all settings to defaults
   */
  async resetAllToDefaults(): Promise<void> {
    try {
      await Promise.all([
        this.coreSettingsManager.resetToDefaults(),
        this.performanceModeSelector.setAutoDetection(true),
        this.visualCustomizationManager.resetToDefaults(),
      ]);
      
      this.notifySettingsChange();
    } catch (error) {
      this.events.onError(error instanceof Error ? error : new Error('Failed to reset settings'));
      throw error;
    }
  }

  /**
   * Check if settings are valid and compatible
   */
  validateSettings(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Validate core settings
    const coreSettings = this.coreSettingsManager.getCurrentSettings();
    if (!this.coreSettingsManager.validateSettings(coreSettings)) {
      issues.push('Core settings are invalid');
    }
    
    // Check performance mode compatibility
    const performanceSettings = this.performanceModeSelector.getCurrentSettings();
    if (!this.performanceModeSelector.isModeSupported(performanceSettings.currentMode)) {
      issues.push(`Performance mode '${performanceSettings.currentMode}' may not be supported on this device`);
    }
    
    // Add performance suggestions as potential issues
    const suggestions = this.getPerformanceSuggestions();
    issues.push(...suggestions);
    
    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Dispose of all managers
   */
  dispose(): void {
    this.coreSettingsManager.dispose();
    this.performanceModeSelector.dispose();
    this.visualCustomizationManager.dispose();
    this.isInitialized = false;
  }

  /**
   * Setup event listeners for all managers
   */
  private setupEventListeners(): void {
    // Core settings changes
    this.coreSettingsManager.addSettingsListener(() => {
      this.notifySettingsChange();
    });
    
    // Performance mode changes
    this.performanceModeSelector.addListener((settings) => {
      this.events.onPerformanceChange(settings.currentMode);
      this.notifySettingsChange();
    });
    
    // Visual customization changes
    this.visualCustomizationManager.addListener((settings) => {
      this.events.onVisualChange(settings);
      this.notifySettingsChange();
    });
  }

  /**
   * Apply performance mode adjustments to core settings
   */
  private applyPerformanceAdjustments(
    coreSettings: CloudSettings, 
    performanceMode: PerformanceMode
  ): CloudSettings {
    const adjustments = this.coreSettingsManager.getRecommendedSettingsForDevice(performanceMode);
    
    return {
      ...coreSettings,
      ...adjustments,
    };
  }

  /**
   * Get numeric value for performance mode (for shaders)
   */
  private getPerformanceModeValue(mode: PerformanceMode): number {
    const values = { low: 0, medium: 1, high: 2 };
    return values[mode];
  }

  /**
   * Notify about settings changes
   */
  private notifySettingsChange(): void {
    try {
      const allSettings = this.getAllSettings();
      this.events.onSettingsChange(allSettings);
    } catch (error) {
      console.error('Error notifying settings change:', error);
    }
  }
}