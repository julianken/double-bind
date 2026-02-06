/**
 * TauriGraphDB - Production GraphDB implementation via Tauri IPC
 *
 * Bridges TypeScript business logic to the Rust shim via Tauri's invoke() API.
 * Maps Rust error strings to typed DoubleBindError instances.
 */
import { invoke } from '@tauri-apps/api/core';
import type { GraphDB, QueryResult, MutationResult } from '@double-bind/types';
import { DoubleBindError, ErrorCode } from '@double-bind/types';

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
 * Production GraphDB implementation for Tauri desktop app.
 * All methods delegate to Rust shim commands via Tauri IPC.
 */
export const tauriGraphDB: GraphDB = {
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
};
