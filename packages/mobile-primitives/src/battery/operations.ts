/**
 * Battery-optimized operation utilities.
 *
 * Provides debounced and batched operation utilities to reduce
 * background CPU usage and minimize wake locks.
 */

// ============================================================================
// Debouncing
// ============================================================================

/**
 * Creates a debounced function that delays execution until after a wait period.
 *
 * Useful for reducing the frequency of expensive operations like sync requests.
 *
 * @param fn - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 *
 * @example
 * ```typescript
 * const debouncedSync = debounce(async () => {
 *   await performSync();
 * }, 1000);
 *
 * // Multiple calls within 1 second will only trigger one execution
 * debouncedSync();
 * debouncedSync();
 * debouncedSync();
 * ```
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = undefined;
    }, wait);
  };
}

/**
 * Creates a debounced async function with cancellation support.
 *
 * @param fn - Async function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function with cancel method
 */
export function debounceAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  wait: number
): ((...args: Parameters<T>) => Promise<ReturnType<T>>) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let resolvers: Array<{
    resolve: (value: ReturnType<T>) => void;
    reject: (reason: unknown) => void;
  }> = [];

  const debounced = function (...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      resolvers.push({ resolve, reject });

      timeoutId = setTimeout(async () => {
        const currentResolvers = resolvers;
        resolvers = [];
        timeoutId = undefined;

        try {
          const result = (await fn(...args)) as ReturnType<T>;
          currentResolvers.forEach(({ resolve }) => resolve(result));
        } catch (error) {
          currentResolvers.forEach(({ reject }) => reject(error));
        }
      }, wait);
    });
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    resolvers.forEach(({ reject }) => reject(new Error('Debounced function cancelled')));
    resolvers = [];
  };

  return debounced;
}

// ============================================================================
// Batching
// ============================================================================

/**
 * Options for batch processing.
 */
export interface BatchOptions {
  /** Maximum number of items per batch */
  maxBatchSize: number;

  /** Maximum wait time before flushing batch (milliseconds) */
  maxWaitTime: number;

  /** Minimum items required before processing batch (defaults to 1) */
  minBatchSize?: number;
}

/**
 * Creates a batched operation processor.
 *
 * Collects items and processes them in batches to reduce overhead
 * and improve efficiency.
 *
 * @param processor - Function to process a batch of items
 * @param options - Batch configuration
 * @returns Function to add items to the batch
 *
 * @example
 * ```typescript
 * const batchedSync = createBatcher(
 *   async (blockIds: string[]) => {
 *     await syncBlocks(blockIds);
 *   },
 *   { maxBatchSize: 50, maxWaitTime: 5000 }
 * );
 *
 * // These will be batched together
 * batchedSync.add('block-1');
 * batchedSync.add('block-2');
 * batchedSync.add('block-3');
 * ```
 */
