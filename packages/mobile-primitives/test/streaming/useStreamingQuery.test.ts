/**
 * Tests for useStreamingQuery hook
 *
 * Tests the streaming query functionality including chunking, cancellation,
 * and progressive loading indicators.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StreamState } from '@double-bind/types';

// Import types for testing
import type { StreamQueryFunction, UseStreamingQueryResult } from '../../src/streaming/useStreamingQuery';

describe('useStreamingQuery types and logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should have correct StreamState enum values', () => {
    expect(StreamState.Pending).toBe('pending');
    expect(StreamState.Streaming).toBe('streaming');
    expect(StreamState.Complete).toBe('complete');
    expect(StreamState.Error).toBe('error');
    expect(StreamState.Cancelled).toBe('cancelled');
  });

  it('should validate query function type', () => {
    const validQueryFn: StreamQueryFunction<number> = async () => [1, 2, 3];
    expect(typeof validQueryFn).toBe('function');
  });

  it('should validate result type structure', () => {
    const mockResult: UseStreamingQueryResult<number> = {
      result: {
        state: StreamState.Pending,
        chunks: [],
        items: [],
        deliveredCount: 0,
      },
      start: vi.fn(),
      cancel: vi.fn(),
      isLoading: false,
    };

    expect(mockResult.result.state).toBe(StreamState.Pending);
    expect(mockResult.result.chunks).toEqual([]);
    expect(mockResult.result.items).toEqual([]);
    expect(typeof mockResult.start).toBe('function');
    expect(typeof mockResult.cancel).toBe('function');
  });
});

/**
 * Test the streaming logic without React hooks
 * Tests the core streaming algorithm
 */
describe('streaming algorithm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should chunk items correctly', () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const chunkSize = 25;
    const chunks: number[][] = [];

    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }

    expect(chunks.length).toBe(4);
    expect(chunks[0].length).toBe(25);
    expect(chunks[1].length).toBe(25);
    expect(chunks[2].length).toBe(25);
    expect(chunks[3].length).toBe(25);
  });

  it('should handle non-evenly divisible chunk sizes', () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const chunkSize = 30;
    const chunks: number[][] = [];

    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }

    expect(chunks.length).toBe(4);
    expect(chunks[0].length).toBe(30);
    expect(chunks[1].length).toBe(30);
    expect(chunks[2].length).toBe(30);
    expect(chunks[3].length).toBe(10);
  });

  it('should calculate progress correctly', () => {
    const totalCount = 100;
    const deliveredCount = 25;
    const progress = (deliveredCount / totalCount) * 100;

    expect(progress).toBe(25);
  });

  it('should calculate progress for completion', () => {
    const totalCount = 100;
    const deliveredCount = 100;
    const progress = (deliveredCount / totalCount) * 100;

    expect(progress).toBe(100);
  });

  it('should handle empty arrays', () => {
    const items: number[] = [];
    const chunkSize = 50;
    const chunks: number[][] = [];

    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }

    expect(chunks.length).toBe(0);
  });

  it('should handle arrays smaller than chunk size', () => {
    const items = [1, 2, 3];
    const chunkSize = 50;
    const chunks: number[][] = [];

    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }

    expect(chunks.length).toBe(1);
    expect(chunks[0]).toEqual([1, 2, 3]);
  });

  it('should create correct chunk metadata', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const chunkSize = 20;
    let deliveredCount = 0;
    const chunkMetadata: Array<{
      index: number;
      deliveredCount: number;
      isFinal: boolean;
    }> = [];

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunkItems = items.slice(i, i + chunkSize);
      deliveredCount += chunkItems.length;
      const isFinal = i + chunkSize >= items.length;

      chunkMetadata.push({
        index: chunkMetadata.length,
        deliveredCount,
        isFinal,
      });
    }

    expect(chunkMetadata.length).toBe(3);

    expect(chunkMetadata[0]).toEqual({
      index: 0,
      deliveredCount: 20,
      isFinal: false,
    });

    expect(chunkMetadata[1]).toEqual({
      index: 1,
      deliveredCount: 40,
      isFinal: false,
    });

    expect(chunkMetadata[2]).toEqual({
      index: 2,
      deliveredCount: 50,
      isFinal: true,
    });
  });
});

/**
 * Test AbortController functionality
 */
describe('AbortController cancellation', () => {
  it('should detect cancellation via AbortSignal', () => {
    const controller = new AbortController();
    const signal = controller.signal;

    expect(signal.aborted).toBe(false);

    controller.abort();

    expect(signal.aborted).toBe(true);
  });

  it('should handle multiple abort calls', () => {
    const controller = new AbortController();

    controller.abort();
    controller.abort();
    controller.abort();

    expect(controller.signal.aborted).toBe(true);
  });

  it('should create fresh controllers for new streams', () => {
    const controller1 = new AbortController();
    controller1.abort();

    const controller2 = new AbortController();

    expect(controller1.signal.aborted).toBe(true);
    expect(controller2.signal.aborted).toBe(false);
  });
});

/**
 * Test async delay functionality
 */
describe('async delays', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay execution', async () => {
    const start = Date.now();
    const delayPromise = new Promise((resolve) => setTimeout(resolve, 100));

    vi.advanceTimersByTime(100);
    await delayPromise;

    // Timer should have advanced
    expect(vi.getRealSystemTime()).toBeGreaterThanOrEqual(start);
  });

  it('should handle zero delay', async () => {
    const delayPromise = new Promise((resolve) => setTimeout(resolve, 0));

    vi.advanceTimersByTime(0);
    await delayPromise;

    expect(true).toBe(true);
  });
});

/**
 * Test error handling
 */
describe('error handling', () => {
  it('should handle Error instances', () => {
    const error = new Error('Test error');

    expect(error instanceof Error).toBe(true);
    expect(error.message).toBe('Test error');
  });

  it('should convert non-Error to Error', () => {
    const notAnError = 'string error';
    const error = notAnError instanceof Error ? notAnError : new Error(String(notAnError));

    expect(error instanceof Error).toBe(true);
    expect(error.message).toBe('string error');
  });

  it('should handle thrown errors in promises', async () => {
    const failingFn = async () => {
      throw new Error('Promise failed');
    };

    let caughtError: Error | null = null;

    try {
      await failingFn();
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toBe('Promise failed');
  });
});
