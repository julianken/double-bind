/**
 * Hook exports for Double-Bind mobile app.
 */
export { useDatabase, useDatabaseReady } from './useDatabase';
export { useGraphData, type UseGraphDataOptions, type UseGraphDataResult } from './useGraphData';
export { useDailyNote } from './useDailyNote';
export type { UseDailyNoteResult } from './useDailyNote';
export { useCreatePage, type UseCreatePageResult, type CreatePageResult } from './useCreatePage';
export {
  useAutocomplete,
  type UseAutocompleteOptions,
  type UseAutocompleteResult,
} from './useAutocomplete';
export {
  useWikiLinkAutocomplete,
  type UseWikiLinkAutocompleteResult,
  type AutocompleteSelection,
} from './useWikiLinkAutocomplete';
export {
  useSyncManager,
  type UseSyncManagerOptions,
  type UseSyncManagerResult,
  type SyncStatus,
} from './useSyncManager';
