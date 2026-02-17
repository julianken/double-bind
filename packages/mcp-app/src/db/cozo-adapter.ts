/**
 * CozoNode → Database adapter
 *
 * NOTE: The MCP app still uses CozoDB as its database backend.
 * This is separate from the main desktop/mobile apps which have migrated to SQLite.
 * The MCP app will be migrated to SQLite in a future phase (out of scope for DBB-438).
 *
 * Wraps cozo-node's CozoDb to satisfy the Database interface used by
 * @double-bind/core services. Same pattern as the TUI/CLI clients.
 */

import { CozoDb } from 'cozo-node';
import type { Database, QueryResult, MutationResult } from '@double-bind/types';

export function createCozoNodeDatabase(engine: 'mem' | 'rocksdb' | 'sqlite', path?: string): Database {
  const db = path ? new CozoDb(engine, path) : new CozoDb(engine);

  return {
    async query<T = unknown>(script: string, params: Record<string, unknown> = {}): Promise<QueryResult<T>> {
      return db.run(script, params) as Promise<QueryResult<T>>;
    },

    async mutate(script: string, params: Record<string, unknown> = {}): Promise<MutationResult> {
      return db.run(script, params) as Promise<MutationResult>;
    },

    async importRelations(data: Record<string, unknown[][]>): Promise<void> {
      await db.importRelations(data);
    },

    async exportRelations(relations: string[]): Promise<Record<string, unknown[][]>> {
      return db.exportRelations(relations) as Promise<Record<string, unknown[][]>>;
    },

    async backup(backupPath: string): Promise<void> {
      await db.backup(backupPath);
    },

    async restore(backupPath: string): Promise<void> {
      await db.restore(backupPath);
    },

    async importRelationsFromBackup(backupPath: string, relations: string[]): Promise<void> {
      await db.importRelationsFromBackup(backupPath, relations);
    },

    async close(): Promise<void> {
      // cozo-node doesn't have an explicit close — GC handles it
    },
  };
}
