# DBB-397: Conflict Resolution Preparation - Implementation Summary

## Overview

Implemented comprehensive conflict detection and resolution infrastructure for sync preparation in the mobile platform. This provides the foundation for future sync capabilities between mobile and desktop clients.

## What Was Implemented

### 1. Type Definitions (`packages/types/src/conflict.ts`)

**Hybrid Logical Clock (HLC) Types:**
- `HybridLogicalClock`: Combines physical time with logical counter for distributed timestamps
- `HLCString`: Serialized format (`physical-logical-nodeId`)
- `VersionVector`: Maps node IDs to their latest HLC timestamps

**Conflict Metadata Types:**
- `ConflictType`: `content | move | delete | parent | order | structural`
- `ConflictState`: `detected | pending | resolved | rejected`
- `ConflictResolutionStrategy`: `last-write-wins | manual | merge | keep-both | reject`
- `ConflictMetadata`: Complete conflict information with local/remote/ancestor versions
- `Versioned`, `VersionedBlock`, `VersionedPage`: Extension interfaces for version tracking

**API Interfaces:**
- `ConflictDetectionOptions`: Configuration for conflict detection
- `ConflictDetectionResult`: Result of conflict detection operation
- `ResolveConflictInput`: Parameters for manual conflict resolution
- `ConflictResolutionHook`: Custom resolution strategy hook
- `ConflictStore`: Storage interface for conflict metadata

### 2. HLC Utilities (`packages/mobile-primitives/src/sync/hlc.ts`)

**Core HLC Functions:**
- `initHLC()`: Initialize HLC state for a node
- `generateHLC()`: Generate new HLC timestamp with monotonicity guarantee
- `updateHLC()`: Update local HLC based on received remote timestamp
- `serializeHLC()` / `deserializeHLC()`: Convert between object and string formats
- `compareHLC()`: Compare two HLC timestamps
- `happenedBefore()`: Check causal ordering
- `maxHLC()`: Get maximum from set of timestamps

**Version Vector Functions:**
- `createVersionVector()`: Create new version vector
- `updateVersionVector()`: Add/update node timestamp
- `mergeVersionVectors()`: Merge two vectors taking max timestamps
- `compareVersionVectors()`: Determine causal relationship (`before | after | concurrent | equal`)
- `vectorPrecedes()`: Check if one vector causally precedes another
- `areConcurrent()`: Detect concurrent (conflicting) versions

**Key Features:**
- Monotonic timestamp generation even with clock drift
- Causal consistency through version vectors
- Total ordering across distributed nodes
- Efficient conflict detection through vector comparison

### 3. Conflict Detection Hook (`packages/mobile-primitives/src/sync/useConflictDetection.ts`)

**Hook API:**
```typescript
const {
  detectConflict,
  getUnresolvedConflicts,
  getConflictsForEntity,
  resolveConflict,
  generateVersion,
  updateVersion,
  pruneResolvedConflicts,
} = useConflictDetection(options, conflictStore);
```

**Conflict Detection Logic:**
- Compares version vectors to determine causality
- No conflict if one version precedes the other (causal ordering)
- Conflict if versions are concurrent AND content differs
- Infers conflict type from snapshot differences:
  - `delete`: Deletion vs edit conflict
  - `parent`: Different parent block assignments
  - `order`: Different position/ordering
  - `content`: Different content edits
  - `structural`: Complex tree structure conflicts

**Resolution Strategy Suggestions:**
- Content conflicts: `manual` (to avoid data loss)
- Delete conflicts: `manual` (to prevent accidental loss)
- Order/parent conflicts: `last-write-wins` (safe for structural changes)

### 4. Conflict Store (`packages/mobile-primitives/src/sync/InMemoryConflictStore.ts`)

**In-Memory Implementation:**
- `saveConflict()`: Store conflict metadata
- `getConflict()`: Retrieve by ID
- `getConflictsForEntity()`: Get all conflicts for a block/page
- `getUnresolvedConflicts()`: Get pending conflicts
- `updateConflict()`: Modify conflict state
- `resolveConflict()`: Mark as resolved with method
- `deleteConflict()`: Remove conflict
- `pruneResolvedConflicts()`: Clean up old resolved conflicts

**Features:**
- Thread-safe in-memory storage
- Supports testing and prototyping
- Easy to replace with database-backed implementation (CozoDB/SQLite)

### 5. Comprehensive Test Coverage

**HLC Tests** (`test/sync/hlc.test.ts`): 37 tests
- Timestamp generation and monotonicity
- Clock synchronization and updates
- Serialization/deserialization
- HLC comparison and ordering
- Version vector operations
- Concurrency detection

**Conflict Store Tests** (`test/sync/InMemoryConflictStore.test.ts`): 21 tests
- CRUD operations
- Conflict state management
- Resolution workflow
- Pruning old conflicts

**Integration Tests** (`test/sync/useConflictDetection.test.ts`): 6 tests
- Version generation and updates
- Conflict store integration
- End-to-end workflows

**Total: 64 new tests with >80% coverage**

## Design Decisions

### Why Hybrid Logical Clocks?

1. **Monotonic:** Always increasing, even with clock adjustments
2. **Causal:** Preserves happened-before relationships
3. **Distributed:** Works offline without central coordination
4. **Approximate Physical Time:** Logical counter usually stays small
5. **Total Ordering:** Deterministic comparison across all nodes

