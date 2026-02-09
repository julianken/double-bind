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
  query<T = unknown>(
    script: string,
    params?: Record<string, unknown>,
  ): Promise<QueryResult<T>>;

  /**
   * Execute a mutation (insert, update, delete) operation.
   *
   * @param script - Datalog mutation script
   * @param params - Optional named parameters for the mutation
   * @returns Mutation result with operation metadata
   */
  mutate(
    script: string,
    params?: Record<string, unknown>,
  ): Promise<MutationResult>;

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
