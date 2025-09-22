/**
 * Map Event Handler for Cloud System
 * Manages map events and triggers appropriate cloud system updates
 */

import { ICloudRenderingEngine } from '../interfaces';
import { ViewportManager } from './ViewportManager';
import { MapBounds } from '../../../types/cloud';

export interface MapEventConfig {
  enableCloudCulling: boolean;
  cullPadding: number; // Percentage padding for culling bounds
  updateThrottleMs: number; // Throttle map updates
  zoomThreshold: number; // Minimum zoom change to trigger updates
  moveThreshold: number; // Minimum move distance to trigger updates (in degrees)
}

export interface CloudVisibilityState {
  visibleClouds: Set<string>;
  culledClouds: Set<string>;
  loadingClouds: Set<string>;
}

/**
 * Handles map events and manages cloud visibility and loading
 */
export class MapEventHandler {
  private map: any = null;
  private cloudEngine: ICloudRenderingEngine;
  private viewportManager: ViewportManager;
  private config: MapEventConfig;
  
  // Event throttling
  private updateTimeout: NodeJS.Timeout | null = null;
  private lastUpdateTime = 0;
  
  // State tracking
  private lastViewport: {
    center: [number, number];
    zoom: number;
    bounds: MapBounds;
  } | null = null;
  
  private visibilityState: CloudVisibilityState = {
    visibleClouds: new Set(),
    culledClouds: new Set(),
    loadingClouds: new Set()
  };
  
  // Event listeners
  private eventListeners: Array<() => void> = [];
  
  // Callbacks
  private onCloudVisibilityChange?: (state: CloudVisibilityState) => void;
  private onCloudLoadingChange?: (loading: boolean) => void;

  constructor(
    cloudEngine: ICloudRenderingEngine,
    viewportManager: ViewportManager,
    config?: Partial<MapEventConfig>
  ) {
    this.cloudEngine = cloudEngine;
    this.viewportManager = viewportManager;
    
    // Default configuration
    this.config = {
      enableCloudCulling: true,
      cullPadding: 0.2, // 20% padding
      updateThrottleMs: 100, // 100ms throttle
      zoomThreshold: 0.1,
      moveThreshold: 0.001, // ~100m at equator
      ...config
    };
  }

  /**
   * Initialize event handling for a Mapbox map instance
   */
  initializeMapEvents(map: any): void {
    console.log('🌥️ Initializing map event handlers...');
    
    this.map = map;
    
    // Set up event listeners
    this.setupMapEventListeners();
    
    // Initial viewport update
    this.handleInitialLoad();
    
    console.log('🌥️ Map event handlers initialized');
  }

  /**
   * Set up all map event listeners
   */
  private setupMapEventListeners(): void {
    if (!this.map) {
      return;
    }

    // Movement events
    const moveHandler = this.throttledUpdate.bind(this, 'move');
    this.map.on('move', moveHandler);
    this.eventListeners.push(() => this.map.off('move', moveHandler));

    const moveEndHandler = this.handleMoveEnd.bind(this);
    this.map.on('moveend', moveEndHandler);
    this.eventListeners.push(() => this.map.off('moveend', moveEndHandler));

    // Zoom events
    const zoomHandler = this.throttledUpdate.bind(this, 'zoom');
    this.map.on('zoom', zoomHandler);
    this.eventListeners.push(() => this.map.off('zoom', zoomHandler));

    const zoomEndHandler = this.handleZoomEnd.bind(this);
    this.map.on('zoomend', zoomEndHandler);
    this.eventListeners.push(() => this.map.off('zoomend', zoomEndHandler));

    // Rotation events
    const rotateHandler = this.throttledUpdate.bind(this, 'rotate');
    this.map.on('rotate', rotateHandler);
    this.eventListeners.push(() => this.map.off('rotate', rotateHandler));

    // Resize events
    const resizeHandler = this.handleResize.bind(this);
    this.map.on('resize', resizeHandler);
    this.eventListeners.push(() => this.map.off('resize', resizeHandler));

    // Data loading events
    const dataLoadingHandler = this.handleDataLoading.bind(this);
    this.map.on('dataloading', dataLoadingHandler);
    this.eventListeners.push(() => this.map.off('dataloading', dataLoadingHandler));

    const dataHandler = this.handleData.bind(this);
    this.map.on('data', dataHandler);
    this.eventListeners.push(() => this.map.off('data', dataHandler));

    // WebGL context events
    const contextLostHandler = this.handleContextLost.bind(this);
    this.map.on('webglcontextlost', contextLostHandler);
    this.eventListeners.push(() => this.map.off('webglcontextlost', contextLostHandler));

    const contextRestoredHandler = this.handleContextRestored.bind(this);
    this.map.on('webglcontextrestored', contextRestoredHandler);
    this.eventListeners.push(() => this.map.off('webglcontextrestored', contextRestoredHandler));
  }

