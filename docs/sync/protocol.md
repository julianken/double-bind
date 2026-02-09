# Sync Protocol Specification

## Overview

This document specifies the synchronization protocol for Double-Bind, enabling cross-device data synchronization with conflict detection and resolution. The protocol leverages CozoDB's native backup/restore capabilities for efficient full synchronization and supports incremental sync through change tracking with Hybrid Logical Clock (HLC) timestamps.

**Key Design Goals:**
- Offline-first: Devices can work independently and sync later
- Causally consistent: Operations maintain causal ordering across devices
- Conflict-aware: Detect and resolve conflicts with user control
- Efficient: Minimize data transfer through incremental sync
- Secure: Encrypt data at rest and in transit

## Protocol Version

**Current Version:** `1.0.0`

Protocol versioning follows semantic versioning. Clients must negotiate protocol version during connection establishment. Breaking changes increment the major version.

## Architecture

### Components

1. **Sync Client** - Per-device sync agent (mobile/desktop)
2. **Sync Server** - Coordination server (optional, for multi-device sync)
3. **Conflict Detector** - Identifies concurrent modifications
4. **Conflict Resolver** - Applies resolution strategies
5. **HLC Generator** - Maintains causally consistent timestamps

### Sync Modes

#### 1. Full Sync (Initial)

Uses CozoDB's native backup/restore:
- **Export**: `db.export_relations(['*'])`
- **Import**: `db.import_relations(data)`
- **Format**: CozoDB-native JSON format
- **Use case**: First-time device pairing, full restore

#### 2. Incremental Sync

Uses HLC-based change tracking:
- **Queries**: Track entities modified since last sync
- **Version vectors**: Determine causal ordering
- **Deltas**: Transfer only changed entities
- **Use case**: Regular syncing after initial setup

## Data Format

### Sync Envelope

All sync messages use a standardized envelope format:

```typescript
interface SyncEnvelope {
  // Protocol metadata
  version: string;           // Protocol version (e.g., "1.0.0")
  messageId: string;         // ULID for message deduplication
  timestamp: number;         // Unix timestamp (milliseconds)

  // Sync metadata
  nodeId: string;            // Sending device identifier (ULID)
  syncType: 'full' | 'incremental' | 'ack';

  // Payload
  payload: SyncPayload;

  // Security
  signature?: string;        // HMAC-SHA256 of payload (optional)
  encrypted?: boolean;       // Whether payload is encrypted
}
```

### Full Sync Payload

```typescript
interface FullSyncPayload {
  type: 'full';

  // Complete database snapshot
  snapshot: {
    // CozoDB export format
    relations: {
      [relationName: string]: Array<Record<string, unknown>>;
    };

    // Metadata
    exportedAt: number;      // Export timestamp
    dbVersion: string;       // Database schema version
  };

  // Version tracking
  versionVector: VersionVector;

  // Statistics
  stats: {
    totalBlocks: number;
    totalPages: number;
    totalLinks: number;
    totalProperties: number;
  };
}
```

### Incremental Sync Payload

```typescript
interface IncrementalSyncPayload {
  type: 'incremental';

  // Changes since last sync
  changes: SyncChange[];

  // Version tracking
  versionVector: VersionVector;
  lastSyncVector: VersionVector;  // What we had at last sync

  // Conflict candidates
  potentialConflicts: ConflictCandidate[];
}

interface SyncChange {
  // Entity identification
  entityId: string;          // block_id or page_id
  entityType: 'block' | 'page' | 'link' | 'property' | 'tag';

  // Operation
  operation: 'create' | 'update' | 'delete' | 'restore';

  // Version info
  version: HLCString;        // HLC timestamp of this change
  versionVector: VersionVector;  // VV at time of change

  // Entity snapshot
  snapshot: EntitySnapshot;

  // Change metadata
  modifiedBy: string;        // Node ID that made the change
  modifiedAt: number;        // Physical timestamp
}

interface EntitySnapshot {
  // Union type - actual fields depend on entityType
  [key: string]: unknown;

  // Common fields
  created_at?: number;
  updated_at?: number;
  is_deleted?: boolean;
}

interface ConflictCandidate {
  entityId: string;
  localVersion: HLCString;
  remoteVersion: HLCString;
  reason: 'concurrent_modification' | 'delete_edit' | 'structural';
}
```

