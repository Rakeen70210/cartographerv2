/**
 * Cloud geometry generation system
 * Creates CloudPatch instances with vertices and texture coordinates
 */

import { PerlinNoise, NoiseConfiguration } from '../noise';

export interface CloudVertex {
  position: [number, number, number]; // x, y, z (elevation)
  texCoord: [number, number];
  density: number;
  normal: [number, number, number];
}

export interface CloudPatch {
  id: string;
  bounds: BoundingBox;
  vertices: Float32Array;
  indices: Uint16Array;
  densityMap: Float32Array;
  textureCoords: Float32Array;
  vertexCount: number;
  indexCount: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CloudCell {
  id: string;
  worldPosition: [number, number];
  vertices: CloudVertex[];
  density: number;
  explored: boolean;
  dissipationState: DissipationState;
}

export interface DissipationState {
  active: boolean;
  progress: number; // 0-1
  center: [number, number];
  radius: number;
}

export interface CloudGridConfig {
  cellSize: number; // meters
  resolution: number; // vertices per cell edge
  maxCells: number;
  noiseConfig: NoiseConfiguration;
}

/**
 * Spatial grid system for organizing cloud cells
 */
export class CloudGrid {
  private cells: Map<string, CloudCell> = new Map();
  private noise: PerlinNoise;
  private config: CloudGridConfig;

  constructor(config: CloudGridConfig, seed: number = 12345) {
    this.config = config;
    this.noise = new PerlinNoise(seed);
  }

  /**
   * Get or create cloud cell at world position
   */
  public getCell(worldX: number, worldY: number): CloudCell {
    const cellX = Math.floor(worldX / this.config.cellSize);
    const cellY = Math.floor(worldY / this.config.cellSize);
    const cellId = `${cellX}_${cellY}`;

    if (!this.cells.has(cellId)) {
      const cell = this.generateCell(cellX, cellY);
      this.cells.set(cellId, cell);
      
      // Cleanup old cells if we exceed max count
      if (this.cells.size > this.config.maxCells) {
        this.cleanupDistantCells(worldX, worldY);
      }
    }

    return this.cells.get(cellId)!;
  }

  /**
   * Get all cells within a bounding box
   */
  public getCellsInBounds(bounds: BoundingBox): CloudCell[] {
    const cells: CloudCell[] = [];
    const startX = Math.floor(bounds.minX / this.config.cellSize);
    const endX = Math.ceil(bounds.maxX / this.config.cellSize);
    const startY = Math.floor(bounds.minY / this.config.cellSize);
    const endY = Math.ceil(bounds.maxY / this.config.cellSize);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const cellId = `${x}_${y}`;
        if (this.cells.has(cellId)) {
          cells.push(this.cells.get(cellId)!);
        }
      }
    }

