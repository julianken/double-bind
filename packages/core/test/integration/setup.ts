// Integration test setup utilities for real SQLite testing
// Provides createTestDatabase() with better-sqlite3 adapter and SQLite migrations

import type { GraphDB } from '@double-bind/types';
import Database from 'better-sqlite3';
import { SqliteNodeAdapter } from '../../src/adapters/sqlite-node-adapter.js';
import { ALL_SQLITE_MIGRATIONS } from '@double-bind/migrations';

/**
 * Create a real SQLite instance for integration testing.
 * Uses in-memory storage and applies all SQLite migrations.
 *
 * NOTE: We execute migration SQL directly rather than using runSqliteMigrations()
 * because the runner's ensureSchemaMetadataTable() creates schema_metadata
 * before running migrations, conflicting with the migration's own
 * CREATE TABLE schema_metadata statement (which lacks IF NOT EXISTS).
 * Direct execution avoids the conflict since better-sqlite3 handles
 * multiple statements and trigger bodies natively.
 *
 * @returns GraphDB instance ready for testing with full schema applied
 *
 * @example
 * ```typescript
 * const db = await createTestDatabase();
 * const result = await db.query('SELECT page_id, title FROM pages');
 * ```
 */
export async function createTestDatabase(): Promise<GraphDB> {
  // Create in-memory SQLite instance
  const sqliteDb = new Database(':memory:');

  // Apply pragmas for performance and correctness
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');

  // Apply migration SQL directly (bypasses runner to avoid schema_metadata conflict)
  for (const migration of ALL_SQLITE_MIGRATIONS) {
    try {
      sqliteDb.exec(migration.up);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`SQLite migration '${migration.name}' failed: ${msg}`);
    }
  }

  // Wrap with adapter that implements the Database interface
  return new SqliteNodeAdapter(sqliteDb);
}
