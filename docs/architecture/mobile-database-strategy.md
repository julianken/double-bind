# Mobile Database Strategy

## Executive Summary

This document defines the CozoDB integration strategy for Double-Bind mobile applications, providing a unified database abstraction that works across desktop (cozo-node + RocksDB), iOS (CozoSwiftBridge + SQLite), and Android (cozo_android + SQLite).

## Current Desktop Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│                  (TypeScript/Zustand)                    │
└─────────────────────────┬───────────────────────────────┘
                          │ Tauri IPC
┌─────────────────────────┴───────────────────────────────┐
│                    Rust Shim (~40 lines)                 │
│   query() │ mutate() │ importRelations() │ backup()     │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│           CozoDB (cozo crate + RocksDB storage)          │
└─────────────────────────────────────────────────────────┘
```

The existing `GraphDB` interface (in `packages/types/src/graph-db.ts`) already provides the abstraction layer needed for cross-platform support.

---

## Platform Binding Analysis

### iOS: CozoSwiftBridge

**Package**: `CozoSwiftBridge` via CocoaPods (`pod 'CozoSwiftBridge', '~> 0.7.1'`)

**Supported Platforms**:
- iOS (ARM64, simulators)
- macOS (ARM64, x86_64)

**Storage Engines**:
- `mem` - In-memory (non-persistent)
- `sqlite` - SQLite file storage (recommended for mobile)
- RocksDB is **not available** in prebuilt binaries (requires custom build)

**API Surface**:
```swift
public class CozoDB {
    // Initialization
    public init()  // In-memory
    public init(kind: String, path: String) throws  // "sqlite" + file path

    // Core operations
    public func run(_ query: String) throws -> [NamedRow]
    public func run(_ query: String, params: JSON) throws -> [NamedRow]

    // Data transfer
    public func exportRelations(relations: [String]) throws -> JSON
    public func importRelations(data: JSON) throws

    // Persistence
    public func backup(path: String) throws
    public func restore(path: String) throws
    public func importRelationsFromBackup(path: String, relations: [String]) throws
}
```

**Thread Safety**: CozoDB's Rust core is thread-safe. Swift wrapper methods can be called from any thread, but results should be dispatched to the main thread for UI updates.

**Memory Management**: `CozoDB` is a class (reference type). No explicit `close()` method in Swift bindings; resources are released on deinit.

### Android: cozo_android

**Package**: Maven Central `implementation 'io.github.cozodb:cozo_android:0.7.2'`

**Supported Architectures**:
- `arm64-v8a` (most modern devices)
- `armeabi-v7a` (older 32-bit devices)
- `x86_64` (emulators, Chromebooks)
- `x86` (older emulators)

**Storage Engines**:
- `mem` - In-memory
- `sqlite` - SQLite file storage (recommended)
- RocksDB requires **manual cross-compilation** with NDK (not recommended for mobile)

**API Surface** (Java/Kotlin):
```kotlin
class CozoDB {
    // Initialization
    constructor()  // In-memory
    constructor(engine: String, path: String)  // "sqlite" + file path

    // Core operations
    fun run(script: String): String  // Returns JSON
    fun run(script: String, params: String): String  // params as JSON string

    // Data transfer
    fun exportRelations(relations: String): String  // relations as JSON array
    fun importRelations(data: String)  // data as JSON object

    // Persistence
    fun backup(path: String)
    fun restore(path: String)
    fun importRelationsFromBackup(path: String, relations: String)

