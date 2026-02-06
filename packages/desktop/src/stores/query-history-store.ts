/**
 * Query History Store - Tracks executed CozoDB queries
 *
 * Manages:
 * - Query history (last 50 queries)
 * - Query metadata (script, timestamp, duration, result count/error)
 * - FIFO eviction when limit is reached
 * - Persistence to localStorage
 *
 * See docs/frontend/state-management.md for architecture details.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of queries to keep in history */
export const MAX_QUERY_HISTORY_SIZE = 50;

/** localStorage key for query history */
export const QUERY_HISTORY_STORAGE_KEY = 'double-bind-query-history';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a query execution - either success with row count or error
 */
export type QueryResult = { success: true; rowCount: number } | { success: false; error: string };

/**
 * A single entry in the query history
 */
export interface QueryHistoryEntry {
  /** Unique identifier for the entry */
  id: string;
  /** The CozoScript query that was executed */
  script: string;
  /** ISO timestamp when the query was executed */
  executedAt: string;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Result of the query execution */
  result: QueryResult;
}

/**
 * Query history store state and actions
 */
export interface QueryHistoryStore {
  /** Array of query history entries (newest first) */
  entries: QueryHistoryEntry[];

  /**
   * Add a new query to history
   * Automatically generates ID and timestamp
   * Enforces FIFO eviction when limit is reached
   */
  addQuery: (script: string, durationMs: number, result: QueryResult) => QueryHistoryEntry;

  /**
   * Clear all query history
   */
  clearHistory: () => void;

  /**
   * Remove a specific query from history by ID
   */
  removeQuery: (id: string) => void;

  /**
   * Get a query by ID
   */
  getQuery: (id: string) => QueryHistoryEntry | undefined;
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique ID for a query history entry
 * Uses timestamp + random suffix for uniqueness
 */
const generateQueryId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `qh-${timestamp}-${random}`;
};

// ============================================================================
// Store
// ============================================================================

/**
 * Zustand store for query history
 * Persisted to localStorage for cross-session persistence
 */
const store = create<QueryHistoryStore>()(
  persist(
    (set, get) => ({
      entries: [],

      addQuery: (script: string, durationMs: number, result: QueryResult): QueryHistoryEntry => {
        const entry: QueryHistoryEntry = {
          id: generateQueryId(),
          script,
          executedAt: new Date().toISOString(),
          durationMs,
          result,
        };

        set((state) => {
          // Add new entry at the beginning (newest first)
          const newEntries = [entry, ...state.entries];

          // Enforce max size with FIFO eviction (remove oldest)
          if (newEntries.length > MAX_QUERY_HISTORY_SIZE) {
            newEntries.pop();
          }

          return { entries: newEntries };
        });

        return entry;
      },

      clearHistory: () => set({ entries: [] }),

      removeQuery: (id: string) =>
        set((state) => ({
          entries: state.entries.filter((entry) => entry.id !== id),
        })),

      getQuery: (id: string) => get().entries.find((entry) => entry.id === id),
    }),
    {
      name: QUERY_HISTORY_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Persist entire entries array
      partialize: (state) => ({ entries: state.entries }),
    }
  )
);

// ============================================================================
// Exports
// ============================================================================

/**
 * Hook to access query history store
 */
export const useQueryHistoryStore = store;

/**
 * Get query history state outside of React components
 */
export const getQueryHistoryState = () => store.getState();

/**
 * Add a query to history outside of React components
 */
export const addQueryToHistory = (
  script: string,
  durationMs: number,
  result: QueryResult
): QueryHistoryEntry => store.getState().addQuery(script, durationMs, result);

// Expose store for E2E testing (only in development/test)
if (typeof window !== 'undefined' && (import.meta.env.DEV || import.meta.env.MODE === 'test')) {
  (window as unknown as { __QUERY_HISTORY_STORE__?: typeof store }).__QUERY_HISTORY_STORE__ = store;
}
