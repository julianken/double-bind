/**
 * useCreatePage - Hook for creating new pages on mobile.
 *
 * Provides a mutation function that:
 * 1. Creates a new page via pageService.createPage
 * 2. Navigates to the new page
 * 3. Returns the created page for further processing
 *
 * The new page starts with one empty root block (handled by pageService).
 *
 * Auto-increment behavior for "Untitled":
 * - First page: "Untitled"
 * - Subsequent pages: "Untitled 2", "Untitled 3", etc.
 */

import { useCallback, useState } from 'react';
import type { Page } from '@double-bind/types';
import { useDatabase } from './useDatabase';

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
  /** Create a new page */
  createPage: (title?: string) => Promise<CreatePageResult>;
  /** Whether a page creation is in progress */
  isCreating: boolean;
  /** Error from the last creation attempt, if any */
  error: Error | null;
}

/**
 * Default title for new pages.
 */
const DEFAULT_PAGE_TITLE = 'Untitled';

/**
 * Pattern to match "Untitled" or "Untitled N" (where N >= 2).
 */
const UNTITLED_PATTERN = /^Untitled(?: (\d+))?$/i;

/**
 * Hook for creating new pages with auto-increment title logic.
 */
export function useCreatePage(): UseCreatePageResult {
  const { services, isReady } = useDatabase();

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createPage = useCallback(
    async (title: string = DEFAULT_PAGE_TITLE): Promise<CreatePageResult> => {
      if (!isReady || !services) {
        const error = new Error('Database not ready');
        return { page: null, error };
      }

      setIsCreating(true);
      setError(null);

      try {
        let finalTitle = title;

        // Auto-increment logic for "Untitled" pages
        // TODO: Consider moving auto-increment logic to backend for better performance
        // Currently fetches all pages client-side, which is O(n). A Datalog query
        // could find max "Untitled N" in O(1) with proper indexing.
        if (title === DEFAULT_PAGE_TITLE) {
          const allPages = await services.pageService.getAllPages({ limit: 1000 });

          const untitledNumbers: number[] = [];
          for (const page of allPages) {
            const match = UNTITLED_PATTERN.exec(page.title);
            if (match) {
              const num = match[1] ? parseInt(match[1], 10) : 1;
              untitledNumbers.push(num);
            }
          }

          if (untitledNumbers.length > 0) {
            const maxNum = Math.max(...untitledNumbers);
            const nextNum = maxNum + 1;
            finalTitle = nextNum === 1 ? 'Untitled' : `Untitled ${nextNum}`;
          }
        }

        const page = await services.pageService.createPage(finalTitle);

        return { page, error: null };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        return { page: null, error };
      } finally {
        setIsCreating(false);
      }
    },
    [services, isReady]
  );

  return { createPage, isCreating, error };
}
