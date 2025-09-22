/**
 * PerformanceModeSelector
 * Manages performance mode selection with automatic detection and manual overrides
 */

import { PerformanceMode, DeviceCapabilities, PerformanceTier } from '../../../types/cloud';
import { PerformanceManager } from '../performance/PerformanceManager';
import { DeviceCapabilityDetector } from '../performance/DeviceCapabilityDetector';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERFORMANCE_MODE_KEY = 'cloud_performance_mode';
const PERFORMANCE_AUTO_KEY = 'cloud_performance_auto';

export interface PerformanceModeInfo {
  mode: PerformanceMode;
  name: string;
  description: string;
  recommended: boolean;
  tier: PerformanceTier | null;
  capabilities: DeviceCapabilities | null;
}

export interface PerformanceModeSettings {
  currentMode: PerformanceMode;
  autoDetect: boolean;
  manualOverride: boolean;
  lastAutoDetection: number;
}

export class PerformanceModeSelector {
  private performanceManager: PerformanceManager;
  private capabilityDetector: DeviceCapabilityDetector;
  private currentSettings: PerformanceModeSettings;
  private listeners: Set<(settings: PerformanceModeSettings) => void> = new Set();
  private isInitialized = false;

  constructor(performanceManager?: PerformanceManager) {
    this.performanceManager = performanceManager || new PerformanceManager();
    this.capabilityDetector = DeviceCapabilityDetector.getInstance();
    
    this.currentSettings = {
      currentMode: 'medium',
      autoDetect: true,
      manualOverride: false,
      lastAutoDetection: 0,
    };
  }

  /**
   * Initialize the performance mode selector
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize performance manager
      await this.performanceManager.initialize();
      
      // Load saved settings
      await this.loadSettings();
      
      // Perform auto-detection if enabled
      if (this.currentSettings.autoDetect) {
        await this.performAutoDetection();
      }

      this.isInitialized = true;
      console.log('PerformanceModeSelector initialized:', this.currentSettings);
    } catch (error) {
      console.error('Failed to initialize PerformanceModeSelector:', error);
      // Use fallback settings
      this.currentSettings.currentMode = 'low';
      this.isInitialized = true;
    }
  }

  /**
   * Get available performance modes with information
   */
  getAvailablePerformanceModes(): PerformanceModeInfo[] {
    const capabilities = this.performanceManager.getDeviceCapabilities();
    const recommendedMode = this.getRecommendedMode();

    const modes: PerformanceModeInfo[] = [
      {
        mode: 'low',
        name: 'Performance',
        description: 'Optimized for battery life and older devices. Reduced visual quality but smooth performance.',
        recommended: recommendedMode === 'low',
        tier: this.capabilityDetector.getPerformanceTier('low'),
        capabilities,
      },
      {
        mode: 'medium',
        name: 'Balanced',
        description: 'Good balance between visual quality and performance. Recommended for most devices.',
        recommended: recommendedMode === 'medium',
        tier: this.capabilityDetector.getPerformanceTier('medium'),
        capabilities,
      },
      {
        mode: 'high',
        name: 'Quality',
        description: 'Maximum visual quality with advanced effects. Requires powerful hardware.',
        recommended: recommendedMode === 'high',
        tier: this.capabilityDetector.getPerformanceTier('high'),
        capabilities,
      },
    ];

    return modes;
  }

  /**
   * Get current performance mode settings
   */
  getCurrentSettings(): PerformanceModeSettings {
    return { ...this.currentSettings };
  }

  /**
   * Set performance mode manually
   */
  async setPerformanceMode(mode: PerformanceMode, manualOverride: boolean = true): Promise<void> {
    try {
      this.currentSettings.currentMode = mode;
      this.currentSettings.manualOverride = manualOverride;
      
      // If manual override, disable auto-detection
      if (manualOverride) {
        this.currentSettings.autoDetect = false;
      }

      // Apply to performance manager
      this.performanceManager.setPerformanceMode(mode);
      
      // Save settings
      await this.saveSettings();
      
      // Notify listeners
      this.notifyListeners();
      
      console.log(`Performance mode set to: ${mode} (manual: ${manualOverride})`);
    } catch (error) {
      console.error('Failed to set performance mode:', error);
      throw error;
    }
  }

