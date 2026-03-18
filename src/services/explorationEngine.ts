import { ExploredArea } from '../database/services';
import { LocationUpdate } from '../types';
import { calculateCircleOverlap, Circle, calculateDistance } from '../utils/spatial';

export interface ExplorationConfig {
  minExplorationRadius: number;
  maxExplorationRadius: number;
  minAccuracyThreshold: number;
  overlapThreshold: number;
  minDwellTime: number;
}

export type ExplorationDecisionStatus = 'accepted' | 'pending' | 'rejected';

export type ExplorationDecisionReason =
  | 'poor_accuracy'
  | 'insufficient_dwell'
  | 'significant_overlap'
  | 'invalid_coordinates';

export interface ExplorationDecision {
  status: ExplorationDecisionStatus;
  reason?: ExplorationDecisionReason;
  shouldPersist: boolean;
  explorationRadius: number;
  overlappingAreas: ExploredArea[];
}

export interface EvaluateExplorationCandidateParams {
  location: LocationUpdate;
  nearbyAreas: ExploredArea[];
  now?: number;
  firstSeenAt?: number;
  config?: Partial<ExplorationConfig>;
  overlapCalculator?: (candidate: Circle, existing: Circle) => number;
}

export const DEFAULT_EXPLORATION_CONFIG: ExplorationConfig = {
  minExplorationRadius: 50,
  maxExplorationRadius: 200,
  minAccuracyThreshold: 100,
  overlapThreshold: 0.7,
  minDwellTime: 30_000,
};

export const calculateExplorationRadius = (
  accuracy: number,
  config: ExplorationConfig = DEFAULT_EXPLORATION_CONFIG
): number => {
  const baseRadius = Math.max(accuracy * 1.5, config.minExplorationRadius);
  return Math.min(baseRadius, config.maxExplorationRadius);
};

export const evaluateExplorationCandidate = ({
  location,
  nearbyAreas,
  now = Date.now(),
  firstSeenAt = location.timestamp,
  config: partialConfig,
  overlapCalculator = calculateCircleOverlap,
}: EvaluateExplorationCandidateParams): ExplorationDecision => {
  const config = { ...DEFAULT_EXPLORATION_CONFIG, ...partialConfig };
  const explorationRadius = calculateExplorationRadius(location.accuracy, config);

  if (!isValidCoordinate(location.latitude, location.longitude)) {
    return rejectedDecision('invalid_coordinates', explorationRadius);
  }

  if (location.accuracy > config.minAccuracyThreshold) {
    return rejectedDecision('poor_accuracy', explorationRadius);
  }

  if (now - firstSeenAt < config.minDwellTime) {
    return {
      status: 'pending',
      reason: 'insufficient_dwell',
      shouldPersist: false,
      explorationRadius,
      overlappingAreas: [],
    };
  }

  const overlappingAreas = findOverlappingAreas(location, explorationRadius, nearbyAreas);
  const hasSignificantOverlap = overlappingAreas.some((area) =>
    overlapCalculator(
      {
        center: { latitude: location.latitude, longitude: location.longitude },
        radius: explorationRadius,
      },
      {
        center: { latitude: area.latitude, longitude: area.longitude },
        radius: area.radius,
      }
    ) >= config.overlapThreshold
  );

  if (hasSignificantOverlap) {
    return {
      status: 'rejected',
      reason: 'significant_overlap',
      shouldPersist: false,
      explorationRadius,
      overlappingAreas,
    };
  }

  return {
    status: 'accepted',
    shouldPersist: true,
    explorationRadius,
    overlappingAreas,
  };
};

const rejectedDecision = (
  reason: ExplorationDecisionReason,
  explorationRadius: number
): ExplorationDecision => ({
  status: 'rejected',
  reason,
  shouldPersist: false,
  explorationRadius,
  overlappingAreas: [],
});

const isValidCoordinate = (latitude: number, longitude: number): boolean => (
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180
);

const findOverlappingAreas = (
  location: LocationUpdate,
  radius: number,
  nearbyAreas: ExploredArea[]
): ExploredArea[] => (
  nearbyAreas.filter((area) => {
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      area.latitude,
      area.longitude
    );

    return distance < (radius + area.radius);
  })
);
