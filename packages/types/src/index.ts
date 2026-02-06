// @double-bind/types - Shared interfaces, domain types, error types
// This package has zero dependencies

// Domain types
export type {
  PageId,
  BlockId,
  Page,
  Block,
  BlockRef,
  Link,
  Property,
  Tag,
  BlockVersion,
} from './domain.js';

// Type utilities
export type { DeepPartial } from './utils.js';

// Error types
export { DoubleBindError, ErrorCode } from './errors';

// Input types
export type { CreatePageInput, CreateBlockInput, UpdateBlockInput } from './inputs';

// GraphDB interface
export type { GraphDB, QueryResult, MutationResult } from './graph-db.js';

// Search types
export type { SearchResult, SearchOptions } from './search.js';