### Acknowledgment Payload

```typescript
interface AckPayload {
  type: 'ack';

  // Reference to processed message
  ackMessageId: string;

  // Processing result
  status: 'success' | 'partial' | 'conflict' | 'error';

  // Updated version vector after applying changes
  versionVector: VersionVector;

  // Conflicts detected during application
  conflicts: ConflictMetadata[];

  // Error details (if status is 'error')
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

## Sync Flow

### Initial Connection

```
Client                                 Server/Peer
  |                                         |
  |--- HELLO (nodeId, version) ----------->|
  |                                         |
  |<-- HELLO_ACK (nodeId, version) --------|
  |                                         |
  |--- CAPABILITIES (syncModes, ...) ----->|
  |                                         |
  |<-- CAPABILITIES_ACK ------------------ |
  |                                         |
  [Connection established]
```

### Full Sync Flow

```
Client A                              Client B
  |                                        |
  |--- SYNC_REQUEST (full) -------------->|
  |                                        |
  |<-- FULL_SYNC (snapshot, VV) ----------|
  |                                        |
  [Apply snapshot]
  [Detect conflicts]
  |                                        |
  |--- ACK (conflicts if any) ----------->|
  |                                        |
  [If conflicts: enter conflict resolution]
```

### Incremental Sync Flow

```
Client A                              Client B
  |                                        |
  |--- SYNC_REQUEST (since: VV) -------->|
  |                                        |
  |<-- INCREMENTAL_SYNC (changes) --------|
  |                                        |
  [Compare version vectors]
  [Detect conflicts]
  [Apply non-conflicting changes]
  |                                        |
  |--- ACK (status, conflicts) ---------->|
  |                                        |
  [If conflicts: present to user]
