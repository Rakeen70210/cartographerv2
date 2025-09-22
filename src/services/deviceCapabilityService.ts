import { Platform, Dimensions, PixelRatio } from 'react-native';
import DeviceInfo from 'react-native-device-info';

export interface DeviceCapabilities {
  tier: 'low' | 'medium' | 'high';
  memoryGB: number;
  screenDensity: number;
  screenSize: 'small' | 'medium' | 'large';
  platform: 'ios' | 'android';
  osVersion: string;
  isTablet: boolean;
  supportedFeatures: {
    highPerformanceAnimations: boolean;
    complexShaders: boolean;
    backgroundProcessing: boolean;
    highResolutionTextures: boolean;
  };
}

export interface PerformanceSettings {
  maxParticles: number;
  animationComplexity: 'low' | 'medium' | 'high';
  fogDetailLevel: number; // 0.1 to 1.0
  cloudLayers: number;
  enableShaders: boolean;
  enableParticleEffects: boolean;
  frameRateTarget: number;
  memoryThresholdMB: number;
}

class DeviceCapabilityService {
  private capabilities: DeviceCapabilities | null = null;
  private performanceSettings: PerformanceSettings | null = null;
  private memoryWarningCount = 0;
  private lastMemoryCheck = 0;
  private readonly MEMORY_CHECK_INTERVAL = 5000; // 5 seconds

