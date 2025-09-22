/**
 * Mapbox Custom Layer Implementation for Cloud Rendering
 * Integrates the cloud system with Mapbox GL's custom layer API
 */

import { ICloudRenderingEngine, IShaderSystem, ITextureManager } from '../interfaces';
import { CloudState, ShaderUniforms, MapBounds } from '../../../types/cloud';
import { ExplorationArea } from '../../../types/exploration';

export interface MapboxCloudLayerProps {
  id: string;
  cloudEngine: ICloudRenderingEngine;
  shaderSystem: IShaderSystem;
  textureManager: ITextureManager;
  zIndex?: number;
}

/**
 * Mapbox custom layer for rendering volumetric clouds
 * Implements the Mapbox GL custom layer interface
 */
export class MapboxCloudLayer {
  public readonly id: string;
  public readonly type = 'custom';
  public readonly renderingMode = '3d';
  
  private cloudEngine: ICloudRenderingEngine;
  private shaderSystem: IShaderSystem;
  private textureManager: ITextureManager;
  private gl: WebGLRenderingContext | null = null;
  private map: any = null;
  private initialized = false;
  private zIndex: number;
  
  // Animation frame tracking
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  
  // Layer state
  private visible = true;
  private opacity = 1.0;
  
  constructor(props: MapboxCloudLayerProps) {
    this.id = props.id;
    this.cloudEngine = props.cloudEngine;
    this.shaderSystem = props.shaderSystem;
    this.textureManager = props.textureManager;
    this.zIndex = props.zIndex || 100; // Default z-index above map but below UI
  }

  /**
   * Mapbox custom layer lifecycle method - called when layer is added to map
   */
  onAdd = (map: any, gl: WebGLRenderingContext): void => {
    console.log('🌥️ MapboxCloudLayer: onAdd called');
    
    this.map = map;
    this.gl = gl;
    
    this.initializeCloudSystem().catch(error => {
      console.error('🌥️ Failed to initialize cloud system:', error);
    });
  };

  /**
   * Mapbox custom layer lifecycle method - called when layer is removed
   */
  onRemove = (): void => {
    console.log('🌥️ MapboxCloudLayer: onRemove called');
    
    this.cleanup();
  };

  /**
   * Mapbox custom layer render method - called every frame
   */
  render = (gl: WebGLRenderingContext, matrix: number[]): void => {
    if (!this.initialized || !this.visible) {
      return;
    }

    try {
      // Update animation timing
      const currentTime = performance.now();
      const deltaTime = currentTime - this.lastFrameTime;
      this.lastFrameTime = currentTime;

      // Get current map state
      const mapBounds = this.getMapBounds();
      const zoomLevel = this.map.getZoom();
      
      // Update cloud engine with current map state
      this.cloudEngine.updateMapBounds(mapBounds);
      this.cloudEngine.setZoomLevel(zoomLevel);

      // Prepare shader uniforms
      const uniforms = this.prepareShaderUniforms(matrix, currentTime, zoomLevel);
      
      // Update shader uniforms
      this.shaderSystem.updateUniforms(uniforms);
      
      // Render clouds
      this.renderClouds(gl, matrix);
      
    } catch (error) {
      console.error('🌥️ Error during cloud rendering:', error);
    }
  };

