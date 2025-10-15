import { Skia, TileMode, BlendMode } from '@shopify/react-native-skia';
import type { SkImage, SkShader } from '@shopify/react-native-skia';
import { GenericExploredArea } from '../../types/fog';
import { DissipationAnimation, SkiaFogViewport } from '../../types/skiaFog';
import {
  SkiaCloudUniforms,
  GPU_MASK_MAX_CIRCLES,
  UNIFORM_MASK_MAX_CIRCLES,
  UNIFORM_MASK_FLOAT_COUNT,
} from './shaders/SkiaCloudShader';

export type FogMaskMode = 'texture' | 'uniform_array' | 'cpu_fallback';

export interface FogMaskUniformBuildRequest {
  exploredAreas: GenericExploredArea[];
  dissipationAnimations: DissipationAnimation[];
  viewport: SkiaFogViewport;
  zoom: number;
  timestamp?: number;
}

export interface FogMaskUniformBuildResult {
  mode: FogMaskMode;
  circleCount: number;
  uniforms: Partial<SkiaCloudUniforms>;
  diagnostics: {
    culled: number;
    clustered: number;
    textureSize: [number, number];
  };
}

interface FogMaskUniformServiceOptions {
  skia?: typeof Skia;
  circleBudget?: number;
  uniformBudget?: number;
  viewportPaddingPx?: number;
  cacheDurationMs?: number;
  maxTextureWidth?: number;
}

interface ScreenCircle {
  x: number;
  y: number;
  radius: number;
  type: number;
}

interface TextureBuildResult {
  shader: SkShader;
  texWidth: number;
  texHeight: number;
}

const GPU_CIRCLE_BUDGET = GPU_MASK_MAX_CIRCLES;
const UNIFORM_ARRAY_CAPACITY = UNIFORM_MASK_MAX_CIRCLES;
const DEFAULT_VIEWPORT_PADDING = 96;
const CACHE_DURATION_MS = 30;
const MAX_TEXTURE_WIDTH = 512;
const MIN_TEXTURE_WIDTH = 32;
const EMPTY_UNIFORM_BUFFER = new Float32Array(UNIFORM_MASK_FLOAT_COUNT);

export class FogMaskUniformService {
  private readonly skia: typeof Skia | undefined;
  private readonly circleBudget: number;
  private readonly uniformBudget: number;
  private readonly viewportPaddingPx: number;
  private readonly cacheDurationMs: number;
  private readonly maxTextureWidth: number;

  private capabilities = { tested: false, texture: false };
  private reusablePaint: ReturnType<typeof Skia['Paint']> | null = null;
  private textureImage: SkImage | null = null;
  private textureShader: SkShader | null = null;

  private cacheKey = '';
  private cacheTimestamp = 0;
  private cacheResult: FogMaskUniformBuildResult | null = null;

  constructor(options: Partial<FogMaskUniformServiceOptions> = {}) {
    this.skia = options.skia ?? Skia;
    this.circleBudget = options.circleBudget ?? GPU_CIRCLE_BUDGET;
    this.uniformBudget = Math.min(options.uniformBudget ?? UNIFORM_ARRAY_CAPACITY, UNIFORM_ARRAY_CAPACITY);
    this.viewportPaddingPx = options.viewportPaddingPx ?? DEFAULT_VIEWPORT_PADDING;
    this.cacheDurationMs = options.cacheDurationMs ?? CACHE_DURATION_MS;
    this.maxTextureWidth = options.maxTextureWidth ?? MAX_TEXTURE_WIDTH;
  }

