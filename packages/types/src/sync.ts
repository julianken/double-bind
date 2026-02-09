/**
 * Sync protocol types for cross-device synchronization.
 *
 * Implements the sync protocol specification defined in docs/sync/protocol.md.
 * Provides types for sync envelopes, payloads, and protocol messages.
 *
 * Protocol Version: 1.0.0
 */

import type { BlockId, PageId, Block, Page, Link, BlockRef, Property, Tag } from './domain.js';
import type { HLCString, VersionVector, ConflictMetadata } from './conflict.js';

// ============================================================================
// Protocol Metadata
// ============================================================================

/**
 * Protocol version string (semantic versioning).
 * Format: "major.minor.patch"
 */
export type ProtocolVersion = string;

/**
 * Unique message identifier (ULID) for deduplication.
 */
export type MessageId = string;

/**
 * Node/device identifier (ULID).
 */
export type NodeId = string;

/**
 * Type of sync operation.
 */
export type SyncType = 'full' | 'incremental' | 'ack';

// ============================================================================
// Sync Envelope
// ============================================================================

/**
 * Standard envelope for all sync messages.
 *
 * Wraps payload with protocol metadata, versioning, and security info.
 */
export interface SyncEnvelope<T = SyncPayload> {
  // Protocol metadata
  /** Protocol version (e.g., "1.0.0") */
  version: ProtocolVersion;

  /** Unique message ID (ULID) for deduplication */
  messageId: MessageId;

  /** Unix timestamp in milliseconds */
  timestamp: number;

  // Sync metadata
  /** Sending device identifier */
  nodeId: NodeId;

  /** Type of sync operation */
  syncType: SyncType;

  // Payload
  /** Message payload (type depends on syncType) */
  payload: T;

  // Security (optional)
  /** HMAC-SHA256 signature of payload */
  signature?: string;

  /** Whether payload is encrypted */
  encrypted?: boolean;
}

// ============================================================================
// Sync Payloads
// ============================================================================

/**
 * Union type for all sync payloads.
 */
export type SyncPayload = FullSyncPayload | IncrementalSyncPayload | AckPayload;

/**
 * Full database snapshot for initial sync.
 *
 * Uses CozoDB's native export format for efficient transfer.
 */
export interface FullSyncPayload {
  type: 'full';

  /** Complete database snapshot */
  snapshot: DatabaseSnapshot;

  /** Version vector after export */
  versionVector: VersionVector;

  /** Statistics about exported data */
  stats: SyncStats;
}

/**
 * Database snapshot in CozoDB export format.
 */
export interface DatabaseSnapshot {
  /** Exported relations (CozoDB format) */
  relations: {
    [relationName: string]: Array<Record<string, unknown>>;
  };

  /** When snapshot was taken */
  exportedAt: number;

  /** Database schema version */
  dbVersion: string;
}

/**
 * Statistics about synced data.
 */
export interface SyncStats {
  /** Total number of blocks */
  totalBlocks: number;

  /** Total number of pages */
  totalPages: number;

  /** Total number of links */
  totalLinks: number;

  /** Total number of properties */
  totalProperties: number;
}

/**
 * Incremental changes since last sync.
 *
 * Contains delta of entities modified since last sync checkpoint.
 */
export interface IncrementalSyncPayload {
  type: 'incremental';

  /** List of changes since last sync */
  changes: SyncChange[];

  /** Current version vector */
  versionVector: VersionVector;

  /** Version vector at last successful sync */
  lastSyncVector: VersionVector;

  /** Entities that may have conflicts */
  potentialConflicts: ConflictCandidate[];
}

/**
 * A single change to sync.
 */
export interface SyncChange {
  // Entity identification
  /** Entity ID (block_id or page_id) */
  entityId: string;

  /** Type of entity */
  entityType: 'block' | 'page' | 'link' | 'property' | 'tag';

  // Operation
  /** Type of operation */
  operation: 'create' | 'update' | 'delete' | 'restore';

