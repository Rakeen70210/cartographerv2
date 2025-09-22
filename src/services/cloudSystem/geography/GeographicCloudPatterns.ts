/**
 * Geographic cloud pattern system
 * Defines different cloud patterns and styles based on terrain and geographic context
 */

import { DensityConfig } from '../geometry/DensityCalculator';
import { TerrainAnalysis, TerrainType } from './TerrainAnalyzer';
import { CloudGeneratorConfig } from '../../../types/cloud';

export interface GeographicCloudStyle {
  name: string;
  description: string;
  densityConfig: DensityConfig;
  generatorConfig: CloudGeneratorConfig;
  visualProperties: {
    opacity: number;
    color: [number, number, number]; // RGB 0-1
    contrast: number;
    softness: number;
  };
  animationProperties: {
    driftSpeed: number;
    morphSpeed: number;
    dissipationStyle: 'radial' | 'linear' | 'organic';
  };
}

export interface RegionalCloudConfig {
  terrainType: TerrainType['type'];
  primaryStyle: GeographicCloudStyle;
  secondaryStyle?: GeographicCloudStyle;
  blendFactor: number; // 0-1, how much to blend secondary style
  adaptiveFactors: {
    elevationInfluence: number;
    waterInfluence: number;
    urbanInfluence: number;
    seasonalInfluence: number;
  };
}

/**
 * Manages geographic-specific cloud patterns and styles
 */
export class GeographicCloudPatterns {
  private cloudStyles: Map<string, GeographicCloudStyle> = new Map();
  private regionalConfigs: Map<TerrainType['type'], RegionalCloudConfig> = new Map();

  constructor() {
    this.initializeCloudStyles();
    this.initializeRegionalConfigs();
  }

  /**
   * Get cloud configuration for a specific terrain analysis
   */
  public getCloudConfigForTerrain(analysis: TerrainAnalysis): {
    style: GeographicCloudStyle;
    adaptedConfig: DensityConfig;
    adaptedGenerator: CloudGeneratorConfig;
  } {
    const terrainType = analysis.terrainType.type;
    const regionalConfig = this.regionalConfigs.get(terrainType);
    
    if (!regionalConfig) {
      // Fallback to default land configuration
      return this.getDefaultConfiguration();
    }

    // Get base style
    let baseStyle = regionalConfig.primaryStyle;
    
    // Blend with secondary style if present
    if (regionalConfig.secondaryStyle && regionalConfig.blendFactor > 0) {
      baseStyle = this.blendCloudStyles(
        baseStyle,
        regionalConfig.secondaryStyle,
        regionalConfig.blendFactor
      );
    }

    // Apply adaptive modifications based on specific terrain features
    const adaptedConfig = this.adaptConfigurationToTerrain(
      baseStyle.densityConfig,
      analysis,
      regionalConfig.adaptiveFactors
    );

    const adaptedGenerator = this.adaptGeneratorToTerrain(
      baseStyle.generatorConfig,
      analysis,
      regionalConfig.adaptiveFactors
    );

    return {
      style: baseStyle,
      adaptedConfig,
      adaptedGenerator
    };
  }

  /**
   * Get cloud style for water bodies (marine fog effects)
   */
  public getMarineFogStyle(waterType: 'ocean' | 'lake' | 'river'): GeographicCloudStyle {
    switch (waterType) {
      case 'ocean':
        return this.cloudStyles.get('oceanicFog')!;
      case 'lake':
        return this.cloudStyles.get('lakeFog')!;
      case 'river':
        return this.cloudStyles.get('riverMist')!;
      default:
        return this.cloudStyles.get('genericFog')!;
    }
  }

  /**
   * Get cloud style for urban areas
   */
  public getUrbanCloudStyle(urbanDensity: number): GeographicCloudStyle {
    if (urbanDensity > 0.8) {
      return this.cloudStyles.get('denseCitySmog')!;
    } else if (urbanDensity > 0.5) {
      return this.cloudStyles.get('suburbanHaze')!;
    } else {
      return this.cloudStyles.get('ruralClouds')!;
    }
  }

