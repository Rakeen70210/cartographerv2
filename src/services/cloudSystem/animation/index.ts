/**
 * Animation Controller Module
 * Contains cloud animation and dissipation effects
 */

// Main animation controller implementation
export { AnimationController } from './AnimationController';
export type { AnimationControllerConfig, FrameRateStats } from './AnimationController';

// Animation utilities and effects
export { DriftAnimation, DriftUtils } from './DriftAnimation';
export type { DriftConfig, DriftState } from './DriftAnimation';

export { MorphingEffects, MorphingUtils } from './MorphingEffects';
export type { MorphingConfig, MorphingState, MorphingData } from './MorphingEffects';

export { DissipationAnimator, DissipationUtils } from './DissipationAnimator';
export type { 
  DissipationConfig, 
  DissipationPoint, 
  RadialFalloff 
} from './DissipationAnimator';

export { ProgressiveRevelationAnimator, ProgressiveRevelationUtils } from './ProgressiveRevelationAnimator';
export type { 
  RevelationStage, 
  ProgressiveRevelationConfig, 
  RevelationState, 
  RevelationAnimation 
} from './ProgressiveRevelationAnimator';

export { EasingFunctions } from './EasingFunctions';
export type { EasingFunction } from './EasingFunctions';

// Animation utilities
export { AnimationUtils } from './AnimationController';