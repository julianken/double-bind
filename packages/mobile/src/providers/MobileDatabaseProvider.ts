/**
 * MobileDatabaseProvider - SQLite database implementation for React Native mobile apps.
 *
 * This provider wraps the op-sqlite library to implement the Database interface.
 * op-sqlite uses JSI (JavaScript Interface) for direct access to SQLite without
 * the React Native bridge, providing high performance.
 *
 * Key differences from desktop SqliteNodeAdapter:
 * - op-sqlite is async (better-sqlite3 is sync)
 * - op-sqlite uses db.execute() for queries (returns object format)
 * - Parameters use ? placeholders with an array of values (not named parameters)
 *
 * Note: op-sqlite requires native setup (pod install on iOS, gradle sync on Android).
 * If not properly linked, the app will crash on initialization.
 */

import { open, type DB, type Scalar } from '@op-engineering/op-sqlite';
import type { Database, QueryResult, MutationResult, TransactionContext } from '@double-bind/types';
import { getDatabaseModule } from '../DatabaseNativeModule';

const TABLE_WHITELIST = new Set([
  'pages',
  'blocks',
  'links',
  'block_properties',
  'page_properties',
  'block_tags',
  'page_tags',
  'daily_notes',
]);

function assertValidTable(table: string): void {
  if (!TABLE_WHITELIST.has(table)) {
    throw new Error(`Invalid table name: "${table}"`);
  }
}

/**
 * Mobile database provider using op-sqlite.
 * Implements the Database interface for React Native apps.
 */
export class MobileDatabaseProvider implements Database {
  private db: DB;
  private closed = false;

  /**
   * Private constructor - use MobileDatabaseProvider.create() instead.
   */
  private constructor(db: DB) {
    this.db = db;
  }

  /**
   * Create and initialize a new MobileDatabaseProvider.
   *
   * @param path Optional absolute path to the database file. If not provided, uses the default platform path.
   * @returns Initialized MobileDatabaseProvider instance
   * @throws Error if initialization fails or op-sqlite is not properly linked
   */
  static async create(path?: string): Promise<MobileDatabaseProvider> {
    try {
      // Get the database path from the native module if not provided
      let dbPath = path;
      if (!dbPath) {
        const nativeModule = getDatabaseModule();
        dbPath = await nativeModule.getDatabasePath();
        await nativeModule.ensureDatabaseDirectory(dbPath);
      }

      // Open the database using op-sqlite
      // The database file is created if it doesn't exist
      const db = open({ name: dbPath });

      // Enable foreign keys and WAL mode for better performance
      db.executeSync('PRAGMA foreign_keys = ON');
      db.executeSync('PRAGMA journal_mode = WAL');

      return new MobileDatabaseProvider(db);
    } catch (error) {
      throw new Error(
        `Failed to initialize database at ${path ?? 'default path'}: ${error instanceof Error ? error.message : String(error)}. ` +
          `Ensure op-sqlite is properly linked (run 'pod install' on iOS or gradle sync on Android).`
      );
    }
  }

  /**
   * Execute a read-only SQL query.
   * Returns results in array format with headers for compatibility.
   *
   * Note: op-sqlite uses ? placeholders, not $name. We convert named parameters to positional.
   */
  async query<T = unknown>(
    script: string,
    params?: Record<string, unknown>
  ): Promise<QueryResult<T>> {
    this.ensureOpen();

    try {
      // Convert named parameters ($name) to positional (?)
      const { sql, values } = this.convertNamedParams(script, params);

      // Execute the query
      const result = await this.db.execute(sql, values);

      // Extract rows (op-sqlite returns array of objects)
      const rows = result.rows ?? [];

      if (rows.length === 0) {
        // Use column metadata if available
        const headers = result.columnNames ?? [];
        return { headers, rows: [] as T[][] };
      }

      // Extract headers from first row's keys
      const firstRow = rows[0];
      if (!firstRow) {
        return { headers: [], rows: [] as T[][] };
      }
      const headers = Object.keys(firstRow);

      // Convert each row object to an array in header order
      const arrayRows = rows.map((row) => {
        return headers.map((h) => row[h]) as T[];
      });

      return { headers, rows: arrayRows };
    } catch (error) {
      throw new Error(
        `Query failed: ${error instanceof Error ? error.message : String(error)}\nSQL: ${script}`
      );
    }
  }