  /**
   * Get elevation-adapted cloud style
   */
  public getElevationCloudStyle(elevation: number): GeographicCloudStyle {
    if (elevation > 2000) {
      return this.cloudStyles.get('alpineClouds')!;
    } else if (elevation > 1000) {
      return this.cloudStyles.get('mountainClouds')!;
    } else if (elevation > 500) {
      return this.cloudStyles.get('hillClouds')!;
    } else {
      return this.cloudStyles.get('lowlandClouds')!;
    }
  }

  /**
   * Initialize all cloud style definitions
   */
  private initializeCloudStyles(): void {
    // Oceanic fog - dense, low-lying marine fog
    this.cloudStyles.set('oceanicFog', {
      name: 'Oceanic Fog',
      description: 'Dense marine fog with high moisture content',
      densityConfig: {
        baseNoise: {
          octaves: 4,
          persistence: 0.8,
          lacunarity: 1.5,
          scale: 0.0008
        },
        detailNoise: {
          octaves: 2,
          persistence: 0.4,
          lacunarity: 2.0,
          scale: 0.004
        },
        turbulenceIntensity: 0.1,
        densityThreshold: 0.15,
        falloffDistance: 0.5
      },
      generatorConfig: {
        cloudDensity: 0.85,
        noiseScale: 0.0008,
        octaves: 4,
        persistence: 0.8,
        lacunarity: 1.5,
        windDirection: { x: 1, y: 0 },
        windSpeed: 2
      },
      visualProperties: {
        opacity: 0.9,
        color: [0.85, 0.88, 0.92],
        contrast: 0.7,
        softness: 0.8
      },
      animationProperties: {
        driftSpeed: 0.5,
        morphSpeed: 0.2,
        dissipationStyle: 'organic'
      }
    });

    // Lake fog - lighter, more localized fog
    this.cloudStyles.set('lakeFog', {
      name: 'Lake Fog',
      description: 'Light fog forming over lake surfaces',
      densityConfig: {
        baseNoise: {
          octaves: 3,
          persistence: 0.6,
          lacunarity: 1.8,
          scale: 0.001
        },
        turbulenceIntensity: 0.15,
        densityThreshold: 0.25,
        falloffDistance: 0.4
      },
      generatorConfig: {
        cloudDensity: 0.6,
        noiseScale: 0.001,
        octaves: 3,
        persistence: 0.6,
        lacunarity: 1.8,
        windDirection: { x: 0.7, y: 0.7 },
        windSpeed: 1.5
      },
      visualProperties: {
        opacity: 0.7,
        color: [0.88, 0.91, 0.95],
        contrast: 0.6,
        softness: 0.9
      },
      animationProperties: {
        driftSpeed: 0.3,
        morphSpeed: 0.3,
        dissipationStyle: 'radial'
      }
    });

    // River mist - thin, flowing mist along waterways
    this.cloudStyles.set('riverMist', {
      name: 'River Mist',
      description: 'Thin mist following river valleys',
      densityConfig: {
        baseNoise: {
          octaves: 2,
          persistence: 0.5,
          lacunarity: 2.2,
          scale: 0.002
        },
        turbulenceIntensity: 0.2,
        densityThreshold: 0.3,
        falloffDistance: 0.3
      },
      generatorConfig: {
        cloudDensity: 0.4,
        noiseScale: 0.002,
        octaves: 2,
        persistence: 0.5,
        lacunarity: 2.2,
        windDirection: { x: 1, y: 0.2 },
        windSpeed: 1
      },
      visualProperties: {
        opacity: 0.5,
        color: [0.9, 0.93, 0.97],
        contrast: 0.5,
        softness: 0.95
      },
      animationProperties: {
        driftSpeed: 0.8,
        morphSpeed: 0.4,
        dissipationStyle: 'linear'
      }
    });

    // Dense city smog - heavy urban pollution clouds
    this.cloudStyles.set('denseCitySmog', {
      name: 'Urban Smog',
      description: 'Heavy smog in dense urban areas',
      densityConfig: {
        baseNoise: {
          octaves: 5,
          persistence: 0.7,
          lacunarity: 1.6,
          scale: 0.0005
        },
        detailNoise: {
          octaves: 3,
          persistence: 0.5,
          lacunarity: 2.5,
          scale: 0.003
        },
        turbulenceIntensity: 0.4,
        densityThreshold: 0.2,
        falloffDistance: 0.6
      },
      generatorConfig: {
        cloudDensity: 0.75,
        noiseScale: 0.0005,
        octaves: 5,
        persistence: 0.7,
        lacunarity: 1.6,
        windDirection: { x: 0.5, y: 0.5 },
        windSpeed: 0.8
      },
      visualProperties: {
        opacity: 0.8,
        color: [0.75, 0.78, 0.82],
        contrast: 0.8,
        softness: 0.6
      },
      animationProperties: {
        driftSpeed: 0.2,
        morphSpeed: 0.1,
        dissipationStyle: 'organic'
      }
    });

    // Alpine clouds - high altitude, wispy clouds
    this.cloudStyles.set('alpineClouds', {
      name: 'Alpine Clouds',
      description: 'High altitude clouds with orographic effects',
      densityConfig: {
        baseNoise: {
          octaves: 6,
          persistence: 0.4,
          lacunarity: 2.3,
          scale: 0.0003
        },
        ridgeNoise: {
          octaves: 4,
          persistence: 0.3,
          lacunarity: 2.0,
          scale: 0.001
        },
        turbulenceIntensity: 0.6,
        densityThreshold: 0.45,
        falloffDistance: 0.2
      },
      generatorConfig: {
        cloudDensity: 0.5,
        noiseScale: 0.0003,
        octaves: 6,
        persistence: 0.4,
        lacunarity: 2.3,
        windDirection: { x: 1, y: 0.3 },
        windSpeed: 4
      },
      visualProperties: {
        opacity: 0.6,
        color: [0.95, 0.96, 0.98],
        contrast: 0.9,
        softness: 0.4
      },
      animationProperties: {
        driftSpeed: 1.5,
        morphSpeed: 0.8,
        dissipationStyle: 'linear'
      }
    });

    // Add more cloud styles...
    this.addAdditionalCloudStyles();
  }

