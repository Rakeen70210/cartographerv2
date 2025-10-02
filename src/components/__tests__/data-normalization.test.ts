/**
 * Test data normalization for SkiaFogOverlay compatibility
 */

import { GenericExploredArea } from '../../types/fog';

// Copy the normalization function from SkiaFogOverlay for testing
const normalizeExploredArea = (area: GenericExploredArea): {
  id: string;
  latitude: number;
  longitude: number;
  radius: number;
  exploredAt: number;
  accuracy?: number;
} => {
  // Handle both database format (latitude/longitude) and Redux format (center)
  const latitude = area.latitude ?? area.center?.[1] ?? 0;
  const longitude = area.longitude ?? area.center?.[0] ?? 0;
  
  // Handle different timestamp formats
  let exploredAt: number;
  if (area.exploredAt) {
    exploredAt = typeof area.exploredAt === 'number' ? area.exploredAt : new Date(area.exploredAt).getTime();
  } else if (area.explored_at) {
    exploredAt = new Date(area.explored_at).getTime();
  } else {
    exploredAt = Date.now();
  }
  
  return {
    id: area.id?.toString() ?? `area_${latitude}_${longitude}_${exploredAt}`,
    latitude,
    longitude,
    radius: area.radius,
    exploredAt,
    accuracy: area.accuracy,
  };
};

describe('Data Normalization for SkiaFogOverlay', () => {
  it('should normalize SQLite format explored areas', () => {
    const sqliteArea: GenericExploredArea = {
      id: 1,
      latitude: 37.7749,
      longitude: -122.4194,
      radius: 100,
      explored_at: '2024-01-01T12:00:00.000Z',
      accuracy: 10,
    };

    const normalized = normalizeExploredArea(sqliteArea);

    expect(normalized.id).toBe('1');
    expect(normalized.latitude).toBe(37.7749);
    expect(normalized.longitude).toBe(-122.4194);
    expect(normalized.radius).toBe(100);
    expect(normalized.accuracy).toBe(10);
    expect(typeof normalized.exploredAt).toBe('number');
    expect(normalized.exploredAt).toBe(new Date('2024-01-01T12:00:00.000Z').getTime());
  });

  it('should normalize Redux format explored areas', () => {
    const reduxArea: GenericExploredArea = {
      id: 'area-123',
      center: [-122.4194, 37.7749],
      radius: 150,
      exploredAt: 1704110400000, // timestamp
      accuracy: 15,
    };

    const normalized = normalizeExploredArea(reduxArea);

    expect(normalized.id).toBe('area-123');
    expect(normalized.latitude).toBe(37.7749);
    expect(normalized.longitude).toBe(-122.4194);
    expect(normalized.radius).toBe(150);
    expect(normalized.accuracy).toBe(15);
    expect(normalized.exploredAt).toBe(1704110400000);
  });

  it('should handle mixed format data', () => {
    const mixedAreas: GenericExploredArea[] = [
      // SQLite format
      {
        id: 1,
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 100,
        explored_at: '2024-01-01T12:00:00.000Z',
        accuracy: 10,
      },
      // Redux format
      {
        id: 'area-456',
        center: [-122.4094, 37.7849],
        radius: 150,
        exploredAt: Date.now(),
        accuracy: 15,
      },
    ];

    const normalized = mixedAreas.map(normalizeExploredArea);

    expect(normalized).toHaveLength(2);
    
    // First area (SQLite format)
    expect(normalized[0].id).toBe('1');
    expect(normalized[0].latitude).toBe(37.7749);
    expect(normalized[0].longitude).toBe(-122.4194);
    
    // Second area (Redux format)
    expect(normalized[1].id).toBe('area-456');
    expect(normalized[1].latitude).toBe(37.7849);
    expect(normalized[1].longitude).toBe(-122.4094);
  });

  it('should handle missing optional fields gracefully', () => {
    const minimalArea: GenericExploredArea = {
      center: [-122.4194, 37.7749],
      radius: 100,
    };

    const normalized = normalizeExploredArea(minimalArea);

    expect(normalized.latitude).toBe(37.7749);
    expect(normalized.longitude).toBe(-122.4194);
    expect(normalized.radius).toBe(100);
    expect(typeof normalized.id).toBe('string');
    expect(normalized.id).toContain('area_');
    expect(typeof normalized.exploredAt).toBe('number');
    expect(normalized.accuracy).toBeUndefined();
  });

  it('should handle invalid data gracefully', () => {
    const invalidArea: GenericExploredArea = {
      radius: 100,
      // Missing both latitude/longitude and center
    };

    const normalized = normalizeExploredArea(invalidArea);

    expect(normalized.latitude).toBe(0);
    expect(normalized.longitude).toBe(0);
    expect(normalized.radius).toBe(100);
    expect(typeof normalized.id).toBe('string');
    expect(typeof normalized.exploredAt).toBe('number');
  });

  it('should handle string timestamp formats', () => {
    const areaWithStringTimestamp: GenericExploredArea = {
      center: [-122.4194, 37.7749],
      radius: 100,
      exploredAt: '2024-01-01T12:00:00.000Z' as any, // String instead of number
    };

    const normalized = normalizeExploredArea(areaWithStringTimestamp);

    expect(typeof normalized.exploredAt).toBe('number');
    expect(normalized.exploredAt).toBe(new Date('2024-01-01T12:00:00.000Z').getTime());
  });

  it('should generate unique IDs when missing', () => {
    const areasWithoutIds: GenericExploredArea[] = [
      { center: [-122.4194, 37.7749], radius: 100 },
      { center: [-122.4194, 37.7749], radius: 100 },
    ];

    const normalized = areasWithoutIds.map(normalizeExploredArea);

    expect(normalized[0].id).not.toBe(normalized[1].id);
    expect(normalized[0].id).toContain('area_');
    expect(normalized[1].id).toContain('area_');
  });
});

export { normalizeExploredArea };