  // Version tracking
  /** HLC timestamp of this change */
  version: HLCString;

  /** Version vector at time of change */
  versionVector: VersionVector;

  // Entity data
  /** Complete entity snapshot */
  snapshot: EntitySnapshot;

  // Change metadata
  /** Node ID that made this change */
  modifiedBy: NodeId;

  /** Physical timestamp (milliseconds) */
  modifiedAt: number;
}

/**
 * Entity snapshot (union type - actual fields depend on entityType).
 */
export interface EntitySnapshot {
  [key: string]: unknown;

  // Common fields across all entity types
  created_at?: number;
  updated_at?: number;
  is_deleted?: boolean;
}

/**
 * Block entity snapshot.
 */
export interface BlockSnapshot extends EntitySnapshot {
  block_id: BlockId;
  page_id: PageId;
  parent_id?: BlockId | null;
  content: string;
  content_type?: string;
  order: string;
  is_collapsed?: boolean;
  is_deleted: boolean;
  created_at: number;
  updated_at: number;

  // Version tracking
  version: HLCString;
  version_vector: string; // JSON-encoded VersionVector
  last_modified_by: NodeId;
}

/**
 * Page entity snapshot.
 */
export interface PageSnapshot extends EntitySnapshot {
  page_id: PageId;
  title: string;
  is_deleted: boolean;
  created_at: number;
  updated_at: number;
  daily_note_date?: string | null;

  // Version tracking
  version: HLCString;
  version_vector: string; // JSON-encoded VersionVector
  last_modified_by: NodeId;
}

/**
 * Entity that may have a conflict.
 */
export interface ConflictCandidate {
  /** Entity ID */
  entityId: string;

  /** Local version timestamp */
  localVersion: HLCString;

  /** Remote version timestamp */
  remoteVersion: HLCString;

  /** Reason for potential conflict */
  reason: 'concurrent_modification' | 'delete_edit' | 'structural';
}

/**
 * Acknowledgment of processed sync message.
 */
export interface AckPayload {
  type: 'ack';

  /** Message ID being acknowledged */
  ackMessageId: MessageId;

  /** Processing result */
  status: 'success' | 'partial' | 'conflict' | 'error';

  /** Version vector after applying changes */
  versionVector: VersionVector;

  /** Conflicts detected during application */
  conflicts: ConflictMetadata[];

  /** Error details (if status is 'error') */
  error?: SyncError;
}

// ============================================================================
// Sync Connection
// ============================================================================

/**
 * Initial handshake message.
 */
export interface HelloMessage {
  /** Node ID of sender */
  nodeId: NodeId;

  /** Protocol version supported */
  version: ProtocolVersion;

  /** Device information */
  deviceInfo: {
    platform: 'desktop' | 'mobile' | 'web';
    osVersion: string;
    appVersion: string;
  };
}

/**
 * Handshake acknowledgment.
 */
export interface HelloAckMessage {
  /** Node ID of responder */
  nodeId: NodeId;

  /** Agreed protocol version */
  version: ProtocolVersion;

  /** Whether connection is accepted */
  accepted: boolean;

  /** Reason if not accepted */
  reason?: string;
}

/**
 * Sync capabilities negotiation.
 */
export interface CapabilitiesMessage {
  /** Supported sync modes */
  syncModes: Array<'full' | 'incremental'>;

  /** Supported compression algorithms */
  compression: Array<'gzip' | 'none'>;

  /** Maximum message size in bytes */
  maxMessageSize: number;

  /** Whether encryption is required */
  requireEncryption: boolean;
}

/**
 * Sync request message.
 */
export interface SyncRequestMessage {
  /** Type of sync requested */
  syncType: 'full' | 'incremental';

  /** For incremental: version vector at last sync */
  lastSyncVector?: VersionVector;

  /** Maximum entities per response */
  limit?: number;

