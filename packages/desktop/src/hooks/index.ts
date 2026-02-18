/**
 * Hooks barrel export
 */

export {
  useCozoQuery,
  invalidateQueries,
  clearQueryCache,
  type UseCozoQueryOptions,
  type UseCozoQueryResult,
} from './useCozoQuery.js';

export { useGlobalShortcuts } from './useGlobalShortcuts.js';

export {
  useKeyboardShortcuts,
  useAppKeyboardShortcuts,
  type KeyboardShortcut,
  type UseKeyboardShortcutsOptions,
} from './useKeyboardShortcuts.js';

export { useCreatePage, type UseCreatePageResult, type CreatePageResult } from './useCreatePage.js';

export {
  useGlobalKeyboardShortcuts,
  useNewPageShortcut,
  type KeyboardShortcutActions,
  type UseGlobalKeyboardShortcutsOptions,
} from './useGlobalKeyboardShortcuts.js';

export { useResizable, type UseResizableOptions, type UseResizableResult } from './useResizable.js';

export { useBacklinks, type UseBacklinksResult } from './useBacklinks.js';

export { useNeighborhood, type UseNeighborhoodResult } from './useNeighborhood.js';

export {
  useSearch,
  type SearchResult,
  type UseSearchOptions,
  type UseSearchResult,
} from './useSearch.js';

export { useContextMenu, type ContextMenuItem, type UseContextMenuResult } from './useContextMenu.js';

export { usePageContextMenu, type UsePageContextMenuResult } from './usePageContextMenu.js';

export { useQuickCapture, type UseQuickCaptureResult } from './useQuickCapture.js';

export {
  useHoverPreview,
  dispatchHoverPreviewOpen,
  dispatchHoverPreviewClose,
  type UseHoverPreviewResult,
  type HoverPreviewPosition,
} from './useHoverPreview.js';

export {
  usePagePreview,
  invalidatePagePreviewCache,
  clearPagePreviewCache,
  type PagePreviewData,
  type UsePagePreviewResult,
} from './usePagePreview.js';

export {
  useBlockContextMenu,
  dispatchBlockContextMenu,
  type UseBlockContextMenuResult,
  type BlockContextMenuAction,
  type ContextMenuPosition,
} from './useBlockContextMenu.js';

export { useTypewriterScroll } from './useTypewriterScroll.js';

export { useSidebarQuietMode } from './useSidebarQuietMode.js';
