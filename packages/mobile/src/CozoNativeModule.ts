/**
 * TypeScript interface for the CozoModule React Native native module.
 *
 * This interface defines the contract between JavaScript and the native
 * Android/iOS implementations. All methods are asynchronous and use JSON
 * strings for data transfer.
 *
 * @see CozoModule.kt - Android implementation
 * @see Database - TypeScript interface at packages/types/src/graph-db.ts
 */
import { NativeModules, Platform } from 'react-native';

/**
 * Native module interface matching the Kotlin/Swift implementations.
 *
 * All database operations are asynchronous and return Promises.
 * Parameters and results are serialized as JSON strings for cross-platform
 * compatibility.
 */
export interface CozoNativeModule {
  /**
   * Initialize the database with the given path.
   * Uses SQLite storage engine (recommended for mobile).
   *
   * @param path Absolute path to the database file
   * @throws Error if already initialized or initialization fails
   */
  initialize(path: string): Promise<void>;

  /**
   * Close the database and release native resources.
   * Must be called when the database is no longer needed.
   *
   * @throws Error if not initialized or close fails
   */
  close(): Promise<void>;

  /**
   * Execute a Datalog query or mutation.
   *
   * @param script Datalog script to execute
   * @param params JSON string of named parameters (e.g., '{"name": "value"}')
   * @returns JSON string containing query results with headers and rows
   * @throws Error if not initialized or query fails
   */
  run(script: string, params: string): Promise<string>;

  /**
   * Export data from specified relations.
   *
   * @param relations JSON array of relation names (e.g., '["pages", "blocks"]')
   * @returns JSON object mapping relation names to row arrays
   * @throws Error if not initialized or export fails
   */
  exportRelations(relations: string): Promise<string>;

  /**
   * Import data into multiple relations at once.
   *
   * Note: Triggers are NOT executed for imported relations.
   *
   * @param data JSON object mapping relation names to row arrays
   * @throws Error if not initialized or import fails
   */
  importRelations(data: string): Promise<void>;

  /**
   * Create a backup of the database at the specified path.
   *
   * @param path File path for the backup
   * @throws Error if not initialized or backup fails
   */
  backup(path: string): Promise<void>;

  /**
   * Restore the database from a backup file.
   *
   * @param path File path to the backup
   * @throws Error if not initialized or restore fails
   */
  restore(path: string): Promise<void>;

  /**
   * Import specific relations from a backup file.
   *
   * @param path File path to the backup
   * @param relations JSON array of relation names to import
   * @throws Error if not initialized or import fails
   */
  importRelationsFromBackup(path: string, relations: string): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Mobile Lifecycle Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Called when the app transitions to the background.
   * Flushes pending writes and prepares for suspension.
   *
   * @throws Error if not initialized or suspend fails
   */
  suspend(): Promise<void>;

  /**
   * Called when the app returns to the foreground.
   * Refreshes connections and validates database state.
   *
   * @throws Error if not initialized or resume fails
   */
  resume(): Promise<void>;

  /**
   * Called when the system signals memory pressure.
   * Releases non-essential caches and resources.
   *
   * @throws Error if not initialized or operation fails
   */
  onLowMemory(): Promise<void>;
}

/**
 * Get the CozoModule native module.
 *
 * @returns The CozoNativeModule interface
 * @throws Error if the native module is not available
 */
export function getCozoModule(): CozoNativeModule {
  const { CozoModule } = NativeModules;

  if (!CozoModule) {
    throw new Error(
      `CozoModule native module is not available. ` +
        `Platform: ${Platform.OS}. ` +
        `Make sure the native module is properly linked.`
    );
  }

  return CozoModule as CozoNativeModule;
}
