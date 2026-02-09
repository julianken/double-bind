/**
 * Sync and import/export types for data synchronization.
 *
 * Defines data structures for exporting and importing database state,
 * including versioning information for conflict detection.
 */

import type { Block, Page, Link, BlockRef, Property, Tag } from './domain.js';
import type { HLCString, VersionVector } from './conflict.js';

// ============================================================================
// Sync Data Format
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