  buildFogMaskUniforms(request: FogMaskUniformBuildRequest): FogMaskUniformBuildResult {
    if (!this.isViewportValid(request.viewport)) {
      return this.buildCpuFallback(0, request.viewport, request.zoom, {
        culled: 0,
        clustered: 0,
        textureSize: [0, 0],
      });
    }

    const now = request.timestamp ?? Date.now();
    const cacheKey = this.computeCacheKey(request);

    if (this.cacheResult && cacheKey === this.cacheKey && now - this.cacheTimestamp <= this.cacheDurationMs) {
      return this.cacheResult;
    }

    const capability = this.ensureTextureCapability();

    const areaCircles = request.exploredAreas
      .map(area => this.areaToScreenCircle(area, request.viewport))
      .filter((circle): circle is ScreenCircle => !!circle);

    const dissipationCircles = request.dissipationAnimations
      .map(animation => this.animationToScreenCircle(animation, request.viewport))
      .filter((circle): circle is ScreenCircle => !!circle);

    const combinedCircles = [...areaCircles, ...dissipationCircles];

    if (combinedCircles.length === 0) {
      const uniforms = this.buildDisabledUniforms(request.viewport, request.zoom);
      const result: FogMaskUniformBuildResult = {
        mode: capability.texture ? 'texture' : 'uniform_array',
        circleCount: 0,
        uniforms,
        diagnostics: { culled: 0, clustered: 0, textureSize: [0, 0] },
      };
      return this.storeCache(cacheKey, now, result);
    }

    const culledCircles = this.cullCircles(combinedCircles, request.viewport);
    const culledCount = combinedCircles.length - culledCircles.length;

    const clusteredCircles = this.applyAdaptiveClustering(culledCircles, request.zoom);
    const clusteredReduction = culledCircles.length - clusteredCircles.length;

    const maxRadius = this.computeMaxRadius(clusteredCircles);
    const featherPx = this.computeFeatherPx(request.zoom, clusteredCircles.length);
    const unpackScale: [number, number, number] = [
      request.viewport.width || 1,
      request.viewport.height || 1,
      maxRadius,
    ];

    let result: FogMaskUniformBuildResult | null = null;

    if (capability.texture && clusteredCircles.length > 0) {
      const texture = this.buildDataTexture(clusteredCircles, request.viewport, maxRadius);
      if (texture) {
        result = {
          mode: 'texture',
          circleCount: clusteredCircles.length,
          uniforms: {
            u_circleCount: clusteredCircles.length,
            u_texWidth: texture.texWidth,
            u_featherPx: featherPx,
            u_unpackScale: unpackScale,
            u_maskMode: 0,
            u_circleData: texture.shader,
            u_circleUniforms: EMPTY_UNIFORM_BUFFER,
          },
          diagnostics: {
            culled: culledCount,
            clustered: clusteredReduction,
            textureSize: [texture.texWidth, texture.texHeight],
          },
        };
      }
    }

    if (!result) {
      if (clusteredCircles.length <= this.uniformBudget) {
        const uniformBuffer = this.buildUniformArray(clusteredCircles);
        result = {
          mode: 'uniform_array',
          circleCount: clusteredCircles.length,
          uniforms: {
            u_circleCount: clusteredCircles.length,
            u_texWidth: 1,
            u_featherPx: featherPx,
            u_unpackScale: unpackScale,
            u_maskMode: 1,
            u_circleData: null,
            u_circleUniforms: uniformBuffer,
          },
          diagnostics: {
            culled: culledCount,
            clustered: clusteredReduction,
            textureSize: [0, 0],
          },
        };
      } else {
        result = this.buildCpuFallback(clusteredCircles.length, request.viewport, request.zoom, {
          culled: culledCount,
          clustered: clusteredReduction,
          textureSize: [0, 0],
        });
      }
    }

    return this.storeCache(cacheKey, now, result);
  }

  private storeCache(key: string, timestamp: number, result: FogMaskUniformBuildResult): FogMaskUniformBuildResult {
    this.cacheKey = key;
    this.cacheTimestamp = timestamp;
    this.cacheResult = result;
    return result;
  }

  private buildCpuFallback(
    circleCount: number,
    viewport: SkiaFogViewport,
    zoom: number,
    diagnostics: FogMaskUniformBuildResult['diagnostics']
  ): FogMaskUniformBuildResult {
    return {
      mode: 'cpu_fallback',
      circleCount,
      uniforms: this.buildDisabledUniforms(viewport, zoom),
      diagnostics,
    };
  }

