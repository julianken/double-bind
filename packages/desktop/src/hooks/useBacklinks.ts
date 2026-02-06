/**
 * useBacklinks - Hook for fetching backlinks to a page
 *
 * Fetches all blocks that link to the given page, grouped by source page.
 * Used by PageView to display the BacklinksPanel.
 *
 * @see packages/ui-primitives/src/data/BacklinksPanel.tsx
 */

import { useCallback } from 'react';
import type { PageId } from '@double-bind/types';
import type { LinkedRef, UnlinkedRef } from '@double-bind/ui-primitives';
import { useCozoQuery } from './useCozoQuery.js';
import { useServices } from '../providers/ServiceProvider.js';

/**
 * Result type for the useBacklinks hook.
 */
export interface UseBacklinksResult {
  /** Linked references (explicit [[page]] links) */
  linkedRefs: LinkedRef[];
  /** Unlinked references (mentions without links) - future feature */
  unlinkedRefs: UnlinkedRef[];
  /** Whether the backlinks are currently loading */
  isLoading: boolean;
}

/**
 * Hook to fetch backlinks for a page.
 *
 * Returns linked references (blocks that contain [[Page Name]] links)
 * and unlinked references (blocks that mention the page title without linking).
 *
 * Note: Unlinked references are not yet implemented; the array will always be empty.
 *
 * @param pageId - The page to fetch backlinks for
 * @returns Object containing linkedRefs, unlinkedRefs, and loading state
 *
 * @example
 * ```tsx
 * function PageView({ pageId }: { pageId: PageId }) {
 *   const { linkedRefs, unlinkedRefs, isLoading } = useBacklinks(pageId);
 *
 *   if (isLoading) return <div>Loading backlinks...</div>;
 *
 *   return (
 *     <BacklinksPanel
 *       pageId={pageId}
 *       linkedRefs={linkedRefs}
 *       unlinkedRefs={unlinkedRefs}
 *       onNavigate={handleNavigate}
 *     />
 *   );
 * }
 * ```
 */
export function useBacklinks(pageId: PageId): UseBacklinksResult {
  const { pageService } = useServices();

  // Query function to fetch backlinks
  const queryFn = useCallback(() => pageService.getPageBacklinks(pageId), [pageService, pageId]);

  // Use the query cache for automatic re-fetching on invalidation
  const { data, isLoading } = useCozoQuery(['backlinks', 'page', pageId], queryFn, {
    enabled: !!pageId,
  });

  // Transform the PageBacklink[] into LinkedRef[] format
  const linkedRefs: LinkedRef[] = data
    ? data.map((backlink) => ({
        block: backlink.block,
        page: backlink.page,
      }))
    : [];

  // Unlinked references are not yet implemented
  // This would require full-text search for page title mentions
  const unlinkedRefs: UnlinkedRef[] = [];

  return {
    linkedRefs,
    unlinkedRefs,
    isLoading,
  };
}

export default useBacklinks;
