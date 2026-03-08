import {
  buildSkiaFogUniforms,
  deriveCloudFogVisualParams,
  EXPLORATION_SOFT_CLOUDS_PRESET_ID,
  getSoftCloudVisualSettingsBaseline,
} from '../CloudFogVisualAdapter';
import {
  CloudColorScheme,
  CloudStylePreset,
} from '../VisualCustomizationManager';

describe('CloudFogVisualAdapter', () => {
  const dayScheme: CloudColorScheme = {
    id: 'day',
    name: 'Day',
    description: 'Day clouds',
    colors: {
      primary: '#F0F0F0',
      secondary: '#D0D8E4',
      highlight: '#FFFFFF',
      ambient: '#E6ECF4',
    },
    opacity: 0.8,
    contrast: 1.0,
  };

  const softCloudPreset: CloudStylePreset = {
    id: EXPLORATION_SOFT_CLOUDS_PRESET_ID,
    name: 'Exploration Soft Clouds',
    description: 'Soft clouds',
    colorScheme: 'day',
    settings: {
      density: 0.72,
      animationSpeed: 0.5,
      opacity: 0.76,
      contrast: 0.8,
    },
  };

  it('should derive soft-cloud visual params from the selected preset', () => {
    const params = deriveCloudFogVisualParams({
      visualSettings: getSoftCloudVisualSettingsBaseline(),
      currentScheme: dayScheme,
      currentPreset: softCloudPreset,
      baseFogOpacity: 0.8,
    });

    expect(params.baseHaze).toBeGreaterThan(0.2);
    expect(params.edgeSoftness).toBeGreaterThan(0.5);
    expect(params.primaryColor).toHaveLength(3);
    expect(params.effectiveFogOpacity).toBeGreaterThan(0.3);
  });

  it('should merge derived visual params into Skia uniforms', () => {
    const params = deriveCloudFogVisualParams({
      visualSettings: {
        ...getSoftCloudVisualSettingsBaseline(),
        brightness: 1.1,
        saturation: 0.9,
      },
      currentScheme: dayScheme,
      currentPreset: softCloudPreset,
      baseFogOpacity: 0.8,
    });

    const uniforms = buildSkiaFogUniforms({
      time: 1.5,
      resolution: [400, 600],
      zoom: 10,
      windOffset: [0.2, 0.4],
      cloudDensity: 0.75,
      animationSpeed: 0.9,
      visualParams: params,
    });

    expect(uniforms).toMatchObject({
      u_time: 1.5,
      u_resolution: [400, 600],
      u_zoom: 10,
      u_cloud_density: 0.75,
      u_animation_speed: 0.9,
      u_base_haze: params.baseHaze,
      u_fog_opacity: params.effectiveFogOpacity,
      u_cloud_primary_color: params.primaryColor,
      u_cloud_secondary_color: params.secondaryColor,
    });
  });
});
