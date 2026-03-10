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
  fogDetailLevel: number;
  cloudLayers: number;
  enableShaders: boolean;
  enableParticleEffects: boolean;
  frameRateTarget: number;
  memoryThresholdMB: number;
}

class DeviceCapabilityService {
  private capabilities: DeviceCapabilities | null = null;
  private performanceSettings: PerformanceSettings | null = null;

  async initialize(): Promise<DeviceCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    const deviceMemory = typeof navigator !== 'undefined' && (navigator as any).deviceMemory
      ? Number((navigator as any).deviceMemory)
      : 4;
    const memoryGB = Math.max(2, Math.round(deviceMemory));

    const screenDensity = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const height = typeof window !== 'undefined' ? window.innerHeight : 768;
    const totalPixels = width * height * screenDensity * screenDensity;

    const screenSize: 'small' | 'medium' | 'large' =
      totalPixels > 2000000 ? 'large' : totalPixels > 800000 ? 'medium' : 'small';

    const isTablet = Math.max(width, height) >= 900;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    const platform: 'ios' | 'android' = /iphone|ipad|mac/.test(ua) ? 'ios' : 'android';
    const osVersion = 'web';

    const tier: 'low' | 'medium' | 'high' = memoryGB >= 6 ? 'high' : memoryGB >= 4 ? 'medium' : 'low';

    this.capabilities = {
      tier,
      memoryGB,
      screenDensity,
      screenSize,
      platform,
      osVersion,
      isTablet,
      supportedFeatures: {
        highPerformanceAnimations: tier !== 'low',
        complexShaders: tier === 'high',
        backgroundProcessing: memoryGB >= 3,
        highResolutionTextures: tier === 'high',
      },
    };

    return this.capabilities;
  }

  getPerformanceSettings(): PerformanceSettings {
    if (this.performanceSettings) {
      return this.performanceSettings;
    }

    const capabilities = this.capabilities ?? {
      tier: 'medium',
      memoryGB: 4,
      screenDensity: 2,
      screenSize: 'medium',
      platform: 'android',
      osVersion: 'web',
      isTablet: false,
      supportedFeatures: {
        highPerformanceAnimations: true,
        complexShaders: false,
        backgroundProcessing: true,
        highResolutionTextures: false,
      },
    };

    const settings: PerformanceSettings = capabilities.tier === 'high'
      ? {
        maxParticles: 100,
        animationComplexity: 'high',
        fogDetailLevel: 1.0,
        cloudLayers: 4,
        enableShaders: true,
        enableParticleEffects: true,
        frameRateTarget: 60,
        memoryThresholdMB: Math.max(512, capabilities.memoryGB * 1024 * 0.3),
      }
      : capabilities.tier === 'low'
        ? {
          maxParticles: 30,
          animationComplexity: 'low',
          fogDetailLevel: 0.5,
          cloudLayers: 2,
          enableShaders: false,
          enableParticleEffects: true,
          frameRateTarget: 30,
          memoryThresholdMB: Math.max(128, capabilities.memoryGB * 1024 * 0.2),
        }
        : {
          maxParticles: 60,
          animationComplexity: 'medium',
          fogDetailLevel: 0.7,
          cloudLayers: 3,
          enableShaders: false,
          enableParticleEffects: true,
          frameRateTarget: 45,
          memoryThresholdMB: Math.max(256, capabilities.memoryGB * 1024 * 0.25),
        };

    this.performanceSettings = settings;
    return settings;
  }

  getAdaptiveSettings(currentFPS: number, memoryUsageMB: number): Partial<PerformanceSettings> {
    if (!this.performanceSettings) return {};
    const adaptive: Partial<PerformanceSettings> = {};

    if (currentFPS < this.performanceSettings.frameRateTarget * 0.8) {
      adaptive.maxParticles = Math.max(10, Math.floor(this.performanceSettings.maxParticles * 0.7));
      adaptive.fogDetailLevel = Math.max(0.2, this.performanceSettings.fogDetailLevel * 0.8);
    }

    if (memoryUsageMB > this.performanceSettings.memoryThresholdMB * 0.9) {
      adaptive.enableParticleEffects = false;
      adaptive.enableShaders = false;
    }

    return adaptive;
  }

  async getPerformanceMetrics(): Promise<{
    memoryUsageMB: number;
    availableMemoryMB: number;
    memoryPressure: 'low' | 'medium' | 'high';
  }> {
    return {
      memoryUsageMB: 0,
      availableMemoryMB: 0,
      memoryPressure: 'low',
    };
  }

  getCapabilities(): DeviceCapabilities | null {
    return this.capabilities;
  }

  recalculateSettings(): PerformanceSettings {
    this.performanceSettings = null;
    return this.getPerformanceSettings();
  }
}

let deviceCapabilityService: DeviceCapabilityService | null = null;

export const getDeviceCapabilityService = (): DeviceCapabilityService => {
  if (!deviceCapabilityService) {
    deviceCapabilityService = new DeviceCapabilityService();
  }
  return deviceCapabilityService;
};

export default DeviceCapabilityService;