    return cells;
  }

  /**
   * Update cell dissipation state
   */
  public updateCellDissipation(cellId: string, dissipationState: DissipationState): void {
    const cell = this.cells.get(cellId);
    if (cell) {
      cell.dissipationState = dissipationState;
    }
  }

  /**
   * Mark cell as explored
   */
  public markCellExplored(cellId: string): void {
    const cell = this.cells.get(cellId);
    if (cell) {
      cell.explored = true;
    }
  }

  /**
   * Generate a new cloud cell
   */
  private generateCell(cellX: number, cellY: number): CloudCell {
    const worldX = cellX * this.config.cellSize;
    const worldY = cellY * this.config.cellSize;
    const vertices = this.generateCellVertices(worldX, worldY);
    const density = this.calculateCellDensity(worldX, worldY);

    return {
      id: `${cellX}_${cellY}`,
      worldPosition: [worldX, worldY],
      vertices,
      density,
      explored: false,
      dissipationState: {
        active: false,
        progress: 0,
        center: [0, 0],
        radius: 0
      }
    };
  }

  /**
   * Generate vertices for a cell
   */
  private generateCellVertices(worldX: number, worldY: number): CloudVertex[] {
    const vertices: CloudVertex[] = [];
    const resolution = this.config.resolution;
    const cellSize = this.config.cellSize;
    const step = cellSize / (resolution - 1);

    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const vertexWorldX = worldX + x * step;
        const vertexWorldY = worldY + y * step;
        
        const density = this.noise.noise(vertexWorldX, vertexWorldY, this.config.noiseConfig);
        const elevation = density * 100; // Scale density to elevation

        vertices.push({
          position: [vertexWorldX, vertexWorldY, elevation],
          texCoord: [x / (resolution - 1), y / (resolution - 1)],
          density: Math.max(0, density), // Clamp to positive values
          normal: [0, 0, 1] // Will be calculated properly in geometry generator
        });
      }
    }

    return vertices;
  }

  /**
   * Calculate average density for a cell
   */
  private calculateCellDensity(worldX: number, worldY: number): number {
    const sampleCount = 9; // 3x3 grid
    let totalDensity = 0;
    const cellSize = this.config.cellSize;

    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const sampleX = worldX + (x * cellSize) / 2;
        const sampleY = worldY + (y * cellSize) / 2;
        const density = this.noise.noise(sampleX, sampleY, this.config.noiseConfig);
        totalDensity += Math.max(0, density);
      }
    }

    return totalDensity / sampleCount;
  }

  /**
   * Remove cells that are far from current position
   */
  private cleanupDistantCells(centerX: number, centerY: number): void {
    const maxDistance = this.config.cellSize * 10; // Keep cells within 10 cell radius
    const cellsToRemove: string[] = [];

    for (const [cellId, cell] of this.cells) {
      const [cellWorldX, cellWorldY] = cell.worldPosition;
      const distance = Math.sqrt(
        Math.pow(cellWorldX - centerX, 2) + Math.pow(cellWorldY - centerY, 2)
      );

      if (distance > maxDistance) {
        cellsToRemove.push(cellId);
      }
    }

    // Remove oldest cells first if we still have too many
    const sortedCells = Array.from(this.cells.keys()).sort();
    const excessCount = this.cells.size - this.config.maxCells + cellsToRemove.length;
    
    for (let i = 0; i < Math.min(excessCount, sortedCells.length); i++) {
      cellsToRemove.push(sortedCells[i]);
    }

    cellsToRemove.forEach(cellId => this.cells.delete(cellId));
  }
}

/**
 * Cloud geometry generator - converts cells to renderable patches
 */
export class CloudGeometryGenerator {
  /**
   * Generate a CloudPatch from a CloudCell
   */
  public static generatePatch(cell: CloudCell, resolution: number): CloudPatch {
    const vertices = cell.vertices;
    const vertexCount = vertices.length;
    const indexCount = (resolution - 1) * (resolution - 1) * 6; // 2 triangles per quad

    // Create flat arrays for WebGL
    const positions = new Float32Array(vertexCount * 3);
    const texCoords = new Float32Array(vertexCount * 2);
    const densities = new Float32Array(vertexCount);
    const indices = new Uint16Array(indexCount);

    // Fill vertex data
    for (let i = 0; i < vertexCount; i++) {
      const vertex = vertices[i];
      
      positions[i * 3] = vertex.position[0];
      positions[i * 3 + 1] = vertex.position[1];
      positions[i * 3 + 2] = vertex.position[2];
      
      texCoords[i * 2] = vertex.texCoord[0];
      texCoords[i * 2 + 1] = vertex.texCoord[1];
      
      densities[i] = vertex.density;
    }

    // Generate indices for triangles
    let indexOffset = 0;
    for (let y = 0; y < resolution - 1; y++) {
      for (let x = 0; x < resolution - 1; x++) {
        const topLeft = y * resolution + x;
        const topRight = topLeft + 1;
        const bottomLeft = (y + 1) * resolution + x;
        const bottomRight = bottomLeft + 1;

        // First triangle
        indices[indexOffset++] = topLeft;
        indices[indexOffset++] = bottomLeft;
        indices[indexOffset++] = topRight;

        // Second triangle
        indices[indexOffset++] = topRight;
        indices[indexOffset++] = bottomLeft;
        indices[indexOffset++] = bottomRight;
      }
    }

    // Calculate bounding box
    const bounds = this.calculateBounds(vertices);

    return {
      id: cell.id,
      bounds,
      vertices: positions,
      indices,
      densityMap: densities,
      textureCoords: texCoords,
      vertexCount,
      indexCount
    };
  }