```

### Bidirectional Sync

Both clients send changes simultaneously:

```
Client A                              Client B
  |                                        |
  |--- INCREMENTAL_SYNC (A's changes) --->|
  |<-- INCREMENTAL_SYNC (B's changes) ----|
  |                                        |
  [Both detect conflicts independently]
  |                                        |
  |--- ACK (A's view of conflicts) ------>|
  |<-- ACK (B's view of conflicts) --------|
  |                                        |
  [Conflict resolution UI on both devices]
```

## Conflict Detection

### Detection Algorithm

Conflicts are detected by comparing version vectors:

```typescript
function detectConflict(
  local: VersionedEntity,
  remote: VersionedEntity
): ConflictDetectionResult {
  // Compare version vectors
  const comparison = compareVersionVectors(
    local.versionVector,
    remote.versionVector
  );

  switch (comparison) {
    case 'before':
      // Local is older, no conflict (accept remote)
      return { hasConflict: false, winner: 'remote' };

    case 'after':
      // Remote is older, no conflict (keep local)
      return { hasConflict: false, winner: 'local' };

    case 'equal':
      // Identical versions, no conflict
      return { hasConflict: false, winner: 'equal' };

    case 'concurrent':
      // Concurrent modifications - check content
      const contentDiffers = !deepEqual(local.snapshot, remote.snapshot);

      if (!contentDiffers) {
        // Same result, no real conflict
        return { hasConflict: false, winner: 'equal' };
      }

      // Real conflict
      return {
        hasConflict: true,
        conflictType: inferConflictType(local, remote),
        localVersion: local,
        remoteVersion: remote
      };
  }
}
```

### Conflict Types

| Type | Description | Example |
|------|-------------|---------|
| `content` | Different edits to same block | User A writes "hello", User B writes "world" |
| `move` | Block moved to different locations | Block moved to different parents on different devices |
| `delete` | One device deleted, another edited | Device A deletes block, Device B edits it |
| `parent` | Conflicting parent changes | Block reparented differently |
| `order` | Conflicting position changes | Block reordered differently |
| `structural` | Tree structure violations | Creates cycles, orphans |

## Conflict Resolution

### Resolution Strategies

#### 1. Last-Write-Wins (LWW)

**When:** Structural changes (move, order, parent)
**How:** Compare HLC timestamps, newer wins

```typescript
function resolveLastWriteWins(
  local: VersionedEntity,
  remote: VersionedEntity
): VersionedEntity {
  const cmp = compareHLC(
    deserializeHLC(local.version),
    deserializeHLC(remote.version)
  );

  // Later timestamp wins
  return cmp > 0 ? local : remote;
}
```

**Pros:** Automatic, simple, deterministic
**Cons:** Can lose data, no user control

#### 2. Manual Resolution

**When:** Content conflicts, deletions
**How:** Present both versions to user, let them choose or merge

```typescript
interface ManualResolutionUI {
  conflictId: string;
  entityType: 'block' | 'page';

  options: {
    local: {
      version: HLCString;
      snapshot: EntitySnapshot;
      timestamp: number;
      device: string;
    };
    remote: {
      version: HLCString;
      snapshot: EntitySnapshot;
      timestamp: number;
      device: string;
    };
  };

  actions: {
    keepLocal: () => Promise<void>;
    keepRemote: () => Promise<void>;
    merge: (merged: EntitySnapshot) => Promise<void>;
    keepBoth: () => Promise<void>;
  };
}
```

**Pros:** No data loss, user control, preserves intent
**Cons:** Requires user action, can block sync

#### 3. Automatic Merge

**When:** Non-overlapping changes to different fields
**How:** Three-way merge using common ancestor

```typescript
function autoMerge(
  local: EntitySnapshot,
  remote: EntitySnapshot,
  ancestor: EntitySnapshot
): EntitySnapshot | null {
  // Detect which fields changed in each version
  const localChanges = detectChanges(ancestor, local);
  const remoteChanges = detectChanges(ancestor, remote);

  // Check for overlapping changes
  const overlap = localChanges.filter(field =>
    remoteChanges.includes(field)
  );

  if (overlap.length > 0) {
    // Cannot auto-merge, need manual resolution
    return null;
  }

  // Merge non-overlapping changes
  return {
    ...ancestor,
    ...localChanges.reduce((acc, field) => ({ ...acc, [field]: local[field] }), {}),
    ...remoteChanges.reduce((acc, field) => ({ ...acc, [field]: remote[field] }), {})
  };
}
```

**Pros:** Automatic for simple cases, preserves all changes
**Cons:** Limited applicability, can produce unexpected results

#### 4. Keep Both

**When:** Critical data that cannot be lost
**How:** Duplicate entity with suffix

```typescript
function keepBoth(
  local: VersionedEntity,
  remote: VersionedEntity
): [VersionedEntity, VersionedEntity] {
  // Keep remote as-is
  const remoteEntity = remote;

  // Rename local to avoid conflict
  const localEntity = {
    ...local,
    entityId: `${local.entityId}-conflict-${ulid()}`,
    snapshot: {
      ...local.snapshot,
      // For blocks: append conflict marker
      content: local.entityType === 'block'
        ? `${local.snapshot.content} [CONFLICT COPY]`
        : local.snapshot.content,
      // For pages: append conflict marker to title
      title: local.entityType === 'page'
        ? `${local.snapshot.title} (Conflict)`
        : local.snapshot.title
    }
  };

  return [localEntity, remoteEntity];
}
```

**Pros:** No data loss, both versions preserved
**Cons:** Creates duplicates, requires cleanup

### Resolution Strategy Selection

Default strategy by conflict type:

```typescript
const DEFAULT_STRATEGIES: Record<ConflictType, ConflictResolutionStrategy> = {
  content: 'manual',      // User must review
  delete: 'manual',       // User must review
  move: 'last-write-wins', // Auto-resolve by timestamp
  parent: 'last-write-wins', // Auto-resolve by timestamp
  order: 'last-write-wins', // Auto-resolve by timestamp
  structural: 'manual'    // User must review
};
```

Users can configure per-type defaults in settings.

## Version Tracking

### Hybrid Logical Clock (HLC)

HLC combines physical time with logical counter for total ordering:

```typescript
interface HybridLogicalClock {
  physical: number;  // Unix timestamp (milliseconds)
  logical: number;   // Counter for events at same physical time
  nodeId: string;    // Device identifier (ULID)
}

// String format: "physical-logical-nodeId"
// Example: "1707456123456-0-01HQXJR9K5ZFN2V8QWPM4G7XY3"
type HLCString = string;
```

**Properties:**
- **Monotonic:** Timestamps always increase locally
- **Causal:** If A happened before B, then HLC(A) < HLC(B)
- **Close to wall clock:** Logical counter usually 0

### Version Vector

Tracks causality across multiple devices:

```typescript
// Map of node IDs to their latest HLC
type VersionVector = Record<string, HLCString>;

// Example:
{
  "01HQXJR9K5ZFN2V8QWPM4G7XY3": "1707456123456-0-01HQXJR9K5ZFN2V8QWPM4G7XY3",
  "01HQXJS2A7NQP3K9XQWN5D8RB6": "1707456120000-3-01HQXJS2A7NQP3K9XQWN5D8RB6"
}
```

### Version Vector Comparison

```typescript
type VectorComparison = 'before' | 'after' | 'concurrent' | 'equal';

function compareVersionVectors(
  a: VersionVector,
  b: VersionVector
): VectorComparison {
  const allNodes = new Set([...Object.keys(a), ...Object.keys(b)]);

  let aLess = false;
  let bLess = false;

  for (const nodeId of allNodes) {
    const aTimestamp = a[nodeId];
    const bTimestamp = b[nodeId];

    if (!aTimestamp && bTimestamp) {
      aLess = true;  // a is missing updates from this node
    } else if (aTimestamp && !bTimestamp) {
      bLess = true;  // b is missing updates from this node
    } else if (aTimestamp && bTimestamp) {
      const cmp = compareHLCStrings(aTimestamp, bTimestamp);
      if (cmp < 0) aLess = true;
      if (cmp > 0) bLess = true;
    }
  }

  if (aLess && bLess) return 'concurrent';
  if (aLess) return 'before';
  if (bLess) return 'after';
  return 'equal';
}
```

## Change Tracking

### Database Schema Extensions

Add version tracking to core relations:

```datalog
# Extend blocks relation
:create blocks {
    block_id: String
    =>
    # ... existing fields ...
    version: String,          # HLC timestamp
    version_vector: String,   # JSON-encoded version vector
    last_modified_by: String  # Node ID
}

# Extend pages relation
:create pages {
    page_id: String
    =>
    # ... existing fields ...
    version: String,
    version_vector: String,
    last_modified_by: String
}

# Sync checkpoint - tracks what we've synced
:create sync_checkpoint {
    node_id: String
    =>
    last_sync_at: Float,
    version_vector: String,   # What we had after last successful sync
    status: String            # 'syncing' | 'idle' | 'conflict'
}
```

### Querying Changes

Get entities modified since last sync:

```datalog
# Get blocks changed since last sync
?[block_id, page_id, content, version, version_vector, updated_at] :=
    *blocks{
        block_id,
        page_id,
        content,
        version,
        version_vector,
        updated_at,
        last_modified_by
    },
    *sync_checkpoint{
        node_id: $peer_node_id,
        version_vector: last_vv_json
    },
    # Only include blocks modified by this node or other nodes
    # after what we've seen in the checkpoint
    needs_sync(version, last_vv_json)
```

## Security Considerations

### Encryption at Rest

**Storage:** AES-256-GCM encryption for local database
**Key derivation:** PBKDF2 from user passphrase (100,000 iterations)
**Salt:** 32-byte random salt stored separately
**IV:** Unique 12-byte IV per encrypted block

```typescript
interface EncryptionConfig {
  algorithm: 'AES-256-GCM';
  keyDerivation: {
    method: 'PBKDF2';
    hash: 'SHA-256';
    iterations: 100000;
    saltLength: 32;
  };
  ivLength: 12;
}
```

### Transport Security

**Protocol:** TLS 1.3 minimum
**Certificates:** Pinned certificates for P2P sync
**HMAC:** SHA-256 HMAC for message integrity

```typescript
interface TransportSecurity {
  tls: {
    minVersion: '1.3';
    cipherSuites: [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256'
    ];
  };
  messageAuth: {
    algorithm: 'HMAC-SHA256';
    keyLength: 32;
  };
}
```

### Authentication

**Device pairing:** QR code with shared secret
**Session tokens:** JWT with 1-hour expiry
**Refresh tokens:** 30-day expiry, device-bound

```typescript
interface AuthToken {
  // JWT payload
  nodeId: string;           // Device identifier
  issuedAt: number;         // Unix timestamp
  expiresAt: number;        // Unix timestamp
  capabilities: string[];   // ['read', 'write', 'sync']

  // Signature
  signature: string;        // HMAC-SHA256
}
```

### Authorization

**Operations:** Read, Write, Delete, Admin
**Scope:** Per-device, per-user
**Audit:** All sync operations logged

```typescript
type Permission = 'read' | 'write' | 'delete' | 'admin';

interface DevicePermissions {
  nodeId: string;
  userId: string;
  permissions: Permission[];
  grantedAt: number;
  grantedBy: string;
}
```

## Error Handling

### Error Categories

```typescript
type SyncErrorCode =
  | 'NETWORK_ERROR'           // Connection failed
  | 'PROTOCOL_VERSION_MISMATCH' // Incompatible protocol versions
  | 'INVALID_MESSAGE'         // Malformed message
  | 'CONFLICT_DETECTED'       // Conflict requires resolution
  | 'STORAGE_ERROR'           // Database write failed
  | 'AUTHENTICATION_FAILED'   // Invalid credentials
  | 'PERMISSION_DENIED'       // Insufficient permissions
  | 'TIMEOUT'                 // Operation timed out
  | 'QUOTA_EXCEEDED';         // Storage or rate limit exceeded

interface SyncError {
  code: SyncErrorCode;
  message: string;
  details?: unknown;
  timestamp: number;
  recoverable: boolean;
}
```

### Retry Strategy

```typescript
interface RetryConfig {
  maxRetries: 3;
  initialDelay: 1000;      // 1 second
  maxDelay: 30000;         // 30 seconds
  backoffMultiplier: 2;    // Exponential backoff
  jitter: 0.1;             // ±10% randomization
}

// Retry delays: 1s, 2s, 4s
// With jitter: ~0.9-1.1s, ~1.8-2.2s, ~3.6-4.4s
```

### Idempotency

All sync operations are idempotent:
- Messages include unique `messageId` (ULID)
- Duplicate messages are detected and ignored
- Applying same change twice produces same result

```typescript
// Message deduplication cache
interface ProcessedMessages {
  messageId: string;
  processedAt: number;
  result: 'success' | 'conflict' | 'error';
}

// Keep cache for 24 hours
const MESSAGE_CACHE_TTL = 24 * 60 * 60 * 1000;
```

## Performance Optimization

### Batching

Combine multiple changes into single message:

```typescript
interface BatchConfig {
  maxBatchSize: 100;        // Max entities per batch
  maxBatchBytes: 1048576;   // 1 MB max payload
  batchTimeout: 5000;       // 5 seconds max wait
}
```

### Compression

Compress large payloads:

```typescript
interface CompressionConfig {
  algorithm: 'gzip';
  level: 6;                 // Balance speed/ratio
  threshold: 1024;          // Only compress if > 1 KB
}
```

### Delta Encoding

For incremental sync, send only changed fields:

```typescript
interface EntityDelta {
  entityId: string;
  version: HLCString;

  // Only include changed fields
  changes: {
    [field: string]: {
      old: unknown;
      new: unknown;
    };
  };
}
```

### Pagination

For large initial syncs:

```typescript
interface PaginationConfig {
  pageSize: 1000;           // Entities per page
  cursor?: string;          // Continuation token
}
```

## Implementation Checklist

### Phase 1: Foundation
- [ ] Define TypeScript types in `packages/types/src/sync.ts`
- [ ] Implement HLC generation and comparison
- [ ] Implement version vector operations
- [ ] Add version tracking to database schema

### Phase 2: Conflict Detection
- [ ] Implement conflict detection algorithm
- [ ] Create in-memory conflict store
- [ ] Add conflict detection tests
- [ ] Create conflict UI components

### Phase 3: Full Sync
- [ ] Implement CozoDB export
- [ ] Implement CozoDB import
- [ ] Add version vector to sync payload
- [ ] Test full sync flow

### Phase 4: Incremental Sync
- [ ] Implement change tracking queries
- [ ] Implement delta generation
- [ ] Add incremental sync protocol
- [ ] Test incremental sync flow

### Phase 5: Conflict Resolution
- [ ] Implement resolution strategies
- [ ] Create resolution UI
- [ ] Add manual resolution flow
- [ ] Test all conflict types

### Phase 6: Security
- [ ] Implement encryption at rest
- [ ] Add TLS for transport
- [ ] Implement device authentication
- [ ] Add audit logging

### Phase 7: Optimization
- [ ] Add batching
- [ ] Add compression
- [ ] Implement pagination
- [ ] Add delta encoding

## References

1. **HLC Paper:** "Logical Physical Clocks and Consistent Snapshots in Globally Distributed Databases" (Kulkarni et al., 2014)
2. **CozoDB Documentation:** https://docs.cozodb.org/
3. **CRDTs:** "A comprehensive study of Convergent and Commutative Replicated Data Types" (Shapiro et al., 2011)
4. **Conflict-free sync:** "Local-first software: You own your data, in spite of the cloud" (Kleppmann et al., 2019)

## Appendix A: Message Examples

### Full Sync Request

```json
{
  "version": "1.0.0",
  "messageId": "01HQXJR9K5ZFN2V8QWPM4G7XY3",
  "timestamp": 1707456123456,
  "nodeId": "01HQXJR9K5ZFN2V8QWPM4G7XY3",
  "syncType": "full",
  "payload": {
    "type": "full",
    "snapshot": {
      "relations": {
        "blocks": [
          {
            "block_id": "01HQXJRA2BCD3EF4GHIJK5LMN",
            "page_id": "01HQXJR9PQRS6TU7VWXYZ8ABC",
            "content": "Hello world",
            "version": "1707456123456-0-01HQXJR9K5ZFN2V8QWPM4G7XY3"
          }
        ],
        "pages": [
          {
            "page_id": "01HQXJR9PQRS6TU7VWXYZ8ABC",
            "title": "My Page",
            "version": "1707456123000-0-01HQXJR9K5ZFN2V8QWPM4G7XY3"
          }
        ]
      },
      "exportedAt": 1707456123456,
      "dbVersion": "1.0.0"
    },
    "versionVector": {
      "01HQXJR9K5ZFN2V8QWPM4G7XY3": "1707456123456-0-01HQXJR9K5ZFN2V8QWPM4G7XY3"
    },
    "stats": {
      "totalBlocks": 1,
      "totalPages": 1,
      "totalLinks": 0,
      "totalProperties": 0
    }
  }
}
```

### Incremental Sync with Conflict

```json
{
  "version": "1.0.0",
  "messageId": "01HQXJS2A7NQP3K9XQWN5D8RB6",
  "timestamp": 1707456130000,
  "nodeId": "01HQXJS2A7NQP3K9XQWN5D8RB6",
  "syncType": "incremental",
  "payload": {
    "type": "incremental",
    "changes": [
      {
        "entityId": "01HQXJRA2BCD3EF4GHIJK5LMN",
        "entityType": "block",
        "operation": "update",
        "version": "1707456130000-0-01HQXJS2A7NQP3K9XQWN5D8RB6",
        "versionVector": {
          "01HQXJS2A7NQP3K9XQWN5D8RB6": "1707456130000-0-01HQXJS2A7NQP3K9XQWN5D8RB6"
        },
        "snapshot": {
          "block_id": "01HQXJRA2BCD3EF4GHIJK5LMN",
          "page_id": "01HQXJR9PQRS6TU7VWXYZ8ABC",
          "content": "Hello universe",
          "updated_at": 1707456130000
        },
        "modifiedBy": "01HQXJS2A7NQP3K9XQWN5D8RB6",
        "modifiedAt": 1707456130000
      }
    ],
    "versionVector": {
      "01HQXJS2A7NQP3K9XQWN5D8RB6": "1707456130000-0-01HQXJS2A7NQP3K9XQWN5D8RB6"
    },
    "lastSyncVector": {
      "01HQXJR9K5ZFN2V8QWPM4G7XY3": "1707456123456-0-01HQXJR9K5ZFN2V8QWPM4G7XY3"
    },
    "potentialConflicts": [
      {
        "entityId": "01HQXJRA2BCD3EF4GHIJK5LMN",
        "localVersion": "1707456125000-0-01HQXJR9K5ZFN2V8QWPM4G7XY3",
        "remoteVersion": "1707456130000-0-01HQXJS2A7NQP3K9XQWN5D8RB6",
        "reason": "concurrent_modification"
      }
    ]
  }
}
```

## Appendix B: Type Definitions

See `packages/types/src/sync.ts` for complete TypeScript type definitions of all protocol messages, payloads, and data structures.
