/**
 * Cloud Integration Layer
 * Manages integration between cloud system and Mapbox, handles coordinate conversion
 */

import { ICloudIntegrationLayer, ICloudRenderingEngine } from '../interfaces';
import { MapboxCloudLayer } from './MapboxCloudLayer';
import { CoordinateConverter } from './CoordinateConverter';
import { ViewportManager } from './ViewportManager';
import { MapEventHandler } from './MapEventHandler';
import { CloudPatchManager } from './CloudPatchManager';
import { ExplorationArea } from '../../../types/exploration';
import { MapBounds } from '../../../types/cloud';

export interface CloudIntegrationLayerProps {
  cloudEngine: ICloudRenderingEngine;
  layerId?: string;
}

/**
 * Integration layer that bridges cloud system with Mapbox
 */
export class CloudIntegrationLayer implements ICloudIntegrationLayer {
  private cloudEngine: ICloudRenderingEngine;
  private mapboxLayer: MapboxCloudLayer | null = null;
  private map: any = null;
  private layerId: string;
  
  // Coordinate system components
  private coordinateConverter: CoordinateConverter;
  private viewportManager: ViewportManager;
  
  // Event handling components
  private mapEventHandler: MapEventHandler;
  private cloudPatchManager: CloudPatchManager;

  constructor(props: CloudIntegrationLayerProps) {
    this.cloudEngine = props.cloudEngine;
    this.layerId = props.layerId || 'cloud-fog-layer';
    
    // Initialize coordinate system components
    this.coordinateConverter = new CoordinateConverter();
    this.viewportManager = new ViewportManager();
    
    // Initialize event handling components
    this.mapEventHandler = new MapEventHandler(this.cloudEngine, this.viewportManager);
    this.cloudPatchManager = new CloudPatchManager(this.viewportManager);
    
    // Set up viewport change handlers
    this.setupViewportHandlers();
    
    // Set up cloud patch management
    this.setupCloudPatchHandlers();
  }

  /**
   * Initialize Mapbox integration
   */
  async initializeMapboxIntegration(map: any): Promise<void> {
    console.log('🌥️ Initializing Mapbox integration...');
    
    this.map = map;
    
    try {
      // Create custom layer (will be added to map externally)
      this.mapboxLayer = await this.createCustomLayer();
      
      console.log('🌥️ Mapbox integration initialized successfully');
    } catch (error) {
      console.error('🌥️ Failed to initialize Mapbox integration:', error);
      throw error;
    }
  }

  /**
   * Create Mapbox custom layer for cloud rendering
   */
  createCustomLayer(): MapboxCloudLayer {
    if (!this.cloudEngine) {
      throw new Error('Cloud engine not initialized');
    }

    // Import shader system and texture manager (these will be created by factory)
    // For now, we'll create placeholder implementations
    const shaderSystem = this.createPlaceholderShaderSystem();
    const textureManager = this.createPlaceholderTextureManager();

    const layer = new MapboxCloudLayer({
      id: this.layerId,
      cloudEngine: this.cloudEngine,
      shaderSystem,
      textureManager,
      zIndex: 100 // Render above map but below UI elements
    });

    this.mapboxLayer = layer;
    return layer;
  }

  /**
   * Handle map events for cloud updates
   */
  handleMapEvents(): void {
    if (!this.map) {
      console.warn('🌥️ Map not initialized for event handling');
      return;
    }

    // Initialize map event handler
    this.mapEventHandler.initializeMapEvents(this.map);
    
    console.log('🌥️ Map event handlers registered');
  }

  /**
   * Convert geographic coordinates to WebGL coordinates
   */
  convertCoordinates(geographic: [number, number]): [number, number] {
    const [longitude, latitude] = geographic;
    
    // Use the coordinate converter for accurate projection
    if (this.map && this.map.project) {
      // Use Mapbox's built-in projection when available
      const projected = this.map.project([longitude, latitude]);
      return [projected.x, projected.y];
    } else {
      // Use our coordinate converter as fallback
      return this.coordinateConverter.geographicToWebMercator(longitude, latitude);
    }
  }

  /**
   * Update exploration state and trigger cloud updates
   */
  updateExplorationState(areas: ExplorationArea[]): void {
    if (!this.mapboxLayer) {
      console.warn('🌥️ Mapbox layer not initialized for exploration update');
      return;
    }

    try {
      this.mapboxLayer.updateExploredAreas(areas);
    } catch (error) {
      console.error('🌥️ Error updating exploration state:', error);
    }
  }

  /**
   * Sync with existing fog system (for backward compatibility)
   */
  syncWithFogSystem(): void {
    // This method provides compatibility with the existing fog overlay system
    // It can be used to synchronize state between the new cloud system and
    // the traditional fog overlay during transition period
    
    console.log('🌥️ Syncing with existing fog system...');
    
    // Implementation will depend on how the existing fog system is structured
    // For now, this is a placeholder for future integration
  }

  /**
   * Get the Mapbox layer instance
   */
  getMapboxLayer(): MapboxCloudLayer | null {
    return this.mapboxLayer;
  }

  /**
   * Set layer visibility
   */
  setLayerVisible(visible: boolean): void {
    if (this.mapboxLayer) {
      this.mapboxLayer.setVisible(visible);
    }
  }