  /**
   * Calculate bounding box for vertices
   */
  private static calculateBounds(vertices: CloudVertex[]): BoundingBox {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const vertex of vertices) {
      const [x, y] = vertex.position;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    return { minX, minY, maxX, maxY };
  }

  /**
   * Calculate normals for vertices (for lighting)
   */
  public static calculateNormals(vertices: CloudVertex[], resolution: number): void {
    // Simple normal calculation - pointing upward for clouds
    for (const vertex of vertices) {
      vertex.normal = [0, 0, 1];
    }

    // For more sophisticated normal calculation, we could compute
    // cross products between adjacent vertices, but for clouds
    // a simple upward normal is often sufficient
  }

  /**
   * Apply level-of-detail reduction to geometry
   */
  public static applyLOD(patch: CloudPatch, lodLevel: number): CloudPatch {
    if (lodLevel <= 1) {
      return patch; // No reduction needed
    }

    // Simple LOD: reduce vertex count by skipping vertices
    const originalResolution = Math.sqrt(patch.vertexCount);
    const newResolution = Math.max(2, Math.floor(originalResolution / lodLevel));
    const step = Math.floor(originalResolution / newResolution);

    const newVertexCount = newResolution * newResolution;
    const newIndexCount = (newResolution - 1) * (newResolution - 1) * 6;

    const newVertices = new Float32Array(newVertexCount * 3);
    const newTexCoords = new Float32Array(newVertexCount * 2);
    const newDensities = new Float32Array(newVertexCount);
    const newIndices = new Uint16Array(newIndexCount);

    // Sample vertices at reduced resolution
    let newVertexIndex = 0;
    for (let y = 0; y < newResolution; y++) {
      for (let x = 0; x < newResolution; x++) {
        const originalX = Math.min(x * step, originalResolution - 1);
        const originalY = Math.min(y * step, originalResolution - 1);
        const originalIndex = originalY * originalResolution + originalX;

        newVertices[newVertexIndex * 3] = patch.vertices[originalIndex * 3];
        newVertices[newVertexIndex * 3 + 1] = patch.vertices[originalIndex * 3 + 1];
        newVertices[newVertexIndex * 3 + 2] = patch.vertices[originalIndex * 3 + 2];

        newTexCoords[newVertexIndex * 2] = patch.textureCoords[originalIndex * 2];
        newTexCoords[newVertexIndex * 2 + 1] = patch.textureCoords[originalIndex * 2 + 1];

        newDensities[newVertexIndex] = patch.densityMap[originalIndex];

        newVertexIndex++;
      }
    }

    // Generate new indices
    let indexOffset = 0;
    for (let y = 0; y < newResolution - 1; y++) {
      for (let x = 0; x < newResolution - 1; x++) {
        const topLeft = y * newResolution + x;
        const topRight = topLeft + 1;
        const bottomLeft = (y + 1) * newResolution + x;
        const bottomRight = bottomLeft + 1;

        newIndices[indexOffset++] = topLeft;
        newIndices[indexOffset++] = bottomLeft;
        newIndices[indexOffset++] = topRight;

        newIndices[indexOffset++] = topRight;
        newIndices[indexOffset++] = bottomLeft;
        newIndices[indexOffset++] = bottomRight;
      }
    }

    return {
      ...patch,
      vertices: newVertices,
      indices: newIndices,
      densityMap: newDensities,
      textureCoords: newTexCoords,
      vertexCount: newVertexCount,
      indexCount: newIndexCount
    };
  }
}