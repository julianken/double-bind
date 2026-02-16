// Integration test setup utilities for real CozoDB testing
// Provides createTestDatabase() with cozo-node adapter and migrations

import type { GraphDB, QueryResult, MutationResult } from '@double-bind/types';
import { runMigrations } from '@double-bind/migrations';

/**
 * Type for cozo-node CozoDb instance.
 * We use unknown since cozo-node is a native module without TypeScript types.
 */
type CozoDb = unknown;

/**
 * Adapter wrapping cozo-node's CozoDb to implement the GraphDB interface.
 * Provides thin compatibility layer between cozo-node API and our abstractions.
 */
export class CozoNodeAdapter implements GraphDB {
  private db: CozoDb;

  constructor(db: CozoDb) {
    this.db = db;
  }

  async query<T = unknown>(
    script: string,
    params?: Record<string, unknown>
  ): Promise<QueryResult<T>> {
    // cozo-node run() returns a Promise with { headers, rows } on success
    // Rejects the promise on error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (this.db as any).run(script, params ?? {});
    return { headers: result.headers ?? [], rows: (result.rows ?? []) as T[][] };
  }

  async mutate(script: string, params?: Record<string, unknown>): Promise<MutationResult> {
    // cozo-node run() returns a Promise with { headers, rows } on success
    // Rejects the promise on error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (this.db as any).run(script, params ?? {});
    return { headers: result.headers ?? [], rows: result.rows ?? [] };
  }

  async importRelations(data: Record<string, unknown[][]>): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.db as any).import_relations(data);
  }

  async exportRelations(relations: string[]): Promise<Record<string, unknown[][]>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.db as any).export_relations(relations);
  }

  async backup(path: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.db as any).backup(path);
  }

  async restore(path: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.db as any).restore(path);
  }

  async importRelationsFromBackup(path: string, relations: string[]): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.db as any).import_relations_from_backup(path, relations);
  }

  async close(): Promise<void> {
    // cozo-node handles cleanup via garbage collection
    // Explicit close() not required but we could call db.close() if it exists
  }
}

/**
 * Create a real CozoDB instance for integration testing.
 * Uses in-memory storage and applies all migrations.
 *
 * @returns GraphDB instance ready for testing with full schema applied
 *
 * @example
 * ```typescript
 * const db = await createTestDatabase();
 * await db.mutate('?[page_id, title] <- [["p1", "Test"]] :put pages {...}');
 * const result = await db.query('?[page_id, title] := *pages{ page_id, title }');
 * ```
 */
export async function createTestDatabase(): Promise<GraphDB> {
  // Dynamic import of cozo-node (native module without TS types)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { CozoDb } = require('cozo-node') as {
    CozoDb: new (engine: string, path: string) => CozoDb;
  };

  // Create in-memory CozoDB instance
  const cozoDb = new CozoDb('mem', '');

  // Wrap with adapter
  const db = new CozoNodeAdapter(cozoDb);

  // Apply all migrations to get full schema
  const result = await runMigrations(db);

  if (result.errors.length > 0) {
    throw new Error(`Migration failed: ${result.errors[0]?.error}`);
  }

  return db;
}