  /** Pagination cursor (for large syncs) */
  cursor?: string;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Sync error codes.
 */
export type SyncErrorCode =
  | 'NETWORK_ERROR'
  | 'PROTOCOL_VERSION_MISMATCH'
  | 'INVALID_MESSAGE'
  | 'CONFLICT_DETECTED'
  | 'STORAGE_ERROR'
  | 'AUTHENTICATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'TIMEOUT'
  | 'QUOTA_EXCEEDED';

/**
 * Sync error details.
 */
export interface SyncError {
  /** Error code */
  code: SyncErrorCode;

  /** Human-readable message */
  message: string;

  /** Additional error details */
  details?: unknown;

  /** When error occurred */
  timestamp: number;

  /** Whether error is recoverable with retry */
  recoverable: boolean;
}

// ============================================================================
// Sync State Management
// ============================================================================

/**
 * Sync checkpoint - tracks sync state for a peer.
 */
export interface SyncCheckpoint {
  /** Peer node ID */
  nodeId: NodeId;

  /** When last sync completed */
  lastSyncAt: number;

  /** Version vector after last successful sync */
  versionVector: VersionVector;

  /** Current sync status */
  status: 'syncing' | 'idle' | 'conflict' | 'error';

  /** Error details (if status is 'error') */
  error?: SyncError;
}

/**
 * Sync session - tracks active sync operation.
 */
export interface SyncSession {
  /** Session ID (ULID) */
  sessionId: string;

  /** Local node ID */
  localNodeId: NodeId;

  /** Peer node ID */
  peerNodeId: NodeId;

  /** When session started */
  startedAt: number;

  /** Sync type being performed */
  syncType: 'full' | 'incremental';

  /** Current status */
  status: 'connecting' | 'negotiating' | 'syncing' | 'resolving' | 'complete' | 'error';

  /** Progress information */
  progress?: {
    totalEntities: number;
    processedEntities: number;
    conflictsDetected: number;
    conflictsResolved: number;
  };

  /** Conflicts requiring resolution */
  pendingConflicts: ConflictMetadata[];
}

// ============================================================================
// Security
// ============================================================================

/**
 * Encryption configuration for data at rest.
 */
export interface EncryptionConfig {
  /** Encryption algorithm */
  algorithm: 'AES-256-GCM';

  /** Key derivation settings */
  keyDerivation: {
    method: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    saltLength: number;
  };

  /** Initialization vector length */
  ivLength: number;
}

/**
 * Transport security configuration.
 */
export interface TransportSecurity {
  /** TLS settings */
  tls: {
    minVersion: '1.3';
    cipherSuites: string[];
  };

  /** Message authentication */
  messageAuth: {
    algorithm: 'HMAC-SHA256';
    keyLength: number;
  };
}

/**
 * Authentication token (JWT-like).
 */
export interface AuthToken {
  /** Device node ID */
  nodeId: NodeId;

  /** When token was issued (Unix timestamp) */
  issuedAt: number;

  /** When token expires (Unix timestamp) */
  expiresAt: number;

  /** Granted capabilities */
  capabilities: Permission[];

  /** HMAC signature */
  signature: string;
}

/**
 * Permission types.
 */
export type Permission = 'read' | 'write' | 'delete' | 'admin';

/**
 * Device permissions.
 */
export interface DevicePermissions {
  /** Device node ID */
  nodeId: NodeId;

  /** User ID owning this device */
  userId: string;

  /** Granted permissions */
  permissions: Permission[];

  /** When permissions were granted */
  grantedAt: number;

  /** Who granted permissions */
  grantedBy: string;
}

// ============================================================================
// Performance Optimization
// ============================================================================

/**
 * Batching configuration.
 */
export interface BatchConfig {
  /** Maximum entities per batch */
  maxBatchSize: number;

  /** Maximum payload size in bytes */
  maxBatchBytes: number;

  /** Maximum time to wait for batch (milliseconds) */
  batchTimeout: number;
}

/**
 * Compression configuration.
 */
export interface CompressionConfig {
  /** Compression algorithm */
  algorithm: 'gzip' | 'none';

