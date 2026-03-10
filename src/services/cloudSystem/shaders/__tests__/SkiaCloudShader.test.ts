import { SkiaShaderManager } from '../SkiaShaderManager';
import { defaultSkiaCloudUniforms, validateSkiaCloudUniforms } from '../SkiaCloudShader';

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    RuntimeEffect: {
      Make: jest.fn(() => ({})),
    },
  },
}));

describe('SkiaCloudShader uniforms', () => {
  it('should provide soft-cloud defaults for the expanded uniform set', () => {
    expect(defaultSkiaCloudUniforms.u_fog_opacity).toBeGreaterThan(0.6);
    expect(defaultSkiaCloudUniforms.u_base_haze).toBeGreaterThan(0.3);
    expect(defaultSkiaCloudUniforms.u_cloud_primary_color).toHaveLength(3);
    expect(defaultSkiaCloudUniforms.u_cloud_highlight_color).toEqual([1, 1, 1]);
  });

  it('should clamp numeric and color uniforms', () => {
    const uniforms = validateSkiaCloudUniforms({
      u_fog_opacity: 2,
      u_base_haze: -1,
      u_edge_softness: 2,
      u_haze_scale: -4,
      u_cloud_primary_color: [1.5, -1, 0.5],
    });

    expect(uniforms.u_fog_opacity).toBe(1);
    expect(uniforms.u_base_haze).toBe(0);
    expect(uniforms.u_edge_softness).toBe(1.5);
    expect(uniforms.u_haze_scale).toBe(0.1);
    expect(uniforms.u_cloud_primary_color).toEqual([1, 0, 0.5]);
  });

  it('should serialize expanded uniforms for Skia consumption', () => {
    const manager = new SkiaShaderManager();
    manager.updateUniforms({
      u_fog_opacity: 0.88,
      u_base_haze: 0.5,
      u_edge_softness: 0.7,
      u_haze_scale: 0.6,
      u_mass_scale: 1.1,
      u_detail_scale: 1.9,
      u_cloud_primary_color: [0.91, 0.93, 0.97],
      u_cloud_secondary_color: [0.8, 0.84, 0.9],
      u_cloud_highlight_color: [1, 1, 1],
      u_cloud_ambient_color: [0.89, 0.92, 0.96],
    });

    expect(manager.createUniformsForSkia()).toMatchObject({
      u_fog_opacity: 0.88,
      u_base_haze: 0.5,
      u_edge_softness: 0.7,
      u_haze_scale: 0.6,
      u_mass_scale: 1.1,
      u_detail_scale: 1.9,
      u_cloud_primary_color: [0.91, 0.93, 0.97],
    });
  });
});
