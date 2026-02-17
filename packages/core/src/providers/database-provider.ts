/**
 * DatabaseProvider - Platform-agnostic database provider interface
 *
 * This interface abstracts database lifecycle management across different platforms:
 * - Desktop (Tauri): Uses Rust shim via IPC
 * - Mobile (Capacitor): Will use SQLite or similar
 * - CLI/TUI: Uses cozo-node directly
 *
 * The provider pattern separates database initialization and lifecycle management
 * from the Database interface itself, allowing platform-specific implementations
 * while keeping business logic platform-agnostic.
 *
 * @example
 * ```typescript
 * // Desktop implementation (DBB-366)
 * const provider = new TauriDatabaseProvider();
 * await provider.initialize({ dbPath: '/path/to/db' });
 * const db = provider.getDatabase();
 * const services = createServices(db);
 *
 * // On app shutdown
 * await provider.close();
 * ```
 */

import type { Database } from '@double-bind/types';

/**
 * Configuration options for database initialization.
 *
 * Different platforms may require different configuration options.
 * This interface provides common options; implementations may extend it.
 */
export interface DatabaseProviderConfig {
  /**
   * Path to the database file or directory.
   * For Tauri desktop: managed by Rust, may be ignored
   * For CLI/TUI: absolute path to RocksDB directory
   * For mobile: platform-specific path
   */
  dbPath?: string;

  /**
   * Whether to run migrations automatically on initialize.
   * Default: true
   */
  runMigrations?: boolean;

  /**
   * Additional platform-specific options.
   * Implementations can use this for platform-specific configuration.
   */
  options?: Record<string, unknown>;
}

/**
 * Result of database initialization.
 */
export interface DatabaseProviderInitResult {
  /**
   * Whether initialization was successful.
   */
  success: boolean;

  /**
   * Schema version after initialization (post-migrations).
   */
  schemaVersion?: number;

  /**
   * Error message if initialization failed.
   */
  error?: string;

  /**
   * Number of migrations applied during initialization.
   */
  migrationsApplied?: number;
}

/**
 * Platform-agnostic interface for database lifecycle management.
 *
 * Implementations of this interface handle:
 * 1. Database initialization (opening connection, running migrations)
 * 2. Providing access to the Database instance
 * 3. Cleanup on shutdown (closing connections, releasing resources)
 *
 * The provider follows a lifecycle:
 * - Created (not initialized)
 * - Initialized (ready for use)
 * - Closed (no longer usable)
 *
 * Calling getDatabase() before initialize() or after close() throws an error.
 */
export interface DatabaseProvider {
  /**
   * Initialize the database connection and run migrations if configured.
   *
   * This method must be called before getDatabase().
   * Calling initialize() multiple times is safe; subsequent calls are no-ops.
   *
   * @param config - Configuration options for initialization
   * @returns Result indicating success/failure and metadata
   * @throws Never throws; errors are returned in the result object
   */
  initialize(config?: DatabaseProviderConfig): Promise<DatabaseProviderInitResult>;

  /**
   * Get the Database instance for executing queries and mutations.
   *
   * @returns The initialized Database instance
   * @throws Error if called before initialize() or after close()
   */
  getDatabase(): Database;

  /**
   * Check if the provider has been initialized and is ready for use.
   *
   * @returns true if initialize() has been called successfully
   */
  isInitialized(): boolean;

  /**
   * Close the database connection and release resources.
   *
   * After calling close(), the provider cannot be used again.
   * Calling close() multiple times is safe; subsequent calls are no-ops.
   *
   * @returns Promise that resolves when cleanup is complete
   */
  close(): Promise<void>;

  /**
   * Get the current schema version of the database.
   *
   * @returns The schema version, or undefined if not initialized
   */
  getSchemaVersion(): number | undefined;
}
