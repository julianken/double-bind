/**
 * SqliteNodeAdapter - Wraps better-sqlite3 to implement the Database interface.
 *
 * This adapter bridges the synchronous better-sqlite3 API with the async
 * Database interface used throughout the codebase. All methods return Promises
 * for interface compatibility, even though better-sqlite3 is synchronous.
 *
 * Key behaviors:
 * - query() returns { headers, rows } in array format (matching CozoDB format)
 * - mutate() returns { headers: ["affected_rows"], rows: [[changes]] }
 * - transaction() wraps operations in BEGIN/COMMIT with rollback on error
 * - Named params use $name syntax (e.g., { id: "abc" } for $id in SQL)
 */

import type BetterSqlite3 from 'better-sqlite3';
import type {
  Database,
  QueryResult,
  MutationResult,
  TransactionContext,
} from '@double-bind/types';

/**
 * Adapter wrapping better-sqlite3 to implement the Database interface.
 * Provides compatibility between synchronous SQLite operations and
 * the async interface expected by repositories and services.
 */
export class SqliteNodeAdapter implements Database {
  private db: BetterSqlite3.Database;
  private closed = false;

  constructor(db: BetterSqlite3.Database) {
    this.db = db;
  }

  /**
   * Execute a read-only SQL query.
   * Returns results in array format with headers for compatibility.
   */
  async query<T = unknown>(
    script: string,
    params?: Record<string, unknown>
  ): Promise<QueryResult<T>> {
    this.ensureOpen();

    const stmt = this.db.prepare(script);
    // Convert params keys to $-prefixed if not already
    const sqliteParams = params ? this.prefixParams(params) : {};
    const rows = stmt.all(sqliteParams);

    if (rows.length === 0) {
      // Try to get column names from the statement
      const columns = stmt.columns();
      const headers = columns.map((col) => col.name);
      return { headers, rows: [] as T[][] };
    }

    // Extract headers from first row's keys
    const firstRow = rows[0] as Record<string, unknown>;
    const headers = Object.keys(firstRow);

    // Convert each row object to an array in header order
    const arrayRows = rows.map((row) => {
      const obj = row as Record<string, unknown>;
      return headers.map((h) => obj[h]) as T[];
    });

    return { headers, rows: arrayRows };
  }

  /**
   * Execute a mutation (INSERT/UPDATE/DELETE).
   *
   * If the SQL contains a RETURNING clause, it behaves like a query
   * and returns the selected rows. Otherwise returns affected_rows count.
   */
  async mutate(
    script: string,
    params?: Record<string, unknown>
  ): Promise<MutationResult> {
    this.ensureOpen();

    const sqliteParams = params ? this.prefixParams(params) : {};

    // Check if this is a statement with RETURNING clause
    const hasReturning = /\bRETURNING\b/i.test(script);

    if (hasReturning) {
      const stmt = this.db.prepare(script);
      const rows = stmt.all(sqliteParams);

      if (rows.length === 0) {
        return { headers: [], rows: [] };
      }

      const firstRow = rows[0] as Record<string, unknown>;
      const headers = Object.keys(firstRow);
      const arrayRows = rows.map((row) => {
        const obj = row as Record<string, unknown>;
        return headers.map((h) => obj[h]);
      });

      return { headers, rows: arrayRows };
    }

    const stmt = this.db.prepare(script);
    const result = stmt.run(sqliteParams);

    return {
      headers: ['affected_rows'],
      rows: [[result.changes]],
    };
  }

  /**
   * Execute multiple operations within a transaction.
   * Provides a TransactionContext with query/execute methods.
   */
  async transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    this.ensureOpen();

    const db = this.db;
    const prefixParams = this.prefixParams.bind(this);