  /**
   * Set layer opacity
   */
  setLayerOpacity(opacity: number): void {
    if (this.mapboxLayer) {
      this.mapboxLayer.setOpacity(opacity);
    }
  }

  // Private helper methods

  /**
   * Set up viewport change handlers
   */
  private setupViewportHandlers(): void {
    // Handle viewport changes
    this.viewportManager.onViewportChange((viewport) => {
      // Update cloud engine with new viewport
      this.cloudEngine.updateMapBounds(viewport.bounds);
      this.cloudEngine.setZoomLevel(viewport.zoom);
      
      // Trigger repaint
      if (this.map) {
        this.map.triggerRepaint();
      }
    });
    
    // Handle zoom changes for level-of-detail adjustments
    this.viewportManager.onZoomChange((zoom, previousZoom) => {
      console.log(`🌥️ Zoom changed from ${previousZoom} to ${zoom}`);
      
      // Update cloud detail level based on zoom
      if (this.cloudEngine) {
        this.cloudEngine.setZoomLevel(zoom);
      }
    });
  }

  /**
   * Set up cloud patch management handlers
   */
  private setupCloudPatchHandlers(): void {
    // Handle patch loading
    this.cloudPatchManager.setOnPatchLoaded((patch) => {
      console.log(`🌥️ Cloud patch loaded: ${patch.id}`);
      
      // Trigger repaint to show new patch
      if (this.map) {
        this.map.triggerRepaint();
      }
    });
    
    // Handle patch unloading
    this.cloudPatchManager.setOnPatchUnloaded((patchId) => {
      console.log(`🌥️ Cloud patch unloaded: ${patchId}`);
      
      // Trigger repaint to hide unloaded patch
      if (this.map) {
        this.map.triggerRepaint();
      }
    });
    
    // Handle loading state changes
    this.cloudPatchManager.setOnLoadingStateChange((loading) => {
      console.log(`🌥️ Cloud patch loading state: ${loading ? 'loading' : 'idle'}`);
    });
  }

  /**
   * Get map event handler instance
   */
  public getMapEventHandler(): MapEventHandler {
    return this.mapEventHandler;
  }

  /**
   * Get cloud patch manager instance
   */
  public getCloudPatchManager(): CloudPatchManager {
    return this.cloudPatchManager;
  }

  /**
   * Force update of cloud visibility and patches
   */
  public forceCloudUpdate(): void {
    console.log('🌥️ Forcing cloud system update...');
    
    // Force map event handler update
    this.mapEventHandler.forceCloudUpdate();
    
    // Force patch manager reload
    this.cloudPatchManager.forceReload();
  }

  /**
   * Get cloud loading statistics
   */
  public getLoadingStats(): {
    totalPatches: number;
    loadedPatches: number;
    loadingPatches: number;
    queuedPatches: number;
  } {
    return this.cloudPatchManager.getLoadingStats();
  }

  /**
   * Handle WebGL context loss
   */
  private handleContextLoss(): void {
    console.warn('🌥️ WebGL context lost');
    
    if (this.mapboxLayer) {
      this.mapboxLayer.handleContextLoss();
    }
  }

  /**
   * Handle WebGL context restoration
   */
  private handleContextRestore(): void {
    console.log('🌥️ WebGL context restored');
    
    // Context restoration is handled automatically by MapboxCloudLayer
  }

  /**
   * Get viewport manager instance
   */
  public getViewportManager(): ViewportManager {
    return this.viewportManager;
  }

  /**
   * Get coordinate converter instance
   */
  public getCoordinateConverter(): CoordinateConverter {
    return this.coordinateConverter;
  }

  /**
   * Calculate visible cloud bounds for culling
   */
  public getVisibleCloudBounds(): MapBounds | null {
    const viewport = this.viewportManager.getCurrentViewport();
    if (!viewport) {
      return null;
    }
    
    return viewport.bounds;
  }

  /**
   * Convert meters to pixels at current zoom level
   */
  public metersToPixels(meters: number): number {
    const viewport = this.viewportManager.getCurrentViewport();
    if (!viewport) {
      return meters; // Fallback
    }
    
    return this.coordinateConverter.metersToPixels(
      meters,
      viewport.center[1], // Use center latitude
      viewport.zoom
    );
  }

  /**
   * Create placeholder shader system (will be replaced by actual implementation)
   */
  private createPlaceholderShaderSystem(): any {
    return {
      initialize: async () => {},
      updateUniforms: () => {},
      bindShaderProgram: () => {},
      getCloudShader: () => ({ program: null, uniforms: {}, attributes: {} }),
      dispose: () => {}
    };
  }

  /**
   * Create placeholder texture manager (will be replaced by actual implementation)
   */
  private createPlaceholderTextureManager(): any {
    return {
      initialize: async () => {},
      dispose: () => {}
    };
  }

  /**
   * Clean up all integration layer resources
   */
  public dispose(): void {
    console.log('🌥️ Disposing cloud integration layer...');
    
    try {
      // Dispose event handler
      this.mapEventHandler.dispose();
      
      // Dispose patch manager
      this.cloudPatchManager.dispose();
      
      // Clear references
      this.map = null;
      this.mapboxLayer = null;
      
    } catch (error) {
      console.error('🌥️ Error during integration layer disposal:', error);
    }
  }
}