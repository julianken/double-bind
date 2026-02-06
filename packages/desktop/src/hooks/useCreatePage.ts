/**
 * useCreatePage - Hook for creating new pages
 *
 * Provides a mutation function that:
 * 1. Creates a new page via pageService.createPage
 * 2. Navigates to the new page via useAppStore.navigateToPage
 * 3. Invalidates the ['pages'] query key so sidebar updates
 *
 * The new page starts with one empty root block (handled by pageService).
 * Focus on PageTitle is handled by the PageView component.
 */

import { useCallback, useState } from 'react';
import { useServices } from '../providers/ServiceProvider.js';
import { useAppStore } from '../stores/ui-store.js';
import { invalidateQueries } from './useCozoQuery.js';
import type { Page } from '@double-bind/types';

/**
 * Result from a createPage call.
 */
export interface CreatePageResult {
  /** The created page, or null if creation failed */
  page: Page | null;
  /** Error if creation failed, null otherwise */
  error: Error | null;
}

/**
 * Result returned by useCreatePage hook.
 */
export interface UseCreatePageResult {
  /** Create a new page and navigate to it */
  createPage: (title?: string) => Promise<CreatePageResult>;
  /** Whether a page creation is in progress */
  isCreating: boolean;
  /** Error from the last creation attempt, if any */
  error: Error | null;
}

/**
 * Default title for new pages.
 * Users can immediately edit the title after creation.
 */
const DEFAULT_PAGE_TITLE = 'Untitled';

/**
 * Hook for creating new pages with navigation and cache invalidation.
 *
 * @returns Object with createPage function, loading state, and error
 *
 * @example
 * ```tsx
 * function NewPageButton() {
 *   const { createPage, isCreating, error } = useCreatePage();
 *
 *   const handleClick = async () => {
 *     await createPage();
 *     // After creation, app navigates to new page automatically
 *   };
 *
 *   return (
 *     <button onClick={handleClick} disabled={isCreating}>
 *       {isCreating ? 'Creating...' : 'New Page'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useCreatePage(): UseCreatePageResult {
  const { pageService } = useServices();
  const navigateToPage = useAppStore((state) => state.navigateToPage);

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createPage = useCallback(
    async (title: string = DEFAULT_PAGE_TITLE): Promise<CreatePageResult> => {
      setIsCreating(true);
      setError(null);

      try {
        // 1. Create the page
        const page = await pageService.createPage(title);

        // 2. Invalidate pages query so sidebar updates
        invalidateQueries(['pages']);

        // 3. Navigate to the new page
        navigateToPage(page.pageId);

        return { page, error: null };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        return { page: null, error };
      } finally {
        setIsCreating(false);
      }
    },
    [pageService, navigateToPage]
  );

  return { createPage, isCreating, error };
}
