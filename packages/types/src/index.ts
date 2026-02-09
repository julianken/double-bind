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

// Saved Query types
export type {
  SavedQueryId,
  SavedQuery,
  CreateSavedQueryInput,
  UpdateSavedQueryInput,
} from './saved-query.js';
export { SavedQueryType } from './saved-query.js';

// Type utilities
export type { DeepPartial } from './utils.js';

// Error types
export { DoubleBindError, ErrorCode } from './errors';

// Input types
export type { CreatePageInput, CreateBlockInput, UpdateBlockInput } from './inputs';

// GraphDB interface
export type {
  GraphDB,
  GraphDBConfig,
  GraphDBFactory,
  QueryResult,
  MutationResult,
} from './graph-db.js';

// Search types
export type { SearchResult, SearchOptions } from './search.js';

// Conflict resolution types
export type {
  HybridLogicalClock,
  HLCString,
  VersionVector,
  ConflictType,
  ConflictResolutionStrategy,
  ConflictState,
  ConflictMetadata,
  Versioned,
  VersionedBlock,
  VersionedPage,
  ConflictDetectionOptions,
  ConflictDetectionResult,
  ResolveConflictInput,
  ConflictResolutionHook,
  ConflictStore,
} from './conflict.js';

// Sync protocol types
export type {
  ProtocolVersion,
  MessageId,
  NodeId,
  SyncType,
  SyncEnvelope,
  SyncPayload,
  FullSyncPayload,
  DatabaseSnapshot,
  SyncStats,
  IncrementalSyncPayload,
  SyncChange,
  EntitySnapshot,
  BlockSnapshot,
  PageSnapshot,
  ConflictCandidate,
  AckPayload,
  HelloMessage,
  HelloAckMessage,
  CapabilitiesMessage,
  SyncRequestMessage,
  SyncErrorCode,
  SyncError,
  SyncCheckpoint,
  SyncSession,
  EncryptionConfig,
  TransportSecurity,
  AuthToken,
  Permission,
  DevicePermissions,
  BatchConfig,
  CompressionConfig,
  PaginationConfig,
  EntityDelta,
  RetryConfig,
  ProcessedMessage,
  SyncProtocolClient,
  SyncProtocolServer,
  // Import/export types
  SyncEntity,
  SyncData,
  ImportConflictStrategy,
  ImportMode,
  ImportOptions,
  ImportStats,
  ImportConflict,
  ImportResult,
  SyncDataValidationError,
  SyncDataValidation,
} from './sync.js';

// Streaming types
export type { StreamChunk, StreamOptions, StreamResult } from './streaming.js';
export { StreamState } from './streaming.js';