    // Lifecycle
    fun close()  // MUST be called to release native resources
}
```

**Thread Safety**: JNI calls are thread-safe. Use Kotlin coroutines with `Dispatchers.IO` for database operations.

**Memory Management**: **Critical** - `close()` must be called when done. Use `use {}` block or `Closeable` pattern.

---

## Storage Backend Comparison

### RocksDB (Desktop)

| Aspect | Characteristics |
|--------|----------------|
| Write Performance | Excellent (LSM-tree optimized for writes) |
| Read Performance | Good (with bloom filters) |
| Memory Usage | Higher (block cache, memtables) |
| Binary Size | ~15-20MB added |
| Compression | Built-in LZ4/Snappy/Zstd |
| Concurrent Access | Excellent (MVCC) |
| Mobile Suitability | Poor (memory overhead, complex build) |

### SQLite (Mobile)

| Aspect | Characteristics |
|--------|----------------|
| Write Performance | Good (WAL mode) |
| Read Performance | Excellent |
| Memory Usage | Low (~1-2MB) |
| Binary Size | ~1MB (often already bundled) |
| Compression | None built-in |
| Concurrent Access | Good (WAL allows concurrent reads) |
| Mobile Suitability | Excellent (designed for embedded) |

### Performance Implications

CozoDB's query execution happens in Rust regardless of storage backend. The storage backend affects:

1. **Write throughput**: RocksDB slightly faster for bulk writes
2. **Read latency**: Similar for indexed lookups
3. **Memory footprint**: SQLite uses ~5-10x less memory
4. **Startup time**: SQLite faster (~10-50ms vs ~100-200ms)

For Double-Bind's workload (note-taking, not high-frequency writes), SQLite is sufficient and preferred on mobile.

---

## Cross-Platform Data Migration

### Backup Format Compatibility

CozoDB's `backup()` and `restore()` use a **storage-agnostic SQLite format**. This is critical:

```
RocksDB database → backup() → SQLite backup file → restore() → SQLite database
```

The backup format is the same regardless of the source storage engine. This enables:

1. **Desktop-to-mobile sync**: Export from RocksDB, import to SQLite
2. **Cross-device restore**: Any backup works on any platform
3. **Future-proofing**: Storage engine can change without data loss

### Migration Strategy

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Desktop         │     │   Sync Server    │     │  Mobile          │
│  (RocksDB)       │     │   (Optional)     │     │  (SQLite)        │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         │  backup()              │                        │
         ├───────────────────────►│                        │
         │  SQLite backup file    │                        │
         │                        │  Transfer              │
         │                        ├───────────────────────►│
         │                        │                        │
         │                        │                        │  restore()
         │                        │                        ├──────────►
         │                        │                        │
```

### Export/Import for Incremental Sync

For efficient sync without full backup:

```typescript
// Desktop: export changed relations
const changes = await db.exportRelations(['blocks', 'pages', 'links']);

// Mobile: import changes
await db.importRelations(changes);
```

**Note**: `importRelations` does NOT trigger CozoDB triggers. If triggers are needed, use parameterized insert queries instead.

---

## Database Initialization Lifecycle

### iOS Lifecycle

```swift
import CozoSwiftBridge

class DatabaseManager {
    private var db: CozoDB?

    func initialize() throws {
        // Get Documents directory for persistent storage
        let documentsPath = FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask)
            .first!
            .appendingPathComponent("double-bind.db")
            .path

        db = try CozoDB("sqlite", documentsPath)
    }

    func shutdown() {
        // CozoDB releases resources on deinit
        db = nil
    }

    // App lifecycle integration
    func applicationWillTerminate() {
        shutdown()
    }

    func applicationDidEnterBackground() {
        // SQLite handles this gracefully; no action needed
    }
}
```

### Android Lifecycle

```kotlin
import org.cozodb.CozoDB

class DatabaseManager(private val context: Context) : Closeable {
    private var db: CozoDB? = null

    fun initialize() {
        val dbPath = context.filesDir.resolve("double-bind.db").absolutePath
        db = CozoDB("sqlite", dbPath)
    }

    override fun close() {
        db?.close()
        db = null
    }

    // Lifecycle integration
    fun onDestroy() {
        close()
    }
}

// Usage with lifecycle-aware component
class MainActivity : AppCompatActivity() {
    private lateinit var dbManager: DatabaseManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        dbManager = DatabaseManager(applicationContext)
        dbManager.initialize()
    }

    override fun onDestroy() {
        super.onDestroy()
        dbManager.close()
    }
}
```

### React Native Integration

For React Native (shared TypeScript codebase):

```typescript
// Native module interface
interface CozoNativeModule {
  initialize(path: string): Promise<void>;
  close(): Promise<void>;
  run(script: string, params: string): Promise<string>;
  exportRelations(relations: string): Promise<string>;
  importRelations(data: string): Promise<void>;
  backup(path: string): Promise<void>;
  restore(path: string): Promise<void>;
}

// Bridge to GraphDB interface
class MobileGraphDB implements GraphDB {
  constructor(private native: CozoNativeModule) {}

  async query<T>(script: string, params?: Record<string, unknown>): Promise<QueryResult<T>> {
    const result = await this.native.run(script, JSON.stringify(params ?? {}));
    return JSON.parse(result);
  }

  async mutate(script: string, params?: Record<string, unknown>): Promise<MutationResult> {
    const result = await this.native.run(script, JSON.stringify(params ?? {}));
    return JSON.parse(result);
  }

  // ... other methods
}
```

---

## Query Performance Considerations

### Mobile-Specific Optimizations

1. **Limit query scope**: Mobile devices have less memory for result sets
   ```datalog
   # Desktop: might return 10,000 blocks
   ?[block_id, content] := *blocks{ block_id, content, is_deleted: false }

   # Mobile: paginate
   ?[block_id, content] := *blocks{ block_id, content, is_deleted: false }
   :limit 100 :offset $offset
   ```

