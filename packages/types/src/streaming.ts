/**
 * Streaming types for incremental query result processing
 *
 * Provides types for streaming query results to the UI in chunks,
 * enabling progressive loading indicators and memory-efficient processing
 * of large result sets in mobile environments.
 */

/**
 * State of a streaming operation
 */
export enum StreamState {
  /** Stream is waiting to start */
  Pending = 'pending',
  /** Stream is actively delivering chunks */
  Streaming = 'streaming',
  /** Stream has completed successfully */
  Complete = 'complete',
  /** Stream encountered an error */
  Error = 'error',
  /** Stream was cancelled by the user */
  Cancelled = 'cancelled',
}

/**
 * A chunk of streaming results with metadata
 *
 * @template T - The type of items in the chunk
 */
export interface StreamChunk<T> {
  /** Items in this chunk */
  items: T[];

  /** Total number of items expected (if known) */
  totalCount?: number;

  /** Number of items delivered so far (including this chunk) */
  deliveredCount: number;

  /** Chunk sequence number (0-indexed) */
  chunkIndex: number;

  /** Whether this is the final chunk */
  isFinal: boolean;

  /** Timestamp when chunk was created */
  timestamp: number;
}

/**
 * Options for configuring streaming behavior
 */
export interface StreamOptions {
  /**
   * Number of items per chunk
   * Smaller chunks = more frequent updates, higher overhead
   * Larger chunks = less frequent updates, lower overhead
   * @default 50
   */
  chunkSize?: number;

  /**
   * Maximum time to wait between chunks (milliseconds)
   * Prevents UI freezing on slow data sources
   * @default 100
   */
  timeout?: number;

  /**
   * AbortSignal for cancelling the stream
   */
  signal?: AbortSignal;
}

/**
 * Result from a streaming query operation
 *
 * @template T - The type of items being streamed
 */
export interface StreamResult<T> {
  /** Current state of the stream */
  state: StreamState;

  /** All chunks received so far */
  chunks: StreamChunk<T>[];

  /** All items received so far (flattened from chunks) */
  items: T[];

  /** Total number of items expected (if known) */
  totalCount?: number;

  /** Number of items delivered so far */
  deliveredCount: number;

  /** Error if state is Error */
  error?: Error;

  /** Progress as a percentage (0-100), undefined if totalCount unknown */
  progress?: number;
}