  private buildDisabledUniforms(viewport: SkiaFogViewport, zoom: number): Partial<SkiaCloudUniforms> {
    return {
      u_circleCount: 0,
      u_texWidth: 1,
      u_featherPx: this.computeFeatherPx(zoom, 0),
      u_unpackScale: [viewport.width || 1, viewport.height || 1, 1],
      u_maskMode: 2,
      u_circleData: null,
      u_circleUniforms: EMPTY_UNIFORM_BUFFER,
    };
  }

  private ensureTextureCapability(): { tested: boolean; texture: boolean } {
    if (this.capabilities.tested) {
      return this.capabilities;
    }

    this.capabilities = { tested: true, texture: false };

    if (!this.skia || typeof this.skia.Surface?.Make !== 'function' || typeof this.skia.Paint !== 'function' || typeof this.skia.Color !== 'function') {
      return this.capabilities;
    }

    try {
      const surface = this.skia.Surface.Make(1, 1);
      if (!surface) {
        return this.capabilities;
      }

      const canvas = surface.getCanvas();
      canvas.clear(this.skia.Color('transparent'));

      const paint = this.skia.Paint();
      if (typeof paint.setAntiAlias === 'function') {
        paint.setAntiAlias(false);
      }
      if (typeof paint.setBlendMode === 'function' && BlendMode) {
        try {
          paint.setBlendMode(BlendMode.Src ?? BlendMode.SrcOver ?? 0);
        } catch (error) {
          // Ignore blend mode configuration issues on unsupported platforms
        }
      }
      paint.setColor(this.skia.Color([0, 0, 0, 255]));
      canvas.drawRect(this.skia.XYWHRect(0, 0, 1, 1), paint);

      const image = surface.makeImageSnapshot();
      if (!image) {
        return this.capabilities;
      }

      const shader = this.makeImageShader(image);
      if (!shader) {
        return this.capabilities;
      }

      this.capabilities.texture = true;
      this.textureImage = null;
      this.textureShader = null;
    } catch (error) {
      this.capabilities.texture = false;
    }

    return this.capabilities;
  }

  private getPaint(): ReturnType<typeof Skia['Paint']> | null {
    if (!this.skia || typeof this.skia.Paint !== 'function') {
      return null;
    }

    if (!this.reusablePaint) {
      const paint = this.skia.Paint();
      if (typeof paint.setAntiAlias === 'function') {
        paint.setAntiAlias(false);
      }
      if (typeof paint.setBlendMode === 'function' && BlendMode) {
        try {
          paint.setBlendMode(BlendMode.Src ?? BlendMode.SrcOver ?? 0);
        } catch (error) {
          // Ignore blend mode issues on environments that do not support the requested mode
        }
      }
      this.reusablePaint = paint;
    }

    return this.reusablePaint;
  }

  private buildDataTexture(
    circles: ScreenCircle[],
    viewport: SkiaFogViewport,
    maxRadius: number
  ): TextureBuildResult | null {
    if (!this.skia || typeof this.skia.Surface?.Make !== 'function') {
      return null;
    }

    const texWidth = this.computeTextureWidth(circles.length);
    const texHeight = Math.max(1, Math.ceil(circles.length / texWidth));

    const surface = this.skia.Surface.Make(texWidth, texHeight);
    if (!surface) {
      return null;
    }

    const canvas = surface.getCanvas();
    canvas.clear(this.skia.Color([0, 0, 0, 0]));

    const paint = this.getPaint();
    if (!paint) {
      return null;
    }

    const width = viewport.width || 1;
    const height = viewport.height || 1;
    const radiusScale = maxRadius > 0 ? maxRadius : 1;

    for (let i = 0; i < circles.length; i++) {
      const circle = circles[i];
      const pixelX = i % texWidth;
      const pixelY = Math.floor(i / texWidth);

      const normalizedX = this.clamp(circle.x / width, 0, 1);
      const normalizedY = this.clamp(circle.y / height, 0, 1);
      const normalizedRadius = this.clamp(circle.radius / radiusScale, 0, 1);
      const typeChannel = this.clamp(circle.type, 0, 1);

      const color = this.skia.Color([
        Math.round(normalizedX * 255),
        Math.round(normalizedY * 255),
        Math.round(normalizedRadius * 255),
        Math.round(typeChannel * 255),
      ]);

      paint.setColor(color);
      canvas.drawRect(this.skia.XYWHRect(pixelX, pixelY, 1, 1), paint);
    }

    const image = surface.makeImageSnapshot();
    if (!image) {
      return null;
    }

    const shader = this.makeImageShader(image);
    if (!shader) {
      return null;
    }

    this.textureImage = image;
    this.textureShader = shader;

    return {
      shader,
      texWidth,
      texHeight,
    };
  }

