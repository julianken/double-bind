/**
 * Hybrid Logical Clock (HLC) utilities for version tracking.
 *
 * Implements HLC algorithm for distributed timestamp generation.
 * HLC combines physical time with a logical counter to provide
 * monotonic, causally-consistent timestamps even in the presence
 * of clock drift and network partitions.
 *
 * Reference: "Logical Physical Clocks and Consistent Snapshots in
 * Globally Distributed Databases" (Kulkarni et al., 2014)
 */

import type { HybridLogicalClock, HLCString, VersionVector } from '@double-bind/types';

// ============================================================================
// HLC Generation
// ============================================================================

/**
 * Internal state for HLC generation.
 * Maintains last known physical time and logical counter.
 */
interface HLCState {
  lastPhysical: number;
  lastLogical: number;
  nodeId: string;
}

// Global state per node (singleton pattern)
const hlcState = new Map<string, HLCState>();

/**
 * Initialize HLC state for a node.
 *
 * @param nodeId - Unique identifier for this node/device
 */
export function initHLC(nodeId: string): void {
  if (!hlcState.has(nodeId)) {
    hlcState.set(nodeId, {
      lastPhysical: 0,
      lastLogical: 0,
      nodeId,
    });
  }
}

/**
 * Generate a new HLC timestamp for the current node.
 *
 * Ensures monotonicity by comparing with last generated timestamp
 * and incrementing logical counter if necessary.
 *
 * @param nodeId - Unique identifier for this node/device
 * @param physicalTime - Optional physical time (defaults to Date.now())
 * @returns New HLC timestamp
 */
export function generateHLC(nodeId: string, physicalTime?: number): HybridLogicalClock {
  // Initialize if needed
  if (!hlcState.has(nodeId)) {
    initHLC(nodeId);
  }

  const state = hlcState.get(nodeId)!;
  const physical = physicalTime ?? Date.now();

  let logical: number;

  if (physical > state.lastPhysical) {
    // Physical time advanced, reset logical counter
    logical = 0;
  } else if (physical === state.lastPhysical) {
    // Same physical time, increment logical counter
    logical = state.lastLogical + 1;
  } else {
    // Physical time went backwards (clock adjustment)
    // Use last physical time and increment logical counter
    logical = state.lastLogical + 1;
  }

  // Update state
  state.lastPhysical = Math.max(physical, state.lastPhysical);
  state.lastLogical = logical;

  return {
    physical: state.lastPhysical,
    logical,
    nodeId,
  };
}

/**
 * Update HLC state based on received timestamp (for sync).
 *
 * Ensures causal consistency by advancing local clock to be
 * greater than both local and received timestamps.
 *
 * @param nodeId - Local node ID
 * @param received - Received HLC from remote node
 * @returns New HLC timestamp that is greater than both
 */
export function updateHLC(nodeId: string, received: HybridLogicalClock): HybridLogicalClock {
  // Initialize if needed
  if (!hlcState.has(nodeId)) {
    initHLC(nodeId);
  }

  const state = hlcState.get(nodeId)!;
  const physical = Date.now();

  // Take maximum of all physical times
  const maxPhysical = Math.max(physical, state.lastPhysical, received.physical);

  let logical: number;

  if (maxPhysical === physical && physical > state.lastPhysical && physical > received.physical) {
    // Physical time advanced beyond both, reset logical
    logical = 0;
  } else if (maxPhysical === state.lastPhysical && state.lastPhysical === received.physical) {
    // All three have same physical time
    logical = Math.max(state.lastLogical, received.logical) + 1;
  } else if (maxPhysical === state.lastPhysical && state.lastPhysical > received.physical) {
    // Local physical time is ahead
    logical = state.lastLogical + 1;
  } else if (maxPhysical === received.physical && received.physical > state.lastPhysical) {
    // Received physical time is ahead
    logical = received.logical + 1;
  } else {
    // Physical time advanced but there was a tie
    logical = Math.max(state.lastLogical, received.logical) + 1;
  }

  // Update state
  state.lastPhysical = maxPhysical;
  state.lastLogical = logical;

  return {
    physical: maxPhysical,
    logical,
    nodeId,
  };
}

// ============================================================================
// HLC Serialization
// ============================================================================

/**
 * Serialize HLC to string format.
 *
 * Format: `physical-logical-nodeId`
 * Example: `1707456123456-0-device123`
 *
 * @param hlc - HLC to serialize
 * @returns Serialized string
 */
export function serializeHLC(hlc: HybridLogicalClock): HLCString {
  return `${hlc.physical}-${hlc.logical}-${hlc.nodeId}`;
}

/**
 * Deserialize HLC from string format.
 *
 * @param hlcString - Serialized HLC string
 * @returns Parsed HLC object
 * @throws Error if format is invalid
 */
export function deserializeHLC(hlcString: HLCString): HybridLogicalClock {
  const parts = hlcString.split('-');
  if (parts.length < 3) {
    throw new Error(`Invalid HLC string format: ${hlcString}`);
  }

  const physical = parseInt(parts[0], 10);
  const logical = parseInt(parts[1], 10);
  const nodeId = parts.slice(2).join('-'); // Handle node IDs with dashes

  if (isNaN(physical) || isNaN(logical)) {
    throw new Error(`Invalid HLC string format: ${hlcString}`);
  }

  return { physical, logical, nodeId };
}

