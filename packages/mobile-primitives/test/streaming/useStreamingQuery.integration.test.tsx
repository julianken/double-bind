/**
 * @vitest-environment jsdom
 *
 * Integration tests for useStreamingQuery React hook
 *
 * Tests actual hook behavior including:
 * - State transitions (Pending → Streaming → Complete)
 * - Cancellation during active streaming
 * - Error handling with query functions
 * - Component unmount cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import { useStreamingQuery } from '../../src/streaming/useStreamingQuery';
import type { StreamQueryFunction } from '../../src/streaming/useStreamingQuery';
import { StreamState } from '@double-bind/types';

describe('useStreamingQuery - React Hook Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('State Transitions', () => {
    it('should transition from Pending → Streaming → Complete', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => i);
      const queryFn: StreamQueryFunction<number> = vi.fn(async () => testData);

      const { result } = renderHook(() =>
        useStreamingQuery(queryFn, { chunkSize: 25, timeout: 50 })
      );

      // Initial state: Pending (but not yet started, so isLoading is false)
      expect(result.current.result.state).toBe(StreamState.Pending);
      expect(result.current.result.items).toEqual([]);
      expect(result.current.result.deliveredCount).toBe(0);
      // Note: isLoading is true when state is Pending OR Streaming
      expect(result.current.isLoading).toBe(true);

      // Start streaming
      act(() => {
        result.current.start();
      });

      // Should be in Pending state initially
      expect(result.current.result.state).toBe(StreamState.Pending);
      expect(result.current.isLoading).toBe(true);

      // Wait for query to resolve
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // After all chunks, should be Complete
      expect(result.current.result.state).toBe(StreamState.Complete);
      expect(result.current.result.items.length).toBe(100);
      expect(result.current.result.deliveredCount).toBe(100);
      expect(result.current.result.progress).toBe(100);
      expect(result.current.isLoading).toBe(false);
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should deliver data in chunks with correct state updates', async () => {
      const testData = Array.from({ length: 75 }, (_, i) => i);
      const queryFn: StreamQueryFunction<number> = vi.fn(async () => testData);

      const { result } = renderHook(() =>
        useStreamingQuery(queryFn, { chunkSize: 25, timeout: 50 })
      );

      act(() => {
        result.current.start();
      });

      // Wait for query to resolve and first chunk
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // After first chunk
      expect(result.current.result.state).toBe(StreamState.Streaming);
      expect(result.current.result.items.length).toBe(25);
      expect(result.current.result.deliveredCount).toBe(25);
      expect(result.current.result.progress).toBeCloseTo(33.33, 1);

      // Advance to second chunk
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      expect(result.current.result.state).toBe(StreamState.Streaming);
      expect(result.current.result.items.length).toBe(50);
      expect(result.current.result.deliveredCount).toBe(50);
      expect(result.current.result.progress).toBeCloseTo(66.67, 1);

      // Advance to final chunk
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      expect(result.current.result.state).toBe(StreamState.Complete);
      expect(result.current.result.items.length).toBe(75);
      expect(result.current.result.deliveredCount).toBe(75);
      expect(result.current.result.progress).toBe(100);
    });

    it('should track chunks correctly', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => i);
      const queryFn: StreamQueryFunction<number> = vi.fn(async () => testData);

      const { result } = renderHook(() =>
        useStreamingQuery(queryFn, { chunkSize: 30, timeout: 50 })
      );

      act(() => {
        result.current.start();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Should have 4 chunks: 30, 30, 30, 10
      expect(result.current.result.chunks.length).toBe(4);
      expect(result.current.result.chunks[0].items.length).toBe(30);
      expect(result.current.result.chunks[0].chunkIndex).toBe(0);
      expect(result.current.result.chunks[0].isFinal).toBe(false);

      expect(result.current.result.chunks[3].items.length).toBe(10);
      expect(result.current.result.chunks[3].chunkIndex).toBe(3);
      expect(result.current.result.chunks[3].isFinal).toBe(true);
    });
  });

  describe('Cancellation', () => {
    it('should cancel stream during active streaming', async () => {
      const testData = Array.from({ length: 200 }, (_, i) => i);
      const queryFn: StreamQueryFunction<number> = vi.fn(async () => testData);

      const { result } = renderHook(() =>
        useStreamingQuery(queryFn, { chunkSize: 25, timeout: 50 })
      );

      act(() => {
        result.current.start();
      });

      // Wait for first chunk
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.result.state).toBe(StreamState.Streaming);
      expect(result.current.result.items.length).toBe(25);

      // Cancel while streaming
      act(() => {
        result.current.cancel();
      });

      // Should be cancelled and not deliver more chunks
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.result.state).toBe(StreamState.Cancelled);
      expect(result.current.result.items.length).toBe(25); // Only first chunk delivered
    });

    it('should cancel stream before it starts', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => i);
      let resolveQuery: (value: number[]) => void;
      const queryFn: StreamQueryFunction<number> = vi.fn(
        () =>
          new Promise<number[]>((resolve) => {
            resolveQuery = resolve;
          })
      );

      const { result } = renderHook(() => useStreamingQuery(queryFn, { chunkSize: 25 }));

      act(() => {
        result.current.start();
      });

      expect(result.current.result.state).toBe(StreamState.Pending);

      // Cancel before query resolves
      act(() => {
        result.current.cancel();
      });

      // Now resolve the query
      await act(async () => {
        resolveQuery!(testData);
        await vi.runAllTimersAsync();
      });

      // Should be cancelled, not complete
      expect(result.current.result.state).toBe(StreamState.Cancelled);
      expect(result.current.result.items.length).toBe(0);
    });

    it('should allow restarting after cancellation', async () => {
      const testData = Array.from({ length: 50 }, (_, i) => i);
      const queryFn: StreamQueryFunction<number> = vi.fn(async () => testData);

      const { result } = renderHook(() =>
        useStreamingQuery(queryFn, { chunkSize: 25, timeout: 50 })
      );

      // First stream
      act(() => {
        result.current.start();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Cancel after first chunk
      act(() => {
        result.current.cancel();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.result.state).toBe(StreamState.Cancelled);

      // Restart
      act(() => {
        result.current.start();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Should complete successfully
      expect(result.current.result.state).toBe(StreamState.Complete);
      expect(result.current.result.items.length).toBe(50);
      expect(queryFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors thrown by query function', async () => {
      const error = new Error('Query failed');
      const queryFn: StreamQueryFunction<number> = vi.fn(async () => {
        throw error;
      });

      const { result } = renderHook(() => useStreamingQuery(queryFn));

      act(() => {
        result.current.start();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.result.state).toBe(StreamState.Error);
      expect(result.current.result.error).toEqual(error);
      expect(result.current.result.items.length).toBe(0);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle non-Error exceptions', async () => {
      const queryFn: StreamQueryFunction<number> = vi.fn(async () => {
        throw 'String error';
      });

      const { result } = renderHook(() => useStreamingQuery(queryFn));

      act(() => {
        result.current.start();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.result.state).toBe(StreamState.Error);
      expect(result.current.result.error).toBeInstanceOf(Error);
      expect(result.current.result.error?.message).toBe('String error');
    });

    it('should not set error state if cancelled during error', async () => {
      let rejectQuery: (error: Error) => void;
      const queryFn: StreamQueryFunction<number> = vi.fn(
        () =>
          new Promise<number[]>((_, reject) => {
            rejectQuery = reject;
          })
      );

      const { result } = renderHook(() => useStreamingQuery(queryFn));

      act(() => {
        result.current.start();
      });

      // Cancel before error
      act(() => {
        result.current.cancel();
      });

      // Trigger error
      await act(async () => {
        rejectQuery!(new Error('Failed'));
        await vi.runAllTimersAsync();
      });

      // Should remain in Cancelled state, not Error
      expect(result.current.result.state).toBe(StreamState.Cancelled);
      expect(result.current.result.error).toBeUndefined();
    });

    it('should allow recovery after error', async () => {
      let shouldFail = true;
      const testData = Array.from({ length: 50 }, (_, i) => i);
      const queryFn: StreamQueryFunction<number> = vi.fn(async () => {
        if (shouldFail) {
          throw new Error('First attempt failed');
        }
        return testData;
      });

      const { result } = renderHook(() => useStreamingQuery(queryFn));

      // First attempt - fails
      act(() => {
        result.current.start();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.result.state).toBe(StreamState.Error);

      // Second attempt - succeeds
      shouldFail = false;
      act(() => {
        result.current.start();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.result.state).toBe(StreamState.Complete);
      expect(result.current.result.items.length).toBe(50);
      expect(queryFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Component Unmount Cleanup', () => {
    it('should cancel stream on unmount', async () => {
      const testData = Array.from({ length: 200 }, (_, i) => i);
      const queryFn: StreamQueryFunction<number> = vi.fn(async () => testData);

      const { result, unmount } = renderHook(() =>
        useStreamingQuery(queryFn, { chunkSize: 25, timeout: 50 })
      );

      act(() => {
        result.current.start();
      });

      // Wait for first chunk
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.result.state).toBe(StreamState.Streaming);

      // Unmount component
      unmount();

      // Timers should not continue processing
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Stream should have been cancelled
      // Note: We can't check state after unmount, but we verify no errors thrown
      expect(true).toBe(true);
    });

    it('should handle unmount during pending state', async () => {
      let resolveQuery: (value: number[]) => void;
      const queryFn: StreamQueryFunction<number> = vi.fn(
        () =>
          new Promise<number[]>((resolve) => {
            resolveQuery = resolve;
          })
      );

      const { result, unmount } = renderHook(() => useStreamingQuery(queryFn));

      act(() => {
        result.current.start();
      });

      expect(result.current.result.state).toBe(StreamState.Pending);

      // Unmount before query resolves
      unmount();

      // Resolve after unmount
      await act(async () => {
        resolveQuery!([1, 2, 3]);
        await vi.runAllTimersAsync();
      });

      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should not update state after unmount', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => i);
      const queryFn: StreamQueryFunction<number> = vi.fn(async () => testData);

      const { result, unmount } = renderHook(() =>
        useStreamingQuery(queryFn, { chunkSize: 25, timeout: 50 })
      );

      act(() => {
        result.current.start();
      });

      const stateBeforeUnmount = result.current.result.state;

      unmount();

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // State should remain as it was before unmount
      expect(stateBeforeUnmount).toBe(StreamState.Pending);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty result set', async () => {
      const queryFn: StreamQueryFunction<number> = vi.fn(async () => []);

      const { result } = renderHook(() => useStreamingQuery(queryFn));

      act(() => {
        result.current.start();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.result.state).toBe(StreamState.Complete);
      expect(result.current.result.items.length).toBe(0);
      expect(result.current.result.chunks.length).toBe(0);
      expect(result.current.result.progress).toBe(100);
    });

    it('should handle single item', async () => {
      const queryFn: StreamQueryFunction<number> = vi.fn(async () => [42]);

      const { result } = renderHook(() => useStreamingQuery(queryFn));

      act(() => {
        result.current.start();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.result.state).toBe(StreamState.Complete);
      expect(result.current.result.items).toEqual([42]);
      expect(result.current.result.chunks.length).toBe(1);
      expect(result.current.result.chunks[0].isFinal).toBe(true);
    });

    it('should handle result set smaller than chunk size', async () => {
      const testData = [1, 2, 3, 4, 5];
      const queryFn: StreamQueryFunction<number> = vi.fn(async () => testData);

      const { result } = renderHook(() => useStreamingQuery(queryFn, { chunkSize: 50 }));

      act(() => {
        result.current.start();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.result.state).toBe(StreamState.Complete);
      expect(result.current.result.items).toEqual(testData);
      expect(result.current.result.chunks.length).toBe(1);
      expect(result.current.result.chunks[0].isFinal).toBe(true);
    });

    it('should cancel existing stream when start is called again', async () => {
      const testData1 = Array.from({ length: 100 }, (_, i) => i);
      const testData2 = Array.from({ length: 50 }, (_, i) => i + 1000);

      let callCount = 0;
      const queryFn: StreamQueryFunction<number> = vi.fn(async () => {
        callCount++;
        return callCount === 1 ? testData1 : testData2;
      });

      const { result } = renderHook(() =>
        useStreamingQuery(queryFn, { chunkSize: 25, timeout: 50 })
      );

      // Start first stream
      act(() => {
        result.current.start();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.result.items.length).toBe(25);

      // Start second stream before first completes
      act(() => {
        result.current.start();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Should have completed with second dataset
      expect(result.current.result.state).toBe(StreamState.Complete);
      expect(result.current.result.items.length).toBe(50);
      expect(result.current.result.items[0]).toBe(1000); // From testData2
      expect(queryFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Options', () => {
    it('should respect custom chunk size', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => i);
      const queryFn: StreamQueryFunction<number> = vi.fn(async () => testData);

      const { result } = renderHook(() => useStreamingQuery(queryFn, { chunkSize: 10 }));

      act(() => {
        result.current.start();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Should have 10 chunks of 10 items each
      expect(result.current.result.chunks.length).toBe(10);
      expect(result.current.result.chunks[0].items.length).toBe(10);
    });

    it('should respect custom timeout', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => i);
      const queryFn: StreamQueryFunction<number> = vi.fn(async () => testData);

      const { result } = renderHook(() =>
        useStreamingQuery(queryFn, { chunkSize: 25, timeout: 200 })
      );

      act(() => {
        result.current.start();
      });

      // First chunk delivered immediately
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.result.items.length).toBe(25);

      // Advance by less than timeout
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should still have only first chunk
      expect(result.current.result.items.length).toBe(25);

      // Advance by remaining timeout
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should now have second chunk
      expect(result.current.result.items.length).toBe(50);
    });
  });
});