  /**
   * Enable or disable automatic performance detection
   */
  async setAutoDetection(enabled: boolean): Promise<void> {
    try {
      this.currentSettings.autoDetect = enabled;
      
      if (enabled) {
        this.currentSettings.manualOverride = false;
        await this.performAutoDetection();
      }
      
      await this.saveSettings();
      this.notifyListeners();
      
      console.log(`Auto-detection ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to set auto-detection:', error);
      throw error;
    }
  }

  /**
   * Perform automatic performance mode detection
   */
  async performAutoDetection(): Promise<PerformanceMode> {
    try {
      const recommendedMode = this.getRecommendedMode();
      
      if (recommendedMode !== this.currentSettings.currentMode) {
        console.log(`Auto-detection recommends: ${recommendedMode} (current: ${this.currentSettings.currentMode})`);
        
        this.currentSettings.currentMode = recommendedMode;
        this.currentSettings.lastAutoDetection = Date.now();
        this.currentSettings.manualOverride = false;
        
        // Apply to performance manager
        this.performanceManager.setPerformanceMode(recommendedMode);
        
        // Save and notify
        await this.saveSettings();
        this.notifyListeners();
      }
      
      return recommendedMode;
    } catch (error) {
      console.error('Auto-detection failed:', error);
      return this.currentSettings.currentMode;
    }
  }

  /**
   * Get recommended performance mode based on device capabilities and current performance
   */
  getRecommendedMode(): PerformanceMode {
    // Use performance manager's recommendation which considers current performance
    return this.performanceManager.getRecommendedPerformanceMode();
  }

  /**
   * Get performance suggestions for the user
   */
  getPerformanceSuggestions(): string[] {
    const suggestions: string[] = [];
    const capabilities = this.performanceManager.getDeviceCapabilities();
    const currentMode = this.currentSettings.currentMode;
    const recommendedMode = this.getRecommendedMode();
    const isPerformanceGood = this.performanceManager.isPerformanceAcceptable();

    // Add performance manager recommendations
    suggestions.push(...this.performanceManager.getPerformanceRecommendations());

    // Mode-specific suggestions
    if (currentMode !== recommendedMode) {
      if (recommendedMode === 'low') {
        suggestions.push(`Consider switching to Performance mode for better frame rates`);
      } else if (recommendedMode === 'high' && currentMode !== 'high') {
        suggestions.push(`Your device can handle Quality mode for better visuals`);
      }
    }

    // Auto-detection suggestions
    if (!this.currentSettings.autoDetect && !isPerformanceGood) {
      suggestions.push('Enable auto-detection to automatically optimize performance');
    }

    // Device-specific suggestions
    if (capabilities) {
      if (capabilities.gpuTier === 'low' && currentMode === 'high') {
        suggestions.push('Quality mode may cause performance issues on this device');
      }
      
      if (capabilities.memoryMB < 512 && currentMode !== 'low') {
        suggestions.push('Consider Performance mode due to limited device memory');
      }
    }

    return suggestions;
  }

  /**
   * Check if a performance mode is suitable for the current device
   */
  isModeSupported(mode: PerformanceMode): boolean {
    const capabilities = this.performanceManager.getDeviceCapabilities();
    if (!capabilities) return true; // Assume supported if we can't detect

    const tier = this.capabilityDetector.getPerformanceTier(mode);
    if (!tier) return true;

    // Check basic compatibility
    const estimatedMemory = this.estimateModeMemoryUsage(mode);
    if (estimatedMemory > capabilities.memoryMB) {
      return false;
    }

    // Check texture size support
    if (tier.textureResolution > capabilities.maxTextureSize) {
      return false;
    }

    return true;
  }

  /**
   * Get performance mode compatibility info
   */
  getModeCompatibility(mode: PerformanceMode): {
    supported: boolean;
    warnings: string[];
    requirements: string[];
  } {
    const warnings: string[] = [];
    const requirements: string[] = [];
    const capabilities = this.performanceManager.getDeviceCapabilities();
    const tier = this.capabilityDetector.getPerformanceTier(mode);

    if (!capabilities || !tier) {
      return { supported: true, warnings: ['Unable to detect device capabilities'], requirements: [] };
    }

    const estimatedMemory = this.estimateModeMemoryUsage(mode);
    
    // Memory requirements
    requirements.push(`Memory: ~${Math.round(estimatedMemory)}MB`);
    if (estimatedMemory > capabilities.memoryMB) {
      warnings.push(`May exceed available memory (${capabilities.memoryMB}MB)`);
    }

    // Texture requirements
    requirements.push(`Max texture size: ${tier.textureResolution}px`);
    if (tier.textureResolution > capabilities.maxTextureSize) {
      warnings.push(`Requires texture size larger than supported (${capabilities.maxTextureSize}px)`);
    }

    // GPU requirements
    const requiredGPU = mode === 'high' ? 'high' : mode === 'medium' ? 'medium' : 'low';
    requirements.push(`GPU tier: ${requiredGPU} or better`);
    if (this.getGPUTierValue(capabilities.gpuTier) < this.getGPUTierValue(requiredGPU)) {
      warnings.push(`May not perform well on ${capabilities.gpuTier}-tier GPU`);
    }

    return {
      supported: warnings.length === 0,
      warnings,
      requirements,
    };
  }

  /**
   * Add listener for settings changes
   */
  addListener(listener: (settings: PerformanceModeSettings) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove settings listener
   */
  removeListener(listener: (settings: PerformanceModeSettings) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Dispose of the selector
   */
  dispose(): void {
    this.listeners.clear();
    this.performanceManager.dispose();
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const [modeData, autoData] = await Promise.all([
        AsyncStorage.getItem(PERFORMANCE_MODE_KEY),
        AsyncStorage.getItem(PERFORMANCE_AUTO_KEY),
      ]);

      if (modeData) {
        const savedSettings = JSON.parse(modeData);
        this.currentSettings = { ...this.currentSettings, ...savedSettings };
      }

      if (autoData) {
        this.currentSettings.autoDetect = JSON.parse(autoData);
      }
    } catch (error) {
      console.error('Failed to load performance settings:', error);
    }
  }

  /**
   * Save settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(PERFORMANCE_MODE_KEY, JSON.stringify(this.currentSettings)),
        AsyncStorage.setItem(PERFORMANCE_AUTO_KEY, JSON.stringify(this.currentSettings.autoDetect)),
      ]);
    } catch (error) {
      console.error('Failed to save performance settings:', error);
    }
  }

  /**
   * Notify all listeners of settings changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentSettings);
      } catch (error) {
        console.error('Error in performance mode listener:', error);
      }
    });
  }

  /**
   * Estimate memory usage for a performance mode
   */
  private estimateModeMemoryUsage(mode: PerformanceMode): number {
    const tier = this.capabilityDetector.getPerformanceTier(mode);
    if (!tier) return 100; // Fallback estimate

    // Rough estimation: texture memory + vertex data + overhead
    const textureMemory = (tier.textureResolution * tier.textureResolution * 4) / (1024 * 1024);
    const vertexMemory = (tier.maxCloudCells * 1000 * 4 * 8) / (1024 * 1024);
    const overhead = 50;
    
    return textureMemory + vertexMemory + overhead;
  }

  /**
   * Get numeric value for GPU tier comparison
   */
  private getGPUTierValue(tier: 'low' | 'medium' | 'high'): number {
    const values = { low: 1, medium: 2, high: 3 };
    return values[tier];
  }
}