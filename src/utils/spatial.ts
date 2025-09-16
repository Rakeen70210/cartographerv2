/**
 * Spatial utility functions for geographic calculations
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Circle {
  center: Coordinate;
  radius: number; // in meters
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Generate grid cell ID from coordinates
 */
export function getGridCellId(lat: number, lon: number, cellSize: number = 0.01): string {
  const gridLat = Math.floor(lat / cellSize) * cellSize;
  const gridLon = Math.floor(lon / cellSize) * cellSize;
  return `${gridLat.toFixed(6)}_${gridLon.toFixed(6)}`;
}

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if two circles overlap
 */
export function circlesOverlap(circle1: Circle, circle2: Circle): boolean {
  const distance = calculateDistance(
    circle1.center.latitude,
    circle1.center.longitude,
    circle2.center.latitude,
    circle2.center.longitude
  );
  return distance < (circle1.radius + circle2.radius);
}

/**
 * Calculate the overlap percentage between two circles
 */
export function calculateCircleOverlap(circle1: Circle, circle2: Circle): number {
  const distance = calculateDistance(
    circle1.center.latitude,
    circle1.center.longitude,
    circle2.center.latitude,
    circle2.center.longitude
  );
  const r1 = circle1.radius;
  const r2 = circle2.radius;
  
  // If circles don't overlap
  if (distance >= r1 + r2) {
    return 0;
  }
  
  // If one circle is completely inside the other
  if (distance <= Math.abs(r1 - r2)) {
    const smallerRadius = Math.min(r1, r2);
    const largerRadius = Math.max(r1, r2);
    return (smallerRadius * smallerRadius) / (largerRadius * largerRadius);
  }
  
  // Calculate intersection area using circle intersection formula
  const r1Sq = r1 * r1;
  const r2Sq = r2 * r2;
  const dSq = distance * distance;
  
  const area1 = r1Sq * Math.acos((dSq + r1Sq - r2Sq) / (2 * distance * r1));
  const area2 = r2Sq * Math.acos((dSq + r2Sq - r1Sq) / (2 * distance * r2));
  const area3 = 0.5 * Math.sqrt((-distance + r1 + r2) * (distance + r1 - r2) * (distance - r1 + r2) * (distance + r1 + r2));
  
  const intersectionArea = area1 + area2 - area3;
  const circle1Area = Math.PI * r1Sq;
  
  return intersectionArea / circle1Area;
}

/**
 * Validate if coordinates are valid
 */
export function isValidCoordinate(coordinate: Coordinate): boolean {
  return (
    typeof coordinate.latitude === 'number' &&
    typeof coordinate.longitude === 'number' &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180 &&
    !isNaN(coordinate.latitude) &&
    !isNaN(coordinate.longitude)
  );
}

/**
 * Create a location key for deduplication
 */
export function createLocationKey(latitude: number, longitude: number, precision: number = 4): string {
  const factor = Math.pow(10, precision);
  const roundedLat = Math.round(latitude * factor) / factor;
  const roundedLng = Math.round(longitude * factor) / factor;
  return `${roundedLat},${roundedLng}`;
}