  /**
   * Initialize the cloud rendering system
   */
  private async initializeCloudSystem(): Promise<void> {
    if (!this.gl) {
      throw new Error('WebGL context not available');
    }

    try {
      console.log('🌥️ Initializing cloud system components...');
      
      // Initialize shader system
      await this.shaderSystem.initialize(this.gl);
      console.log('🌥️ Shader system initialized');
      
      // Initialize texture manager
      await this.textureManager.initialize(this.gl);
      console.log('🌥️ Texture manager initialized');
      
      // Initialize cloud engine
      await this.cloudEngine.initialize();
      console.log('🌥️ Cloud engine initialized');
      
      this.initialized = true;
      console.log('🌥️ Cloud system initialization complete');
      
    } catch (error) {
      console.error('🌥️ Cloud system initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get current map bounds in geographic coordinates
   */
  private getMapBounds(): MapBounds {
    if (!this.map) {
      return { north: 90, south: -90, east: 180, west: -180 };
    }

    const bounds = this.map.getBounds();
    return {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest()
    };
  }

  /**
   * Prepare shader uniforms for current frame
   */
  private prepareShaderUniforms(
    matrix: number[], 
    currentTime: number, 
    zoomLevel: number
  ): Partial<ShaderUniforms> {
    // Convert Mapbox matrix to Float32Array
    const viewMatrix = new Float32Array(matrix);
    
    // Create projection matrix (identity for now, can be enhanced)
    const projectionMatrix = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);

    return {
      u_time: currentTime * 0.001, // Convert to seconds
      u_zoomLevel: zoomLevel,
      u_viewMatrix: viewMatrix,
      u_projectionMatrix: projectionMatrix,
      u_cloudOpacity: this.opacity,
      u_cloudDensity: 0.8, // Default density, will be configurable
      u_windVector: [0.1, 0.05], // Default wind vector
      u_dissipationCenter: [0, 0], // Will be updated by animation system
      u_dissipationRadius: 0 // Will be updated by animation system
    };
  }

  /**
   * Render clouds using WebGL
   */
  private renderClouds(gl: WebGLRenderingContext, matrix: number[]): void {
    // Save current WebGL state
    const currentProgram = gl.getParameter(gl.CURRENT_PROGRAM);
    const currentBlend = gl.getParameter(gl.BLEND);
    const currentDepthTest = gl.getParameter(gl.DEPTH_TEST);
    
    try {
      // Set up blending for cloud transparency
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      
      // Enable depth testing for proper layering
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      
      // Get and bind cloud shader program
      const cloudShader = this.shaderSystem.getCloudShader();
      this.shaderSystem.bindShaderProgram(cloudShader);
      
      // Render cloud geometry (placeholder for now)
      // This will be implemented when cloud geometry generation is complete
      this.renderCloudGeometry(gl);
      
    } finally {
      // Restore WebGL state
      gl.useProgram(currentProgram);
      if (!currentBlend) gl.disable(gl.BLEND);
      if (!currentDepthTest) gl.disable(gl.DEPTH_TEST);
    }
  }

  /**
   * Render cloud geometry (placeholder implementation)
   */
  private renderCloudGeometry(gl: WebGLRenderingContext): void {
    // Placeholder: This will render actual cloud geometry once
    // the cloud generation system is integrated
    
    // For now, we just ensure the shader is properly bound
    // The actual geometry rendering will be implemented in later tasks
  }

  /**
   * Update explored areas and trigger cloud dissipation
   */
  public updateExploredAreas(exploredAreas: ExplorationArea[]): void {
    if (!this.initialized) {
      return;
    }

    try {
      this.cloudEngine.updateClouds(exploredAreas);
      
      // Trigger repaint to show changes
      if (this.map) {
        this.map.triggerRepaint();
      }
    } catch (error) {
      console.error('🌥️ Error updating explored areas:', error);
    }
  }

  /**
   * Set layer visibility
   */
  public setVisible(visible: boolean): void {
    this.visible = visible;
    
    if (this.map) {
      this.map.triggerRepaint();
    }
  }

  /**
   * Set layer opacity
   */
  public setOpacity(opacity: number): void {
    this.opacity = Math.max(0, Math.min(1, opacity));
    
    if (this.map) {
      this.map.triggerRepaint();
    }
  }

  /**
   * Get current cloud system state
   */
  public getCloudState(): CloudState | null {
    if (!this.initialized) {
      return null;
    }

    return this.cloudEngine.getState();
  }

  /**
   * Cleanup resources when layer is removed
   */
  private cleanup(): void {
    console.log('🌥️ Cleaning up cloud layer resources...');
    
    // Cancel animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Dispose cloud system components
    try {
      this.cloudEngine.dispose();
      this.shaderSystem.dispose();
      this.textureManager.dispose();
    } catch (error) {
      console.error('🌥️ Error during cleanup:', error);
    }
    
    this.initialized = false;
    this.gl = null;
    this.map = null;
  }

  /**
   * Handle WebGL context loss
   */
  public handleContextLoss(): void {
    console.warn('🌥️ WebGL context lost, reinitializing...');
    
    this.initialized = false;
    
    // Reinitialize when context is restored
    if (this.gl && this.map) {
      this.initializeCloudSystem().catch(error => {
        console.error('🌥️ Failed to reinitialize after context loss:', error);
      });
    }
  }
}