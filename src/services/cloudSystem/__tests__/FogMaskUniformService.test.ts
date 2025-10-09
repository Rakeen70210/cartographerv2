jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Surface: {
      Make: jest.fn(() => null),
    },
    Paint: jest.fn(() => ({
      setAntiAlias: jest.fn(),
      setBlendMode: jest.fn(),
      setColor: jest.fn(),
    })),
    Color: jest.fn(() => 0),
    XYWHRect: jest.fn(() => ({})),
  },
  TileMode: {
    Clamp: 0,
    Repeat: 1,
    Mirror: 2,
  },
  BlendMode: {
    Src: 0,
    SrcOver: 1,
  },
}));

import { FogMaskUniformService } from '../FogMaskUniformService';
import type { FogMaskUniformBuildResult } from '../FogMaskUniformService';

const viewport = {
  width: 100,
  height: 100,
  bounds: {
    north: 1,
    south: 0,
    east: 1,
    west: 0,
  },
};

describe('FogMaskUniformService', () => {
  const createMinimalSkiaStub = () => ({
    Surface: {
      Make: jest.fn(() => null),
    },
    Paint: jest.fn(() => ({
      setAntiAlias: jest.fn(),
      setBlendMode: jest.fn(),
      setColor: jest.fn(),
    })),
    Color: jest.fn(() => 0),
    XYWHRect: jest.fn(() => ({})),
  }) as any;

  it('returns uniform array mode when texture sampling is unavailable', () => {
    const service = new FogMaskUniformService({
      skia: createMinimalSkiaStub(),
      uniformBudget: 4,
    });

    const result = service.buildFogMaskUniforms({
      exploredAreas: [{ id: 'area-1', latitude: 0.5, longitude: 0.5, radius: 120 }],
      dissipationAnimations: [],
      viewport,
      zoom: 12,
    });

    expect(result.mode).toBe('uniform_array');
    expect(result.circleCount).toBe(1);
    expect(result.uniforms.u_maskMode).toBe(1);
    const buffer = result.uniforms.u_circleUniforms as Float32Array;
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer[0]).toBeCloseTo(50, 1); // x pixel coordinate
    expect(buffer[1]).toBeCloseTo(50, 1); // y pixel coordinate
  });

  it('falls back to CPU path when circle count exceeds uniform budget', () => {
    const service = new FogMaskUniformService({
      skia: createMinimalSkiaStub(),
      uniformBudget: 0,
      circleBudget: 16,
    });

    const exploredAreas = Array.from({ length: 40 }).map((_, index) => ({
      id: `area-${index}`,
      latitude: 0.4 + index * 0.001,
      longitude: 0.4 + index * 0.001,
      radius: 150,
    }));

    const result = service.buildFogMaskUniforms({
      exploredAreas,
      dissipationAnimations: [],
      viewport,
      zoom: 10,
    });

    expect(result.mode).toBe('cpu_fallback');
    expect(result.uniforms.u_maskMode).toBe(2);
    expect(result.circleCount).toBeGreaterThan(0);
  });

  it('packages circles into texture data when Skia surface is available', () => {
    const shaderRef = { kind: 'shader' } as any;
    const canvasStub = {
      clear: jest.fn(),
      drawRect: jest.fn(),
    };
    const surfaceStub = {
      getCanvas: jest.fn(() => canvasStub),
      makeImageSnapshot: jest.fn(() => ({
        makeShader: jest.fn(() => shaderRef),
      })),
    };

    const skiaStub = {
      Surface: {
        Make: jest.fn(() => surfaceStub),
      },
      Paint: jest.fn(() => ({
        setAntiAlias: jest.fn(),
        setBlendMode: jest.fn(),
        setColor: jest.fn(),
      })),
      Color: jest.fn(() => 0),
      XYWHRect: jest.fn(() => ({})),
    } as any;

    const service = new FogMaskUniformService({
      skia: skiaStub,
      uniformBudget: 8,
    });

    const result = service.buildFogMaskUniforms({
      exploredAreas: [{ id: 'tex-1', latitude: 0.5, longitude: 0.5, radius: 180 }],
      dissipationAnimations: [],
      viewport,
      zoom: 14,
    }) as FogMaskUniformBuildResult;

    expect(result.mode).toBe('texture');
    expect(result.circleCount).toBe(1);
    expect(result.uniforms.u_maskMode).toBe(0);
    expect(result.uniforms.u_circleData).toBe(shaderRef);
    expect(result.diagnostics.textureSize[0]).toBeGreaterThan(0);
    expect(canvasStub.drawRect).toHaveBeenCalled();
    expect(surfaceStub.makeImageSnapshot).toHaveBeenCalled();
  });
});
