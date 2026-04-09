/**
 * usePageContextMenu - Page-specific context menu composed from useContextMenu.
 *
 * Provides standard page actions: open in new tab (stub), copy link,
 * star/unstar, and delete.
 */

import { useCallback, useContext } from 'react';
import { useContextMenu } from './useContextMenu.js';
import { ServiceContext } from '../providers/ServiceProvider.js';

// ============================================================================
// Types
// ============================================================================

export interface UsePageContextMenuResult {
  /** Show the page context menu at the event position */
  showContextMenu: (event: React.MouseEvent) => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * usePageContextMenu returns a showContextMenu function pre-configured
 * with standard page actions for a given pageId.
 *
 * @param pageId - The ID of the page this context menu operates on
 * @returns Object with showContextMenu handler
 *
 * @example
 * ```ts
 * const { showContextMenu } = usePageContextMenu(pageId);
 *
 * <div onContextMenu={showContextMenu}>...</div>
 * ```
 */
export function usePageContextMenu(pageId: string): UsePageContextMenuResult {
  const services = useContext(ServiceContext);
  const { showContextMenu: showGenericMenu } = useContextMenu();

  const showContextMenu = useCallback(
    (event: React.MouseEvent) => {
      showGenericMenu(event, [
        {
          label: 'Open in new tab',
          action: () => {},
          disabled: true,
        },
        {
          label: 'Copy link',
          action: () => {
            const url = `double-bind://page/${pageId}`;
            navigator.clipboard.writeText(url).catch(() => {});
          },
        },
        {
          label: 'Star',
          separator: false,
          action: () => {
            // TODO: wire to PageService.starPage() when available
          },
        },
        {
          label: 'Delete',
          action: () => {
            if (!services) return;
            services.pageService.deletePage(pageId).catch(() => {});
          },
        },
      ]);
    },
    [pageId, showGenericMenu, services]
  );

  return { showContextMenu };
}