  private buildUniformArray(circles: ScreenCircle[]): Float32Array {
    const buffer = new Float32Array(UNIFORM_ARRAY_CAPACITY * 4);
    const limit = Math.min(circles.length, UNIFORM_ARRAY_CAPACITY);

    for (let i = 0; i < limit; i++) {
      const circle = circles[i];
      const offset = i * 4;
      buffer[offset] = circle.x;
      buffer[offset + 1] = circle.y;
      buffer[offset + 2] = circle.radius;
      buffer[offset + 3] = circle.type;
    }

    return buffer;
  }

  private cullCircles(circles: ScreenCircle[], viewport: SkiaFogViewport): ScreenCircle[] {
    const width = viewport.width || 1;
    const height = viewport.height || 1;
    const padding = this.viewportPaddingPx;

    return circles.filter(circle => {
      const left = circle.x - circle.radius;
      const right = circle.x + circle.radius;
      const top = circle.y - circle.radius;
      const bottom = circle.y + circle.radius;

      return (
        right >= -padding &&
        left <= width + padding &&
        bottom >= -padding &&
        top <= height + padding
      );
    });
  }

  private applyAdaptiveClustering(circles: ScreenCircle[], zoom: number): ScreenCircle[] {
    if (circles.length <= this.circleBudget) {
      return circles;
    }

    let cellSize = this.computeInitialCellSize(zoom, circles.length);
    let clustered = this.clusterByGrid(circles, cellSize);
    let iterations = 0;

    while (clustered.length > this.circleBudget && iterations < 6) {
      cellSize *= 1.5;
      clustered = this.clusterByGrid(circles, cellSize);
      iterations++;
    }

    if (clustered.length > this.circleBudget) {
      return clustered
        .sort((a, b) => b.radius - a.radius)
        .slice(0, this.circleBudget);
    }

    return clustered;
  }

  private clusterByGrid(circles: ScreenCircle[], cellSize: number): ScreenCircle[] {
    const grid = new Map<string, { weight: number; xSum: number; ySum: number; maxRadius: number; type: number }>();

    for (const circle of circles) {
      const cellX = Math.floor(circle.x / cellSize);
      const cellY = Math.floor(circle.y / cellSize);
      const key = `${cellX}_${cellY}`;
      const weight = Math.max(circle.radius * circle.radius, 1);

      const existing = grid.get(key);
      if (existing) {
        existing.weight += weight;
        existing.xSum += circle.x * weight;
        existing.ySum += circle.y * weight;
        existing.maxRadius = Math.max(existing.maxRadius, circle.radius);
        if (circle.type > existing.type) {
          existing.type = circle.type;
        }
      } else {
        grid.set(key, {
          weight,
          xSum: circle.x * weight,
          ySum: circle.y * weight,
          maxRadius: circle.radius,
          type: circle.type,
        });
      }
    }

    const clusters: ScreenCircle[] = [];
    grid.forEach(entry => {
      const radius = Math.max(Math.sqrt(entry.weight), entry.maxRadius * 0.85);
      clusters.push({
        x: entry.xSum / entry.weight,
        y: entry.ySum / entry.weight,
        radius,
        type: entry.type,
      });
    });

    return clusters;
  }

