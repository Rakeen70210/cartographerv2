import * as SQLite from 'expo-sqlite';
import { SCHEMA_QUERIES } from './schema';

export interface DatabaseConfig {
  name: string;
  version: number;
}

export interface MigrationScript {
  version: number;
  up: string[];
  down: string[];
}

export class DatabaseManager {
  private db: SQLite.SQLiteDatabase | null = null;
  private config: DatabaseConfig;
  private migrations: MigrationScript[] = [];

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.setupMigrations();
  }

  private setupMigrations(): void {
    // Version 1: Initial schema
    this.migrations.push({
      version: 1,
      up: SCHEMA_QUERIES,
      down: [
        'DROP INDEX IF EXISTS idx_explored_areas_location;',
        'DROP TABLE IF EXISTS achievements;',
        'DROP TABLE IF EXISTS user_stats;',
        'DROP TABLE IF EXISTS explored_areas;'
      ]
    });
  }

  async initialize(): Promise<void> {
    try {
      console.log('DatabaseManager: Starting initialization...');
      this.db = await SQLite.openDatabaseAsync(this.config.name);
      console.log('DatabaseManager: SQLite database opened');
      await this.runMigrations();
      console.log('DatabaseManager: Migrations completed');
      await this.initializeUserStats();
      console.log('DatabaseManager: User stats initialized');
      console.log('DatabaseManager: Initialization finished successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw new Error(`Failed to initialize database: ${error}`);
    }
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Create version tracking table if it doesn't exist
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get current version
    const result = await this.db.getFirstAsync<{ version: number }>(
      'SELECT MAX(version) as version FROM schema_version'
    );
    const currentVersion = result?.version || 0;

    // Apply pending migrations
    for (const migration of this.migrations) {
      if (migration.version > currentVersion) {
        await this.applyMigration(migration);
      }
    }
  }

  private async applyMigration(migration: MigrationScript): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.withTransactionAsync(async () => {
        // Execute migration scripts
        for (const query of migration.up) {
          await this.db!.execAsync(query);
        }

        // Record migration
        await this.db!.runAsync(
          'INSERT INTO schema_version (version) VALUES (?)',
          [migration.version]
        );
      });

      console.log(`Applied migration version ${migration.version}`);
    } catch (error) {
      console.error(`Migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  private async initializeUserStats(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Check if user stats exist, if not create initial record
    const existingStats = await this.db.getFirstAsync(
      'SELECT id FROM user_stats WHERE id = 1'
    );

    if (!existingStats) {
      await this.db.runAsync(`
        INSERT INTO user_stats (id) VALUES (1)
      `);
    }
  }

  async checkIntegrity(): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.getFirstAsync<{ integrity_check: string }>(
        'PRAGMA integrity_check'
      );
      return result?.integrity_check === 'ok';
    } catch (error) {
      console.error('Database integrity check failed:', error);
      return false;
    }
  }

  async vacuum(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.execAsync('VACUUM');
    } catch (error) {
      console.error('Database vacuum failed:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }

  async reinitialize(): Promise<void> {
    try {
      console.log('Reinitializing database...');

      // Close existing connection
      await this.close();

      // Delete the database file to start fresh
      try {
        await SQLite.deleteDatabaseAsync(this.config.name);
        console.log('Existing database file deleted');
      } catch (error) {
        console.warn('Could not delete database file:', error);
      }

      // Initialize fresh database
      await this.initialize();

      console.log('Database reinitialization completed');
    } catch (error) {
      console.error('Database reinitialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if database is initialized and ready for use
   */
  isInitialized(): boolean {
    return this.db !== null;
  }

  getDatabase(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }
}

// Singleton instance
let databaseManager: DatabaseManager | null = null;

export const getDatabaseManager = (): DatabaseManager => {
  if (!databaseManager) {
    databaseManager = new DatabaseManager({
      name: 'cartographer.db',
      version: 1
    });
  }
  return databaseManager;
};

export const initializeDatabase = async (): Promise<DatabaseManager> => {
  const manager = getDatabaseManager();
  await manager.initialize();
  return manager;
};