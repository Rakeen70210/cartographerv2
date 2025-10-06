/**
 * Compaction Service
 * Merges overlapping explored areas to optimize storage and rendering performance.
 */

import { getDatabaseService, ExploredArea } from '../database/services';
import * as turf from '@turf/turf';

export interface CompactionConfig {
  enabled: boolean;
  compactionThreshold: number; // Min number of areas in a cluster to trigger compaction
  searchRadius: number; // Radius in km to search for overlapping areas
  simplificationTolerance: number; // Tolerance for turf.simplify
}

export interface CompactionResult {
  success: boolean;
  areasCompacted: number;
  newAreasCreated: number;
  polygonsSimplified: boolean;
}

class CompactionService {
  private dbService = getDatabaseService();
  private config: CompactionConfig;

  constructor() {
    this.config = {
      enabled: true,
      compactionThreshold: 10,
      searchRadius: 1, // 1 km
      simplificationTolerance: 0.001, // ~100m
    };
  }

  /**
   * Runs the compaction process for the entire dataset.
   */
  async runCompaction(): Promise<CompactionResult> {
    if (!this.config.enabled) {
      return { success: true, areasCompacted: 0, newAreasCreated: 0, polygonsSimplified: false };
    }

    console.log('Starting compaction service...');

    const allAreas = await this.dbService.getAllExploredAreas();

    if (allAreas.length < this.config.compactionThreshold) {
      console.log('Not enough areas to warrant compaction.');
      return { success: true, areasCompacted: 0, newAreasCreated: 0, polygonsSimplified: false };
    }

    const clusters = this.findAreaClusters(allAreas);

    let totalCompacted = 0;
    let totalCreated = 0;

    for (const cluster of clusters) {
      if (cluster.length < this.config.compactionThreshold) {
        continue;
      }

      const mergedPolygon = this.mergeCluster(cluster);

      if (mergedPolygon) {
        const simplifiedPolygon = turf.simplify(mergedPolygon, { tolerance: this.config.simplificationTolerance, highQuality: true });
        const newArea = this.createAreaFromPolygon(simplifiedPolygon);

        await this.dbService.withTransaction(async () => {
          const oldAreaIds = cluster.map(area => area.id).filter(id => id !== undefined) as number[];
          for (const id of oldAreaIds) {
            await this.dbService.deleteExploredArea(id);
          }
          await this.dbService.createExploredArea(newArea);
        });

        totalCompacted += cluster.length;
        totalCreated += 1;
      }
    }

    console.log(`Compaction complete. Compacted ${totalCompacted} areas into ${totalCreated}.`);

    return {
      success: true,
      areasCompacted: totalCompacted,
      newAreasCreated: totalCreated,
      polygonsSimplified: true,
    };
  }

  /**
   * Finds clusters of overlapping areas using a Disjoint Set Union (DSU) algorithm.
   */
  private findAreaClusters(areas: ExploredArea[]): ExploredArea[][] {
    const parent: number[] = Array.from({ length: areas.length }, (_, i) => i);
    const find = (i: number): number => {
      if (parent[i] === i) return i;
      return parent[i] = find(parent[i]);
    };
    const union = (i: number, j: number) => {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) {
        parent[rootJ] = rootI;
      }
    };

    const areaPolygons = areas.map(area => 
        turf.circle([area.longitude, area.latitude], area.radius / 1000, { steps: 16 })
    );

    // This is an O(n^2) approach. For a large number of areas, this should be optimized
    // by using a spatial index (like the rbush library) to only check nearby areas.
    for (let i = 0; i < areas.length; i++) {
      for (let j = i + 1; j < areas.length; j++) {
        if (turf.booleanIntersects(areaPolygons[i], areaPolygons[j])) {
          union(i, j);
        }
      }
    }

    const clusters = new Map<number, ExploredArea[]>();
    for (let i = 0; i < areas.length; i++) {
      const root = find(i);
      if (!clusters.has(root)) {
        clusters.set(root, []);
      }
      clusters.get(root)!.push(areas[i]);
    }

    return Array.from(clusters.values());
  }

  /**
   * Merges a cluster of areas into a single Turf.js polygon.
   */
  private mergeCluster(cluster: ExploredArea[]): turf.Feature<turf.Polygon | turf.MultiPolygon> | null {
    if (cluster.length === 0) {
      return null;
    }

    const polygons = cluster.map(area => {
        const center = [area.longitude, area.latitude];
        const radius = area.radius / 1000; // turf.circle expects radius in kilometers
        return turf.circle(center, radius, { steps: 32 });
    });

    let merged: turf.Feature<turf.Polygon | turf.MultiPolygon> = polygons[0];
    for (let i = 1; i < polygons.length; i++) {
        try {
            const nextMerged = turf.union(merged, polygons[i]);
            if (nextMerged) {
                merged = nextMerged;
            }
        } catch (e) {
            console.error("Error during turf.union", e);
        }
    }

    return merged;
  }

  /**
   * Creates a new ExploredArea from a merged polygon.
   */
  private createAreaFromPolygon(polygon: turf.Feature<turf.Polygon | turf.MultiPolygon>): Omit<ExploredArea, 'id' | 'created_at'> {
    const centerOfMass = turf.centerOfMass(polygon);
    const bbox = turf.bbox(polygon);
    const bboxPolygon = turf.bboxPolygon(bbox);
    const center = turf.center(bboxPolygon).geometry.coordinates;
    const radius = turf.distance(center, [bbox[2], bbox[3]]) * 1000; // in meters

    return {
      latitude: centerOfMass.geometry.coordinates[1],
      longitude: centerOfMass.geometry.coordinates[0],
      radius: radius, // This is a simplification but covers the whole merged area.
      explored_at: new Date().toISOString(),
      accuracy: 50, // Compaction results in an averaged accuracy
    };
  }
}

export const compactionService = new CompactionService();