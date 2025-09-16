import { CloudLayer, FogGeometry } from '../types/fog';

export interface CloudAnimationConfig {
  speed: number;
  density: number;
  layers: number;
  windDirection: number; // degrees
  turbulence: number;
}

export class CloudAnimationService {
  private animationFrame: number | null = null;
  private startTime: number = Date.now();
  private cloudLayers: CloudLayer[] = [];
  private config: CloudAnimationConfig;

  constructor(config: CloudAnimationConfig = {
    speed: 1.0,
    density: 0.7,
    layers: 3,
    windDirection: 45,
    turbulence: 0.3
  }) {
    this.config = config;
    this.initializeCloudLayers();
  }

  /**
   * Initialize cloud layers for animation
   */
  private initializeCloudLayers(): void {
    this.cloudLayers = [];
    
    for (let i = 0; i < this.config.layers; i++) {
      const layer: CloudLayer = {
        id: `cloud-layer-${i}`,
        opacity: this.config.density * (0.2 + i * 0.15),
        animationState: 'static',
        offsetX: Math.random() * 360 - 180,
        offsetY: Math.random() * 180 - 90,
        speed: this.config.speed * (0.3 + i * 0.2)
      };
      this.cloudLayers.push(layer);
    }
  }

  /**
   * Generate cloud geometry for a specific layer
   */
  generateCloudGeometry(layerIndex: number, time: number): FogGeometry {
    const layer = this.cloudLayers[layerIndex];
    if (!layer) {
      return { type: 'FeatureCollection', features: [] };
    }

    // Calculate animated offset based on time and wind
    const windRadians = (this.config.windDirection * Math.PI) / 180;
    const timeOffset = (time - this.startTime) / 1000; // Convert to seconds
    
    const animatedOffsetX = layer.offsetX + 
      Math.cos(windRadians) * layer.speed * timeOffset * 0.01 +
      Math.sin(timeOffset * 0.1 + layerIndex) * this.config.turbulence * 5;
    
    const animatedOffsetY = layer.offsetY + 
      Math.sin(windRadians) * layer.speed * timeOffset * 0.01 +
      Math.cos(timeOffset * 0.15 + layerIndex) * this.config.turbulence * 3;

    // Generate cloud patches across the world
    const cloudFeatures = this.generateCloudPatches(
      animatedOffsetX,
      animatedOffsetY,
      layer.opacity,
      layerIndex
    );

    return {
      type: 'FeatureCollection',
      features: cloudFeatures
    };
  }

  /**
   * Generate cloud patches for a layer
   */
  private generateCloudPatches(
    offsetX: number,
    offsetY: number,
    opacity: number,
    layerIndex: number
  ) {
    const features = [];
    const patchSize = 20 + layerIndex * 10; // Varying patch sizes
    const patchSpacing = 40 + layerIndex * 20;

    // Create cloud patches across the visible world
    for (let lat = -80; lat <= 80; lat += patchSpacing) {
      for (let lng = -180; lng <= 180; lng += patchSpacing) {
        // Add some randomness to cloud placement
        const randomOffset = (Math.sin(lat * 0.1) * Math.cos(lng * 0.1) + 1) * 0.5;
        if (randomOffset > 0.3) { // Only create clouds in some areas
          const cloudLat = lat + offsetY * 0.1;
          const cloudLng = lng + offsetX * 0.1;
          
          // Create organic cloud shape (simplified as ellipse)
          const cloudFeature = this.createCloudPatch(
            cloudLat,
            cloudLng,
            patchSize,
            opacity,
            layerIndex
          );
          
          if (cloudFeature) {
            features.push(cloudFeature);
          }
        }
      }
    }

    return features;
  }

  /**
   * Create individual cloud patch
   */
  private createCloudPatch(
    centerLat: number,
    centerLng: number,
    size: number,
    opacity: number,
    layerIndex: number
  ) {
    // Ensure cloud is within world bounds
    if (centerLat < -85 || centerLat > 85 || centerLng < -180 || centerLng > 180) {
      return null;
    }

    const sizeInDegrees = size / 111320; // Convert meters to degrees
    const aspectRatio = 1.5 + Math.random() * 0.5; // Clouds are typically wider than tall
    
    // Create elliptical cloud shape
    const points = 16;
    const coordinates = [];
    
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const radiusX = sizeInDegrees * aspectRatio;
      const radiusY = sizeInDegrees;
      
      // Add some organic variation to the shape
      const variation = 1 + Math.sin(angle * 3 + layerIndex) * 0.2;
      
      const lat = centerLat + radiusY * Math.cos(angle) * variation;
      const lng = centerLng + radiusX * Math.sin(angle) * variation / Math.cos(centerLat * Math.PI / 180);
      
      coordinates.push([lng, lat]);
    }

    return {
      type: 'Feature' as const,
      properties: {
        opacity: opacity,
        type: 'cloud' as const,
        layer: layerIndex
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [coordinates]
      }
    };
  }

  /**
   * Start cloud animation
   */
  startAnimation(onUpdate: (layerGeometries: FogGeometry[]) => void): void {
    let lastUpdateTime = 0;
    const targetFPS = 30; // Limit to 30 FPS for better performance
    const frameInterval = 1000 / targetFPS;

    const animate = (currentTime: number) => {
      if (currentTime - lastUpdateTime >= frameInterval) {
        const layerGeometries = this.cloudLayers.map((_, index) => 
          this.generateCloudGeometry(index, currentTime)
        );
        
        onUpdate(layerGeometries);
        lastUpdateTime = currentTime;
      }
      
      this.animationFrame = requestAnimationFrame(animate);
    };

    this.startTime = Date.now();
    this.animationFrame = requestAnimationFrame(animate);
  }

  /**
   * Stop cloud animation
   */
  stopAnimation(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Update animation configuration
   */
  updateConfig(newConfig: Partial<CloudAnimationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.initializeCloudLayers();
  }

  /**
   * Get current cloud layers
   */
  getCloudLayers(): CloudLayer[] {
    return [...this.cloudLayers];
  }
}

// Singleton instance
let cloudAnimationService: CloudAnimationService | null = null;

export const getCloudAnimationService = (): CloudAnimationService => {
  if (!cloudAnimationService) {
    cloudAnimationService = new CloudAnimationService();
  }
  return cloudAnimationService;
};