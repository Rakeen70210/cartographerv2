import { SkiaCloudUniforms } from '../shaders/SkiaCloudShader';
import type {
  CloudColorScheme,
  CloudStylePreset,
  VisualCustomizationSettings,
} from './VisualCustomizationManager';

export const EXPLORATION_SOFT_CLOUDS_PRESET_ID = 'exploration_soft_clouds';
export const SOFT_CLOUD_VISUAL_ROLLOUT_VERSION = 1;

export interface CloudFogVisualParams {
  effectiveFogOpacity: number;
  baseHaze: number;
  edgeSoftness: number;
  hazeScale: number;
  massScale: number;
  detailScale: number;
  primaryColor: [number, number, number];
  secondaryColor: [number, number, number];
  highlightColor: [number, number, number];
  ambientColor: [number, number, number];
  veilAlpha: number;
  puffOpacityScale: number;
}

export interface BuildSkiaFogUniformsInput {
  time: number;
  resolution: [number, number];
  zoom: number;
  windOffset: [number, number];
  cloudDensity: number;
  animationSpeed: number;
  visualParams: CloudFogVisualParams;
}

export const getSoftCloudVisualSettingsBaseline = (): VisualCustomizationSettings => ({
  selectedColorScheme: 'day',
  selectedStylePreset: EXPLORATION_SOFT_CLOUDS_PRESET_ID,
  opacity: 0.86,
  contrast: 0.84,
  brightness: 1.03,
  saturation: 0.82,
  enableCustomColors: false,
});

const DEFAULT_COLOR_SCHEME: CloudColorScheme = {
  id: 'day',
  name: 'Day',
  description: 'Bright, natural daytime clouds',
  colors: {
    primary: '#F0F0F0',
    secondary: '#D0D0D0',
    highlight: '#FFFFFF',
    ambient: '#E8E8E8',
  },
  opacity: 0.8,
  contrast: 1.0,
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return [1, 1, 1];
  }

  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
};

const applyBrightnessAndSaturation = (
  color: [number, number, number],
  brightness: number,
  saturation: number,
): [number, number, number] => {
  const normalizedBrightness = clamp(brightness, 0.4, 1.6);
  const normalizedSaturation = clamp(saturation, 0, 2);
  const lit: [number, number, number] = [
    clamp(color[0] * normalizedBrightness, 0, 1),
    clamp(color[1] * normalizedBrightness, 0, 1),
    clamp(color[2] * normalizedBrightness, 0, 1),
  ];
  const luminance = lit[0] * 0.2126 + lit[1] * 0.7152 + lit[2] * 0.0722;

  return [
    clamp(luminance + (lit[0] - luminance) * normalizedSaturation, 0, 1),
    clamp(luminance + (lit[1] - luminance) * normalizedSaturation, 0, 1),
    clamp(luminance + (lit[2] - luminance) * normalizedSaturation, 0, 1),
  ];
};

const getPresetProfile = (presetId?: string) => {
  switch (presetId) {
    case 'dramatic':
      return { baseHaze: 0.34, edgeSoftness: 0.62, hazeScale: 0.52, massScale: 1.05, detailScale: 1.95 };
    case 'dreamy':
      return { baseHaze: 0.48, edgeSoftness: 0.86, hazeScale: 0.62, massScale: 0.95, detailScale: 1.7 };
    case 'stylized':
      return { baseHaze: 0.38, edgeSoftness: 0.68, hazeScale: 0.5, massScale: 1.1, detailScale: 2.0 };
    case 'minimal':
      return { baseHaze: 0.28, edgeSoftness: 0.74, hazeScale: 0.64, massScale: 0.85, detailScale: 1.45 };
    case 'realistic':
      return { baseHaze: 0.4, edgeSoftness: 0.82, hazeScale: 0.5, massScale: 0.92, detailScale: 1.38 };
    case EXPLORATION_SOFT_CLOUDS_PRESET_ID:
    default:
      return { baseHaze: 0.5, edgeSoftness: 0.96, hazeScale: 0.48, massScale: 0.84, detailScale: 1.22 };
  }
};

