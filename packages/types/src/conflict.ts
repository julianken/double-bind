/**
 * Conflict detection and resolution types for sync preparation.
 *
 * This module provides infrastructure for detecting and tracking conflicts
 * that may arise during synchronization between multiple devices.
 * It uses Hybrid Logical Clocks (HLC) for version tracking, which combines
 * physical timestamps with logical counters to provide total ordering
 * even in offline-first scenarios.
 *
 * The design supports multiple resolution strategies:
 * - Last-write-wins (simple, lossy)
 * - Manual resolution (preserving, requires UI)
 * - Automatic merge (complex, context-dependent)
 * - CRDT-based (future, conflict-free)
 */

import type { BlockId, PageId } from './domain.js';

// ============================================================================
// Version Tracking - Hybrid Logical Clock (HLC)
// ============================================================================

/**
 * Hybrid Logical Clock timestamp for version tracking.
 *
 * Combines physical time (milliseconds) with a logical counter to ensure
 * total ordering of events across distributed systems, even when clocks drift.
 *
 * Format: `<physical_time>-<logical_counter>-<node_id>`
 * Example: `1707456123456-0-device123`
 *
 * Properties:
 * - Monotonic: timestamps always increase
 * - Causal: if A happened before B, HLC(A) < HLC(B)
 * - Close to physical time: logical counter is usually 0
 */
export interface HybridLogicalClock {
  /** Physical timestamp in milliseconds (Unix epoch) */
  physical: number;
  /** Logical counter for events at the same physical time */
  logical: number;
  /** Node/device identifier (ULID or UUID) */
  nodeId: string;
}

/**
 * Serialized HLC string format: `physical-logical-nodeId`
 * Example: `1707456123456-0-device123`
 */
export type HLCString = string;

/**
 * Version vector for tracking causality across multiple nodes.
 * Maps node IDs to their latest known HLC.
 *
 * Example:
 * {
 *   "device-desktop": "1707456123456-0-device-desktop",
 *   "device-mobile": "1707456120000-3-device-mobile"
 * }
 */
export type VersionVector = Record<string, HLCString>;

// ============================================================================
// Conflict Metadata
// ============================================================================

/**
 * Type of conflict detected during synchronization.
 */
export type ConflictType =
  | 'content' // Different content edits to the same block
  | 'move' // Block moved to different locations
  | 'delete' // One device deleted while another edited
  | 'parent' // Conflicting parent changes
  | 'order' // Conflicting order/position changes
  | 'structural'; // Tree structure conflicts (cycles, orphans)

/**
 * Resolution strategy for handling conflicts.
 */
export type ConflictResolutionStrategy =
  | 'last-write-wins' // Newest timestamp wins (lossy)
  | 'manual' // Requires user intervention
  | 'merge' // Automatic merge attempt
  | 'keep-both' // Create duplicate blocks
  | 'reject'; // Reject incoming change

/**
 * Current state of a conflict.
 */
export type ConflictState =
  | 'detected' // Conflict identified, not yet resolved
  | 'pending' // Awaiting resolution
  | 'resolved' // Resolution applied
  | 'rejected'; // Conflict ignored/rejected

/**
 * Metadata for a detected conflict.
 *
 * Stores complete information about conflicting versions to enable
 * various resolution strategies and provide context for user decisions.
 */
export interface ConflictMetadata {
  /** Unique conflict identifier (ULID) */
  conflictId: string;

  /** Entity that has the conflict (blockId or pageId) */
  entityId: BlockId | PageId;

  /** Type of entity */
  entityType: 'block' | 'page';

  /** Type of conflict */
  conflictType: ConflictType;

  /** Current state */
  state: ConflictState;

  /** Resolution strategy to apply */
  resolutionStrategy: ConflictResolutionStrategy;

  /** Local version (this device) */
  localVersion: {
    /** HLC timestamp of local version */
    timestamp: HLCString;
    /** Snapshot of local state */
    snapshot: unknown; // Block or Page object
    /** Version vector at time of local change */
    versionVector: VersionVector;
  };

  /** Remote version (incoming from sync) */
  remoteVersion: {
    /** HLC timestamp of remote version */
    timestamp: HLCString;
    /** Snapshot of remote state */
    snapshot: unknown; // Block or Page object
    /** Version vector at time of remote change */
    versionVector: VersionVector;
  };

  /** Common ancestor version (for three-way merge) */
  ancestorVersion?: {
    /** HLC timestamp of ancestor */
    timestamp: HLCString;
    /** Snapshot of ancestor state */
    snapshot: unknown;
  };