  /**
   * Execute a mutation (INSERT/UPDATE/DELETE).
   *
   * If the SQL contains a RETURNING clause, it behaves like a query
   * and returns the selected rows. Otherwise returns affected_rows count.
   */
  async mutate(script: string, params?: Record<string, unknown>): Promise<MutationResult> {
    this.ensureOpen();

    try {
      // Convert named parameters ($name) to positional (?)
      const { sql, values } = this.convertNamedParams(script, params);

      // Check if this is a statement with RETURNING clause
      const hasReturning = /\bRETURNING\b/i.test(sql);

      // Execute the mutation
      const result = await this.db.execute(sql, values);

      if (hasReturning) {
        const rows = result.rows ?? [];

        if (rows.length === 0) {
          return { headers: [], rows: [] };
        }

        const firstRow = rows[0];
        if (!firstRow) {
          return { headers: [], rows: [] };
        }
        const headers = Object.keys(firstRow);
        const arrayRows = rows.map((row) => {
          return headers.map((h) => row[h]);
        });

        return { headers, rows: arrayRows };
      }

      // For non-RETURNING statements, return rowsAffected
      const affectedRows = result.rowsAffected ?? 0;

      return {
        headers: ['affected_rows'],
        rows: [[affectedRows]],
      };
    } catch (error) {
      throw new Error(
        `Mutation failed: ${error instanceof Error ? error.message : String(error)}\nSQL: ${script}`
      );
    }
  }

  /**
   * Execute multiple operations within a transaction.
   * Provides a TransactionContext with query/execute methods.
   */
  async transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    this.ensureOpen();

    const convertParams = this.convertNamedParams.bind(this);
    let result: T | undefined;

    // Use op-sqlite's transaction API
    await this.db.transaction(async (tx) => {
      // Create a TransactionContext that uses the transaction object
      const wrappedContext: TransactionContext = {
        async query<U = unknown>(script: string, params?: Record<string, unknown>): Promise<U[]> {
          const { sql, values } = convertParams(script, params);
          const queryResult = await tx.execute(sql, values);
          return (queryResult.rows ?? []) as U[];
        },

        async execute(
          script: string,
          params?: Record<string, unknown>
        ): Promise<{ affectedRows: number }> {
          const { sql, values } = convertParams(script, params);
          const queryResult = await tx.execute(sql, values);
          return { affectedRows: queryResult.rowsAffected ?? 0 };
        },
      };

      result = await fn(wrappedContext);
    });

    if (result === undefined) {
      throw new Error('Transaction did not return a result');
    }

