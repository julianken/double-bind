/**
 * HttpGraphDBProvider - GraphDB provider for browser-based E2E testing.
 *
 * This provider routes GraphDB calls through an HTTP bridge server (localhost:3001)
 * which wraps cozo-node. Used when running outside of Tauri for development
 * and E2E testing in a browser context.
 *
 * @module
 */

import type { GraphDB, QueryResult, MutationResult } from '@double-bind/types';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import type { GraphDBProvider } from './TauriGraphDBProvider.js';

const BRIDGE_URL = 'http://localhost:3001';

/**
 * Maps error strings to typed DoubleBindError instances.
 */
function mapError(errorString: string): DoubleBindError {
  if (errorString.startsWith('Blocked operation:')) {
    return new DoubleBindError(errorString, ErrorCode.BLOCKED_OPERATION);
  }
  return new DoubleBindError(errorString, ErrorCode.DB_QUERY_FAILED);
}

/**
 * Makes an HTTP request to the bridge server.
 */
async function bridgeInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  try {
    const response = await fetch(`${BRIDGE_URL}/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd, args }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw mapError(error.error || `Bridge call failed: ${cmd}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof DoubleBindError) {
      throw error;
    }
    throw mapError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * HTTP Bridge GraphDB implementation for browser-only testing.
 * All methods delegate to the HTTP bridge server.
 */
const httpGraphDB: GraphDB = {
  async query<T = unknown>(
    script: string,
    params: Record<string, unknown> = {}
  ): Promise<QueryResult<T>> {
    return bridgeInvoke<QueryResult<T>>('query', { script, params });
  },

  async mutate(script: string, params: Record<string, unknown> = {}): Promise<MutationResult> {
    return bridgeInvoke<MutationResult>('mutate', { script, params });
  },

  async importRelations(data: Record<string, unknown[][]>): Promise<void> {
    return bridgeInvoke<void>('import_relations', { data });
  },

  async exportRelations(relations: string[]): Promise<Record<string, unknown[][]>> {
    return bridgeInvoke<Record<string, unknown[][]>>('export_relations', { relations });
  },

  async backup(path: string): Promise<void> {
    return bridgeInvoke<void>('backup', { path });
  },

  async restore(path: string): Promise<void> {
    return bridgeInvoke<void>('restore', { path });
  },

  async importRelationsFromBackup(path: string, relations: string[]): Promise<void> {
    return bridgeInvoke<void>('import_relations_from_backup', { path, relations });
  },

  async close(): Promise<void> {
    // HTTP bridge manages its own lifecycle. This is a no-op for compatibility.
    return Promise.resolve();
  },
};

/**
 * HttpGraphDBProvider - GraphDB provider for browser-based E2E testing.
 *
 * This provider is used when running outside of Tauri (in a browser) for
 * development and E2E testing. It communicates with the HTTP bridge server
 * which wraps cozo-node.
 *
 * @example
 * ```typescript
 * const provider = new HttpGraphDBProvider();
 * await provider.initialize();
 * const graphDB = provider.getGraphDB();
 * const result = await graphDB.query('?[x] <- [[1], [2], [3]]');
 * ```
 */
export class HttpGraphDBProvider implements GraphDBProvider {
  private initialized = false;

  /**
   * Get the GraphDB instance for HTTP bridge.
   * Returns the singleton httpGraphDB that communicates via HTTP.
   */
  getGraphDB(): GraphDB {
    return httpGraphDB;
  }

  /**
   * Initialize the provider.
   * For HTTP bridge, we could optionally check if the bridge server is running.
   */
  async initialize(): Promise<void> {
    // Optionally verify bridge is running:
    // await httpGraphDB.query('?[x] <- [[1]]');
    this.initialized = true;
  }

  /**
   * Check if the provider is ready to use.
   */
  isReady(): boolean {
    return this.initialized;
  }
}
