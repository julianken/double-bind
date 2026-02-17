// Database interface and result types
// Renamed from Database to be database-engine agnostic (supports both CozoDB Datalog and SQLite SQL)

/**
 * Result from a read-only query operation.
 * Headers contain column names, rows contain the data.
 *
 * Currently uses array format for backwards compatibility.
 * Future: Will be changed to a union type (RowArrayResult | RowObjectResult)
 * to support both CozoDB Datalog (array format) and SQLite SQL (object format).
 *
 * @template T - The type of values in each row (defaults to unknown)
 */
export interface QueryResult<T = unknown> {
  headers: string[];
  rows: T[][];
}

/**
 * Result from a mutation operation (insert, update, delete).
 * Structure matches QueryResult but mutations typically return
 * operation metadata rather than domain data.
 */
export interface MutationResult {
  headers: string[];
  rows: unknown[][];
}

/**
 * Result format for array-based query results (CozoDB Datalog).
 * This type will be used in the future QueryResult union.
 */
export interface RowArrayResult<T = unknown> {
  format: 'array';
  headers: string[];
  rows: T[][];
}

/**
 * Result format for object-based query results (SQLite SQL).
 * This type will be used in the future QueryResult union.
 */
export interface RowObjectResult<T = unknown> {
  format: 'object';
  rows: T[];
}

/**
 * Context for executing queries within a transaction.
 * Uses `script` parameter name (not `sql`) to remain engine-agnostic —
 * consistent with Database.query() and Database.mutate().
 */
export interface TransactionContext {
  query<T = unknown>(script: string, params?: Record<string, unknown>): Promise<T[]>;
  execute(script: string, params?: Record<string, unknown>): Promise<{ affectedRows: number }>;
}

/**
 * Configuration for database initialization.
 * Platform implementations use this to create appropriate connections.
 */
export interface DatabaseConfig {
  /**
   * Storage engine to use.
   * - 'rocksdb': High-performance LSM-tree storage (desktop)
   * - 'sqlite': Universal embedded storage (mobile, backup format)
   * - 'mem': In-memory, non-persistent (testing)
   */
  engine: 'rocksdb' | 'sqlite' | 'mem';

  /**
   * Path to the database file or directory.
   * Ignored for 'mem' engine.
   */
  path: string;
}

/**
 * Database interface for graph operations.
 * Abstracts the underlying database engine to allow mocking in tests and cross-platform
 * implementations (desktop, iOS, Android).
 *
 * All implementations must be thread-safe. Query results should
 * be considered immutable after return.
 */
export interface Database {
  /**
   * Execute a read-only query.
   *
   * @param script - Query script (Datalog for CozoDB, SQL for SQLite)
   * @param params - Optional named parameters for the query
   * @returns Query results with headers and typed rows
   */
  query<T = unknown>(script: string, params?: Record<string, unknown>): Promise<QueryResult<T>>;

  /**
   * Execute a mutation (insert, update, delete) operation.
   *
   * @param script - Mutation script (Datalog for CozoDB, SQL for SQLite)
   * @param params - Optional named parameters for the mutation
   * @returns Mutation result with operation metadata
   */
  mutate(script: string, params?: Record<string, unknown>): Promise<MutationResult>;

  /**
   * Execute multiple operations within a transaction.
   *
   * @param fn - Function that receives a transaction context
   * @returns The result returned by the transaction function
   */
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;

  /**
   * Import data into multiple relations at once.
   * Used for bulk imports and restoring from backup.
   *
   * Note: Triggers are NOT executed for imported relations.
   * Use parameterized queries if triggers must fire.
   *
   * @param data - Map of relation names to row arrays
   */
  importRelations(data: Record<string, unknown[][]>): Promise<void>;

  /**
   * Export data from specified relations.
   * Used for backup and data export features.
   *
   * @param relations - Names of relations to export
   * @returns Map of relation names to row arrays
   */
  exportRelations(relations: string[]): Promise<Record<string, unknown[][]>>;

  /**
   * Create a backup of the database at the specified path.
   * The backup format is SQLite regardless of the source engine.
   *
   * @param path - File path for the backup
   */
  backup(path: string): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Mobile Lifecycle Methods (optional)
  // These methods support mobile platform lifecycle events.
  // Desktop implementations can omit these.
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Called when the app transitions to the background (mobile).
   * Implementations should flush pending writes and prepare for suspension.
   * This ensures data integrity if the OS terminates the app while backgrounded.
   *
   * @remarks
   * - iOS: Called during applicationDidEnterBackground
   * - Android: Called during onPause/onStop
   * - Desktop: Not used (can be omitted from implementation)
   */
  suspend?(): Promise<void>;

  /**
   * Called when the app returns to the foreground (mobile).
   * Implementations may refresh connections or validate database state.
   *
   * @remarks
   * - iOS: Called during applicationWillEnterForeground
   * - Android: Called during onResume
   * - Desktop: Not used (can be omitted from implementation)
   */
  resume?(): Promise<void>;

  /**
   * Called when the system signals memory pressure (mobile).
   * Implementations should release non-essential caches and resources.
   * This helps prevent the OS from terminating the app.
   *
   * @remarks
   * - iOS: Called during applicationDidReceiveMemoryWarning
   * - Android: Called during onTrimMemory with TRIM_MEMORY_RUNNING_LOW or higher
   * - Desktop: Not used (can be omitted from implementation)
   */
  onLowMemory?(): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Backup and Resource Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Restore the database from a backup file.
   * The current database must be empty (no relations with data).
   *
   * The backup format is portable across storage engines:
   * a RocksDB backup can be restored to SQLite and vice versa.
   *
   * @param path - File path to the backup
   */
  restore(path: string): Promise<void>;

  /**
   * Import specific relations from a backup file.
   * Relations must already exist in the current database.
   *
   * Note: Triggers are NOT executed for imported relations.
   *
   * @param path - File path to the backup
   * @param relations - Names of relations to import
   */
  importRelationsFromBackup(path: string, relations: string[]): Promise<void>;

  /**
   * Close the database and release native resources.
   *
   * IMPORTANT: On mobile platforms (iOS, Android), this method MUST
   * be called when the database is no longer needed. Failure to call
   * close() will leak native memory and file handles.
   *
   * On desktop (Node.js), this is optional but recommended.
   *
   * After calling close(), the Database instance is unusable and
   * all subsequent method calls will throw.
   */
  close(): Promise<void>;
}

/**
 * Factory function type for creating Database instances.
 * Each platform provides its own implementation.
 */
export type DatabaseFactory = (config: DatabaseConfig) => Promise<Database>;

