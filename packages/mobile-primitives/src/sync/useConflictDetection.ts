/**
 * React hook for conflict detection and resolution.
 *
 * Provides imperative API for detecting conflicts between local and remote
 * versions of entities, and managing conflict resolution state.
 */

import { useCallback, useEffect, useRef } from 'react';
import type {
  ConflictDetectionOptions,
  ConflictDetectionResult,
  ConflictMetadata,
  ConflictStore,
  ConflictType,
  HLCString,
  ResolveConflictInput,
  VersionVector,
} from '@double-bind/types';
import { ulid } from 'ulid';
import {
  compareVersionVectors,
  generateHLC,
  serializeHLC,
  updateHLC,
  deserializeHLC,
} from './hlc';

/**
 * Hook return type with conflict detection methods.
 */
export interface UseConflictDetectionReturn {
  /**
   * Detect conflicts between local and remote versions.
   *
   * @param params - Detection parameters
   * @returns Detection result with conflict metadata
   */
  detectConflict: (params: DetectConflictParams) => Promise<ConflictDetectionResult>;

  /**
   * Get all unresolved conflicts.
   *
   * @returns Array of unresolved conflicts
   */
  getUnresolvedConflicts: () => Promise<ConflictMetadata[]>;

  /**
   * Get conflicts for a specific entity.
   *
   * @param entityId - Entity ID (blockId or pageId)
   * @returns Array of conflicts for the entity
   */
  getConflictsForEntity: (entityId: string) => Promise<ConflictMetadata[]>;

  /**
   * Resolve a conflict manually.
   *
   * @param input - Resolution input
   */
  resolveConflict: (input: ResolveConflictInput) => Promise<void>;

  /**
   * Generate a new version timestamp for this node.
   *
   * @returns New HLC timestamp string
   */
  generateVersion: () => HLCString;

  /**
   * Update local HLC based on received remote timestamp.
   *
   * Call this when receiving sync data to maintain causal consistency.
   *
   * @param remoteTimestamp - Remote HLC timestamp
   * @returns Updated local HLC timestamp
   */
  updateVersion: (remoteTimestamp: HLCString) => HLCString;

  /**
   * Prune old resolved conflicts from storage.
   *
   * @param olderThan - Timestamp threshold (milliseconds)
   * @returns Number of conflicts pruned
   */
  pruneResolvedConflicts: (olderThan: number) => Promise<number>;
}

/**
 * Parameters for conflict detection.
 */
export interface DetectConflictParams {
  /** Entity ID (blockId or pageId) */
  entityId: string;

  /** Entity type */
  entityType: 'block' | 'page';

  /** Local version */
  localVersion: {
    timestamp: HLCString;
    snapshot: unknown;
    versionVector: VersionVector;
  };

  /** Remote version */
  remoteVersion: {
    timestamp: HLCString;
    snapshot: unknown;
    versionVector: VersionVector;
  };

  /** Common ancestor version (for three-way merge) */
  ancestorVersion?: {
    timestamp: HLCString;
    snapshot: unknown;
  };

  /** Type of conflict (if known) */
  conflictType?: ConflictType;
}

/**
 * Hook for conflict detection and resolution.
 *
 * @param options - Configuration options
 * @param conflictStore - Storage for conflict metadata
 * @returns Conflict detection methods
 *
 * @example
 * ```typescript
 * const { detectConflict, resolveConflict, generateVersion } = useConflictDetection(
 *   { nodeId: 'device-123', defaultStrategy: 'manual' },
 *   conflictStoreImpl
 * );
 *
 * // Generate version for local change
 * const version = generateVersion();
 *
 * // Detect conflict during sync
 * const result = await detectConflict({
 *   entityId: 'block-456',
 *   entityType: 'block',
 *   localVersion: { timestamp: localTimestamp, snapshot: localBlock, versionVector: localVV },
 *   remoteVersion: { timestamp: remoteTimestamp, snapshot: remoteBlock, versionVector: remoteVV },
 * });
 *
 * if (result.hasConflict) {
 *   // Show conflict UI and let user resolve
 *   await resolveConflict({
 *     conflictId: result.conflict.conflictId,
 *     method: 'manual',
 *     mergedSnapshot: userMergedBlock,
 *   });
 * }
 * ```
 */