  /** Compression level (1-9) */
  level: number;

  /** Only compress if payload > threshold bytes */
  threshold: number;
}

/**
 * Pagination configuration.
 */
export interface PaginationConfig {
  /** Entities per page */
  pageSize: number;

  /** Continuation token */
  cursor?: string;
}

/**
 * Entity delta (for incremental sync optimization).
 */
export interface EntityDelta {
  /** Entity ID */
  entityId: string;

  /** Current version */
  version: HLCString;

  /** Changed fields only */
  changes: {
    [field: string]: {
      old: unknown;
      new: unknown;
    };
  };
}

// ============================================================================
// Retry Strategy
// ============================================================================

/**
 * Retry configuration for failed sync operations.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;

  /** Initial delay in milliseconds */
  initialDelay: number;

  /** Maximum delay in milliseconds */
  maxDelay: number;

  /** Backoff multiplier (exponential) */
  backoffMultiplier: number;

  /** Random jitter factor (0-1) */
  jitter: number;
}

// ============================================================================
// Message Deduplication
// ============================================================================

/**
 * Processed message cache entry (for idempotency).
 */
export interface ProcessedMessage {
  /** Message ID */
  messageId: MessageId;

  /** When message was processed */
  processedAt: number;

  /** Processing result */
  result: 'success' | 'conflict' | 'error';

  /** Response payload (cached) */
  response?: SyncEnvelope;
}

// ============================================================================
// Sync Protocol API
// ============================================================================

/**
 * Sync protocol client interface.
 *
 * Implementations handle connection management, message exchange,
 * and protocol state machine.
 */
export interface SyncProtocolClient {
  /**
   * Establish connection with peer.
   *
   * @param peerNodeId - Target peer node ID
   * @returns True if connection successful
   */
  connect(peerNodeId: NodeId): Promise<boolean>;

  /**
   * Disconnect from peer.
   */
  disconnect(): Promise<void>;

  /**
   * Request full sync from peer.
   *
   * @returns Full sync payload
   */
  requestFullSync(): Promise<FullSyncPayload>;

  /**
   * Request incremental sync from peer.
   *
   * @param lastSyncVector - Version vector at last sync
   * @returns Incremental sync payload
   */
  requestIncrementalSync(lastSyncVector: VersionVector): Promise<IncrementalSyncPayload>;

  /**
   * Send acknowledgment to peer.
   *
   * @param ack - Acknowledgment payload
   */
  sendAck(ack: AckPayload): Promise<void>;

  /**
   * Get current sync status.
   */
  getStatus(): SyncSession | null;
}

/**
 * Sync protocol server interface.
 *
 * Handles incoming sync requests from peers.
 */
export interface SyncProtocolServer {
  /**
   * Start listening for connections.
   *
   * @param port - Port to listen on (optional)
   */
  start(port?: number): Promise<void>;

  /**
   * Stop server.
   */
  stop(): Promise<void>;

  /**
   * Handle full sync request.
   *
   * @param request - Sync request message
   * @returns Full sync payload
   */
  handleFullSyncRequest(request: SyncRequestMessage): Promise<FullSyncPayload>;

  /**
   * Handle incremental sync request.
   *
   * @param request - Sync request message
   * @returns Incremental sync payload
   */
  handleIncrementalSyncRequest(request: SyncRequestMessage): Promise<IncrementalSyncPayload>;

  /**
   * Handle acknowledgment from peer.
   *
   * @param ack - Acknowledgment payload
   */
  handleAck(ack: AckPayload): Promise<void>;

  /**
   * Get list of connected peers.
   */
  getConnectedPeers(): NodeId[];
}

// ============================================================================
// Sync Data Format (Import/Export)
// ============================================================================

/**
 * Entity with version tracking for sync.
 * Wraps domain entities (Block, Page, etc.) with HLC metadata.
 */
export interface SyncEntity<T> {
  /** The domain entity data */
  data: T;