  /**
   * Add additional cloud styles for different terrain types
   */
  private addAdditionalCloudStyles(): void {
    // Mountain clouds
    this.cloudStyles.set('mountainClouds', {
      name: 'Mountain Clouds',
      description: 'Orographic clouds forming around mountains',
      densityConfig: {
        baseNoise: {
          octaves: 5,
          persistence: 0.5,
          lacunarity: 2.0,
          scale: 0.0006
        },
        detailNoise: {
          octaves: 3,
          persistence: 0.4,
          lacunarity: 2.2,
          scale: 0.002
        },
        turbulenceIntensity: 0.3,
        densityThreshold: 0.35,
        falloffDistance: 0.3
      },
      generatorConfig: {
        cloudDensity: 0.65,
        noiseScale: 0.0006,
        octaves: 5,
        persistence: 0.5,
        lacunarity: 2.0,
        windDirection: { x: 0.8, y: 0.6 },
        windSpeed: 3
      },
      visualProperties: {
        opacity: 0.75,
        color: [0.9, 0.92, 0.95],
        contrast: 0.8,
        softness: 0.6
      },
      animationProperties: {
        driftSpeed: 1.0,
        morphSpeed: 0.5,
        dissipationStyle: 'organic'
      }
    });

    // Desert clouds - sparse, high clouds
    this.cloudStyles.set('desertClouds', {
      name: 'Desert Clouds',
      description: 'Sparse, high-altitude clouds in arid regions',
      densityConfig: {
        baseNoise: {
          octaves: 4,
          persistence: 0.3,
          lacunarity: 2.5,
          scale: 0.0004
        },
        turbulenceIntensity: 0.5,
        densityThreshold: 0.6,
        falloffDistance: 0.1
      },
      generatorConfig: {
        cloudDensity: 0.3,
        noiseScale: 0.0004,
        octaves: 4,
        persistence: 0.3,
        lacunarity: 2.5,
        windDirection: { x: 1, y: 0.1 },
        windSpeed: 2.5
      },
      visualProperties: {
        opacity: 0.4,
        color: [0.98, 0.97, 0.95],
        contrast: 1.0,
        softness: 0.3
      },
      animationProperties: {
        driftSpeed: 1.2,
        morphSpeed: 0.6,
        dissipationStyle: 'linear'
      }
    });

    // Forest clouds - moderate density with organic patterns
    this.cloudStyles.set('forestClouds', {
      name: 'Forest Clouds',
      description: 'Natural clouds over forested areas',
      densityConfig: {
        baseNoise: {
          octaves: 5,
          persistence: 0.6,
          lacunarity: 1.9,
          scale: 0.0008
        },
        detailNoise: {
          octaves: 3,
          persistence: 0.4,
          lacunarity: 2.1,
          scale: 0.003
        },
        turbulenceIntensity: 0.25,
        densityThreshold: 0.3,
        falloffDistance: 0.4
      },
      generatorConfig: {
        cloudDensity: 0.55,
        noiseScale: 0.0008,
        octaves: 5,
        persistence: 0.6,
        lacunarity: 1.9,
        windDirection: { x: 0.7, y: 0.7 },
        windSpeed: 2
      },
      visualProperties: {
        opacity: 0.7,
        color: [0.88, 0.9, 0.93],
        contrast: 0.7,
        softness: 0.7
      },
      animationProperties: {
        driftSpeed: 0.7,
        morphSpeed: 0.4,
        dissipationStyle: 'organic'
      }
    });

    // Add default styles
    this.cloudStyles.set('genericFog', this.cloudStyles.get('forestClouds')!);
    this.cloudStyles.set('suburbanHaze', this.cloudStyles.get('forestClouds')!);
    this.cloudStyles.set('ruralClouds', this.cloudStyles.get('forestClouds')!);
    this.cloudStyles.set('hillClouds', this.cloudStyles.get('mountainClouds')!);
    this.cloudStyles.set('lowlandClouds', this.cloudStyles.get('forestClouds')!);
  }

