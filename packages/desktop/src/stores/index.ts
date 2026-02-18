/**
 * Stores - Zustand state management
 *
 * Barrel export for all application stores.
 */

export { useAppStore } from './ui-store.js';
export type {
  AppStore,
  SidebarMode,
  RouteType,
  SaveState,
  RightPanelContent,
  ThemePreference,
  ResolvedTheme,
} from './ui-store.js';

export { useSettingsStore } from './settings-store.js';
export type {
  SettingsStore,
  LineSpacing,
  AccessibilityOverride,
  FontScale,
  DefaultBlockType,
} from './settings-store.js';

export { useGraphStore } from './graph-store.js';
export type { GraphStore, EncodingMode, PageId } from './graph-store.js';

export {
  useQueryHistoryStore,
  getQueryHistoryState,
  addQueryToHistory,
  MAX_QUERY_HISTORY_SIZE,
  QUERY_HISTORY_STORAGE_KEY,
} from './query-history-store.js';
export type { QueryHistoryStore, QueryHistoryEntry, QueryResult } from './query-history-store.js';
