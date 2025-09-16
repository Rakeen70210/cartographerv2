export interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface LocationManagerConfig {
  accuracy: 'high' | 'balanced' | 'low';
  distanceInterval: number;
  timeInterval: number;
  backgroundMode: boolean;
}