  /**
   * Initialize regional configurations
   */
  private initializeRegionalConfigs(): void {
    // Water regions
    this.regionalConfigs.set('water', {
      terrainType: 'water',
      primaryStyle: this.cloudStyles.get('oceanicFog')!,
      blendFactor: 0,
      adaptiveFactors: {
        elevationInfluence: 0.1,
        waterInfluence: 1.0,
        urbanInfluence: 0.2,
        seasonalInfluence: 0.3
      }
    });

    // Coastal regions
    this.regionalConfigs.set('coastal', {
      terrainType: 'coastal',
      primaryStyle: this.cloudStyles.get('lakeFog')!,
      secondaryStyle: this.cloudStyles.get('oceanicFog')!,
      blendFactor: 0.3,
      adaptiveFactors: {
        elevationInfluence: 0.3,
        waterInfluence: 0.8,
        urbanInfluence: 0.4,
        seasonalInfluence: 0.5
      }
    });

    // Mountain regions
    this.regionalConfigs.set('mountain', {
      terrainType: 'mountain',
      primaryStyle: this.cloudStyles.get('mountainClouds')!,
      secondaryStyle: this.cloudStyles.get('alpineClouds')!,
      blendFactor: 0.4,
      adaptiveFactors: {
        elevationInfluence: 1.0,
        waterInfluence: 0.3,
        urbanInfluence: 0.1,
        seasonalInfluence: 0.6
      }
    });

    // Urban regions
    this.regionalConfigs.set('urban', {
      terrainType: 'urban',
      primaryStyle: this.cloudStyles.get('denseCitySmog')!,
      blendFactor: 0,
      adaptiveFactors: {
        elevationInfluence: 0.2,
        waterInfluence: 0.4,
        urbanInfluence: 1.0,
        seasonalInfluence: 0.3
      }
    });

    // Desert regions
    this.regionalConfigs.set('desert', {
      terrainType: 'desert',
      primaryStyle: this.cloudStyles.get('desertClouds')!,
      blendFactor: 0,
      adaptiveFactors: {
        elevationInfluence: 0.4,
        waterInfluence: 0.6,
        urbanInfluence: 0.2,
        seasonalInfluence: 0.8
      }
    });

    // Forest regions
    this.regionalConfigs.set('forest', {
      terrainType: 'forest',
      primaryStyle: this.cloudStyles.get('forestClouds')!,
      blendFactor: 0,
      adaptiveFactors: {
        elevationInfluence: 0.5,
        waterInfluence: 0.6,
        urbanInfluence: 0.3,
        seasonalInfluence: 0.7
      }
    });

    // Default land regions
    this.regionalConfigs.set('land', {
      terrainType: 'land',
      primaryStyle: this.cloudStyles.get('forestClouds')!,
      blendFactor: 0,
      adaptiveFactors: {
        elevationInfluence: 0.4,
        waterInfluence: 0.5,
        urbanInfluence: 0.4,
        seasonalInfluence: 0.6
      }
    });
  }