2. **Reduce JOIN complexity**: Graph algorithms consume memory proportional to graph size
   ```datalog
   # Avoid on large graphs with mobile
   ?[node] <~ ShortestPathBFS(*links[], ...)

   # Prefer bounded depth
   ?[source, target] := *links{ source_id: $start, target_id: target }
   ?[source, target] := ?[source, mid], *links{ source_id: mid, target_id: target }
   # Stop at 2 hops
   ```

3. **FTS query limits**: Full-text search returns all matches by default
   ```datalog
   # Always limit FTS on mobile
   ?[block_id, content, score] := ~blocks:fts{ block_id, content, score | query: $q }
   :limit 50
   ```

### Background Query Handling

Mobile apps must handle app suspension:

```swift
// iOS: Use background task for long queries
func runQueryInBackground(_ script: String) async throws -> [NamedRow] {
    let taskId = UIApplication.shared.beginBackgroundTask()
    defer { UIApplication.shared.endBackgroundTask(taskId) }

    return try await withCheckedThrowingContinuation { continuation in
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let result = try self.db.run(script)
                continuation.resume(returning: result)
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }
}
```

```kotlin
// Android: Use WorkManager for durable queries
class QueryWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val script = inputData.getString("script") ?: return Result.failure()
        val dbPath = inputData.getString("dbPath") ?: return Result.failure()

        return withContext(Dispatchers.IO) {
            CozoDB("sqlite", dbPath).use { db ->
                val result = db.run(script)
                Result.success(workDataOf("result" to result))
            }
        }
    }
}
```

---

## Memory and Battery Optimization

### Memory Management

| Strategy | Implementation |
|----------|---------------|
| Lazy loading | Don't load all blocks on page open; load visible + buffer |
| Result streaming | Process results row-by-row, don't materialize full result set |
| Cache eviction | Limit in-memory block cache to ~100 recently accessed |
| Query cancellation | Cancel pending queries on navigation |

### Battery Considerations

1. **Batch writes**: Collect mutations, apply in single transaction
   ```typescript
   // Bad: individual writes
   for (const block of blocks) {
     await db.mutate(':put blocks {...}', block);
   }

   // Good: batch write
   const script = `
     ?[...] <- $blocks
     :put blocks { ... }
   `;
   await db.mutate(script, { blocks: blocks.map(toRow) });
   ```

2. **Debounce autosave**: Don't persist every keystroke
   ```typescript
   const debouncedSave = useMemo(
     () => debounce((content) => db.mutate(...), 1000),
     [db]
   );
   ```

3. **Avoid polling**: Use reactive patterns, not repeated queries
   ```typescript
   // Bad: poll for changes
   setInterval(() => db.query('?[...] := ...'), 1000);

   // Good: invalidate on known mutations
   const queryClient = useQueryClient();
   await db.mutate(...);
   queryClient.invalidateQueries(['blocks', pageId]);
   ```

---

## Unified Interface Definition

### TypeScript (Cross-Platform Core)

```typescript
// packages/types/src/graph-db.ts (existing, no changes needed)
export interface GraphDB {
  query<T = unknown>(
    script: string,
    params?: Record<string, unknown>
  ): Promise<QueryResult<T>>;

  mutate(
    script: string,
    params?: Record<string, unknown>
  ): Promise<MutationResult>;

  importRelations(data: Record<string, unknown[][]>): Promise<void>;
  exportRelations(relations: string[]): Promise<Record<string, unknown[][]>>;
  backup(path: string): Promise<void>;
}

// New: Platform-specific configuration
export interface GraphDBConfig {
  engine: 'rocksdb' | 'sqlite' | 'mem';
  path: string;
}

// New: Factory function signature
export type GraphDBFactory = (config: GraphDBConfig) => Promise<GraphDB>;
```

### Swift Protocol

```swift
// ios/DoubleBindCore/Sources/GraphDB.swift

import Foundation

public struct QueryResult<T: Decodable>: Decodable {
    public let headers: [String]
    public let rows: [[T]]
}

public struct MutationResult: Decodable {
    public let headers: [String]
    public let rows: [[Any]]
}

public protocol GraphDB {
    func query<T: Decodable>(_ script: String, params: [String: Any]?) async throws -> QueryResult<T>
    func mutate(_ script: String, params: [String: Any]?) async throws -> MutationResult
    func importRelations(_ data: [String: [[Any]]]) async throws
    func exportRelations(_ relations: [String]) async throws -> [String: [[Any]]]
    func backup(to path: String) async throws
}

// Implementation
public final class CozoGraphDB: GraphDB {
    private let db: CozoDB

    public init(engine: String = "sqlite", path: String) throws {
        self.db = try CozoDB(kind: engine, path: path)
    }

    public func query<T: Decodable>(_ script: String, params: [String: Any]? = nil) async throws -> QueryResult<T> {
        return try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    let paramsJSON = try JSONSerialization.data(withJSONObject: params ?? [:])
                    let result = try self.db.run(script, params: paramsJSON)
                    // Parse result to QueryResult<T>
                    continuation.resume(returning: result)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    public func mutate(_ script: String, params: [String: Any]? = nil) async throws -> MutationResult {
        // Same pattern as query
    }

    public func importRelations(_ data: [String: [[Any]]]) async throws {
        let json = try JSONSerialization.data(withJSONObject: data)
        try db.importRelations(data: json)
    }

    public func exportRelations(_ relations: [String]) async throws -> [String: [[Any]]] {
        let result = try db.exportRelations(relations: relations)
        return result as? [String: [[Any]]] ?? [:]
    }

    public func backup(to path: String) async throws {
        try db.backup(path: path)
    }
}
```

