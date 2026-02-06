/**
 * Stores - Zustand state management
 *
 * Barrel export for all application stores.
 */

export { useAppStore } from './ui-store.js';
export type { AppStore, RightPanelContent } from './ui-store.js';

export {
  useQueryHistoryStore,
  getQueryHistoryState,
  addQueryToHistory,
  MAX_QUERY_HISTORY_SIZE,
  QUERY_HISTORY_STORAGE_KEY,
} from './query-history-store.js';
export type { QueryHistoryStore, QueryHistoryEntry, QueryResult } from './query-history-store.js';