// ============================================================================
// HLC Comparison
// ============================================================================

/**
 * Compare two HLC timestamps.
 *
 * @param a - First HLC
 * @param b - Second HLC
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareHLC(a: HybridLogicalClock, b: HybridLogicalClock): number {
  // First compare physical time
  if (a.physical < b.physical) return -1;
  if (a.physical > b.physical) return 1;

  // Physical times equal, compare logical counter
  if (a.logical < b.logical) return -1;
  if (a.logical > b.logical) return 1;

  // Both equal, compare node IDs for deterministic total order
  if (a.nodeId < b.nodeId) return -1;
  if (a.nodeId > b.nodeId) return 1;

  return 0;
}

/**
 * Compare two HLC strings.
 *
 * @param a - First HLC string
 * @param b - Second HLC string
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareHLCStrings(a: HLCString, b: HLCString): number {
  return compareHLC(deserializeHLC(a), deserializeHLC(b));
}

/**
 * Check if HLC a happened before HLC b.
 *
 * @param a - First HLC
 * @param b - Second HLC
 * @returns true if a < b
 */
export function happenedBefore(a: HybridLogicalClock, b: HybridLogicalClock): boolean {
  return compareHLC(a, b) < 0;
}

/**
 * Get the maximum HLC from a set of timestamps.
 *
 * @param timestamps - Array of HLCs
 * @returns Maximum HLC
 */
export function maxHLC(timestamps: HybridLogicalClock[]): HybridLogicalClock {
  if (timestamps.length === 0) {
    throw new Error('Cannot get max of empty array');
  }

  return timestamps.reduce((max, current) => (compareHLC(current, max) > 0 ? current : max));
}

// ============================================================================
// Version Vector Operations
// ============================================================================

/**
 * Create a new version vector with a single entry.
 *
 * @param nodeId - Node ID
 * @param timestamp - HLC timestamp string
 * @returns Version vector
 */
export function createVersionVector(nodeId: string, timestamp: HLCString): VersionVector {
  return { [nodeId]: timestamp };
}

/**
 * Update version vector with a new timestamp.
 *
 * @param vector - Existing version vector
 * @param nodeId - Node ID to update
 * @param timestamp - New timestamp
 * @returns Updated version vector (immutable)
 */
export function updateVersionVector(
  vector: VersionVector,
  nodeId: string,
  timestamp: HLCString
): VersionVector {
  return {
    ...vector,
    [nodeId]: timestamp,
  };
}

/**
 * Merge two version vectors, taking maximum timestamp for each node.
 *
 * @param a - First version vector
 * @param b - Second version vector
 * @returns Merged version vector
 */
export function mergeVersionVectors(a: VersionVector, b: VersionVector): VersionVector {
  const result: VersionVector = { ...a };

  for (const [nodeId, timestamp] of Object.entries(b)) {
    if (!result[nodeId] || compareHLCStrings(timestamp, result[nodeId]) > 0) {
      result[nodeId] = timestamp;
    }
  }

  return result;
}

/**
 * Compare version vectors for causal ordering.
 *
 * @param a - First version vector
 * @param b - Second version vector
 * @returns 'before' if a < b, 'after' if a > b, 'concurrent' if concurrent, 'equal' if equal
 */
export function compareVersionVectors(
  a: VersionVector,
  b: VersionVector
): 'before' | 'after' | 'concurrent' | 'equal' {
  const allNodes = new Set([...Object.keys(a), ...Object.keys(b)]);

  let aLess = false;
  let bLess = false;

  for (const nodeId of allNodes) {
    const aTimestamp = a[nodeId];
    const bTimestamp = b[nodeId];

    if (!aTimestamp && bTimestamp) {
      // a is missing this node, a is behind
      aLess = true;
    } else if (aTimestamp && !bTimestamp) {
      // b is missing this node, b is behind
      bLess = true;
    } else if (aTimestamp && bTimestamp) {
      const cmp = compareHLCStrings(aTimestamp, bTimestamp);
      if (cmp < 0) {
        // a's timestamp is less than b's
        aLess = true;
      } else if (cmp > 0) {
        // a's timestamp is greater than b's
        bLess = true;
      }
    }
  }

  if (aLess && bLess) {
    return 'concurrent'; // Both have changes the other doesn't
  }
  if (aLess) {
    return 'before'; // a < b
  }
  if (bLess) {
    return 'after'; // a > b
  }
  return 'equal'; // a == b
}

/**
 * Check if version vector A causally precedes version vector B.
 *
 * A precedes B if all of A's timestamps are <= corresponding timestamps in B,
 * and at least one is strictly less.
 *
 * @param a - First version vector
 * @param b - Second version vector
 * @returns true if A precedes B
 */
export function vectorPrecedes(a: VersionVector, b: VersionVector): boolean {
  const comparison = compareVersionVectors(a, b);
  return comparison === 'before';
}

/**
 * Detect if two version vectors are concurrent (conflict).
 *
 * @param a - First version vector
 * @param b - Second version vector
 * @returns true if vectors are concurrent (neither precedes the other)
 */
export function areConcurrent(a: VersionVector, b: VersionVector): boolean {
  return compareVersionVectors(a, b) === 'concurrent';
}