  /**
   * Blend two cloud styles together
   */
  private blendCloudStyles(
    style1: GeographicCloudStyle,
    style2: GeographicCloudStyle,
    blendFactor: number
  ): GeographicCloudStyle {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    return {
      name: `${style1.name} + ${style2.name}`,
      description: `Blended style: ${style1.description} with ${style2.description}`,
      densityConfig: this.blendDensityConfigs(style1.densityConfig, style2.densityConfig, blendFactor),
      generatorConfig: this.blendGeneratorConfigs(style1.generatorConfig, style2.generatorConfig, blendFactor),
      visualProperties: {
        opacity: lerp(style1.visualProperties.opacity, style2.visualProperties.opacity, blendFactor),
        color: [
          lerp(style1.visualProperties.color[0], style2.visualProperties.color[0], blendFactor),
          lerp(style1.visualProperties.color[1], style2.visualProperties.color[1], blendFactor),
          lerp(style1.visualProperties.color[2], style2.visualProperties.color[2], blendFactor)
        ],
        contrast: lerp(style1.visualProperties.contrast, style2.visualProperties.contrast, blendFactor),
        softness: lerp(style1.visualProperties.softness, style2.visualProperties.softness, blendFactor)
      },
      animationProperties: {
        driftSpeed: lerp(style1.animationProperties.driftSpeed, style2.animationProperties.driftSpeed, blendFactor),
        morphSpeed: lerp(style1.animationProperties.morphSpeed, style2.animationProperties.morphSpeed, blendFactor),
        dissipationStyle: blendFactor > 0.5 ? style2.animationProperties.dissipationStyle : style1.animationProperties.dissipationStyle
      }
    };
  }

  /**
   * Blend density configurations
   */
  private blendDensityConfigs(config1: DensityConfig, config2: DensityConfig, t: number): DensityConfig {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    return {
      baseNoise: {
        octaves: Math.round(lerp(config1.baseNoise.octaves, config2.baseNoise.octaves, t)),
        persistence: lerp(config1.baseNoise.persistence, config2.baseNoise.persistence, t),
        lacunarity: lerp(config1.baseNoise.lacunarity, config2.baseNoise.lacunarity, t),
        scale: lerp(config1.baseNoise.scale, config2.baseNoise.scale, t)
      },
      detailNoise: config1.detailNoise && config2.detailNoise ? {
        octaves: Math.round(lerp(config1.detailNoise.octaves, config2.detailNoise.octaves, t)),
        persistence: lerp(config1.detailNoise.persistence, config2.detailNoise.persistence, t),
        lacunarity: lerp(config1.detailNoise.lacunarity, config2.detailNoise.lacunarity, t),
        scale: lerp(config1.detailNoise.scale, config2.detailNoise.scale, t)
      } : config1.detailNoise || config2.detailNoise,
      turbulenceIntensity: lerp(config1.turbulenceIntensity, config2.turbulenceIntensity, t),
      densityThreshold: lerp(config1.densityThreshold, config2.densityThreshold, t),
      falloffDistance: lerp(config1.falloffDistance, config2.falloffDistance, t)
    };
  }

