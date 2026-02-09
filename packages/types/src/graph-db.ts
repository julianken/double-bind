// GraphDB interface and result types for CozoDB interactions

/**
 * Result from a read-only query operation.
 * Headers contain column names, rows contain the data.
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
 * Database interface for graph operations.
 * Abstracts CozoDB to allow mocking in tests and potential
 * future alternative implementations.
 */
export interface GraphDB {
  /**
   * Execute a read-only Datalog query.
   *
   * @param script - Datalog query script
   * @param params - Optional named parameters for the query
   * @returns Query results with headers and typed rows
   */
  query<T = unknown>(script: string, params?: Record<string, unknown>): Promise<QueryResult<T>>;

  /**
   * Execute a mutation (insert, update, delete) operation.
   *
   * @param script - Datalog mutation script
   * @param params - Optional named parameters for the mutation
   * @returns Mutation result with operation metadata
   */
  mutate(script: string, params?: Record<string, unknown>): Promise<MutationResult>;

  /**
   * Import data into multiple relations at once.
   * Used for bulk imports and restoring from backup.
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
}

/**
 * Provider interface for platform-agnostic database access.
 *
 * This interface abstracts database initialization and lifecycle management,
 * allowing different platforms (desktop, mobile, CLI) to provide their own
 * implementations while sharing the same service layer.
 *
 * Implementations:
 * - Desktop: TauriGraphDBProvider (uses Tauri IPC)
 * - Mobile: ExpoSQLiteProvider (uses expo-sqlite)
 * - CLI/TUI: NodeGraphDBProvider (uses cozo-node)
 *
 * @example
 * ```typescript
 * // Platform provides its implementation
 * const provider: GraphDBProvider = new TauriGraphDBProvider();
 *
 * // Core uses it to create services
 * const services = await createServicesFromProvider(provider);
 * ```
 */
export interface GraphDBProvider {
  /**
   * Get the GraphDB instance.
   *
   * This may initialize the database on first call (lazy initialization).
   * Subsequent calls should return the same instance.
   *
   * @returns The GraphDB instance for database operations
   */
  getDatabase(): Promise<GraphDB>;
}
