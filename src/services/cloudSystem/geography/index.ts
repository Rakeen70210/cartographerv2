/**
 * Geographic context and terrain-aware cloud generation
 * Exports all geography-related cloud system components
 */

export {
  TerrainAnalyzer,
  type TerrainType,
  type ElevationData,
  type WaterBodyInfo,
  type UrbanInfo,
  type ClimateInfo,
  type TerrainAnalysis
} from './TerrainAnalyzer';

export {
  GeographicCloudPatterns,
  type GeographicCloudStyle,
  type RegionalCloudConfig
} from './GeographicCloudPatterns';

export {
  TerrainAwareCloudGenerator,
  type TerrainAwareGeneratorConfig,
  type CloudRegion
} from './TerrainAwareCloudGenerator';

export {
  AdaptiveCloudDensitySystem,
  type DensityAdaptationRule,
  type RegionalDensityProfile,
  type MarineFogConfig,
  type UrbanAdaptationConfig,
  type AdaptiveDensityConfig
} from './AdaptiveCloudDensitySystem';

export {
  MarineFogEffects,
  type MarineFogParameters,
  type FogFormationConditions,
  type MarineFogType
} from './MarineFogEffects';

export {
  UrbanCloudAdaptation,
  type UrbanHeatIslandEffect,
  type PollutionHazeEffect,
  type BuildingWakeEffect,
  type UrbanCloudProfile,
  type UrbanAdaptationSettings
} from './UrbanCloudAdaptation';