  /**
   * Blend generator configurations
   */
  private blendGeneratorConfigs(config1: CloudGeneratorConfig, config2: CloudGeneratorConfig, t: number): CloudGeneratorConfig {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    return {
      cloudDensity: lerp(config1.cloudDensity, config2.cloudDensity, t),
      noiseScale: lerp(config1.noiseScale, config2.noiseScale, t),
      octaves: Math.round(lerp(config1.octaves, config2.octaves, t)),
      persistence: lerp(config1.persistence, config2.persistence, t),
      lacunarity: lerp(config1.lacunarity, config2.lacunarity, t),
      windDirection: {
        x: lerp(config1.windDirection.x, config2.windDirection.x, t),
        y: lerp(config1.windDirection.y, config2.windDirection.y, t)
      },
      windSpeed: lerp(config1.windSpeed, config2.windSpeed, t)
    };
  }

  /**
   * Adapt configuration to specific terrain features
   */
  private adaptConfigurationToTerrain(
    baseConfig: DensityConfig,
    analysis: TerrainAnalysis,
    factors: RegionalCloudConfig['adaptiveFactors']
  ): DensityConfig {
    let adaptedConfig = { ...baseConfig };

    // Elevation adaptations
    if (factors.elevationInfluence > 0) {
      const elevationFactor = 1 + (analysis.elevation.elevation / 2000) * factors.elevationInfluence;
      adaptedConfig.baseNoise.scale *= elevationFactor;
      adaptedConfig.densityThreshold *= (1 / elevationFactor);
    }

    // Water proximity adaptations
    if (factors.waterInfluence > 0) {
      const waterFactor = Math.exp(-analysis.waterBody.distance / 10000) * factors.waterInfluence;
      adaptedConfig.turbulenceIntensity *= (1 + waterFactor * 0.5);
      adaptedConfig.falloffDistance *= (1 + waterFactor * 0.3);
    }

    // Urban adaptations
    if (factors.urbanInfluence > 0) {
      const urbanFactor = analysis.urban.density * factors.urbanInfluence;
      adaptedConfig.baseNoise.persistence *= (1 - urbanFactor * 0.2);
      adaptedConfig.densityThreshold *= (1 + urbanFactor * 0.3);
    }

    return adaptedConfig;
  }

  /**
   * Adapt generator configuration to terrain
   */
  private adaptGeneratorToTerrain(
    baseConfig: CloudGeneratorConfig,
    analysis: TerrainAnalysis,
    factors: RegionalCloudConfig['adaptiveFactors']
  ): CloudGeneratorConfig {
    let adaptedConfig = { ...baseConfig };

    // Elevation adaptations
    if (factors.elevationInfluence > 0) {
      const elevationFactor = analysis.elevation.elevation / 1000;
      adaptedConfig.windSpeed *= (1 + elevationFactor * 0.5 * factors.elevationInfluence);
    }

    // Water proximity adaptations
    if (factors.waterInfluence > 0) {
      const waterFactor = Math.exp(-analysis.waterBody.distance / 5000) * factors.waterInfluence;
      adaptedConfig.cloudDensity *= (1 + waterFactor * 0.3);
    }

    // Climate adaptations
    const humidityFactor = analysis.climate.humidity;
    adaptedConfig.cloudDensity *= humidityFactor;

    return adaptedConfig;
  }

  /**
   * Get default configuration fallback
   */
  private getDefaultConfiguration() {
    const defaultStyle = this.cloudStyles.get('forestClouds')!;
    return {
      style: defaultStyle,
      adaptedConfig: defaultStyle.densityConfig,
      adaptedGenerator: defaultStyle.generatorConfig
    };
  }
}