  private computeInitialCellSize(zoom: number, circleCount: number): number {
    const base = zoom < 9 ? 180 : zoom < 12 ? 132 : zoom < 15 ? 96 : 72;
    const multiplier = Math.max(1, Math.ceil(circleCount / this.circleBudget));
    return base * Math.min(multiplier, 3);
  }

  private computeTextureWidth(circleCount: number): number {
    if (circleCount <= 0) {
      return 1;
    }
    const ideal = Math.ceil(Math.sqrt(circleCount));
    const clamped = this.clamp(ideal, MIN_TEXTURE_WIDTH, this.maxTextureWidth);
    return Math.max(1, clamped);
  }

  private computeMaxRadius(circles: ScreenCircle[]): number {
    let max = 1;
    for (const circle of circles) {
      if (circle.radius > max) {
        max = circle.radius;
      }
    }
    return max;
  }

  private computeFeatherPx(zoom: number, circleCount: number): number {
    let base = zoom < 9 ? 16 : zoom < 12 ? 12 : zoom < 15 ? 8 : 6;
    if (circleCount > this.circleBudget * 0.75) {
      base *= 0.75;
    }
    return Math.max(3, base);
  }

  private makeImageShader(image: SkImage): SkShader | null {
    const candidate = image as unknown as { makeShader?: (tx: TileMode, ty: TileMode) => SkShader };
    if (typeof candidate.makeShader !== 'function') {
      return null;
    }

    try {
      return candidate.makeShader(TileMode.Clamp, TileMode.Clamp);
    } catch (error) {
      return null;
    }
  }

  private areaToScreenCircle(area: GenericExploredArea, viewport: SkiaFogViewport): ScreenCircle | null {
    const coords = this.resolveAreaCoordinates(area);
    if (!coords) {
      return null;
    }

    const [lat, lng] = coords;
    const radiusMeters = typeof area.radius === 'number' ? area.radius : Number(area.radius);
    if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
      return null;
    }

    const x = this.longitudeToScreenX(lng, viewport);
    const y = this.latitudeToScreenY(lat, viewport);
    const radiusPx = this.metersToPixels(radiusMeters, lat, viewport);

    if (!isFinite(x) || !isFinite(y) || !isFinite(radiusPx) || radiusPx <= 0) {
      return null;
    }