  /** When conflict was detected */
  detectedAt: number;

  /** When conflict was resolved (if resolved) */
  resolvedAt?: number;

  /** Resolution details (if resolved) */
  resolution?: {
    /** Which version was chosen or how merge was performed */
    method: 'local' | 'remote' | 'merged' | 'both' | 'manual';
    /** ID of chosen version or merged result */
    resultId?: string;
    /** Human-readable description of resolution */
    description?: string;
  };

  /** Additional context */
  metadata?: {
    /** User ID who resolved (if manual) */
    resolvedBy?: string;
    /** Notes about the conflict */
    notes?: string;
    /** Related conflicts */
    relatedConflicts?: string[];
  };
}

// ============================================================================
// Versioned Entity Interfaces
// ============================================================================

/**
 * Adds version tracking to an entity (Block or Page).
 *
 * This interface can be mixed into existing domain types to add
 * sync-aware version tracking.
 */
export interface Versioned {
  /** Current HLC timestamp */
  version: HLCString;

  /** Version vector tracking causality */
  versionVector: VersionVector;

  /** ID of device/node that last modified this entity */
  lastModifiedBy: string;
}

/**
 * Extended block with version tracking for sync.
 */
export interface VersionedBlock {
  blockId: BlockId;
  pageId: PageId;
  content: string;
  version: HLCString;
  versionVector: VersionVector;
  lastModifiedBy: string;
  updatedAt: number;
}

/**
 * Extended page with version tracking for sync.
 */
export interface VersionedPage {
  pageId: PageId;
  title: string;
  version: HLCString;
  versionVector: VersionVector;
  lastModifiedBy: string;
  updatedAt: number;
}

// ============================================================================
// Conflict Detection & Resolution API
// ============================================================================

/**
 * Options for conflict detection.
 */
export interface ConflictDetectionOptions {
  /** Node/device ID for this instance */
  nodeId: string;

  /** Default resolution strategy */
  defaultStrategy?: ConflictResolutionStrategy;

  /** Whether to automatically resolve simple conflicts */
  autoResolve?: boolean;

  /** Maximum age for conflicts before auto-expiry (milliseconds) */
  maxConflictAge?: number;
}

/**
 * Result of conflict detection operation.
 */
export interface ConflictDetectionResult {
  /** Whether a conflict was detected */
  hasConflict: boolean;

  /** Conflict metadata (if detected) */
  conflict?: ConflictMetadata;

  /** Suggested resolution */
  suggestion?: {
    strategy: ConflictResolutionStrategy;
    reason: string;
  };
}

/**
 * Input for manual conflict resolution.
 */
export interface ResolveConflictInput {
  /** Conflict ID to resolve */
  conflictId: string;

  /** Resolution method */
  method: 'local' | 'remote' | 'merged' | 'both' | 'manual';

  /** Merged content (if method is 'merged' or 'manual') */
  mergedSnapshot?: unknown;

  /** User notes about resolution */
  notes?: string;

  /** User ID performing resolution */
  userId?: string;
}

/**
 * Hook for customizing conflict resolution behavior.
 *
 * This allows applications to implement custom resolution strategies
 * based on conflict type, entity type, or other factors.
 */
export type ConflictResolutionHook = (
  conflict: ConflictMetadata
) => Promise<ConflictResolutionStrategy>;

/**
 * Storage interface for conflict metadata.
 *
 * Implementations should persist conflicts to local database
 * for offline access and durability.
 */
export interface ConflictStore {
  /** Save detected conflict */
  saveConflict(conflict: ConflictMetadata): Promise<void>;

  /** Get conflict by ID */
  getConflict(conflictId: string): Promise<ConflictMetadata | null>;

  /** Get all conflicts for an entity */
  getConflictsForEntity(entityId: string): Promise<ConflictMetadata[]>;

  /** Get all unresolved conflicts */
  getUnresolvedConflicts(): Promise<ConflictMetadata[]>;

  /** Update conflict state */
  updateConflict(conflictId: string, updates: Partial<ConflictMetadata>): Promise<void>;

  /** Mark conflict as resolved */
  resolveConflict(conflictId: string, resolution: ResolveConflictInput): Promise<void>;

  /** Delete conflict */
  deleteConflict(conflictId: string): Promise<void>;

  /** Delete all resolved conflicts older than given timestamp */
  pruneResolvedConflicts(olderThan: number): Promise<number>;
}
