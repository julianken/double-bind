// Database interface -- engine-agnostic (CozoDB Datalog / SQLite SQL)

export interface QueryResult<T = unknown> {
  headers: string[];
  rows: T[][];
}

/** Result from a mutation operation (insert, update, delete). */
export interface MutationResult {
  headers: string[];
  rows: unknown[][];
}

/** Array-based query results (CozoDB Datalog). */
export interface RowArrayResult<T = unknown> {
  format: 'array';
  headers: string[];
  rows: T[][];
}

/** Object-based query results (SQLite SQL). */
export interface RowObjectResult<T = unknown> {
  format: 'object';
  rows: T[];
}

/**
 * Transaction context. Uses `script` (not `sql`) to remain engine-agnostic.
 */
export interface TransactionContext {
  query<T = unknown>(script: string, params?: Record<string, unknown>): Promise<T[]>;
  execute(script: string, params?: Record<string, unknown>): Promise<{ affectedRows: number }>;
}

export interface DatabaseConfig {
  /** rocksdb = desktop, sqlite = mobile/backup, mem = testing */
  engine: 'rocksdb' | 'sqlite' | 'mem';
  /** Path to the database file or directory. Ignored for 'mem'. */
  path: string;
}

/**
 * Database interface for graph operations.
 *
 * Abstracts the underlying engine for cross-platform use (desktop, iOS, Android)
 * and test mocking. Implementations must be thread-safe; results are immutable.
 */
export interface Database {
  query<T = unknown>(script: string, params?: Record<string, unknown>): Promise<QueryResult<T>>;
  mutate(script: string, params?: Record<string, unknown>): Promise<MutationResult>;
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;

  /**
   * Bulk import. Triggers are NOT executed -- use parameterized queries
   * if triggers must fire.
   */
  importRelations(data: Record<string, unknown[][]>): Promise<void>;
  exportRelations(relations: string[]): Promise<Record<string, unknown[][]>>;

  /** Backup format is always SQLite regardless of source engine. */
  backup(path: string): Promise<void>;

  // ── Mobile Lifecycle (optional, desktop can omit) ──────────────────────────

  /** Flush pending writes before OS suspension (iOS/Android only). */
  suspend?(): Promise<void>;
  /** Refresh connections on foreground resume (iOS/Android only). */
  resume?(): Promise<void>;
  /** Release caches under memory pressure (iOS/Android only). */
  onLowMemory?(): Promise<void>;

  // ── Backup and Resource Management ────────────────────────────────────────

  /** Restore from backup. Database must be empty. Format is cross-engine portable. */
  restore(path: string): Promise<void>;
  /** Import specific relations from a backup. Triggers are NOT executed. */
  importRelationsFromBackup(path: string, relations: string[]): Promise<void>;

  /**
   * Close the database and release native resources.
   *
   * MUST be called on mobile (iOS/Android) to avoid leaking native memory
   * and file handles. After close(), all method calls will throw.
   */
  close(): Promise<void>;
}

export type DatabaseFactory = (config: DatabaseConfig) => Promise<Database>;

