import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { BoundingBox, FogGeometry } from '../types/fog';
import {
  createWorldAnchoredCloudPuffs,
  ScreenPoint,
} from './CloudFogCanvasUtils';
import { CloudFogVisualParams } from '../services/cloudSystem/settings/CloudFogVisualAdapter';

interface WebMapLike {
  getBounds: () => {
    getNorth: () => number;
    getSouth: () => number;
    getEast: () => number;
    getWest: () => number;
  };
  on: (event: string, handler: (...args: any[]) => void) => void;
  off?: (event: string, handler: (...args: any[]) => void) => void;
  project: (coordinate: [number, number]) => ScreenPoint;
}

interface CloudFogCanvasOverlayProps {
  map: WebMapLike | null;
  visible: boolean;
  cloudDensity: number;
  zoomLevel: number;
  visualParams: CloudFogVisualParams;
  fogGeometry: FogGeometry | null;
  exploredAreas: Array<{
    center: [number, number];
    radius: number;
  }>;
}
const INTERACT_FRAME_MS = 40;
const IDLE_FRAME_MS = 90;
const MAX_PROJECTABLE_LATITUDE = 85.051129;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const wrapLongitude = (longitude: number): number => {
  const wrapped = ((longitude + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
};

const projectCoordinate = (map: WebMapLike, longitude: number, latitude: number): ScreenPoint =>
  map.project([
    wrapLongitude(longitude),
    clamp(latitude, -MAX_PROJECTABLE_LATITUDE, MAX_PROJECTABLE_LATITUDE),
  ]);

const getBounds = (map: WebMapLike): BoundingBox => {
  const bounds = map.getBounds();
  const north = clamp(bounds.getNorth(), -MAX_PROJECTABLE_LATITUDE, MAX_PROJECTABLE_LATITUDE);
  const south = clamp(bounds.getSouth(), -MAX_PROJECTABLE_LATITUDE, MAX_PROJECTABLE_LATITUDE);
  const east = bounds.getEast();
  const west = bounds.getWest();

  if (!Number.isFinite(east) || !Number.isFinite(west) || east <= west || east > 180 || west < -180) {
    return {
      north,
      south,
      east: 180,
      west: -180,
    };
  }

  return {
    north,
    south,
    east,
    west,
  };
};

export const CloudFogCanvasOverlay: React.FC<CloudFogCanvasOverlayProps> = ({
  map,
  visible,
  cloudDensity,
  zoomLevel,
  visualParams,
  fogGeometry: _fogGeometry,
  exploredAreas,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isInteractingRef = useRef(false);
  const idleFrameRef = useRef<number | null>(null);
  const lastIdleDrawTimeRef = useRef(0);
  const lastInteractionDrawTimeRef = useRef(0);

  const effectiveOpacity = useMemo(() => visualParams.effectiveFogOpacity, [visualParams]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return null;
    }

    const width = Math.max(1, Math.floor(container.clientWidth));
    const height = Math.max(1, Math.floor(container.clientHeight));
    const devicePixelRatio = window.devicePixelRatio || 1;
    const scaledWidth = Math.max(1, Math.floor(width * devicePixelRatio));
    const scaledHeight = Math.max(1, Math.floor(height * devicePixelRatio));

    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    return {
      context,
      width,
      height,
    };
  }, []);

  const drawCloudPuff = useCallback((
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    seed: number,
    opacity: number,
    highlightStrength: number,
  ) => {
    const random = (offset: number) => {
      const value = Math.sin((seed + offset) * 43758.5453123) * 143758.5453;
      return value - Math.floor(value);
    };

    context.save();
    context.translate(centerX, centerY);
    context.rotate(rotation);

    const primary = visualParams.primaryColor.map(channel => Math.round(channel * 255));
    const secondary = visualParams.secondaryColor.map(channel => Math.round(channel * 255));
    const ambient = visualParams.ambientColor.map(channel => Math.round(channel * 255));
    const highlight = visualParams.highlightColor.map(channel => Math.round(channel * 255));

    const shadowGradient = context.createRadialGradient(
      radiusX * -0.25,
      radiusY * 0.18,
      radiusX * 0.08,
      radiusX * -0.1,
      radiusY * 0.18,
      radiusX * 1.1,
    );
    shadowGradient.addColorStop(0, `rgba(${secondary[0]},${secondary[1]},${secondary[2]},${0.52 * opacity})`);
    shadowGradient.addColorStop(1, `rgba(${secondary[0]},${secondary[1]},${secondary[2]},0)`);
    context.fillStyle = shadowGradient;
    context.beginPath();
    context.ellipse(0, radiusY * 0.12, radiusX * 1.05, radiusY * 0.86, 0, 0, Math.PI * 2);
    context.fill();

    const lobeCount = 3 + Math.floor(random(1) * 2);
    for (let index = 0; index < lobeCount; index += 1) {
      const angle = (index / lobeCount) * Math.PI * 2 + (random(index + 2) - 0.5) * 0.65;
      const offsetRadius = radiusX * (0.12 + random(index + 9) * 0.26);
      const lobeX = Math.cos(angle) * offsetRadius * 0.85;
      const lobeY = Math.sin(angle) * offsetRadius * 0.38;
      const lobeRadiusX = radiusX * (0.55 + random(index + 16) * 0.4);
      const lobeRadiusY = radiusY * (0.52 + random(index + 23) * 0.36);

      const bodyGradient = context.createRadialGradient(
        lobeX - lobeRadiusX * 0.2,
        lobeY - lobeRadiusY * 0.14,
        lobeRadiusX * 0.12,
        lobeX,
        lobeY,
        lobeRadiusX,
      );
      bodyGradient.addColorStop(0, `rgba(${highlight[0]},${highlight[1]},${highlight[2]},${0.88 * opacity})`);
      bodyGradient.addColorStop(0.38, `rgba(${primary[0]},${primary[1]},${primary[2]},${0.72 * opacity})`);
      bodyGradient.addColorStop(0.74, `rgba(${ambient[0]},${ambient[1]},${ambient[2]},${0.52 * opacity})`);
      bodyGradient.addColorStop(1, `rgba(${ambient[0]},${ambient[1]},${ambient[2]},0)`);
      context.fillStyle = bodyGradient;
      context.beginPath();
      context.ellipse(lobeX, lobeY, lobeRadiusX, lobeRadiusY, 0, 0, Math.PI * 2);
      context.fill();
    }

    const highlightGradient = context.createLinearGradient(
      -radiusX * 0.75,
      -radiusY * 0.6,
      radiusX * 0.45,
      radiusY * 0.15,
    );
    highlightGradient.addColorStop(0, `rgba(${highlight[0]},${highlight[1]},${highlight[2]},${highlightStrength * opacity * 0.82})`);
    highlightGradient.addColorStop(0.45, `rgba(${highlight[0]},${highlight[1]},${highlight[2]},${highlightStrength * opacity * 0.38})`);
    highlightGradient.addColorStop(1, `rgba(${highlight[0]},${highlight[1]},${highlight[2]},0)`);
    context.fillStyle = highlightGradient;
    context.beginPath();
    context.ellipse(-radiusX * 0.08, -radiusY * 0.08, radiusX * 0.92, radiusY * 0.68, 0, 0, Math.PI * 2);
    context.fill();

    context.restore();
  }, [visualParams]);

  const drawOverlay = useCallback((timeMs: number) => {
    const drawingSurface = resizeCanvas();
    if (!drawingSurface) {
      return;
    }

    const { context, width, height } = drawingSurface;
    context.clearRect(0, 0, width, height);

    if (!map || !visible) {
      return;
    }

    context.save();

    const ambient = visualParams.ambientColor.map(channel => Math.round(channel * 255));
    context.fillStyle = `rgba(${ambient[0]}, ${ambient[1]}, ${ambient[2]}, ${visualParams.veilAlpha})`;
    context.fillRect(0, 0, width, height);

    const deckGradient = context.createLinearGradient(0, 0, 0, height);
    deckGradient.addColorStop(0, `rgba(${ambient[0]}, ${ambient[1]}, ${ambient[2]}, ${visualParams.veilAlpha * 0.35})`);
    deckGradient.addColorStop(0.55, `rgba(${ambient[0]}, ${ambient[1]}, ${ambient[2]}, ${visualParams.veilAlpha * 0.16})`);
    deckGradient.addColorStop(1, `rgba(${ambient[0]}, ${ambient[1]}, ${ambient[2]}, ${visualParams.veilAlpha * 0.48})`);
    context.fillStyle = deckGradient;
    context.fillRect(0, 0, width, height);

    const puffs = createWorldAnchoredCloudPuffs(
      getBounds(map),
      zoomLevel,
      cloudDensity,
      timeMs * 0.001,
    );

    puffs.forEach(puff => {
      const [longitude, latitude] = puff.center;
      const center = projectCoordinate(map, longitude, latitude);
      const eastPoint = projectCoordinate(map, longitude + puff.radiusLng, latitude);
      const northPoint = projectCoordinate(map, longitude, latitude + puff.radiusLat);
      const radiusX = Math.max(22, Math.abs(eastPoint.x - center.x) * puff.stretchX);
      const radiusY = Math.max(18, Math.abs(northPoint.y - center.y) * puff.stretchY);

      if (
        center.x + radiusX < 0 ||
        center.x - radiusX > width ||
        center.y + radiusY < 0 ||
        center.y - radiusY > height
      ) {
        return;
      }

      drawCloudPuff(
        context,
        center.x,
        center.y,
        radiusX,
        radiusY,
        puff.rotation,
        puff.seed,
        puff.opacity * effectiveOpacity * visualParams.puffOpacityScale,
        puff.highlight,
      );
    });

    if (exploredAreas.length > 0) {
      context.save();
      context.globalCompositeOperation = 'destination-out';

      exploredAreas.forEach(area => {
        const [longitude, latitude] = area.center;
        const center = projectCoordinate(map, longitude, latitude);
        const latRadius = area.radius / 111320;
        const lngRadius = area.radius / Math.max(111320 * Math.cos((latitude * Math.PI) / 180), 0.0001);
        const eastPoint = projectCoordinate(map, longitude + lngRadius, latitude);
        const northPoint = projectCoordinate(map, longitude, latitude + latRadius);
        const radiusX = Math.max(24, Math.abs(eastPoint.x - center.x));
        const radiusY = Math.max(24, Math.abs(northPoint.y - center.y));

        const clearGradient = context.createRadialGradient(
          center.x,
          center.y,
          Math.max(4, Math.min(radiusX, radiusY) * 0.15),
          center.x,
          center.y,
          Math.max(radiusX, radiusY) * 1.25,
        );
        clearGradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        clearGradient.addColorStop(0.52, 'rgba(0, 0, 0, 0.92)');
        clearGradient.addColorStop(0.82, 'rgba(0, 0, 0, 0.4)');
        clearGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        context.fillStyle = clearGradient;
        context.beginPath();
        context.ellipse(center.x, center.y, radiusX * 1.15, radiusY * 1.15, 0, 0, Math.PI * 2);
        context.fill();
      });

      context.restore();
    }

    context.restore();
  }, [cloudDensity, drawCloudPuff, effectiveOpacity, exploredAreas, map, resizeCanvas, visible, visualParams, zoomLevel]);

  useEffect(() => {
    drawOverlay(performance.now());
  }, [drawOverlay]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const handleRender = () => {
      if (isInteractingRef.current) {
        const now = performance.now();
        if (now - lastInteractionDrawTimeRef.current < INTERACT_FRAME_MS) {
          return;
        }

        lastInteractionDrawTimeRef.current = now;
        drawOverlay(performance.now());
      }
    };
    const handleInteractionStart = () => {
      isInteractingRef.current = true;
      lastInteractionDrawTimeRef.current = 0;
      drawOverlay(performance.now());
    };
    const handleInteractionEnd = () => {
      isInteractingRef.current = false;
      lastInteractionDrawTimeRef.current = 0;
      drawOverlay(performance.now());
    };

    map.on('render', handleRender);
    map.on('movestart', handleInteractionStart);
    map.on('dragstart', handleInteractionStart);
    map.on('zoomstart', handleInteractionStart);
    map.on('pitchstart', handleInteractionStart);
    map.on('rotatestart', handleInteractionStart);
    map.on('moveend', handleInteractionEnd);
    map.on('dragend', handleInteractionEnd);
    map.on('zoomend', handleInteractionEnd);
    map.on('pitchend', handleInteractionEnd);
    map.on('rotateend', handleInteractionEnd);

    return () => {
      map.off?.('render', handleRender);
      map.off?.('movestart', handleInteractionStart);
      map.off?.('dragstart', handleInteractionStart);
      map.off?.('zoomstart', handleInteractionStart);
      map.off?.('pitchstart', handleInteractionStart);
      map.off?.('rotatestart', handleInteractionStart);
      map.off?.('moveend', handleInteractionEnd);
      map.off?.('dragend', handleInteractionEnd);
      map.off?.('zoomend', handleInteractionEnd);
      map.off?.('pitchend', handleInteractionEnd);
      map.off?.('rotateend', handleInteractionEnd);
    };
  }, [drawOverlay, map]);

  useEffect(() => {
    const loop = (timeMs: number) => {
      if (!isInteractingRef.current && timeMs - lastIdleDrawTimeRef.current >= IDLE_FRAME_MS) {
        lastIdleDrawTimeRef.current = timeMs;
        drawOverlay(timeMs);
      }
      idleFrameRef.current = window.requestAnimationFrame(loop);
    };

    idleFrameRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (idleFrameRef.current !== null) {
        window.cancelAnimationFrame(idleFrameRef.current);
      }
    };
  }, [drawOverlay]);

  useEffect(() => {
    const handleResize = () => drawOverlay(performance.now());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawOverlay]);

  return (
    <View style={styles.container}>
      <div ref={containerRef} style={overlayDivStyle}>
        <canvas ref={canvasRef} style={canvasStyle} />
      </div>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
    zIndex: 1,
  },
});

const overlayDivStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
};

const canvasStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'block',
  pointerEvents: 'none',
};
