/**
 * usePagePreview - Fetches lightweight preview data for a page.
 *
 * Returns `{ title, excerpt, blockCount, updatedAt }` for a given pageId.
 * Results are cached in a module-level Map for the lifetime of the session so
 * repeated hovers over the same link do not re-query the database.
 *
 * The hook is a no-op when `pageId` is null, returning null data immediately.
 *
 * @example
 * ```tsx
 * const { title, excerpt, blockCount } = usePagePreview(pageId);
 * ```
 */

import { useState, useEffect } from 'react';
import type { PageId } from '@double-bind/types';
import { useServicesOptional } from '../providers/ServiceProvider.js';

// ============================================================================
// Types
// ============================================================================

export interface PagePreviewData {
  title: string;
  excerpt: string;
  blockCount: number;
  /** Unix timestamp (ms) matching Page.updatedAt */
  updatedAt: number;
}

export interface UsePagePreviewResult {
  data: PagePreviewData | null;
  isLoading: boolean;
  error: Error | null;
}

// ============================================================================
// Session-level cache (cleared on full page reload)
// ============================================================================

const previewCache = new Map<PageId, PagePreviewData>();

// ============================================================================
// Hook
// ============================================================================

/**
 * usePagePreview returns preview metadata for a page.
 *
 * Cache strategy: results are cached per-session in a module-level Map.
 * Subsequent hovers over the same page link resolve instantly from cache.
 */
export function usePagePreview(pageId: PageId | null): UsePagePreviewResult {
  const [data, setData] = useState<PagePreviewData | null>(() =>
    pageId ? (previewCache.get(pageId) ?? null) : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const services = useServicesOptional();

  useEffect(() => {
    if (!pageId) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Serve from cache if available
    const cached = previewCache.get(pageId);
    if (cached) {
      setData(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!services?.pageService) {
      // No service provider — return empty state gracefully
      setData(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function fetchPreview() {
      try {
        // getPageWithBlocks gives us both page metadata and blocks in one call
        const pageWithBlocks = await services!.pageService.getPageWithBlocks(pageId!);
        if (cancelled) return;

        const { page, blocks } = pageWithBlocks;
        const blockCount = blocks.length;

        // Excerpt: first non-empty root-level block content, truncated to 120 chars
        let excerpt = '';
        const firstBlock = blocks.find(
          (b) => b.parentId === null && b.content.trim().length > 0
        );
        if (firstBlock) {
          const raw = firstBlock.content.trim();
          excerpt = raw.length > 120 ? `${raw.slice(0, 120)}...` : raw;
        }

        const previewData: PagePreviewData = {
          title: page.title,
          excerpt,
          blockCount,
          updatedAt: page.updatedAt,
        };

        previewCache.set(pageId!, previewData);
        setData(previewData);
        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to load preview'));
          setIsLoading(false);
        }
      }
    }

    void fetchPreview();

    return () => {
      cancelled = true;
    };
  }, [pageId, services?.pageService]);

  return { data, isLoading, error };
}

/**
 * Evict a specific page from the preview cache (e.g., after a title update).
 */
export function invalidatePagePreviewCache(pageId: PageId): void {
  previewCache.delete(pageId);
}

/**
 * Clear the entire preview cache (e.g., on logout or database reset).
 */
export function clearPagePreviewCache(): void {
  previewCache.clear();
}