export function createBatcher<T>(
  processor: (items: T[]) => Promise<void>,
  options: BatchOptions
): {
  add: (item: T) => Promise<void>;
  flush: () => Promise<void>;
  cancel: () => void;
  size: () => number;
} {
  let batch: T[] = [];
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let processing = false;
  let pendingResolvers: Array<{
    resolve: () => void;
    reject: (reason: unknown) => void;
  }> = [];

  const minBatchSize = options.minBatchSize ?? 1;

  /**
   * Process the current batch.
   */
  async function processBatch(force = false): Promise<void> {
    if (processing || batch.length === 0) {
      return;
    }

    // Don't process if minBatchSize not met, unless forced (flush) or maxBatchSize reached
    if (!force && batch.length < minBatchSize && batch.length < options.maxBatchSize) {
      // Not enough items yet, wait longer
      return;
    }

    processing = true;
    const currentBatch = batch.splice(0, options.maxBatchSize);
    const currentResolvers = pendingResolvers.splice(0, currentBatch.length);

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }

    try {
      await processor(currentBatch);
      currentResolvers.forEach(({ resolve }) => resolve());
    } catch (error) {
      currentResolvers.forEach(({ reject }) => reject(error));
    } finally {
      processing = false;

      // Process next batch if items remain
      if (batch.length > 0) {
        scheduleNextBatch();
      }
    }
  }

  /**
   * Schedule the next batch processing.
   */
  function scheduleNextBatch(): void {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      processBatch();
    }, options.maxWaitTime);
  }

  /**
   * Add an item to the batch.
   */
  async function add(item: T): Promise<void> {
    return new Promise((resolve, reject) => {
      batch.push(item);
      pendingResolvers.push({ resolve, reject });

      // Process immediately if batch is full
      if (batch.length >= options.maxBatchSize) {
        processBatch();
      } else if (batch.length >= minBatchSize && !timeoutId) {
        // Start timer when minBatchSize is reached
        scheduleNextBatch();
      } else if (minBatchSize === 1 && !timeoutId) {
        // For minBatchSize=1, schedule on first item
        scheduleNextBatch();
      }
    });
  }

  /**
   * Flush the current batch immediately.
   */
  async function flush(): Promise<void> {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    await processBatch(true);
  }

  /**
   * Cancel all pending batches.
   */
  function cancel(): void {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    batch = [];
    pendingResolvers.forEach(({ reject }) => reject(new Error('Batch cancelled')));
    pendingResolvers = [];
  }

  /**
   * Get current batch size.
   */
  function size(): number {
    return batch.length;
  }

  return { add, flush, cancel, size };
}

// ============================================================================
// Throttling
// ============================================================================

/**
 * Creates a throttled function that only executes once per time period.
 *
 * Unlike debouncing, throttling ensures the function runs at regular intervals
 * during continuous calls.
 *
 * @param fn - Function to throttle
 * @param limit - Minimum time between executions in milliseconds
 * @returns Throttled function
 *
 * @example
 * ```typescript
 * const throttledUpdate = throttle(() => {
 *   updateUI();
 * }, 100);
 *
 * // Will only execute once per 100ms even with rapid calls
 * throttledUpdate();
 * throttledUpdate();
 * throttledUpdate();
 * ```
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function throttled(...args: Parameters<T>) {
    const now = Date.now();

    if (now - lastRun >= limit) {
      // Execute immediately
      fn(...args);
      lastRun = now;
    } else {
      // Schedule for later
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(
        () => {
          fn(...args);
          lastRun = Date.now();
          timeoutId = undefined;
        },
        limit - (now - lastRun)
      );
    }
  };
}

/**
 * Creates a rate-limited async function with queue support.
 *
 * @param fn - Async function to rate limit
 * @param limit - Minimum time between executions in milliseconds
 * @returns Rate-limited function
 */
export function rateLimit<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let lastRun = 0;
  const queue: Array<{
    args: Parameters<T>;
    resolve: (value: ReturnType<T>) => void;
    reject: (reason: unknown) => void;
  }> = [];
  let processing = false;
  let scheduled = false;

  async function processNext(): Promise<void> {
    scheduled = false;

    if (processing || queue.length === 0) {
      return;
    }

    const now = Date.now();
    const timeSinceLastRun = now - lastRun;

    if (lastRun > 0 && timeSinceLastRun < limit) {
      // Need to wait before processing
      if (!scheduled) {
        scheduled = true;
        setTimeout(processNext, limit - timeSinceLastRun);
      }
      return;
    }

    processing = true;
    const { args, resolve, reject } = queue.shift()!;

    try {
      const result = (await fn(...args)) as ReturnType<T>;
      resolve(result);
      lastRun = Date.now();
    } catch (error) {
      reject(error);
    } finally {
      processing = false;

      // Schedule processing of next item if there are any
      if (queue.length > 0 && !scheduled) {
        scheduled = true;
        setTimeout(processNext, limit);
      }
    }
  }

  return function rateLimited(...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise((resolve, reject) => {
      queue.push({ args, resolve, reject });

      // Try to schedule processing if not already processing or scheduled
      if (!processing && !scheduled) {
        processNext();
      }
    });
  };
}