export const deriveCloudFogVisualParams = ({
  visualSettings,
  currentScheme,
  currentPreset,
  baseFogOpacity,
}: {
  visualSettings: VisualCustomizationSettings;
  currentScheme: CloudColorScheme | null;
  currentPreset: CloudStylePreset | null;
  baseFogOpacity: number;
}): CloudFogVisualParams => {
  const scheme = currentScheme ?? DEFAULT_COLOR_SCHEME;
  const profile = getPresetProfile(currentPreset?.id ?? visualSettings.selectedStylePreset);
  const presetOpacity = currentPreset?.settings.opacity ?? 1;
  const presetContrast = currentPreset?.settings.contrast ?? 1;
  const visualOpacity = clamp(visualSettings.opacity, 0, 2);
  const visualContrast = clamp(visualSettings.contrast, 0.5, 2);
  const contrast = clamp(presetContrast * scheme.contrast * visualContrast, 0.6, 1.8);

  const primaryColor = applyBrightnessAndSaturation(
    hexToRgb(scheme.colors.primary),
    visualSettings.brightness,
    visualSettings.saturation,
  );
  const secondaryColor = applyBrightnessAndSaturation(
    hexToRgb(scheme.colors.secondary),
    visualSettings.brightness * 0.98,
    visualSettings.saturation,
  );
  const highlightColor = applyBrightnessAndSaturation(
    hexToRgb(scheme.colors.highlight),
    visualSettings.brightness * 1.02,
    visualSettings.saturation * 0.9,
  );
  const ambientColor = applyBrightnessAndSaturation(
    hexToRgb(scheme.colors.ambient),
    visualSettings.brightness,
    visualSettings.saturation * 0.95,
  );

  // Keep the chain simple: only the user-facing base opacity and the preset tune it.
  // Removing scheme.opacity/visualOpacity multiplication prevents the ~0.37 compound result.
  const effectiveFogOpacity = clamp(baseFogOpacity * presetOpacity * 0.94, 0, 0.92);

  return {
    effectiveFogOpacity,
    baseHaze: clamp(profile.baseHaze / Math.max(0.82, contrast * 0.92), 0.24, 0.72),
    edgeSoftness: clamp(profile.edgeSoftness - (contrast - 1) * 0.05, 0.62, 1.18),
    hazeScale: clamp(profile.hazeScale + (1 - scheme.opacity) * 0.04, 0.28, 1.1),
    massScale: clamp(profile.massScale + (contrast - 1) * 0.04, 0.62, 1.2),
    detailScale: clamp(profile.detailScale + (contrast - 1) * 0.08, 0.9, 1.9),
    primaryColor,
    secondaryColor,
    highlightColor,
    ambientColor,
    veilAlpha: clamp(effectiveFogOpacity * 0.38, 0.14, 0.38),
    puffOpacityScale: clamp(0.58 + contrast * 0.08, 0.52, 0.76),
  };
};

export const buildSkiaFogUniforms = ({
  time,
  resolution,
  zoom,
  windOffset,
  cloudDensity,
  animationSpeed,
  visualParams,
}: BuildSkiaFogUniformsInput): SkiaCloudUniforms => ({
  u_time: time,
  u_resolution: resolution,
  u_zoom: zoom,
  u_wind_offset: windOffset,
  u_cloud_density: cloudDensity,
  u_animation_speed: animationSpeed,
  u_fog_opacity: visualParams.effectiveFogOpacity,
  u_base_haze: visualParams.baseHaze,
  u_edge_softness: visualParams.edgeSoftness,
  u_haze_scale: visualParams.hazeScale,
  u_mass_scale: visualParams.massScale,
  u_detail_scale: visualParams.detailScale,
  u_cloud_primary_color: visualParams.primaryColor,
  u_cloud_secondary_color: visualParams.secondaryColor,
  u_cloud_highlight_color: visualParams.highlightColor,
  u_cloud_ambient_color: visualParams.ambientColor,
});