  /** HLC timestamp of this version */
  version: HLCString;

  /** Version vector tracking causality */
  versionVector: VersionVector;

  /** Node ID that created/modified this entity */
  nodeId: string;

  /** When this version was created (milliseconds) */
  timestamp: number;
}

/**
 * Complete sync data export.
 * Contains all entities with version metadata.
 */
export interface SyncData {
  /** Schema version for compatibility */
  schemaVersion: number;

  /** When this export was created */
  exportedAt: number;

  /** Node ID that created this export */
  exportedBy: string;

  /** Versioned pages */
  pages: SyncEntity<Page>[];

  /** Versioned blocks */
  blocks: SyncEntity<Block>[];

  /** Links between pages */
  links: Link[];

  /** Block references */
  blockRefs: BlockRef[];

  /** Properties */
  properties: Property[];

  /** Tags */
  tags: Tag[];
}

// ============================================================================
// Import Options
// ============================================================================

/**
 * Strategy for handling conflicts during import.
 */
export type ImportConflictStrategy =
  | 'auto' // Automatically resolve using HLC comparison
  | 'manual' // Create Conflict objects for UI resolution
  | 'reject' // Reject all conflicts, keep local
  | 'accept-remote'; // Accept all remote changes

/**
 * Import mode - full or incremental.
 */
export type ImportMode =
  | 'full' // Replace entire database
  | 'incremental'; // Merge with existing data

/**
 * Options for import operation.
 */
export interface ImportOptions {
  /** Import mode */
  mode: ImportMode;

  /** Conflict resolution strategy */
  conflictStrategy: ImportConflictStrategy;

  /** Current node ID (for HLC operations) */
  nodeId: string;

  /** Whether to perform validation before import */
  validate?: boolean;

  /** Whether to create backups before import */
  createBackup?: boolean;

  /** Maximum conflicts to detect before failing */
  maxConflicts?: number;
}

// ============================================================================
// Import Result
// ============================================================================

/**
 * Statistics from an import operation.
 */
export interface ImportStats {
  /** Number of pages imported */
  pagesImported: number;

  /** Number of blocks imported */
  blocksImported: number;

  /** Number of links imported */
  linksImported: number;

  /** Number of conflicts detected */
  conflictsDetected: number;

  /** Number of conflicts auto-resolved */
  conflictsAutoResolved: number;

  /** Import duration in milliseconds */
  durationMs: number;
}

/**
 * Conflict detected during import.
 */
export interface ImportConflict {
  /** Entity ID (blockId or pageId) */
  entityId: string;

  /** Entity type */
  entityType: 'block' | 'page';

  /** Local version */
  localVersion: HLCString;

  /** Remote version */
  remoteVersion: HLCString;

  /** Comparison result */
  comparison: 'local-newer' | 'remote-newer' | 'concurrent';

  /** Whether auto-resolved */
  autoResolved: boolean;

  /** Resolution taken (if auto-resolved) */
  resolution?: 'keep-local' | 'accept-remote';
}

/**
 * Result of an import operation.
 */
export interface ImportResult {
  /** Whether import succeeded */
  success: boolean;

  /** Import statistics */
  stats: ImportStats;

  /** Conflicts detected */
  conflicts: ImportConflict[];

  /** Error message (if failed) */
  error?: string;

  /** Conflict IDs created (for manual resolution) */
  conflictIds?: string[];
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validation error in sync data.
 */
export interface SyncDataValidationError {
  /** Error type */
  type: 'missing-page' | 'orphan-block' | 'invalid-reference' | 'invalid-version';

  /** Entity ID */
  entityId: string;

  /** Error message */
  message: string;
}

/**
 * Result of sync data validation.
 */
export interface SyncDataValidation {
  /** Whether data is valid */
  valid: boolean;

  /** Validation errors */
  errors: SyncDataValidationError[];

  /** Warnings (non-fatal issues) */
  warnings: SyncDataValidationError[];
}