    return { x, y, radius: radiusPx, type: 0 };
  }

  private animationToScreenCircle(animation: DissipationAnimation, viewport: SkiaFogViewport): ScreenCircle | null {
    if (!Array.isArray(animation.center) || animation.center.length !== 2) {
      return null;
    }

    const [lng, lat] = animation.center;
    const radiusMeters = this.resolveAnimationRadius(animation);
    if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
      return null;
    }

    const x = this.longitudeToScreenX(lng, viewport);
    const y = this.latitudeToScreenY(lat, viewport);
    const radiusPx = this.metersToPixels(radiusMeters, lat, viewport);

    if (!isFinite(x) || !isFinite(y) || !isFinite(radiusPx) || radiusPx <= 0) {
      return null;
    }

    return { x, y, radius: radiusPx, type: 1 };
  }

  private resolveAreaCoordinates(area: GenericExploredArea): [number, number] | null {
    if (Array.isArray(area.center) && area.center.length === 2) {
      const [lng, lat] = area.center;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return [lat, lng];
      }
    }

    if (Number.isFinite(area.latitude) && Number.isFinite(area.longitude)) {
      return [area.latitude as number, area.longitude as number];
    }

    return null;
  }

  private resolveAnimationRadius(animation: DissipationAnimation): number {
    const raw = (animation as unknown as { radius?: unknown }).radius;
    if (typeof raw === 'number') {
      return raw;
    }
    if (raw && typeof (raw as { value?: unknown }).value === 'number') {
      return (raw as { value: number }).value;
    }
    if (raw && typeof (raw as { _value?: unknown })._value === 'number') {
      return (raw as { _value: number })._value;
    }
    return 0;
  }

  private metersToPixels(meters: number, lat: number, viewport: SkiaFogViewport): number {
    const latRange = viewport.bounds.north - viewport.bounds.south;
    const lngRange = viewport.bounds.east - viewport.bounds.west;
    if (!Number.isFinite(latRange) || !Number.isFinite(lngRange) || latRange === 0 || lngRange === 0) {
      return 0;
    }

    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = metersPerDegreeLat * Math.cos(lat * Math.PI / 180);
    const radiusLat = meters / metersPerDegreeLat;
    const radiusLng = meters / Math.max(metersPerDegreeLng, 1e-6);
    const radiusDeg = Math.min(radiusLat, radiusLng);
    const pixelsPerDegree = viewport.height / latRange;
    return radiusDeg * pixelsPerDegree;
  }

  private longitudeToScreenX(lng: number, viewport: SkiaFogViewport): number {
    const lngRange = viewport.bounds.east - viewport.bounds.west;
    if (!Number.isFinite(lngRange) || lngRange === 0) {
      return (viewport.width || 0) / 2;
    }
    const normalized = (lng - viewport.bounds.west) / lngRange;
    return normalized * viewport.width;
  }

  private latitudeToScreenY(lat: number, viewport: SkiaFogViewport): number {
    const latRange = viewport.bounds.north - viewport.bounds.south;
    if (!Number.isFinite(latRange) || latRange === 0) {
      return (viewport.height || 0) / 2;
    }
    const normalized = (viewport.bounds.north - lat) / latRange;
    return normalized * viewport.height;
  }

  private isViewportValid(viewport: SkiaFogViewport): boolean {
    if (!viewport) {
      return false;
    }

    const hasSize = Number.isFinite(viewport.width) && Number.isFinite(viewport.height) && viewport.width > 0 && viewport.height > 0;
    const hasBounds = viewport.bounds &&
      Number.isFinite(viewport.bounds.north) &&
      Number.isFinite(viewport.bounds.south) &&
      Number.isFinite(viewport.bounds.east) &&
      Number.isFinite(viewport.bounds.west) &&
      viewport.bounds.north !== viewport.bounds.south &&
      viewport.bounds.east !== viewport.bounds.west;

    return hasSize && hasBounds;
  }

  private computeCacheKey(request: FogMaskUniformBuildRequest): string {
    const parts: string[] = [
      String(request.exploredAreas.length),
      String(request.dissipationAnimations.length),
      String(Math.round(request.viewport.width || 0)),
      String(Math.round(request.viewport.height || 0)),
      request.zoom.toFixed(2),
    ];

    if (request.exploredAreas.length > 0) {
      const first = this.resolveAreaCoordinates(request.exploredAreas[0]);
      const last = this.resolveAreaCoordinates(request.exploredAreas[request.exploredAreas.length - 1]);
      if (first) {
        parts.push(this.formatNumber(first[0], 3), this.formatNumber(first[1], 3));
      }
      if (last) {
        parts.push(this.formatNumber(last[0], 3), this.formatNumber(last[1], 3));
      }
    }

    if (request.dissipationAnimations.length > 0) {
      const center = request.dissipationAnimations[0]?.center;
      if (Array.isArray(center) && center.length === 2) {
        parts.push(this.formatNumber(center[1], 3), this.formatNumber(center[0], 3));
      }
    }

    return parts.join('|');
  }

  private clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  private formatNumber(value: unknown, precision: number): string {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return '0';
    }
    return num.toFixed(precision);
  }
}

let instance: FogMaskUniformService | null = null;

export const getFogMaskUniformService = (): FogMaskUniformService => {
  if (!instance) {
    instance = new FogMaskUniformService();
  }
  return instance;
};
