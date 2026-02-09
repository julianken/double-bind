# ADR-014: Mobile Database Strategy

## Status
Proposed

## Context

Double-Bind is expanding to mobile platforms (iOS and Android). The desktop app uses CozoDB with RocksDB storage backend via Tauri IPC. Mobile platforms require a different approach due to:

1. **Storage backend limitations**: RocksDB is complex to cross-compile for mobile and has higher memory overhead
2. **Platform bindings**: Native Swift (iOS) and Kotlin (Android) bindings are needed
3. **Data portability**: Users expect to sync data between desktop and mobile
4. **Resource constraints**: Mobile devices have limited memory and battery

## Options Considered

### 1. SQLite Storage Backend on Mobile

- **Pros**:
  - Available in prebuilt CozoSwiftBridge and cozo_android packages
  - Low memory footprint (~1-2MB vs RocksDB's ~10-20MB)
  - Fast startup (~10-50ms vs ~100-200ms)
  - Universal backup format (CozoDB backups are SQLite regardless of source engine)
- **Cons**:
  - Slightly lower write throughput than RocksDB for bulk operations
  - Different storage engine than desktop (potential consistency edge cases)

### 2. RocksDB on Mobile (Custom Build)

- **Pros**: Same storage engine as desktop
- **Cons**:
  - Complex NDK/Xcode cross-compilation
  - Higher memory usage problematic on mobile
  - No prebuilt packages available
  - CozoDB maintainers explicitly advise against this

### 3. Alternative Database (SQLite + Datalog layer)

- **Pros**: More control, larger community
- **Cons**: Lose CozoDB's built-in graph algorithms, FTS, and Datalog optimization
- **Cons**: Significant rewrite of query layer

## Decision

Use **SQLite storage backend on mobile** via the official CozoDB bindings:
- iOS: `CozoSwiftBridge` (CocoaPods)
- Android: `cozo_android` (Maven Central)

Extend the existing `GraphDB` interface with methods required for mobile:
- `restore(path)`: Restore from backup file
- `importRelationsFromBackup(path, relations)`: Selective restore
- `close()`: Explicit resource cleanup (required on mobile)

## Rationale

### Storage Backend Compatibility

CozoDB's backup format is **storage-engine agnostic**. A `backup()` from RocksDB produces an SQLite file that can be `restore()`d to an SQLite-backed database. This is by design:

> "The backup format is the same regardless of the source storage engine."

This means:
- Desktop (RocksDB) can export backups
- Mobile (SQLite) can import those exact backups
- Cross-platform sync "just works" via backup/restore

### Performance Characteristics

| Metric | RocksDB (Desktop) | SQLite (Mobile) |
|--------|-------------------|-----------------|
| Memory | 10-20MB baseline | 1-2MB baseline |
| Startup | 100-200ms | 10-50ms |
| Write throughput | Excellent | Good |
| Read throughput | Good | Excellent |
| Query execution | Rust core | Rust core |

Since query execution happens in CozoDB's Rust core regardless of storage backend, the performance difference is primarily in I/O operations. For Double-Bind's workload (note-taking with occasional bulk operations), SQLite is sufficient.

### Interface Extension

The `GraphDB` interface already abstracts CozoDB, allowing:
- Mock implementations for testing
- HTTP bridge for browser testing
- Tauri IPC for desktop

Adding `restore()`, `importRelationsFromBackup()`, and `close()` maintains this abstraction while supporting mobile-specific requirements.

## Consequences

**Positive**:
- No custom cross-compilation needed
- Lower memory/battery usage on mobile
- Backup format enables seamless sync
- Existing `GraphDB` abstraction requires minimal changes
- Mobile implementations can use official CozoDB packages

**Negative**:
- Different storage engines may have subtle behavior differences (though query semantics are identical)
- Two code paths to maintain (RocksDB for desktop, SQLite for mobile)
- Need to test backup/restore across engines in CI

**Mitigations**:
- Add integration tests that backup from RocksDB and restore to SQLite
- Document any edge cases discovered during mobile development
- `GraphDB` abstraction isolates business logic from storage differences

## Implementation

See [Mobile Database Strategy](../architecture/mobile-database-strategy.md) for:
- Swift protocol and implementation
- Kotlin interface and implementation
- React Native bridge design
- Memory and battery optimization guidelines

## References

- [CozoSwiftBridge](https://github.com/cozodb/cozo/tree/main/cozo-lib-swift)
- [cozo_android](https://github.com/cozodb/cozo-lib-android)
- [ADR-001: Use CozoDB as the Database](./001-database-cozodb.md)
- [GraphDB Interface](../../packages/types/src/graph-db.ts)
