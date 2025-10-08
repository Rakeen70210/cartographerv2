/**
 * Device Capability Detection System
 * Analyzes device hardware capabilities for cloud rendering optimization using react-native-device-info.
 */

import DeviceInfo from 'react-native-device-info';
import { DeviceCapabilities, PerformanceTier, PerformanceMode } from '../../../types/cloud';

export class DeviceCapabilityDetector {
  private static instance: DeviceCapabilityDetector;
  private cachedCapabilities: DeviceCapabilities | null = null;
  private performanceTiers: PerformanceTier[] = [];

  private constructor() {
    this.initializePerformanceTiers();
  }

  public static getInstance(): DeviceCapabilityDetector {
    if (!DeviceCapabilityDetector.instance) {
      DeviceCapabilityDetector.instance = new DeviceCapabilityDetector();
    }
    return DeviceCapabilityDetector.instance;
  }

  public async detectCapabilities(): Promise<DeviceCapabilities> {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities;
    }

    const totalMemory = await DeviceInfo.getTotalMemory();
    const memoryMB = Math.round(totalMemory / (1024 * 1024));
    const model = DeviceInfo.getModel();
    const deviceId = DeviceInfo.getDeviceId();

    const gpuTier = this.detectGPUTier(model, memoryMB);

    this.cachedCapabilities = {
      gpuTier,
      memoryMB,
      // These are harder to detect reliably in React Native without a GL context
      supportsFloatTextures: gpuTier !== 'low', // Assumption
      maxTextureSize: gpuTier === 'high' ? 4096 : 2048, // Assumption
      webglVersion: 2, // Most modern devices support WebGL 2.0 equivalent via Metal/Vulkan
    };

    return this.cachedCapabilities;
  }

  public getRecommendedPerformanceTier(capabilities: DeviceCapabilities): PerformanceTier {
    const sortedTiers = [...this.performanceTiers].sort((a, b) => 
      this.getTierComplexityScore(a) - this.getTierComplexityScore(b)
    );

    for (let i = sortedTiers.length - 1; i >= 0; i--) {
      const tier = sortedTiers[i];
      if (this.canHandleTier(capabilities, tier)) {
        return tier;
      }
    }

    return sortedTiers[0];
  }

  public getRecommendedPerformanceMode(capabilities: DeviceCapabilities): PerformanceMode {
    const tier = this.getRecommendedPerformanceTier(capabilities);
    
    if (tier.animationQuality === 'high' && capabilities.gpuTier === 'high') {
      return 'high';
    } else if (tier.animationQuality === 'medium' || capabilities.gpuTier === 'medium') {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private detectGPUTier(model: string, memoryMB: number): 'low' | 'medium' | 'high' {
    const modelLower = model.toLowerCase();

    // High-end devices
    if (memoryMB > 4000 || modelLower.includes('pro') || modelLower.includes('max') || modelLower.includes('ultra') || /iphone (1[3-9]|2[0-9])/.test(modelLower)) {
        return 'high';
    }

    // Medium-tier devices
    if (memoryMB > 2000 || /iphone (1[0-2])/.test(modelLower) || modelLower.includes('plus') || modelLower.includes('xr')) {
        return 'medium';
    }

    // Low-end devices
    return 'low';
  }

  private initializePerformanceTiers(): void {
    this.performanceTiers = [
      {
        name: 'low',
        maxCloudCells: 50,
        textureResolution: 256,
        animationQuality: 'low',
        shaderComplexity: 'simple',
        updateFrequency: 15
      },
      {
        name: 'medium',
        maxCloudCells: 150,
        textureResolution: 512,
        animationQuality: 'medium',
        shaderComplexity: 'standard',
        updateFrequency: 30
      },
      {
        name: 'high',
        maxCloudCells: 300,
        textureResolution: 1024,
        animationQuality: 'high',
        shaderComplexity: 'advanced',
        updateFrequency: 60
      }
    ];
  }

  private canHandleTier(capabilities: DeviceCapabilities, tier: PerformanceTier): boolean {
    if (tier.textureResolution > capabilities.maxTextureSize) {
      return false;
    }

    const estimatedMemoryUsage = this.estimateTierMemoryUsage(tier);
    if (estimatedMemoryUsage > capabilities.memoryMB) {
      return false;
    }

    const requiredGPUTier = this.getRequiredGPUTier(tier);
    if (!this.isGPUTierSufficient(capabilities.gpuTier, requiredGPUTier)) {
      return false;
    }

    return true;
  }

  private estimateTierMemoryUsage(tier: PerformanceTier): number {
    const textureMemory = (tier.textureResolution * tier.textureResolution * 4) / (1024 * 1024); // RGBA bytes to MB
    const vertexMemory = (tier.maxCloudCells * 1000 * 4 * 8) / (1024 * 1024); 
    const overhead = 50; 
    
    return textureMemory + vertexMemory + overhead;
  }

  private getRequiredGPUTier(tier: PerformanceTier): 'low' | 'medium' | 'high' {
    if (tier.shaderComplexity === 'advanced') return 'high';
    if (tier.shaderComplexity === 'standard') return 'medium';
    return 'low';
  }

  private isGPUTierSufficient(available: 'low' | 'medium' | 'high', required: 'low' | 'medium' | 'high'): boolean {
    const tierValues = { low: 1, medium: 2, high: 3 };
    return tierValues[available] >= tierValues[required];
  }

  private getTierComplexityScore(tier: PerformanceTier): number {
    const complexityWeights = { simple: 1, standard: 2, advanced: 3 };
    const qualityWeights = { low: 1, medium: 2, high: 3 };
    
    return (
      tier.maxCloudCells * 0.01 +
      tier.textureResolution * 0.001 +
      complexityWeights[tier.shaderComplexity] * 10 +
      qualityWeights[tier.animationQuality] * 5 +
      tier.updateFrequency * 0.1
    );
  }

  public getPerformanceTiers(): PerformanceTier[] {
    return [...this.performanceTiers];
  }

  public getPerformanceTier(name: string): PerformanceTier | null {
    return this.performanceTiers.find(tier => tier.name === name) || null;
  }

  public clearCache(): void {
    this.cachedCapabilities = null;
  }
}