  /**
   * Initialize device capability detection
   */
  async initialize(): Promise<DeviceCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    try {
      const { width, height } = Dimensions.get('window');
      const pixelRatio = PixelRatio.get();
      const screenDensity = pixelRatio;
      
      // Get device memory (fallback to estimation if not available)
      let memoryGB = 2; // Default fallback
      try {
        const totalMemory = await DeviceInfo.getTotalMemory();
        memoryGB = Math.round(totalMemory / (1024 * 1024 * 1024));
      } catch (error) {
        console.warn('Could not get device memory, using fallback:', error);
        // Estimate based on device characteristics
        memoryGB = this.estimateMemoryFromDevice();
      }

      // Determine screen size category
      const screenSize = this.categorizeScreenSize(width, height, pixelRatio);
      
      // Check if device is tablet
      const isTablet = await DeviceInfo.isTablet();
      
      // Get OS version
      const osVersion = await DeviceInfo.getSystemVersion();

      // Determine device tier based on multiple factors
      const tier = this.calculateDeviceTier(memoryGB, screenDensity, width * height, osVersion);

      this.capabilities = {
        tier,
        memoryGB,
        screenDensity,
        screenSize,
        platform: Platform.OS as 'ios' | 'android',
        osVersion,
        isTablet,
        supportedFeatures: this.determineSupportedFeatures(tier, memoryGB, Platform.OS)
      };

      console.log('Device capabilities detected:', this.capabilities);
      return this.capabilities;
    } catch (error) {
      console.error('Failed to detect device capabilities:', error);
      // Return safe fallback capabilities
      this.capabilities = this.getFallbackCapabilities();
      return this.capabilities;
    }
  }

  /**
   * Get optimized performance settings based on device capabilities
   */
  getPerformanceSettings(): PerformanceSettings {
    if (!this.capabilities) {
      throw new Error('Device capabilities not initialized. Call initialize() first.');
    }

    if (this.performanceSettings) {
      return this.performanceSettings;
    }

    const { tier, memoryGB, supportedFeatures, isTablet } = this.capabilities;

    let settings: PerformanceSettings;

    switch (tier) {
      case 'high':
        settings = {
          maxParticles: isTablet ? 150 : 100,
          animationComplexity: 'high',
          fogDetailLevel: 1.0,
          cloudLayers: 4,
          enableShaders: true,
          enableParticleEffects: true,
          frameRateTarget: 60,
          memoryThresholdMB: Math.max(512, memoryGB * 1024 * 0.3), // 30% of total memory
        };
        break;

      case 'medium':
        settings = {
          maxParticles: isTablet ? 80 : 60,
          animationComplexity: 'medium',
          fogDetailLevel: 0.7,
          cloudLayers: 3,
          enableShaders: supportedFeatures.complexShaders,
          enableParticleEffects: true,
          frameRateTarget: 45,
          memoryThresholdMB: Math.max(256, memoryGB * 1024 * 0.25), // 25% of total memory
        };
        break;

      case 'low':
      default:
        settings = {
          maxParticles: isTablet ? 40 : 30,
          animationComplexity: 'low',
          fogDetailLevel: 0.4,
          cloudLayers: 2,
          enableShaders: false,
          enableParticleEffects: supportedFeatures.highPerformanceAnimations,
          frameRateTarget: 30,
          memoryThresholdMB: Math.max(128, memoryGB * 1024 * 0.2), // 20% of total memory
        };
        break;
    }

    this.performanceSettings = settings;
    console.log('Performance settings configured:', settings);
    return settings;
  }

  /**
   * Get adaptive settings based on current performance
   */
  getAdaptiveSettings(currentFPS: number, memoryUsageMB: number): Partial<PerformanceSettings> {
    if (!this.performanceSettings) {
      return {};
    }

    const adaptiveSettings: Partial<PerformanceSettings> = {};
    const { frameRateTarget, memoryThresholdMB } = this.performanceSettings;

    // Adapt based on FPS performance
    if (currentFPS < frameRateTarget * 0.8) {
      // Performance is poor, reduce quality
      adaptiveSettings.maxParticles = Math.max(10, Math.floor(this.performanceSettings.maxParticles * 0.7));
      adaptiveSettings.fogDetailLevel = Math.max(0.2, this.performanceSettings.fogDetailLevel * 0.8);
      adaptiveSettings.cloudLayers = Math.max(1, this.performanceSettings.cloudLayers - 1);
      
      if (currentFPS < frameRateTarget * 0.6) {
        // Very poor performance, aggressive reduction
        adaptiveSettings.enableParticleEffects = false;
        adaptiveSettings.enableShaders = false;
        adaptiveSettings.animationComplexity = 'low';
      }
    } else if (currentFPS > frameRateTarget * 1.1 && this.capabilities?.tier !== 'low') {
      // Performance is good, can potentially increase quality
      adaptiveSettings.maxParticles = Math.min(200, Math.floor(this.performanceSettings.maxParticles * 1.1));
      adaptiveSettings.fogDetailLevel = Math.min(1.0, this.performanceSettings.fogDetailLevel * 1.1);
    }

    // Adapt based on memory usage
    if (memoryUsageMB > memoryThresholdMB * 0.9) {
      // High memory usage, reduce memory-intensive features
      adaptiveSettings.maxParticles = Math.max(5, Math.floor((adaptiveSettings.maxParticles || this.performanceSettings.maxParticles) * 0.5));
      adaptiveSettings.cloudLayers = Math.max(1, (adaptiveSettings.cloudLayers || this.performanceSettings.cloudLayers) - 1);
      adaptiveSettings.fogDetailLevel = Math.max(0.1, (adaptiveSettings.fogDetailLevel || this.performanceSettings.fogDetailLevel) * 0.7);
      
      this.memoryWarningCount++;
      if (this.memoryWarningCount > 3) {
        console.warn('Persistent high memory usage detected, enabling aggressive memory management');
        adaptiveSettings.enableParticleEffects = false;
      }
    } else if (memoryUsageMB < memoryThresholdMB * 0.5) {
      // Low memory usage, reset warning count
      this.memoryWarningCount = Math.max(0, this.memoryWarningCount - 1);
    }

    return adaptiveSettings;
  }

  /**
   * Monitor device performance and return current metrics
   */
  async getPerformanceMetrics(): Promise<{
    memoryUsageMB: number;
    availableMemoryMB: number;
    memoryPressure: 'low' | 'medium' | 'high';
  }> {
    const now = Date.now();
    if (now - this.lastMemoryCheck < this.MEMORY_CHECK_INTERVAL) {
      // Return cached values if checked recently
      return {
        memoryUsageMB: 0,
        availableMemoryMB: 0,
        memoryPressure: 'low'
      };
    }

    this.lastMemoryCheck = now;

    try {
      const usedMemory = await DeviceInfo.getUsedMemory();
      const totalMemory = await DeviceInfo.getTotalMemory();
      const availableMemory = totalMemory - usedMemory;
      
      const memoryUsageMB = Math.round(usedMemory / (1024 * 1024));
      const availableMemoryMB = Math.round(availableMemory / (1024 * 1024));
      const usagePercentage = (usedMemory / totalMemory) * 100;

      let memoryPressure: 'low' | 'medium' | 'high';
      if (usagePercentage > 85) {
        memoryPressure = 'high';
      } else if (usagePercentage > 70) {
        memoryPressure = 'medium';
      } else {
        memoryPressure = 'low';
      }

      return {
        memoryUsageMB,
        availableMemoryMB,
        memoryPressure
      };
    } catch (error) {
      console.warn('Could not get memory metrics:', error);
      return {
        memoryUsageMB: 0,
        availableMemoryMB: 0,
        memoryPressure: 'low'
      };
    }
  }

  /**
   * Get current device capabilities
   */
  getCapabilities(): DeviceCapabilities | null {
    return this.capabilities;
  }

  /**
   * Force recalculation of performance settings
   */
  recalculateSettings(): PerformanceSettings {
    this.performanceSettings = null;
    return this.getPerformanceSettings();
  }

  // Private helper methods

  private estimateMemoryFromDevice(): number {
    const { width, height } = Dimensions.get('window');
    const pixelRatio = PixelRatio.get();
    const totalPixels = width * height * pixelRatio * pixelRatio;

    // Rough estimation based on screen resolution and platform
    if (Platform.OS === 'ios') {
      if (totalPixels > 2000000) return 6; // High-end iPhone/iPad
      if (totalPixels > 1000000) return 4; // Mid-range iPhone
      return 3; // Older iPhone
    } else {
      if (totalPixels > 2500000) return 8; // High-end Android
      if (totalPixels > 1500000) return 6; // Mid-range Android
      if (totalPixels > 800000) return 4; // Budget Android
      return 2; // Very low-end Android
    }
  }

  private categorizeScreenSize(width: number, height: number, pixelRatio: number): 'small' | 'medium' | 'large' {
    const totalPixels = width * height * pixelRatio * pixelRatio;
    
    if (totalPixels > 2000000) return 'large';
    if (totalPixels > 800000) return 'medium';
    return 'small';
  }

  private calculateDeviceTier(memoryGB: number, screenDensity: number, screenPixels: number, osVersion: string): 'low' | 'medium' | 'high' {
    let score = 0;

    // Memory score (40% weight)
    if (memoryGB >= 6) score += 40;
    else if (memoryGB >= 4) score += 30;
    else if (memoryGB >= 3) score += 20;
    else score += 10;

    // Screen/GPU score (30% weight)
    if (screenPixels > 2000000 && screenDensity >= 3) score += 30;
    else if (screenPixels > 1000000 && screenDensity >= 2) score += 20;
    else score += 10;

    // OS version score (20% weight)
    const majorVersion = parseInt(osVersion.split('.')[0], 10);
    if (Platform.OS === 'ios') {
      if (majorVersion >= 15) score += 20;
      else if (majorVersion >= 13) score += 15;
      else score += 10;
    } else {
      if (majorVersion >= 11) score += 20;
      else if (majorVersion >= 9) score += 15;
      else score += 10;
    }

    // Platform bonus (10% weight)
    if (Platform.OS === 'ios') score += 10; // iOS generally has better performance optimization

    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
  }

  private determineSupportedFeatures(tier: 'low' | 'medium' | 'high', memoryGB: number, platform: string): DeviceCapabilities['supportedFeatures'] {
    return {
      highPerformanceAnimations: tier !== 'low',
      complexShaders: tier === 'high' || (tier === 'medium' && platform === 'ios'),
      backgroundProcessing: memoryGB >= 3,
      highResolutionTextures: tier === 'high' && memoryGB >= 4,
    };
  }

  private getFallbackCapabilities(): DeviceCapabilities {
    return {
      tier: 'medium',
      memoryGB: 3,
      screenDensity: 2,
      screenSize: 'medium',
      platform: Platform.OS as 'ios' | 'android',
      osVersion: '12.0',
      isTablet: false,
      supportedFeatures: {
        highPerformanceAnimations: true,
        complexShaders: false,
        backgroundProcessing: true,
        highResolutionTextures: false,
      }
    };
  }
}

// Singleton instance
let deviceCapabilityService: DeviceCapabilityService | null = null;

export const getDeviceCapabilityService = (): DeviceCapabilityService => {
  if (!deviceCapabilityService) {
    deviceCapabilityService = new DeviceCapabilityService();
  }
  return deviceCapabilityService;
};

export default DeviceCapabilityService;