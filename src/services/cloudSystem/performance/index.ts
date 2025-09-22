/**
 * Performance Management Module
 * Contains device capability detection and optimization
 */

// Main performance manager implementation
export { PerformanceManager } from './PerformanceManager';
export type { PerformanceManagerConfig, PerformanceMetrics } from './PerformanceManager';

// Device capability detection
export { DeviceCapabilityDetector } from './DeviceCapabilityDetector';

// Frame rate monitoring
export { FrameRateMonitor } from './FrameRateMonitor';
export type { FrameRateMetrics } from './FrameRateMonitor';

// WebGL feature detection
export { WebGLFeatureDetector } from './WebGLFeatureDetector';
export type { WebGLCapabilities, WebGLExtensionSupport } from './WebGLFeatureDetector';

// Level of Detail system
export { LODSystem } from './LODSystem';
export type { LODLevel, LODConfiguration, CullingResult } from './LODSystem';

// Memory management system
export { MemoryManager } from './MemoryManager';
export type { 
  TexturePoolEntry, 
  CloudResourceEntry, 
  MemoryUsageStats, 
  MemoryManagerConfig 
} from './MemoryManager';

// Integrated performance optimizer
export { PerformanceOptimizer } from './PerformanceOptimizer';
export type { PerformanceOptimizerConfig, OptimizationResult } from './PerformanceOptimizer';