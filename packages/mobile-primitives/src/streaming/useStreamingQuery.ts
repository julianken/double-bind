/**
 * useStreamingQuery - Hook for streaming query results with progressive loading
 *
 * Enables memory-efficient processing of large query result sets by streaming
 * results in chunks. Supports cancellation and provides progressive loading state
 * for optimal mobile UX.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { StreamChunk, StreamOptions, StreamResult } from '@double-bind/types';
import { StreamState } from '@double-bind/types';

/**
 * Default streaming options
 */
const DEFAULT_OPTIONS: Required<Omit<StreamOptions, 'signal'>> = {
  chunkSize: 50,
  timeout: 100,
};

/**
 * Function that fetches data and returns items
 * @template T - The type of items being fetched
 */
export type StreamQueryFunction<T> = () => Promise<T[]>;

/**
 * Result returned by useStreamingQuery hook
 *
 * @template T - The type of items being streamed
 */
export interface UseStreamingQueryResult<T> {
  /** Current stream result with state and items */
  result: StreamResult<T>;

  /** Start or restart the stream */
  start: () => void;

  /** Cancel the stream */
  cancel: () => void;

  /** Whether the stream is currently active */
  isLoading: boolean;
}

/**
 * Hook for streaming query results with progressive loading
 *
 * Fetches data using the provided query function and streams results to the UI
 * in chunks for memory-efficient processing and progressive loading indicators.
 *
 * @template T - The type of items being streamed
 * @param queryFn - Function that fetches all data
 * @param options - Streaming configuration options
 *
 * @example
 * ```tsx
 * function SearchResults({ query }: { query: string }) {
 *   const { result, start, cancel, isLoading } = useStreamingQuery(
 *     async () => {
 *       const response = await searchBlocks(query);
 *       return response.blocks;
 *     },
 *     { chunkSize: 25 }
 *   );
 *
 *   useEffect(() => {
 *     if (query) {
 *       start();
 *     }
 *   }, [query, start]);
 *
 *   return (
 *     <View>
 *       {result.items.map(block => (
 *         <BlockView key={block.blockId} block={block} />
 *       ))}
 *       {isLoading && (
 *         <ActivityIndicator />
 *       )}
 *       {result.progress !== undefined && (
 *         <ProgressBar progress={result.progress} />
 *       )}
 *       <Button onPress={cancel}>Cancel</Button>
 *     </View>
 *   );
 * }
 * ```
 */
export function useStreamingQuery<T>(
  queryFn: StreamQueryFunction<T>,
  options: StreamOptions = {}
): UseStreamingQueryResult<T> {
  const { chunkSize = DEFAULT_OPTIONS.chunkSize, timeout = DEFAULT_OPTIONS.timeout } = options;

  // AbortController for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Current stream result state
  const [result, setResult] = useState<StreamResult<T>>({
    state: StreamState.Pending,
    chunks: [],
    items: [],
    deliveredCount: 0,
  });

  // Derived loading state
  const isLoading = result.state === StreamState.Streaming || result.state === StreamState.Pending;

  /**
   * Process items in chunks with delays for UI responsiveness
   */
  const streamItems = useCallback(
    async (items: T[], signal: AbortSignal) => {
      const totalCount = items.length;
      const chunks: StreamChunk<T>[] = [];
      let deliveredCount = 0;

      // Set state to streaming
      setResult({
        state: StreamState.Streaming,
        chunks: [],
        items: [],
        totalCount,
        deliveredCount: 0,
        progress: 0,
      });

      // Process items in chunks
      for (let i = 0; i < items.length; i += chunkSize) {
        // Check for cancellation
        if (signal.aborted) {
          setResult((prev) => ({
            ...prev,
            state: StreamState.Cancelled,
          }));
          return;
        }

        // Create chunk
        const chunkItems = items.slice(i, i + chunkSize);
        deliveredCount += chunkItems.length;
        const isFinal = i + chunkSize >= items.length;

        const chunk: StreamChunk<T> = {
          items: chunkItems,
          totalCount,
          deliveredCount,
          chunkIndex: chunks.length,
          isFinal,
          timestamp: Date.now(),
        };

        chunks.push(chunk);

        // Update state with new chunk
        setResult({
          state: StreamState.Streaming,
          chunks: [...chunks],
          items: items.slice(0, deliveredCount),
          totalCount,
          deliveredCount,
          progress: (deliveredCount / totalCount) * 100,
        });

        // Delay before next chunk (unless it's the final chunk)
        if (!isFinal) {
          await new Promise((resolve) => setTimeout(resolve, timeout));
        }
      }

      // Set state to complete
      setResult({
        state: StreamState.Complete,
        chunks,
        items,
        totalCount,
        deliveredCount,
        progress: 100,
      });
    },
    [chunkSize, timeout]
  );

  /**
   * Start or restart the stream
   */
  const start = useCallback(() => {
    // Cancel any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Reset state
    setResult({
      state: StreamState.Pending,
      chunks: [],
      items: [],
      deliveredCount: 0,
    });

    // Fetch and stream data
    (async () => {
      try {
        const items = await queryFn();

        // Check if cancelled during fetch
        if (controller.signal.aborted) {
          setResult((prev) => ({
            ...prev,
            state: StreamState.Cancelled,
          }));
          return;
        }

        // Stream the items
        await streamItems(items, controller.signal);
      } catch (error) {
        // Check if error is due to cancellation
        if (controller.signal.aborted) {
          setResult((prev) => ({
            ...prev,
            state: StreamState.Cancelled,
          }));
          return;
        }

        // Set error state
        setResult((prev) => ({
          ...prev,
          state: StreamState.Error,
          error: error instanceof Error ? error : new Error(String(error)),
        }));
      }
    })();
  }, [queryFn, streamItems]);

  /**
   * Cancel the stream
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    result,
    start,
    cancel,
    isLoading,
  };
}