  /**
   * Handle initial map load
   */
  private handleInitialLoad(): void {
    console.log('🌥️ Handling initial map load...');
    
    // Update viewport immediately
    this.updateViewportFromMap();
    
    // Perform initial cloud visibility calculation
    this.updateCloudVisibility();
  }

  /**
   * Throttled update handler for frequent events
   */
  private throttledUpdate(eventType: string): void {
    const now = Date.now();
    
    // Clear existing timeout
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    
    // Throttle updates
    if (now - this.lastUpdateTime < this.config.updateThrottleMs) {
      this.updateTimeout = setTimeout(() => {
        this.handleMapUpdate(eventType);
      }, this.config.updateThrottleMs);
    } else {
      this.handleMapUpdate(eventType);
    }
  }

  /**
   * Handle map updates (move, zoom, rotate)
   */
  private handleMapUpdate(eventType: string): void {
    this.lastUpdateTime = Date.now();
    
    // Update viewport
    this.updateViewportFromMap();
    
    // Check if update is significant enough to trigger cloud updates
    if (this.isSignificantChange()) {
      console.log(`🌥️ Significant ${eventType} detected, updating clouds...`);
      
      // Update cloud visibility
      this.updateCloudVisibility();
      
      // Update last viewport
      this.updateLastViewport();
    }
  }

  /**
   * Handle move end event
   */
  private handleMoveEnd(): void {
    console.log('🌥️ Map move ended');
    
    // Force update on move end to ensure accuracy
    this.updateViewportFromMap();
    this.updateCloudVisibility();
    this.updateLastViewport();
  }

  /**
   * Handle zoom end event
   */
  private handleZoomEnd(): void {
    console.log('🌥️ Map zoom ended');
    
    // Update viewport and trigger cloud level-of-detail changes
    this.updateViewportFromMap();
    this.updateCloudVisibility();
    this.updateLastViewport();
    
    // Notify cloud engine of zoom change for LOD updates
    const viewport = this.viewportManager.getCurrentViewport();
    if (viewport) {
      this.cloudEngine.setZoomLevel(viewport.zoom);
    }
  }

  /**
   * Handle map resize event
   */
  private handleResize(): void {
    console.log('🌥️ Map resized');
    
    // Update viewport with new screen dimensions
    setTimeout(() => {
      this.updateViewportFromMap();
      this.updateCloudVisibility();
    }, 100); // Small delay to ensure resize is complete
  }

  /**
   * Handle data loading events
   */
  private handleDataLoading(event: any): void {
    if (event.sourceId && event.sourceId.includes('cloud')) {
      this.visibilityState.loadingClouds.add(event.sourceId);
      this.notifyLoadingChange(true);
    }
  }

  /**
   * Handle data loaded events
   */
  private handleData(event: any): void {
    if (event.sourceId && event.sourceId.includes('cloud')) {
      this.visibilityState.loadingClouds.delete(event.sourceId);
      
      if (this.visibilityState.loadingClouds.size === 0) {
        this.notifyLoadingChange(false);
      }
    }
  }

  /**
   * Handle WebGL context lost
   */
  private handleContextLost(): void {
    console.warn('🌥️ WebGL context lost in map event handler');
    
    // Clear visibility state
    this.visibilityState = {
      visibleClouds: new Set(),
      culledClouds: new Set(),
      loadingClouds: new Set()
    };
  }

  /**
   * Handle WebGL context restored
   */
  private handleContextRestored(): void {
    console.log('🌥️ WebGL context restored in map event handler');
    
    // Reinitialize cloud visibility
    setTimeout(() => {
      this.updateCloudVisibility();
    }, 100);
  }

  /**
   * Update viewport manager from current map state
   */
  private updateViewportFromMap(): void {
    if (!this.map) {
      return;
    }

    try {
      const center = this.map.getCenter();
      const zoom = this.map.getZoom();
      const bearing = this.map.getBearing() || 0;
      const pitch = this.map.getPitch() || 0;
      
      // Get screen dimensions
      const canvas = this.map.getCanvas();
      const width = canvas ? canvas.clientWidth : 1024;
      const height = canvas ? canvas.clientHeight : 1024;
      
      // Update viewport manager
      this.viewportManager.updateViewport(
        [center.lng, center.lat],
        zoom,
        bearing,
        pitch,
        width,
        height
      );
    } catch (error) {
      console.error('🌥️ Error updating viewport from map:', error);
    }
  }