### Kotlin Interface

```kotlin
// android/core/src/main/kotlin/com/doublebind/core/GraphDB.kt

package com.doublebind.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.cozodb.CozoDB
import java.io.Closeable

@Serializable
data class QueryResult<T>(
    val headers: List<String>,
    val rows: List<List<T>>
)

@Serializable
data class MutationResult(
    val headers: List<String>,
    val rows: List<List<Any?>>
)

interface GraphDB : Closeable {
    suspend fun <T> query(script: String, params: Map<String, Any?> = emptyMap()): QueryResult<T>
    suspend fun mutate(script: String, params: Map<String, Any?> = emptyMap()): MutationResult
    suspend fun importRelations(data: Map<String, List<List<Any?>>>)
    suspend fun exportRelations(relations: List<String>): Map<String, List<List<Any?>>>
    suspend fun backup(path: String)
}

class CozoGraphDB(
    engine: String = "sqlite",
    path: String
) : GraphDB {

    private val db = CozoDB(engine, path)
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun <T> query(
        script: String,
        params: Map<String, Any?>
    ): QueryResult<T> = withContext(Dispatchers.IO) {
        val paramsJson = json.encodeToString(params)
        val resultJson = db.run(script, paramsJson)
        json.decodeFromString(resultJson)
    }

    override suspend fun mutate(
        script: String,
        params: Map<String, Any?>
    ): MutationResult = withContext(Dispatchers.IO) {
        val paramsJson = json.encodeToString(params)
        val resultJson = db.run(script, paramsJson)
        json.decodeFromString(resultJson)
    }

    override suspend fun importRelations(data: Map<String, List<List<Any?>>>) =
        withContext(Dispatchers.IO) {
            val dataJson = json.encodeToString(data)
            db.importRelations(dataJson)
        }

    override suspend fun exportRelations(relations: List<String>): Map<String, List<List<Any?>>> =
        withContext(Dispatchers.IO) {
            val relationsJson = json.encodeToString(relations)
            val resultJson = db.exportRelations(relationsJson)
            json.decodeFromString(resultJson)
        }

    override suspend fun backup(path: String) = withContext(Dispatchers.IO) {
        db.backup(path)
    }

    override fun close() {
        db.close()
    }
}
```

---

## Implementation Roadmap

### Phase 1: Interface Validation

1. Verify `GraphDB` interface covers all mobile use cases
2. Add `restore()` method if needed for mobile-first sync
3. Add `close()` method for explicit resource cleanup (mobile requirement)

### Phase 2: Native Implementations

1. Create `ios/` directory with Swift Package
2. Create `android/` directory with Kotlin module
3. Implement `CozoGraphDB` for each platform
4. Unit test with in-memory engine

### Phase 3: React Native Bridge

1. Create native modules wrapping platform implementations
2. Expose unified JavaScript interface
3. Integration test with shared TypeScript repositories

### Phase 4: Sync Infrastructure

1. Implement conflict-free sync protocol
2. Use `exportRelations`/`importRelations` for delta sync
3. Use `backup`/`restore` for full sync

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| CozoDB maintenance stall | GraphDB interface allows swapping implementation |
| SQLite performance insufficient | Profile early; FTS and graph algorithms are Rust-side |
| RocksDB backup incompatible | Test backup/restore across engines in CI |
| Memory pressure on low-end devices | Implement query pagination, result streaming |
| JNI/Swift bridge overhead | Batch operations, minimize crossing boundary |

---

## References

- [CozoDB GitHub](https://github.com/cozodb/cozo)
- [CozoSwiftBridge](https://github.com/cozodb/cozo/tree/main/cozo-lib-swift)
- [cozo_android](https://github.com/cozodb/cozo-lib-android)
- [cozo-android-example](https://github.com/cozodb/cozo-android-example)
- [ADR-001: Use CozoDB as the Database](/docs/decisions/001-database-cozodb.md)
- [GraphDB Interface](/packages/types/src/graph-db.ts)
