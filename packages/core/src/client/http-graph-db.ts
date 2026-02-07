/**
 * HTTP Bridge GraphDB - Browser-only implementation for E2E testing
 *
 * Routes GraphDB calls to the HTTP bridge server (localhost:3001) which
 * wraps cozo-node. Used when running outside of Tauri (browser dev/testing).
 */
import type { GraphDB, QueryResult, MutationResult } from '@double-bind/types';
import { DoubleBindError, ErrorCode } from '@double-bind/types';

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
export const httpGraphDB: GraphDB = {
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
};

/**
 * Detect if running inside Tauri.
 */
export function isInTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