  /**
   * Check if the viewport change is significant enough to trigger updates
   */
  private isSignificantChange(): boolean {
    const currentViewport = this.viewportManager.getCurrentViewport();
    
    if (!currentViewport || !this.lastViewport) {
      return true; // First update or no previous viewport
    }

    // Check zoom change
    const zoomDiff = Math.abs(currentViewport.zoom - this.lastViewport.zoom);
    if (zoomDiff >= this.config.zoomThreshold) {
      return true;
    }

    // Check center movement
    const [currentLng, currentLat] = currentViewport.center;
    const [lastLng, lastLat] = this.lastViewport.center;
    
    const moveDist = Math.sqrt(
      Math.pow(currentLng - lastLng, 2) + Math.pow(currentLat - lastLat, 2)
    );
    
    if (moveDist >= this.config.moveThreshold) {
      return true;
    }

    return false;
  }

  /**
   * Update cloud visibility based on current viewport
   */
  private updateCloudVisibility(): void {
    if (!this.config.enableCloudCulling) {
      return;
    }

    const viewport = this.viewportManager.getCurrentViewport();
    if (!viewport) {
      return;
    }

    try {
      // Calculate visible bounds with padding
      const bounds = this.calculateCullingBounds(viewport.bounds);
      
      // Update cloud engine with visible bounds
      this.cloudEngine.updateMapBounds(bounds);
      
      // Perform cloud culling (placeholder - will be implemented when cloud generation is ready)
      this.performCloudCulling(bounds);
      
    } catch (error) {
      console.error('🌥️ Error updating cloud visibility:', error);
    }
  }

  /**
   * Calculate bounds for cloud culling with padding
   */
  private calculateCullingBounds(viewportBounds: MapBounds): MapBounds {
    const padding = this.config.cullPadding;
    
    const width = viewportBounds.east - viewportBounds.west;
    const height = viewportBounds.north - viewportBounds.south;
    
    return {
      north: viewportBounds.north + height * padding,
      south: viewportBounds.south - height * padding,
      east: viewportBounds.east + width * padding,
      west: viewportBounds.west - width * padding
    };
  }

  /**
   * Perform cloud culling based on visibility bounds
   */
  private performCloudCulling(bounds: MapBounds): void {
    // This is a placeholder for cloud culling logic
    // Will be implemented when cloud generation system is complete
    
    // For now, just update the visibility state
    const previousVisible = new Set(this.visibilityState.visibleClouds);
    
    // Placeholder: assume all clouds in bounds are visible
    // In actual implementation, this would check cloud positions against bounds
    
    // Notify if visibility changed
    if (previousVisible.size !== this.visibilityState.visibleClouds.size) {
      this.notifyVisibilityChange();
    }
  }

  /**
   * Update last viewport for change detection
   */
  private updateLastViewport(): void {
    const currentViewport = this.viewportManager.getCurrentViewport();
    if (currentViewport) {
      this.lastViewport = {
        center: [...currentViewport.center],
        zoom: currentViewport.zoom,
        bounds: { ...currentViewport.bounds }
      };
    }
  }

  /**
   * Set callback for cloud visibility changes
   */
  setOnCloudVisibilityChange(callback: (state: CloudVisibilityState) => void): void {
    this.onCloudVisibilityChange = callback;
  }

  /**
   * Set callback for cloud loading state changes
   */
  setOnCloudLoadingChange(callback: (loading: boolean) => void): void {
    this.onCloudLoadingChange = callback;
  }

  /**
   * Get current cloud visibility state
   */
  getVisibilityState(): CloudVisibilityState {
    return {
      visibleClouds: new Set(this.visibilityState.visibleClouds),
      culledClouds: new Set(this.visibilityState.culledClouds),
      loadingClouds: new Set(this.visibilityState.loadingClouds)
    };
  }

  /**
   * Manually trigger cloud visibility update
   */
  forceCloudUpdate(): void {
    console.log('🌥️ Forcing cloud visibility update...');
    this.updateViewportFromMap();
    this.updateCloudVisibility();
    this.updateLastViewport();
  }

  /**
   * Clean up event listeners
   */
  dispose(): void {
    console.log('🌥️ Disposing map event handler...');
    
    // Clear timeout
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
    
    // Remove all event listeners
    for (const removeListener of this.eventListeners) {
      try {
        removeListener();
      } catch (error) {
        console.error('🌥️ Error removing event listener:', error);
      }
    }
    
    this.eventListeners = [];
    this.map = null;
  }

  // Private notification methods

  private notifyVisibilityChange(): void {
    if (this.onCloudVisibilityChange) {
      this.onCloudVisibilityChange(this.getVisibilityState());
    }
  }

  private notifyLoadingChange(loading: boolean): void {
    if (this.onCloudLoadingChange) {
      this.onCloudLoadingChange(loading);
    }
  }
}