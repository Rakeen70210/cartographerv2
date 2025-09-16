// SQLite database schema definitions
export const CREATE_EXPLORED_AREAS_TABLE = `
  CREATE TABLE IF NOT EXISTS explored_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    radius REAL NOT NULL,
    explored_at DATETIME NOT NULL,
    accuracy REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

export const CREATE_USER_STATS_TABLE = `
  CREATE TABLE IF NOT EXISTS user_stats (
    id INTEGER PRIMARY KEY,
    total_areas_explored INTEGER DEFAULT 0,
    total_distance REAL DEFAULT 0,
    exploration_percentage REAL DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

export const CREATE_ACHIEVEMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    unlocked_at DATETIME,
    progress REAL DEFAULT 0
  );
`;

export const CREATE_SPATIAL_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_explored_areas_location 
  ON explored_areas(latitude, longitude);
`;

export const SCHEMA_QUERIES = [
  CREATE_EXPLORED_AREAS_TABLE,
  CREATE_USER_STATS_TABLE,
  CREATE_ACHIEVEMENTS_TABLE,
  CREATE_SPATIAL_INDEX,
];