    const txContext: TransactionContext = {
      async query<U = unknown>(
        script: string,
        params?: Record<string, unknown>
      ): Promise<U[]> {
        const sqliteParams = params ? prefixParams(params) : {};
        const stmt = db.prepare(script);
        return stmt.all(sqliteParams) as U[];
      },

      async execute(
        script: string,
        params?: Record<string, unknown>
      ): Promise<{ affectedRows: number }> {
        const sqliteParams = params ? prefixParams(params) : {};
        const stmt = db.prepare(script);
        const result = stmt.run(sqliteParams);
        return { affectedRows: result.changes };
      },
    };

    // Use explicit BEGIN/COMMIT/ROLLBACK for async compatibility
    db.pragma('defer_foreign_keys = ON');
    db.prepare('BEGIN').run();
    try {
      const result = await fn(txContext);
      db.prepare('COMMIT').run();
      return result;
    } catch (error) {
      db.prepare('ROLLBACK').run();
      throw error;
    }
  }

  /**
   * Bulk insert data into multiple tables.
   * Each key in the data object is a table name, and the value is an array of row arrays.
   */
  async importRelations(data: Record<string, unknown[][]>): Promise<void> {
    this.ensureOpen();

    const txn = this.db.transaction(() => {
      for (const [table, rows] of Object.entries(data)) {
        if (rows.length === 0) continue;

        // Get column names from the table
        const tableInfo = this.db.pragma(`table_info(${table})`) as Array<{
          name: string;
        }>;
        const columns = tableInfo.map((col) => col.name);

        const placeholders = columns.map(() => '?').join(', ');
        const quotedCols = columns
          .map((c) => (c === 'order' ? `"order"` : c))
          .join(', ');
        const insertStmt = this.db.prepare(
          `INSERT OR REPLACE INTO ${table} (${quotedCols}) VALUES (${placeholders})`
        );

        for (const row of rows) {
          insertStmt.run(...row);
        }
      }
    });

    txn();
  }

  /**
   * Export data from specified tables.
   * Returns a map of table names to row arrays.
   */
  async exportRelations(
    relations: string[]
  ): Promise<Record<string, unknown[][]>> {
    this.ensureOpen();

    const result: Record<string, unknown[][]> = {};

    for (const table of relations) {
      const rows = this.db.prepare(`SELECT * FROM ${table}`).all();
      result[table] = rows.map((row) => Object.values(row as Record<string, unknown>));
    }

    return result;
  }

  /**
   * Create a backup of the database.
   * Uses better-sqlite3's backup API.
   */
  async backup(path: string): Promise<void> {
    this.ensureOpen();
    await this.db.backup(path);
  }

  /**
   * Restore is not directly supported for in-memory databases.
   * This is a placeholder for interface compliance.
   */
  async restore(_path: string): Promise<void> {
    throw new Error(
      'restore() is not supported by SqliteNodeAdapter. Create a new database from the backup file instead.'
    );
  }

  /**
   * Import specific relations from a backup file.
   * Not implemented for the test adapter.
   */
  async importRelationsFromBackup(
    _path: string,
    _relations: string[]
  ): Promise<void> {
    throw new Error(
      'importRelationsFromBackup() is not supported by SqliteNodeAdapter.'
    );
  }

  /**
   * Close the database and release resources.
   */
  async close(): Promise<void> {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }

  /**
   * Prepare parameter values for better-sqlite3.
   *
   * better-sqlite3 expects bare parameter names (e.g., { title: "abc" })
   * even when the SQL uses $-prefixed placeholders ($title). The library
   * handles the mapping internally. If a key already has a $ prefix,
   * we strip it to avoid "Missing named parameter" errors.
   *
   * Also converts boolean values to 0/1 for SQLite compatibility.
   */
  private prefixParams(
    params: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      // Strip $ prefix if present (better-sqlite3 uses bare names)
      const bareKey = key.startsWith('$') ? key.slice(1) : key;
      // Convert booleans to 0/1 for SQLite
      if (typeof value === 'boolean') {
        result[bareKey] = value ? 1 : 0;
      } else {
        result[bareKey] = value;
      }
    }
    return result;
  }

  /**
   * Ensure the database has not been closed.
   */
  private ensureOpen(): void {
    if (this.closed) {
      throw new Error('Database has been closed');
    }
  }
}
