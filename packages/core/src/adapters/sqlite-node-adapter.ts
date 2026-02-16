/**
 * SqliteNodeAdapter - Wraps better-sqlite3 to implement the Database interface.
 *
 * Translates between the Database interface's { headers, rows } array format
 * (used by all repositories) and better-sqlite3's object-based row results.
 *
 * Named parameter mapping:
 * - SQL uses $name placeholders
 * - better-sqlite3 accepts { name: value } objects (no $ prefix in keys)
 *
 * Boolean handling:
 * - SQLite stores booleans as INTEGER (0/1)
 * - This adapter does NOT convert them; schema parsers handle this via sqliteBool
 */

import type {
  Database,
  QueryResult,
  MutationResult,
  TransactionContext,
} from '@double-bind/types';

// Use dynamic import type for better-sqlite3
type BetterSqlite3Database = import('better-sqlite3').Database;

/**
 * Adapter wrapping better-sqlite3 to implement the Database interface.
 * Provides the { headers, rows } array format expected by all repositories.
 */
export class SqliteNodeAdapter implements Database {
  private db: BetterSqlite3Database;
  private closed = false;

  constructor(db: BetterSqlite3Database) {
    this.db = db;
  }

  /**
   * Execute a read-only SQL query.
   * Converts better-sqlite3 object rows to { headers, rows } array format.
   */
  async query<T = unknown>(
    script: string,
    params?: Record<string, unknown>
  ): Promise<QueryResult<T>> {
    this.ensureOpen();
    const stmt = this.db.prepare(script);
    const bindParams = params ? this.convertParams(params) : {};
    const rows = stmt.all(bindParams) as Record<string, unknown>[];

    if (rows.length === 0) {
      // Try to get headers from column definitions
      const columns = stmt.columns();
      const headers = columns.map((col) => col.name);
      return { headers, rows: [] };
    }

    // Extract headers from first row's keys
    const headers = Object.keys(rows[0]!);
    const arrayRows = rows.map((row) => headers.map((h) => row[h]) as T[]);

    return { headers, rows: arrayRows };
  }

  /**
   * Execute a mutation (INSERT, UPDATE, DELETE).
   * Returns affected row count in { headers, rows } format.
   */
  async mutate(
    script: string,
    params?: Record<string, unknown>
  ): Promise<MutationResult> {
    this.ensureOpen();
    const stmt = this.db.prepare(script);
    const bindParams = params ? this.convertParams(params) : {};
    const result = stmt.run(bindParams);

    return {
      headers: ['affected_rows'],
      rows: [[result.changes]],
    };
  }

  /**
   * Execute multiple operations within a transaction.
   * Uses better-sqlite3's synchronous transaction support with async wrapper.
   */
  async transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    this.ensureOpen();

    const txContext: TransactionContext = {
      query: async <R = unknown>(
        sql: string,
        params?: Record<string, unknown>
      ): Promise<R[]> => {
        const stmt = this.db.prepare(sql);
        const bindParams = params ? this.convertParams(params) : {};
        return stmt.all(bindParams) as R[];
      },
      execute: async (
        sql: string,
        params?: Record<string, unknown>
      ): Promise<{ affectedRows: number }> => {
        const stmt = this.db.prepare(sql);
        const bindParams = params ? this.convertParams(params) : {};
        const result = stmt.run(bindParams);
        return { affectedRows: result.changes };
      },
    };

    // Begin transaction, run callback, commit/rollback
    this.db.exec('BEGIN');
    try {
      const result = await fn(txContext);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * Import data into multiple tables.
   * Uses INSERT statements within a transaction.
   */
  async importRelations(data: Record<string, unknown[][]>): Promise<void> {
    this.ensureOpen();

    const transact = this.db.transaction(() => {
      for (const [table, rows] of Object.entries(data)) {
        if (rows.length === 0) continue;

        // Get column info from table
        const tableInfo = this.db
          .prepare(`PRAGMA table_info(${table})`)
          .all() as Array<{ name: string }>;
        const columns = tableInfo.map((col) => col.name);
        const placeholders = columns.map(() => '?').join(', ');
        const quotedColumns = columns
          .map((c) => (c === 'order' ? '"order"' : c))
          .join(', ');
        const stmt = this.db.prepare(
          `INSERT OR REPLACE INTO ${table} (${quotedColumns}) VALUES (${placeholders})`
        );

        for (const row of rows) {
          stmt.run(...row);
        }
      }
    });
    transact();
  }

  /**
   * Export data from specified tables.
   */
  async exportRelations(relations: string[]): Promise<Record<string, unknown[][]>> {
    this.ensureOpen();

    const result: Record<string, unknown[][]> = {};

    for (const table of relations) {
      const rows = this.db.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
      if (rows.length === 0) {
        result[table] = [];
        continue;
      }
      const headers = Object.keys(rows[0]!);
      result[table] = rows.map((row) => headers.map((h) => row[h]));
    }

    return result;
  }

  /**
   * Create a backup of the database.
   */
  async backup(path: string): Promise<void> {
    this.ensureOpen();
    await this.db.backup(path);
  }

  /**
   * Restore the database from a backup file.
   */
  async restore(_path: string): Promise<void> {
    throw new Error('SqliteNodeAdapter.restore() not implemented');
  }

  /**
   * Import specific relations from a backup file.
   */
  async importRelationsFromBackup(_path: string, _relations: string[]): Promise<void> {
    throw new Error('SqliteNodeAdapter.importRelationsFromBackup() not implemented');
  }

  /**
   * Close the database and release native resources.
   */
  async close(): Promise<void> {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }

  /**
   * Convert params from { key: value } to the format better-sqlite3 expects.
   * better-sqlite3 uses $name placeholders and expects keys without $ prefix.
   */
  private convertParams(params: Record<string, unknown>): Record<string, unknown> {
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      converted[key] = value;
    }
    return converted;
  }

  private ensureOpen(): void {
    if (this.closed) {
      throw new Error('Database is closed');
    }
  }
}
