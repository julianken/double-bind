/**
 * Tests for battery-optimized operation utilities.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  debounce,
  debounceAsync,
  createBatcher,
  throttle,
  rateLimit,
} from '../../src/battery/operations.js';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay function execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should cancel previous calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('arg1', 'arg2');

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should use latest arguments', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('first');
    debounced('second');
    debounced('third');

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('third');
  });
});

describe('debounceAsync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return a promise', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    const debounced = debounceAsync(fn, 100);

    const promise = debounced();
    expect(promise).toBeInstanceOf(Promise);

    vi.advanceTimersByTime(100);
    await expect(promise).resolves.toBe('result');
  });

  it('should resolve all pending promises with same result', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    const debounced = debounceAsync(fn, 100);

    const promise1 = debounced();
    const promise2 = debounced();
    const promise3 = debounced();

    vi.advanceTimersByTime(100);

    await expect(Promise.all([promise1, promise2, promise3])).resolves.toEqual([
      'result',
      'result',
      'result',
    ]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should handle errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Test error'));
    const debounced = debounceAsync(fn, 100);

    const promise = debounced();

    vi.advanceTimersByTime(100);

    await expect(promise).rejects.toThrow('Test error');
  });

  it('should support cancellation', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    const debounced = debounceAsync(fn, 100);

    const promise = debounced();
    debounced.cancel();

    await expect(promise).rejects.toThrow('Debounced function cancelled');
    expect(fn).not.toHaveBeenCalled();
  });

  it('should pass arguments to function', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    const debounced = debounceAsync(fn, 100);

    debounced('arg1', 'arg2');

    vi.advanceTimersByTime(100);
    await vi.runAllTimersAsync();

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});

describe('createBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should batch items up to maxBatchSize', async () => {
    const processor = vi.fn().mockResolvedValue(undefined);
    const batcher = createBatcher(processor, { maxBatchSize: 3, maxWaitTime: 1000 });

    batcher.add('item1');
    batcher.add('item2');
    batcher.add('item3');

    await vi.runAllTimersAsync();

    expect(processor).toHaveBeenCalledWith(['item1', 'item2', 'item3']);
  });

  it('should process batch after maxWaitTime', async () => {
    const processor = vi.fn().mockResolvedValue(undefined);
    const batcher = createBatcher(processor, { maxBatchSize: 10, maxWaitTime: 1000 });

    batcher.add('item1');
    batcher.add('item2');

    expect(processor).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(processor).toHaveBeenCalledWith(['item1', 'item2']);
  });

  it('should process immediately when batch is full', async () => {
    const processor = vi.fn().mockResolvedValue(undefined);
    const batcher = createBatcher(processor, { maxBatchSize: 2, maxWaitTime: 1000 });

    batcher.add('item1');
    expect(processor).not.toHaveBeenCalled();

    batcher.add('item2');
    await vi.runAllTimersAsync();

    expect(processor).toHaveBeenCalledWith(['item1', 'item2']);
  });

  it('should process multiple batches', async () => {
    const processor = vi.fn().mockResolvedValue(undefined);
    const batcher = createBatcher(processor, { maxBatchSize: 2, maxWaitTime: 1000 });

    batcher.add('item1');
    batcher.add('item2');
    batcher.add('item3');
    batcher.add('item4');

    await vi.runAllTimersAsync();

    expect(processor).toHaveBeenCalledTimes(2);
    expect(processor).toHaveBeenNthCalledWith(1, ['item1', 'item2']);
    expect(processor).toHaveBeenNthCalledWith(2, ['item3', 'item4']);
  });

  it('should return promise that resolves after processing', async () => {
    const processor = vi.fn().mockResolvedValue(undefined);
    const batcher = createBatcher(processor, { maxBatchSize: 2, maxWaitTime: 1000 });

    const promise1 = batcher.add('item1');
    const promise2 = batcher.add('item2');

    await vi.runAllTimersAsync();

    await expect(promise1).resolves.toBeUndefined();
    await expect(promise2).resolves.toBeUndefined();
  });

  it('should handle processing errors', async () => {
    const processor = vi.fn().mockRejectedValue(new Error('Processing failed'));
    const batcher = createBatcher(processor, { maxBatchSize: 2, maxWaitTime: 1000 });

    const promise1 = batcher.add('item1');
    const promise2 = batcher.add('item2');

    await vi.runAllTimersAsync();

    await expect(promise1).rejects.toThrow('Processing failed');
    await expect(promise2).rejects.toThrow('Processing failed');
  });

  it('should support manual flush', async () => {
    const processor = vi.fn().mockResolvedValue(undefined);
    const batcher = createBatcher(processor, { maxBatchSize: 10, maxWaitTime: 1000 });

    batcher.add('item1');
    batcher.add('item2');

    expect(processor).not.toHaveBeenCalled();

    await batcher.flush();

    expect(processor).toHaveBeenCalledWith(['item1', 'item2']);
  });

  it('should support cancellation', async () => {
    const processor = vi.fn().mockResolvedValue(undefined);
    const batcher = createBatcher(processor, { maxBatchSize: 10, maxWaitTime: 1000 });

    const promise1 = batcher.add('item1');
    const promise2 = batcher.add('item2');

    batcher.cancel();

    await expect(promise1).rejects.toThrow('Batch cancelled');
    await expect(promise2).rejects.toThrow('Batch cancelled');
    expect(processor).not.toHaveBeenCalled();
  });

  it('should return current batch size', () => {
    const processor = vi.fn().mockResolvedValue(undefined);
    const batcher = createBatcher(processor, { maxBatchSize: 10, maxWaitTime: 1000 });

    expect(batcher.size()).toBe(0);

    batcher.add('item1');
    expect(batcher.size()).toBe(1);

    batcher.add('item2');
    expect(batcher.size()).toBe(2);
  });

  it('should respect minBatchSize', async () => {
    const processor = vi.fn().mockResolvedValue(undefined);
    const batcher = createBatcher(processor, {
      maxBatchSize: 10,
      maxWaitTime: 100,
      minBatchSize: 3,
    });

    batcher.add('item1');
    batcher.add('item2');

    await vi.advanceTimersByTimeAsync(100);

    // Should not process yet (min batch size not reached)
    expect(processor).not.toHaveBeenCalled();

    batcher.add('item3');
    await vi.advanceTimersByTimeAsync(100);

    // Now should process
    expect(processor).toHaveBeenCalledWith(['item1', 'item2', 'item3']);
  });
});

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should execute immediately on first call', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should delay subsequent calls', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    throttled();
    throttled();

    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should allow execution after time limit', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);

    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should pass arguments to function', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('arg1', 'arg2');

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should execute immediately on first call', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    const limited = rateLimit(fn, 100);

    const promise = limited();
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should queue subsequent calls', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    const limited = rateLimit(fn, 100);

    const promise1 = limited();
    const promise2 = limited();
    const promise3 = limited();

    await vi.runAllTimersAsync();

    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();

    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();

    expect(fn).toHaveBeenCalledTimes(3);

    await expect(promise1).resolves.toBe('result');
    await expect(promise2).resolves.toBe('result');
    await expect(promise3).resolves.toBe('result');
  });

  it('should handle errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Test error'));
    const limited = rateLimit(fn, 100);

    const promise = limited();
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('Test error');
  });

  it('should pass arguments to function', async () => {
    const fn = vi.fn().mockResolvedValue('result');
    const limited = rateLimit(fn, 100);

    limited('arg1', 'arg2');
    await vi.runAllTimersAsync();

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should process queue in order', async () => {
    const fn = vi.fn().mockImplementation(async (value: string) => value);
    const limited = rateLimit(fn, 100);

    const promise1 = limited('first');
    const promise2 = limited('second');
    const promise3 = limited('third');

    await vi.runAllTimersAsync();
    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();
    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();

    await expect(promise1).resolves.toBe('first');
    await expect(promise2).resolves.toBe('second');
    await expect(promise3).resolves.toBe('third');
  });
});
