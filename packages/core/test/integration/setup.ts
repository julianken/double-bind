// Integration test setup utilities for real SQLite testing
// Provides createTestDatabase() with better-sqlite3 adapter and SQLite migrations
//
// IMPORTANT: We apply migration SQL directly (bypassing the migration runner)
// to avoid a conflict where the runner creates schema_metadata before the
// migration's own CREATE TABLE schema_metadata statement executes.

import type { GraphDB } from '@double-bind/types';
import BetterSqlite3 from 'better-sqlite3';
// Import the migration directly from source (migrations package may not be built)
import { migration as initialSchema } from '../../../migrations/src/sqlite/001-initial-schema.js';
import { SqliteNodeAdapter } from '../../src/adapters/sqlite-node-adapter.js';

/**
 * Create a real SQLite instance for integration testing.
 * Uses in-memory storage and applies the initial schema migration directly.
 *
 * Uses better-sqlite3's exec() which handles multi-statement SQL natively,
 * including CREATE TABLE, CREATE INDEX, CREATE TRIGGER, and INSERT statements.
 *
 * @returns GraphDB instance ready for testing with full schema applied
 *
 * @example
 * ```typescript
 * const db = await createTestDatabase();
 * await db.mutate(
 *   'INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted) VALUES ($id, $title, $now, $now, 0)',
 *   { id: 'p1', title: 'Test', now: Date.now() }
 * );
 * const result = await db.query('SELECT page_id, title FROM pages');
 * ```
 */
export async function createTestDatabase(): Promise<GraphDB> {
  // Create in-memory SQLite instance
  const sqliteDb = new BetterSqlite3(':memory:');
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');

  // Apply the entire migration SQL at once.
  // better-sqlite3's exec() handles multi-statement SQL natively,
  // correctly parsing trigger bodies, FTS5 virtual tables, etc.
  sqliteDb.exec(initialSchema.up);

  // Wrap with adapter that implements the Database interface
  return new SqliteNodeAdapter(sqliteDb);
}
