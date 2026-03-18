import { evaluateExplorationCandidate, DEFAULT_EXPLORATION_CONFIG } from '../explorationEngine';
import { ExploredArea } from '../../database/services';
import { LocationUpdate } from '../../types';

const baseLocation: LocationUpdate = {
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 24,
  timestamp: new Date('2026-03-17T10:00:00.000Z').getTime(),
};

describe('evaluateExplorationCandidate', () => {
  it('rejects locations with poor accuracy using a shared reason code', () => {
    const result = evaluateExplorationCandidate({
      location: {
        ...baseLocation,
        accuracy: DEFAULT_EXPLORATION_CONFIG.minAccuracyThreshold + 1,
      },
      nearbyAreas: [],
      now: baseLocation.timestamp + DEFAULT_EXPLORATION_CONFIG.minDwellTime,
    });

    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('poor_accuracy');
    expect(result.shouldPersist).toBe(false);
  });

  it('returns pending until dwell time has elapsed', () => {
    const result = evaluateExplorationCandidate({
      location: baseLocation,
      nearbyAreas: [],
      now: baseLocation.timestamp + 1_000,
      firstSeenAt: baseLocation.timestamp,
    });

    expect(result.status).toBe('pending');
    expect(result.reason).toBe('insufficient_dwell');
    expect(result.shouldPersist).toBe(false);
  });

  it('accepts a location after dwell time and calculates a bounded exploration radius', () => {
    const result = evaluateExplorationCandidate({
      location: baseLocation,
      nearbyAreas: [],
      now: baseLocation.timestamp + DEFAULT_EXPLORATION_CONFIG.minDwellTime,
      firstSeenAt: baseLocation.timestamp,
    });

    expect(result.status).toBe('accepted');
    expect(result.reason).toBeUndefined();
    expect(result.shouldPersist).toBe(true);
    expect(result.explorationRadius).toBeGreaterThanOrEqual(
      DEFAULT_EXPLORATION_CONFIG.minExplorationRadius
    );
    expect(result.explorationRadius).toBeLessThanOrEqual(
      DEFAULT_EXPLORATION_CONFIG.maxExplorationRadius
    );
  });

  it('rejects locations that significantly overlap an explored area', () => {
    const overlappingArea: ExploredArea = {
      id: 1,
      latitude: baseLocation.latitude,
      longitude: baseLocation.longitude,
      radius: 60,
      explored_at: new Date(baseLocation.timestamp - 60_000).toISOString(),
      accuracy: 15,
    };

    const result = evaluateExplorationCandidate({
      location: baseLocation,
      nearbyAreas: [overlappingArea],
      now: baseLocation.timestamp + DEFAULT_EXPLORATION_CONFIG.minDwellTime,
      firstSeenAt: baseLocation.timestamp,
      overlapCalculator: () => DEFAULT_EXPLORATION_CONFIG.overlapThreshold + 0.1,
    });

    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('significant_overlap');
    expect(result.overlappingAreas).toHaveLength(1);
    expect(result.shouldPersist).toBe(false);
  });
});
