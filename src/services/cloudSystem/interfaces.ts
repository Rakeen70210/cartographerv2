/**
 * Core interfaces for Cloud System components
 * Defines the contracts for cloud rendering engine, generators, and managers
 */

import {
  CloudPatch,
  CloudGeneratorConfig,
  CloudState,
  CloudSettings,
  PerformanceMode,
  MapBounds,
  CloudGeographicArea,
  AnimationState,
  DissipationAnimation,
  ShaderUniforms,
  CloudShaderProgram,
  DeviceCapabilities,
  CloudSystemEvents
} from '../../types';
import { ExplorationArea } from '../../types/exploration';

// Main cloud rendering engine interface
export interface ICloudRenderingEngine {
  initialize(): Promise<void>;
  updateClouds(exploredAreas: ExplorationArea[]): void;
  animateCloudDissipation(area: CloudGeographicArea): Promise<void>;
  setPerformanceMode(mode: PerformanceMode): void;
  updateMapBounds(bounds: MapBounds): void;
  setZoomLevel(zoom: number): void;
  dispose(): void;
  getState(): CloudState;
}

// Procedural cloud generator interface
export interface IProceduralCloudGenerator {
  generateCloudPatch(bounds: MapBounds, config: CloudGeneratorConfig): CloudPatch;
  updateCloudDensity(patch: CloudPatch, density: number): void;
  generateNoisePattern(width: number, height: number, config: CloudGeneratorConfig): Float32Array;
  calculateCloudCoverage(area: CloudGeographicArea): number;
}

// Shader system interface
export interface IShaderSystem {
  initialize(gl: WebGLRenderingContext): Promise<void>;
  compileCloudShaders(): Promise<CloudShaderProgram>;
  updateUniforms(uniforms: Partial<ShaderUniforms>): void;
  bindShaderProgram(program: CloudShaderProgram): void;
  getCloudShader(): CloudShaderProgram;
  dispose(): void;
}

// Animation controller interface
export interface IAnimationController {
  startCloudDrift(windSpeed: number, direction: number): void;
  stopCloudDrift(): void;
  animateDissipation(animation: DissipationAnimation): Promise<void>;
  updateMorphing(speed: number): void;
  getAnimationState(): AnimationState;
  setAnimationQuality(quality: 'low' | 'medium' | 'high'): void;
  dispose(): void;
}

// Performance manager interface
export interface IPerformanceManager {
  detectDeviceCapabilities(): Promise<DeviceCapabilities>;
  getRecommendedPerformanceMode(): PerformanceMode;
  optimizeForPerformance(mode: PerformanceMode): void;
  monitorFrameRate(): void;
  getFrameRate(): number;
  adjustQualityBasedOnPerformance(): void;
}

// Texture manager interface
export interface ITextureManager {
  initialize(gl: WebGLRenderingContext): Promise<void>;
  loadCloudTextures(): Promise<void>;
  createTextureAtlas(): Promise<void>;
  getCloudTexture(type: string): WebGLTexture | null;
  updateTextureResolution(resolution: number): void;
  dispose(): void;
}

// Integration layer interface
export interface ICloudIntegrationLayer {
  initializeMapboxIntegration(map: any): Promise<void>;
  createCustomLayer(): any; // Mapbox custom layer
  handleMapEvents(): void;
  convertCoordinates(geographic: [number, number]): [number, number];
  updateExplorationState(areas: ExplorationArea[]): void;
  syncWithFogSystem(): void;
}

// Settings interface
export interface ICloudSettingsManager {
  loadSettings(): Promise<CloudSettings>;
  saveSettings(settings: CloudSettings): Promise<void>;
  getDefaultSettings(): CloudSettings;
  validateSettings(settings: Partial<CloudSettings>): boolean;
  applySettings(settings: CloudSettings): void;
}

// Component props interfaces
export interface CloudRenderingEngineProps {
  exploredAreas: ExplorationArea[];
  mapBounds: MapBounds;
  zoomLevel: number;
  performanceMode: PerformanceMode;
  settings: CloudSettings;
  events: CloudSystemEvents;
}

export interface CloudSystemProps {
  enabled: boolean;
  settings: CloudSettings;
  exploredAreas: ExplorationArea[];
  onStateChange: (state: CloudState) => void;
  onError: (error: Error) => void;
}

// Factory interface for creating cloud system components
export interface ICloudSystemFactory {
  createRenderingEngine(props: CloudRenderingEngineProps): ICloudRenderingEngine;
  createCloudGenerator(config: CloudGeneratorConfig): IProceduralCloudGenerator;
  createShaderSystem(): IShaderSystem;
  createAnimationController(): IAnimationController;
  createPerformanceManager(): IPerformanceManager;
  createTextureManager(): ITextureManager;
  createIntegrationLayer(): ICloudIntegrationLayer;
  createSettingsManager(): ICloudSettingsManager;
}