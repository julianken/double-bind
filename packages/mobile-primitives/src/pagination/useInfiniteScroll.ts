/**
 * useInfiniteScroll - Hook for infinite scroll behavior with paginated queries
 *
 * Automatically triggers fetchNextPage when user scrolls near the end of
 * the content. Optimized for mobile touch interactions.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { InfiniteScrollOptions, PaginatedQuery } from '@double-bind/types';

const DEFAULT_THRESHOLD = 0.8; // Trigger when 80% scrolled
const DEFAULT_ROOT_MARGIN = '100px'; // Pre-load 100px before reaching bottom

/**
 * Hook that adds infinite scroll behavior to a paginated query.
 *
 * @param query - Paginated query instance from usePaginatedQuery
 * @param options - Infinite scroll configuration
 *
 * @example
 * ```tsx
 * const query = usePaginatedQuery(fetcher);
 * const scrollRef = useInfiniteScroll(query, {
 *   threshold: 0.8,
 *   enabled: true
 * });
 *
 * return (
 *   <ScrollView ref={scrollRef}>
 *     {query.items.map(item => <Item key={item.id} {...item} />)}
 *   </ScrollView>
 * );
 * ```
 */
export function useInfiniteScroll<T, E extends HTMLElement = HTMLElement>(
  query: PaginatedQuery<T>,
  options: InfiniteScrollOptions = {}
): React.RefObject<E> {
  const {
    threshold = DEFAULT_THRESHOLD,
    enabled = true,
    rootMargin = DEFAULT_ROOT_MARGIN,
  } = options;

  const scrollRef = useRef<E>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Create and manage intersection observer
  useEffect(() => {
    if (!enabled || !query.hasMore || query.loading) {
      return;
    }

    // Create sentinel element that will trigger the load
    const sentinel = document.createElement('div');
    sentinel.style.height = '1px';
    sentinel.style.width = '100%';
    sentinelRef.current = sentinel;

    // Append sentinel to scroll container
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    container.appendChild(sentinel);

    // Create intersection observer
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !query.loading && query.hasMore) {
          void query.fetchNextPage();
        }
      },
      {
        root: null, // Use viewport as root
        rootMargin,
        threshold,
      }
    );

    observer.observe(sentinel);
    observerRef.current = observer;

    // Cleanup
    return () => {
      observer.disconnect();
      observerRef.current = null;

      if (sentinel.parentNode) {
        sentinel.parentNode.removeChild(sentinel);
      }
      sentinelRef.current = null;
    };
  }, [enabled, query.hasMore, query.loading, threshold, rootMargin, query]);

  return scrollRef;
}

/**
 * Hook for manual scroll position monitoring (fallback for React Native).
 *
 * @param query - Paginated query instance
 * @param options - Scroll monitoring options
 * @returns Scroll event handler to attach to ScrollView
 *
 * @example
 * ```tsx
 * const query = usePaginatedQuery(fetcher);
 * const handleScroll = useScrollMonitor(query);
 *
 * return (
 *   <ScrollView onScroll={handleScroll} scrollEventThrottle={400}>
 *     {query.items.map(item => <Item key={item.id} {...item} />)}
 *   </ScrollView>
 * );
 * ```
 */
export function useScrollMonitor<T>(
  query: PaginatedQuery<T>,
  options: Pick<InfiniteScrollOptions, 'threshold' | 'enabled'> = {}
) {
  const { threshold = DEFAULT_THRESHOLD, enabled = true } = options;

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
      if (!enabled || !query.hasMore || query.loading) {
        return;
      }

      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const scrollPosition = contentOffset.y;
      const scrollViewHeight = layoutMeasurement.height;
      const contentHeight = contentSize.height;

      // Calculate how far scrolled (0 to 1)
      const scrollPercentage = (scrollPosition + scrollViewHeight) / contentHeight;

      // Trigger fetch if past threshold
      if (scrollPercentage >= threshold) {
        void query.fetchNextPage();
      }
    },
    [enabled, query, threshold]
  );

  return handleScroll;
}
