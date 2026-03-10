/**
 * MockCloudRenderingEngine - Temporary mock implementation for development
 * This provides a working implementation until the full cloud rendering engine is ready
 */

import { ICloudRenderingEngine } from './interfaces';
import { CloudState, CloudGeographicArea, MapBounds, PerformanceMode, DissipationAnimation } from '../../types/cloud';
import { ExplorationArea } from '../../types/exploration';
import { debugLog } from '../../utils/logger';

export class MockCloudRenderingEngine implements ICloudRenderingEngine {
  private state: CloudState;
  private isInitialized = false;

  constructor() {
    this.state = {
      initialized: false,
      rendering: false,
      animating: false,
      performanceMode: 'medium',
      visibleCells: [],
      activeAnimations: []
    };
  }

  async initialize(): Promise<void> {
    debugLog('CloudEngine', 'Initializing...');

    // Simulate initialization delay
    await new Promise(resolve => setTimeout(resolve, 500));

    this.isInitialized = true;
    this.state.initialized = true;
    this.state.rendering = true;

    debugLog('CloudEngine', 'Initialized successfully');
  }

  updateClouds(exploredAreas: ExplorationArea[]): void {
    if (!this.isInitialized) {
      // Silently skip if not initialized
      return;
    }

    debugLog('CloudEngine', `Updating clouds for ${exploredAreas.length} explored areas`);

    // Mock visible cells based on explored areas
    this.state.visibleCells = exploredAreas.map(area => `cell_${area.id}`);
  }

  async animateCloudDissipation(area: CloudGeographicArea): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    debugLog('CloudEngine', 'Starting cloud dissipation animation');

    const animation: DissipationAnimation = {
      startTime: Date.now(),
      duration: 2000, // 2 seconds
      center: area.center,
      maxRadius: area.radius,
      easing: (t: number) => 1 - Math.pow(1 - t, 3) // ease-out cubic
    };

    // Add animation to state
    this.state.activeAnimations.push(animation);
    this.state.animating = true;

    // Simulate animation progress
    return new Promise((resolve) => {
      const animationInterval = setInterval(() => {
        const elapsed = Date.now() - animation.startTime;
        const progress = Math.min(elapsed / animation.duration, 1);

        if (progress >= 1) {
          // Remove completed animation
          this.state.activeAnimations = this.state.activeAnimations.filter(a => a !== animation);

          if (this.state.activeAnimations.length === 0) {
            this.state.animating = false;
          }

          clearInterval(animationInterval);
          debugLog('CloudEngine', 'Cloud dissipation animation completed');
          resolve();
        }
      }, 100); // Update every 100ms
    });
  }

  setPerformanceMode(mode: PerformanceMode): void {
    debugLog('CloudEngine', `Setting performance mode to ${mode}`);
    this.state.performanceMode = mode;
  }

  updateMapBounds(bounds: MapBounds): void {
    if (!this.isInitialized) return;

    debugLog('CloudEngine', 'Updating map bounds');
    // In a real implementation, this would update the visible cloud patches
  }

  setZoomLevel(zoom: number): void {
    if (!this.isInitialized) return;

    debugLog('CloudEngine', `Setting zoom level to ${zoom}`);
    // In a real implementation, this would adjust level of detail
  }

  dispose(): void {
    debugLog('CloudEngine', 'Disposing...');

    this.isInitialized = false;
    this.state.initialized = false;
    this.state.rendering = false;
    this.state.animating = false;
    this.state.visibleCells = [];
    this.state.activeAnimations = [];

    debugLog('CloudEngine', 'Disposed');
  }

  getState(): CloudState {
    return { ...this.state };
  }
}

// Export singleton instance for easy use
let mockEngineInstance: MockCloudRenderingEngine | null = null;

export const getMockCloudRenderingEngine = (): MockCloudRenderingEngine => {
  if (!mockEngineInstance) {
    mockEngineInstance = new MockCloudRenderingEngine();
  }
  return mockEngineInstance;
};