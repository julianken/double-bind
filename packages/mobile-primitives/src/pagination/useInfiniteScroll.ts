/**
 * useScrollMonitor - Hook for infinite scroll behavior with paginated queries
 *
 * Monitors scroll position and triggers fetchNextPage when user scrolls near
 * the end of the content. Designed for React Native ScrollView/FlatList.
 */

import { useCallback } from 'react';
import type { InfiniteScrollOptions, PaginatedQuery } from '@double-bind/types';

const DEFAULT_THRESHOLD = 0.8; // Trigger when 80% scrolled

/**
 * Hook for scroll position monitoring in React Native.
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
