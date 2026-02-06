/**
 * Error codes for DoubleBindError
 * Categorized by domain: Database, Domain, Import/Export, Security
 */
export enum ErrorCode {
  // Database
  DB_CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
  DB_QUERY_FAILED = 'DB_QUERY_FAILED',
  DB_MUTATION_FAILED = 'DB_MUTATION_FAILED',

  // Domain
  PAGE_NOT_FOUND = 'PAGE_NOT_FOUND',
  BLOCK_NOT_FOUND = 'BLOCK_NOT_FOUND',
  INVALID_CONTENT = 'INVALID_CONTENT',
  CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',

  // Import/Export
  IMPORT_PARSE_ERROR = 'IMPORT_PARSE_ERROR',
  EXPORT_WRITE_ERROR = 'EXPORT_WRITE_ERROR',

  // Security
  BLOCKED_OPERATION = 'BLOCKED_OPERATION',
}

/**
 * Application-specific error class for Double-Bind
 * Provides typed error codes and optional cause chaining
 */
export class DoubleBindError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'DoubleBindError';
  }
}