    return result;
  }

  /**
   * Bulk insert data into multiple tables.
   * Each key in the data object is a table name, and the value is an array of row arrays.
   */
  async importRelations(data: Record<string, unknown[][]>): Promise<void> {
    this.ensureOpen();

    await this.db.transaction(async (tx) => {
      for (const [table, rows] of Object.entries(data)) {
        if (rows.length === 0) continue;

        assertValidTable(table);
        const tableInfoResult = await tx.execute(`PRAGMA table_info(${table})`);
        const tableInfo = (tableInfoResult.rows ?? []) as Array<{ name: string }>;
        const columns = tableInfo.map((col) => col.name);

        const placeholders = columns.map(() => '?').join(', ');
        const quotedCols = columns.map((c) => (c === 'order' ? `"order"` : c)).join(', ');
        const sql = `INSERT OR REPLACE INTO ${table} (${quotedCols}) VALUES (${placeholders})`;

        for (const row of rows) {
          // Convert row values to Scalars
          const scalarRow: Scalar[] = row.map((val) => {
            if (typeof val === 'boolean') {
              return val ? 1 : 0;
            } else if (
              typeof val === 'string' ||
              typeof val === 'number' ||
              val === null ||
              val instanceof ArrayBuffer ||
              ArrayBuffer.isView(val)
            ) {
              return val as Scalar;
            } else {
              return String(val);
            }
          });
          await tx.execute(sql, scalarRow);
        }
      }
    });
  }

  /**
   * Export data from specified tables.
   * Returns a map of table names to row arrays.
   */
  async exportRelations(relations: string[]): Promise<Record<string, unknown[][]>> {
    this.ensureOpen();

    const result: Record<string, unknown[][]> = {};

    for (const table of relations) {
      assertValidTable(table);
      const queryResult = await this.db.execute(`SELECT * FROM ${table}`);
      const rows = queryResult.rows ?? [];
      result[table] = rows.map((row) => Object.values(row));
    }

    return result;
  }

  /**
   * Create a backup of the database.
   * Not directly supported by op-sqlite - would need to copy the file manually.
   */
  async backup(path: string): Promise<void> {
    throw new Error(
      `backup() is not yet implemented for MobileDatabaseProvider. ` +
        `Target path: ${path}. Use file system copy operations instead.`
    );
  }

  /**
   * Restore the database from a backup file.
   * Not directly supported - create a new database from the backup file instead.
   */
  async restore(_path: string): Promise<void> {
    throw new Error(
      'restore() is not supported by MobileDatabaseProvider. ' +
        'Create a new database from the backup file instead.'
    );
  }

  /**
   * Import specific relations from a backup file.
   * Not implemented for the mobile adapter.
   */
  async importRelationsFromBackup(_path: string, _relations: string[]): Promise<void> {
    throw new Error('importRelationsFromBackup() is not supported by MobileDatabaseProvider.');
  }

  /**
   * Called when the app transitions to the background (mobile).
   * Ensures pending writes are flushed.
   */
  async suspend(): Promise<void> {
    this.ensureOpen();
    // WAL mode handles this automatically - checkpoint the WAL
    try {
      this.db.executeSync('PRAGMA wal_checkpoint(PASSIVE)');
    } catch {
      // Checkpoint failure is non-fatal
    }
  }

  /**
   * Called when the app returns to the foreground (mobile).
   * Validates database state.
   */
  async resume(): Promise<void> {
    this.ensureOpen();
    // Validate database is accessible with a simple query
    try {
      await this.db.execute('SELECT 1');
    } catch (error) {
      throw new Error(
        `Database validation failed on resume: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Called when the system signals memory pressure (mobile).
   * Releases non-essential caches.
   */
  async onLowMemory(): Promise<void> {
    this.ensureOpen();
    // Free page cache to reduce memory usage
    try {
      this.db.executeSync('PRAGMA shrink_memory');
    } catch {
      // Shrink memory failure is non-fatal
    }
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
   * Convert named parameters ($name) to positional (?) for op-sqlite.
   *
   * op-sqlite uses ? placeholders with positional parameters.
   * We need to convert $name to ? and extract values in order.
   *
   * Also converts boolean values to 0/1 for SQLite compatibility.
   */
  private convertNamedParams(
    sql: string,
    params?: Record<string, unknown>
  ): { sql: string; values: Scalar[] } {
    if (!params || Object.keys(params).length === 0) {
      return { sql, values: [] };
    }

    const values: Scalar[] = [];
    const paramMap = new Map<string, number>();

    // Replace $name with ? and track parameter order
    const convertedSql = sql.replace(/\$(\w+)/g, (_match, name) => {
      if (!paramMap.has(name)) {
        const value = params[name];
        // Convert booleans to 0/1 for SQLite
        let sqlValue: Scalar;
        if (typeof value === 'boolean') {
          sqlValue = value ? 1 : 0;
        } else if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          value === null ||
          value instanceof ArrayBuffer ||
          ArrayBuffer.isView(value)
        ) {
          sqlValue = value as Scalar;
        } else {
          // Fallback: convert to string
          sqlValue = String(value);
        }
        values.push(sqlValue);
        paramMap.set(name, values.length - 1);
      }
      return '?';
    });

    return { sql: convertedSql, values };
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
