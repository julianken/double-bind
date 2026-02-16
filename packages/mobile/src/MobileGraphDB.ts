/**
 * Mobile GraphDB implementation using React Native native modules.
 *
 * This class bridges the TypeScript GraphDB interface to the native
 * Android/iOS CozoDB implementations via React Native's NativeModules.
 *
 * @see GraphDB - TypeScript interface at packages/types/src/graph-db.ts
 * @see CozoNativeModule - Native module interface
 */
import type {
  GraphDB,
  QueryResult,
  MutationResult,
  TransactionContext,
} from '@double-bind/types';
import type { CozoNativeModule } from './CozoNativeModule';
import { getCozoModule } from './CozoNativeModule';

/**
 * Mobile implementation of GraphDB using React Native native modules.
 *
 * All operations are delegated to the native CozoDB implementation via
 * JSON serialization. The native module handles threading and resource
 * management.
 *
 * Usage:
 * ```typescript
 * const db = await MobileGraphDB.create('/path/to/database');
 * const result = await db.query('?[x] := x = 1');
 * await db.close();
 * ```
 */
export class MobileGraphDB implements GraphDB {
  private readonly native: CozoNativeModule;
  private closed = false;

  /**
   * Private constructor - use MobileGraphDB.create() instead.
   */
  private constructor(native: CozoNativeModule) {
    this.native = native;
  }

  /**
   * Create and initialize a new MobileGraphDB instance.
   *
   * @param path Absolute path to the database file
   * @returns Initialized MobileGraphDB instance
   * @throws Error if initialization fails
   */
  static async create(path: string): Promise<MobileGraphDB> {
    const native = getCozoModule();
    await native.initialize(path);
    return new MobileGraphDB(native);
  }

  /**
   * Execute a read-only Datalog query.
   *
   * @param script Datalog query script
   * @param params Optional named parameters for the query
   * @returns Query results with headers and typed rows
   */
  async query<T = unknown>(
    script: string,
    params?: Record<string, unknown>
  ): Promise<QueryResult<T>> {
    this.checkNotClosed();
    const paramsJson = JSON.stringify(params ?? {});
    const resultJson = await this.native.run(script, paramsJson);
    return JSON.parse(resultJson) as QueryResult<T>;
  }

  /**
   * Execute a mutation (insert, update, delete) operation.
   *
   * @param script Datalog mutation script
   * @param params Optional named parameters for the mutation
   * @returns Mutation result with operation metadata
   */
  async mutate(
    script: string,
    params?: Record<string, unknown>
  ): Promise<MutationResult> {
    this.checkNotClosed();
    const paramsJson = JSON.stringify(params ?? {});
    const resultJson = await this.native.run(script, paramsJson);
    return JSON.parse(resultJson) as MutationResult;
  }

  /**
   * Execute multiple operations within a transaction.
   *
   * NOTE: Transactions are not yet supported in the mobile CozoDB implementation.
   * This method will be implemented during the SQLite migration.
   *
   * @param _fn Function that receives a transaction context
   * @throws Error always - transactions not yet supported
   */
  async transaction<T>(_fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    throw new Error('Transactions are not yet supported in mobile CozoDB implementation');
  }

  /**
   * Import data into multiple relations at once.
   *
   * Note: Triggers are NOT executed for imported relations.
   *
   * @param data Map of relation names to row arrays
   */
  async importRelations(data: Record<string, unknown[][]>): Promise<void> {
    this.checkNotClosed();
    const dataJson = JSON.stringify(data);
    await this.native.importRelations(dataJson);
  }

  /**
   * Export data from specified relations.
   *
   * @param relations Names of relations to export
   * @returns Map of relation names to row arrays
   */
  async exportRelations(
    relations: string[]
  ): Promise<Record<string, unknown[][]>> {
    this.checkNotClosed();
    const relationsJson = JSON.stringify(relations);
    const resultJson = await this.native.exportRelations(relationsJson);
    return JSON.parse(resultJson) as Record<string, unknown[][]>;
  }

  /**
   * Create a backup of the database at the specified path.
   *
   * @param path File path for the backup
   */
  async backup(path: string): Promise<void> {
    this.checkNotClosed();
    await this.native.backup(path);
  }

  /**
   * Restore the database from a backup file.
   *
   * @param path File path to the backup
   */
  async restore(path: string): Promise<void> {
    this.checkNotClosed();
    await this.native.restore(path);
  }

  /**
   * Import specific relations from a backup file.
   *
   * @param path File path to the backup
   * @param relations Names of relations to import
   */
  async importRelationsFromBackup(
    path: string,
    relations: string[]
  ): Promise<void> {
    this.checkNotClosed();
    const relationsJson = JSON.stringify(relations);
    await this.native.importRelationsFromBackup(path, relationsJson);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Mobile Lifecycle Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Called when the app transitions to the background.
   * Flushes pending writes and prepares for suspension.
   */
  async suspend(): Promise<void> {
    this.checkNotClosed();
    await this.native.suspend();
  }

  /**
   * Called when the app returns to the foreground.
   * Refreshes connections and validates database state.
   */
  async resume(): Promise<void> {
    this.checkNotClosed();
    await this.native.resume();
  }

  /**
   * Called when the system signals memory pressure.
   * Releases non-essential caches and resources.
   */
  async onLowMemory(): Promise<void> {
    this.checkNotClosed();
    await this.native.onLowMemory();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Resource Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Close the database and release native resources.
   *
   * MUST be called when the database is no longer needed.
   * After calling close(), the instance is unusable.
   */
  async close(): Promise<void> {
    if (!this.closed) {
      this.closed = true;
      await this.native.close();
    }
  }

  /**
   * Check if the database is closed and throw if so.
   */
  private checkNotClosed(): void {
    if (this.closed) {
      throw new Error('Database has been closed');
    }
  }
}