export function useConflictDetection(
  options: ConflictDetectionOptions,
  conflictStore: ConflictStore
): UseConflictDetectionReturn {
  const optionsRef = useRef(options);

  // Update options ref on change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  /**
   * Detect if there's a conflict between local and remote versions.
   */
  const detectConflict = useCallback(
    async (params: DetectConflictParams): Promise<ConflictDetectionResult> => {
      const opts = optionsRef.current;
      const { localVersion, remoteVersion, entityId, entityType, ancestorVersion, conflictType } =
        params;

      // Compare version vectors to determine causality
      const vectorComparison = compareVersionVectors(
        localVersion.versionVector,
        remoteVersion.versionVector
      );

      // No conflict if one version causally precedes the other
      if (vectorComparison === 'before') {
        // Local is older, no conflict (remote is newer)
        return { hasConflict: false };
      }

      if (vectorComparison === 'after') {
        // Remote is older, no conflict (local is newer)
        return { hasConflict: false };
      }

      if (vectorComparison === 'equal') {
        // Versions are identical, no conflict
        return { hasConflict: false };
      }

      // Concurrent versions - potential conflict
      // Check if content actually differs
      const contentDiffers = !deepEqual(localVersion.snapshot, remoteVersion.snapshot);

      if (!contentDiffers) {
        // Concurrent but identical content (rare but possible)
        return { hasConflict: false };
      }

      // Real conflict detected - create conflict metadata
      const conflictId = ulid();
      const detectedAt = Date.now();

      // Determine conflict type if not provided
      const detectedConflictType = conflictType || inferConflictType(params);

      // Suggest resolution strategy
      const strategy =
        opts.defaultStrategy || suggestResolutionStrategy(detectedConflictType, params);

      const conflict: ConflictMetadata = {
        conflictId,
        entityId,
        entityType,
        conflictType: detectedConflictType,
        state: 'detected',
        resolutionStrategy: strategy,
        localVersion,
        remoteVersion,
        ancestorVersion,
        detectedAt,
      };

      // Save to store
      await conflictStore.saveConflict(conflict);

      return {
        hasConflict: true,
        conflict,
        suggestion: {
          strategy,
          reason: getStrategyReason(strategy, detectedConflictType),
        },
      };
    },
    [conflictStore]
  );

  /**
   * Get all unresolved conflicts.
   */
  const getUnresolvedConflicts = useCallback(async (): Promise<ConflictMetadata[]> => {
    return conflictStore.getUnresolvedConflicts();
  }, [conflictStore]);

  /**
   * Get conflicts for a specific entity.
   */
  const getConflictsForEntity = useCallback(
    async (entityId: string): Promise<ConflictMetadata[]> => {
      return conflictStore.getConflictsForEntity(entityId);
    },
    [conflictStore]
  );

  /**
   * Resolve a conflict manually.
   */
  const resolveConflict = useCallback(
    async (input: ResolveConflictInput): Promise<void> => {
      await conflictStore.resolveConflict(input.conflictId, input);
    },
    [conflictStore]
  );

  /**
   * Generate a new version timestamp.
   */
  const generateVersion = useCallback((): HLCString => {
    const hlc = generateHLC(optionsRef.current.nodeId);
    return serializeHLC(hlc);
  }, []);

  /**
   * Update local HLC based on received remote timestamp.
   */
  const updateVersion = useCallback((remoteTimestamp: HLCString): HLCString => {
    const remoteHLC = deserializeHLC(remoteTimestamp);
    const updatedHLC = updateHLC(optionsRef.current.nodeId, remoteHLC);
    return serializeHLC(updatedHLC);
  }, []);

  /**
   * Prune old resolved conflicts.
   */
  const pruneResolvedConflicts = useCallback(
    async (olderThan: number): Promise<number> => {
      return conflictStore.pruneResolvedConflicts(olderThan);
    },
    [conflictStore]
  );

  return {
    detectConflict,
    getUnresolvedConflicts,
    getConflictsForEntity,
    resolveConflict,
    generateVersion,
    updateVersion,
    pruneResolvedConflicts,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Deep equality check for snapshots.
 * Simple JSON-based comparison for now.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Infer conflict type from snapshot differences.
 */
function inferConflictType(params: DetectConflictParams): ConflictType {
  const { entityType, localVersion, remoteVersion } = params;

  if (entityType === 'page') {
    return 'content'; // Page conflicts are typically title changes
  }

  // For blocks, try to infer type from snapshot structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const local = localVersion.snapshot as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const remote = remoteVersion.snapshot as any;

  if (local?.isDeleted !== remote?.isDeleted) {
    return 'delete';
  }

  if (local?.parentId !== remote?.parentId) {
    return 'parent';
  }

  if (local?.order !== remote?.order) {
    return 'order';
  }

  if (local?.content !== remote?.content) {
    return 'content';
  }

  // Default to structural
  return 'structural';
}

/**
 * Suggest resolution strategy based on conflict type.
 */
function suggestResolutionStrategy(
  conflictType: ConflictType,
  _params: DetectConflictParams
): 'last-write-wins' | 'manual' | 'merge' | 'keep-both' | 'reject' {
  switch (conflictType) {
    case 'content': {
      // For content conflicts, prefer manual resolution to avoid data loss
      return 'manual';
    }
    case 'delete': {
      // Deletions should be manual to avoid accidentally losing data
      return 'manual';
    }
    case 'move':
    case 'parent': {
      // Structural changes can use last-write-wins
      return 'last-write-wins';
    }
    case 'order': {
      // Order conflicts can be auto-resolved
      return 'last-write-wins';
    }
    case 'structural': {
      // Complex structural conflicts need manual review
      return 'manual';
    }
    default:
      return 'manual';
  }
}

/**
 * Get human-readable reason for strategy suggestion.
 */
function getStrategyReason(
  strategy: string,
  conflictType: ConflictType
): string {
  const reasons: Record<string, Record<string, string>> = {
    'last-write-wins': {
      move: 'Block movements can be safely auto-resolved using most recent change',
      parent: 'Parent changes are structural and can use latest version',
      order: 'Order conflicts are safe to auto-resolve with latest position',
      structural: 'Structural changes resolved by timestamp',
      content: 'Content resolved by timestamp',
      delete: 'Deletion resolved by timestamp',
    },
    manual: {
      content: 'Content changes should be manually reviewed to avoid data loss',
      delete: 'Deletions should be manually reviewed to prevent accidental data loss',
      structural: 'Complex structural changes need manual review',
      move: 'Block movements need review',
      parent: 'Parent changes need review',
      order: 'Order changes need review',
    },
    merge: {
      content: 'Content can be automatically merged',
      delete: 'Merge deletion with edits',
      structural: 'Merge structural changes',
      move: 'Merge movements',
      parent: 'Merge parent changes',
      order: 'Merge order changes',
    },
    'keep-both': {
      content: 'Keep both versions as separate blocks',
      delete: 'Keep both deleted and edited versions',
      structural: 'Keep both structural variants',
      move: 'Keep both positions',
      parent: 'Keep both parent relationships',
      order: 'Keep both orderings',
    },
    reject: {
      content: 'Reject incoming changes',
      delete: 'Reject deletion',
      structural: 'Reject structural changes',
      move: 'Reject movement',
      parent: 'Reject parent change',
      order: 'Reject order change',
    },
  };

  return reasons[strategy]?.[conflictType] || `Using ${strategy} strategy`;
}
