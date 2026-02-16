/**
 * TauriGraphDBProvider - GraphDB provider implementation for Tauri desktop app.
 *
 * Implements the GraphDBProvider interface using Tauri IPC to communicate
 * with the Rust shim. This keeps all Tauri-specific code in the desktop package.
 *
 * @module
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  GraphDB,
  QueryResult,
  MutationResult,
  TransactionContext,
} from '@double-bind/types';
import { DoubleBindError, ErrorCode } from '@double-bind/types';

/**
 * GraphDBProvider interface - abstraction for creating GraphDB instances.
 *
 * This interface allows different platforms (desktop, mobile, web) to provide
 * their own GraphDB implementations while keeping the core business logic
 * platform-agnostic.
 *
 * NOTE: This is a minimal local definition. It will be replaced by the
 * interface from @double-bind/core when DBB-363 merges.
 */
export interface GraphDBProvider {
  /**
   * Get the GraphDB instance for this provider.
   * The instance may be lazily initialized on first call.
   */
  getGraphDB(): GraphDB;

  /**
   * Initialize the provider. Called once at app startup.
   * For Tauri, this is a no-op since the Rust backend is always available.
   * For mobile, this may initialize SQLite or other storage.
   */
  initialize(): Promise<void>;

  /**
   * Check if the provider is ready to use.
   */
  isReady(): boolean;
}

/**
 * Maps error strings from the Rust shim to typed DoubleBindError instances.
 *
 * @param errorString - Raw error message from Rust
 * @returns DoubleBindError with appropriate error code
 */
function mapError(errorString: string): DoubleBindError {
  if (errorString.startsWith('Blocked operation:')) {
    return new DoubleBindError(errorString, ErrorCode.BLOCKED_OPERATION);
  }
  return new DoubleBindError(errorString, ErrorCode.DB_QUERY_FAILED);
}

/**
 * Wraps Tauri invoke calls with error mapping.
 * All IPC calls go through this to ensure consistent error handling.
 *
 * @param cmd - Tauri command name
 * @param args - Command arguments
 * @returns Promise resolving to the command result
 * @throws DoubleBindError on failure
 */
async function invokeWithErrorMapping<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (error) {
    // Tauri invoke throws strings or Error objects
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw mapError(errorMessage);
  }
}

/**
 * GraphDB implementation for Tauri desktop app.
 * All methods delegate to Rust shim commands via Tauri IPC.
 */
const tauriGraphDB: GraphDB = {
  /**
   * Execute a read-only Datalog query via Tauri IPC.
   */
  async query<T = unknown>(
    script: string,
    params: Record<string, unknown> = {}
  ): Promise<QueryResult<T>> {
    return invokeWithErrorMapping<QueryResult<T>>('query', { script, params });
  },

  /**
   * Execute a mutation (insert, update, delete) via Tauri IPC.
   */
  async mutate(script: string, params: Record<string, unknown> = {}): Promise<MutationResult> {
    return invokeWithErrorMapping<MutationResult>('mutate', { script, params });
  },

  /**
   * Execute multiple operations within a transaction.
   *
   * NOTE: Transactions are not yet supported in the CozoDB/Tauri implementation.
   * This method will be implemented during the SQLite migration.
   *
   * @param _fn Function that receives a transaction context
   * @throws Error always - transactions not yet supported
   */
  async transaction<T>(_fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    throw new Error('Transactions are not yet supported in Tauri CozoDB implementation');
  },

  /**
   * Import data into multiple relations at once via Tauri IPC.
   */
  async importRelations(data: Record<string, unknown[][]>): Promise<void> {
    return invokeWithErrorMapping<void>('import_relations', { data });
  },

  /**
   * Export data from specified relations via Tauri IPC.
   */
  async exportRelations(relations: string[]): Promise<Record<string, unknown[][]>> {
    return invokeWithErrorMapping<Record<string, unknown[][]>>('export_relations', { relations });
  },

  /**
   * Create a backup of the database at the specified path via Tauri IPC.
   */
  async backup(path: string): Promise<void> {
    return invokeWithErrorMapping<void>('backup', { path });
  },

  /**
   * Restore the database from a backup file via Tauri IPC.
   */
  async restore(path: string): Promise<void> {
    return invokeWithErrorMapping<void>('restore', { path });
  },

  /**
   * Import specific relations from a backup file via Tauri IPC.
   */
  async importRelationsFromBackup(path: string, relations: string[]): Promise<void> {
    return invokeWithErrorMapping<void>('import_relations_from_backup', { path, relations });
  },

  /**
   * Close the database and release native resources via Tauri IPC.
   * On desktop Tauri, this is typically a no-op as the Rust backend
   * manages the database lifecycle.
   */
  async close(): Promise<void> {
    // The Tauri backend handles cleanup on app shutdown.
    // This is provided for API compatibility with mobile platforms.
    return Promise.resolve();
  },
};

/**
 * TauriGraphDBProvider - Production GraphDB provider for Tauri desktop app.
 *
 * This provider wraps the Tauri IPC-based GraphDB implementation and provides
 * it through the GraphDBProvider interface. The Rust backend is always available
 * once the Tauri app starts, so initialization is essentially a no-op.
 *
 * @example
 * ```typescript
 * const provider = new TauriGraphDBProvider();
 * await provider.initialize();
 * const graphDB = provider.getGraphDB();
 * const result = await graphDB.query('?[x] <- [[1], [2], [3]]');
 * ```
 */
export class TauriGraphDBProvider implements GraphDBProvider {
  private initialized = false;

  /**
   * Get the GraphDB instance for Tauri.
   * Returns the singleton tauriGraphDB that communicates via IPC.
   */
  getGraphDB(): GraphDB {
    return tauriGraphDB;
  }

  /**
   * Initialize the provider.
   * For Tauri, the Rust backend is always available, so this just marks
   * the provider as ready.
   */
  async initialize(): Promise<void> {
    // Tauri backend is always available once the app starts.
    // We could optionally perform a health check here:
    // await tauriGraphDB.query('?[x] <- [[1]]');
    this.initialized = true;
  }

  /**
   * Check if the provider is ready to use.
   */
  isReady(): boolean {
    return this.initialized;
  }
}

/**
 * Check if running inside a Tauri desktop application.
 * Detects the presence of Tauri's window.__TAURI_INTERNALS__ object.
 */
export function isInTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