Alternative Considered: Vector clocks (rejected due to unbounded growth)

### Why Version Vectors?

1. **Conflict Detection:** Efficiently detect concurrent operations
2. **Causality:** Track what each node has seen
3. **Compact:** Fixed size per node (vs. vector clocks)
4. **Merge-Friendly:** Simple max operation to merge

### Multiple Resolution Strategies

The implementation supports:

1. **Last-Write-Wins (LWW):** Automatic, simple, potentially lossy
2. **Manual:** User reviews and decides (preserves all data)
3. **Merge:** Automatic content merging (future: CRDT-based)
4. **Keep-Both:** Duplicate entities to preserve all versions
5. **Reject:** Discard incoming changes

This flexibility allows different strategies for different conflict types and user preferences.

### Future CRDT Integration

The design intentionally leaves room for CRDT (Conflict-free Replicated Data Type) integration:

- Version vectors provide the causality tracking CRDTs need
- Conflict metadata stores ancestor versions for 3-way merge
- Resolution strategies can be extended to CRDT-based automatic merge
- HLC timestamps can serve as CRDT operation timestamps

## Integration Points

### Mobile App Integration

```typescript
// In mobile-app, create a database-backed store
class CozoConflictStore implements ConflictStore {
  constructor(private db: CozoDB) {}

  async saveConflict(conflict: ConflictMetadata) {
    // Store in CozoDB
  }
  // ... implement other methods
}

// Use in components
const { detectConflict, resolveConflict } = useConflictDetection(
  { nodeId: deviceId, defaultStrategy: 'manual' },
  cozoConflictStore
);
```

### Block Operations Integration

```typescript
// When updating a block
const block = await blockRepo.getBlock(blockId);
const newVersion = generateVersion();
const versionVector = updateVersionVector(
  block.versionVector,
  nodeId,
  newVersion
);

await blockRepo.updateBlock({
  ...block,
  content: newContent,
  version: newVersion,
  versionVector,
  lastModifiedBy: nodeId,
});
```

### Sync Integration

```typescript
// During sync, detect conflicts
const result = await detectConflict({
  entityId: block.blockId,
  entityType: 'block',
  localVersion: {
    timestamp: localBlock.version,
    snapshot: localBlock,
    versionVector: localBlock.versionVector,
  },
  remoteVersion: {
    timestamp: remoteBlock.version,
    snapshot: remoteBlock,
    versionVector: remoteBlock.versionVector,
  },
});

if (result.hasConflict) {
  // Show conflict resolution UI
  showConflictDialog(result.conflict);
}
```

## Files Created

```
packages/types/src/conflict.ts (285 lines)
packages/mobile-primitives/src/sync/hlc.ts (386 lines)
packages/mobile-primitives/src/sync/useConflictDetection.ts (422 lines)
packages/mobile-primitives/src/sync/InMemoryConflictStore.ts (125 lines)
packages/mobile-primitives/src/sync/index.ts (30 lines)
packages/mobile-primitives/test/sync/hlc.test.ts (472 lines)
packages/mobile-primitives/test/sync/InMemoryConflictStore.test.ts (233 lines)
packages/mobile-primitives/test/sync/useConflictDetection.test.ts (116 lines)
```

**Total: ~2,069 lines of production code and tests**

## Files Modified

```
packages/types/src/index.ts
packages/mobile-primitives/src/index.ts
packages/mobile-primitives/package.json (added ulid dependency)
```

## Test Results

```
packages/types: ✓ 143 tests passed
packages/mobile-primitives: ✓ 233 tests passed (includes 64 new conflict resolution tests)
```

All tests pass. Lint and type checks pass for new code.

## Acceptance Criteria

- [x] Conflict detection infrastructure
- [x] Version tracking per block (HLC + version vectors)
- [x] Conflict metadata stored (ConflictMetadata type + ConflictStore)
- [x] Hooks for resolution UI (useConflictDetection hook)
- [x] Comprehensive unit tests (64 tests, >80% coverage)

## Next Steps

### Immediate (Epic 6 continuation):
1. Integrate version tracking into block/page repositories
2. Add version fields to database schema
3. Create conflict resolution UI components
4. Implement database-backed ConflictStore for CozoDB

### Future (Post-Epic 6):
1. Implement sync protocol using conflict detection
2. Add CRDT-based automatic merge for certain conflict types
3. Implement three-way merge for content conflicts
4. Add conflict history and audit trail
5. Support for offline conflict resolution queue

## Technical Notes

- **Offline-First:** All conflict detection works without network
- **No Central Coordinator:** Fully distributed, peer-to-peer friendly
- **Storage Agnostic:** ConflictStore interface can use any backend
- **Type-Safe:** Full TypeScript types throughout
- **Testable:** Pure functions, mockable dependencies
- **Extensible:** Easy to add new conflict types and resolution strategies

## References

- **HLC Paper:** "Logical Physical Clocks and Consistent Snapshots in Globally Distributed Databases" (Kulkarni et al., 2014)
- **Version Vectors:** "Detecting Causal Relationships in Distributed Computations" (Fidge, 1988)
- **CRDTs:** "Conflict-free Replicated Data Types" (Shapiro et al., 2011)
