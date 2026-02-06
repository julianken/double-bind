# Contribution 3: Local-First Graph-Native Architecture

## Thesis

A graph database (CozoDB with RocksDB) running locally on consumer hardware can provide sub-10ms query response times for typical personal knowledge management operations at scale (10,000+ pages), making the "local-first" promise practical for graph-structured data without the performance compromises that typically push graph workloads to servers.

## Prior Art

### How Existing PKM Tools Store Data

| Tool | Storage | Graph Support | Performance Model |
|------|---------|--------------|-------------------|
| Roam Research | Remote server (Datomic) | Server-side Datalog | Requires internet, server-dependent |
| Logseq | Local files (Markdown/EDN) | DataScript (in-memory) | Fast reads, full re-index on load |
| Obsidian | Local files (Markdown) | In-memory link index | Fast reads, link index rebuilt on startup |
| Notion | Remote server (PostgreSQL) | None (relational) | Requires internet |
| Athens Research | Local (DataScript) | In-memory Datalog | Fast, but all data in RAM |

### Key Observations

1. **Server-dependent tools** (Roam, Notion) sacrifice local-first principles for graph capabilities
2. **File-based tools** (Logseq, Obsidian) are local-first but build in-memory indexes on every startup — startup time grows linearly with database size
3. **In-memory Datalog** (DataScript) is fast but limited by RAM and requires full reload
4. **No tool uses an embedded graph database** with persistent indexes and disk-backed storage

### The Gap

There is no PKM tool that combines:
- Local-first (all data on user's device, works offline)
- Graph-native storage (not files + in-memory index)
- Persistent indexes (no re-indexing on startup)
- Sub-10ms query performance at scale

## Technical Approach

### CozoDB as the Foundation

CozoDB is an embedded database (like SQLite) with:
- **Datalog query engine** — native graph queries
- **RocksDB storage** — persistent, indexed, crash-safe
- **Built-in graph algorithms** — no separate graph processing engine
- **Full-text search** — integrated FTS
- **Embedded deployment** — no separate server process

### Why This Is Different from "Just Use SQLite"

SQLite can store graph data in relational tables, but:

| Operation | SQLite | CozoDB |
|-----------|--------|--------|
| "All pages linked from X" | JOIN on links table | Datalog pattern match |
| "All pages within 3 hops of X" | Recursive CTE (verbose, slow) | Datalog recursion (native, fast) |
| "PageRank of all pages" | Not possible without extension | Built-in algorithm |
| "Community detection" | Not possible | Built-in algorithm |
| "Full-text search" | FTS5 extension | Built-in FTS |

CozoDB's Datalog engine optimizes graph traversal patterns that are expensive in SQL. Recursive queries (essential for graph exploration) are first-class, not bolted-on CTEs.

### Architecture: Shared Core

The core business logic runs identically in three contexts:

```
Desktop (Tauri)          CLI              TUI (Terminal)
  │                       │                 │
  invoke('query')        cozo-node         cozo-node
  │                       │                 │
  └── Rust shim ──┐      │                 │
       CozoDB     │      CozoDB            CozoDB
       (RocksDB)  │      (RocksDB)         (RocksDB)
```

The `core` package doesn't know whether it's running in a browser (via Tauri IPC), a CLI process (via cozo-node NAPI), or a terminal UI. The `GraphDB` interface abstracts the transport.

### Performance Architecture

1. **Primary key lookup** (`getById`): Direct RocksDB key scan — O(1), ~0.1ms
2. **Index scan** (`getByPage`): Prefix scan on `blocks_by_page` — O(k), ~1ms for k=100 blocks
3. **Full-text search**: CozoDB's integrated FTS — ~5ms for typical queries
4. **Graph algorithms**: CozoDB built-in — ~100ms for PageRank on 1000 nodes
5. **Write path**: `:put` with index updates — ~1ms per block (batched)

### Startup Time

Unlike file-based tools that rebuild indexes on every launch:

| Tool Model | 10 pages | 1,000 pages | 10,000 pages | 100,000 pages |
|-----------|---------|-------------|-------------|---------------|
| File-based (Logseq) | ~100ms | ~2s | ~15s | ~2min+ |
| In-memory (DataScript) | ~50ms | ~1s | ~10s | Memory limit |
| **CozoDB (RocksDB)** | ~50ms | ~50ms | ~50ms | ~50ms |

RocksDB indexes are persistent. Startup opens the database file — no re-indexing.

## Evaluation Criteria

1. **Query latency**: Benchmark common operations at increasing scale
   - `getPageBlocks(pageId)` at 100, 1000, 10000 blocks per page
   - `searchContent(query)` at 1000, 10000, 100000 total blocks
   - `getBacklinks(blockId)` at varying reference density
   - `PageRank(graph)` at 100, 1000, 10000, 100000 pages

2. **Startup time**: Measure time from process start to first query, at increasing DB sizes

3. **Memory usage**: Compare RAM consumption vs file-based + in-memory approaches

4. **Disk usage**: Measure RocksDB storage overhead vs raw data size

5. **Write throughput**: Measure blocks/second during bulk import

### Benchmark Protocol

```typescript
// Benchmark harness
async function benchmark(name: string, fn: () => Promise<void>, iterations: number = 1000) {
  // Warmup
  for (let i = 0; i < 10; i++) await fn();

  // Measure
  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const elapsed = performance.now() - start;

  console.log(`${name}: ${(elapsed / iterations).toFixed(2)}ms avg (${iterations} iterations)`);
}
```

### Target Latencies

| Operation | Target (p50) | Target (p99) |
|-----------|:---:|:---:|
| Block lookup by ID | <1ms | <5ms |
| Page load (100 blocks) | <5ms | <20ms |
| Full-text search | <10ms | <50ms |
| Backlinks for a block | <5ms | <20ms |
| PageRank (1000 pages) | <200ms | <500ms |
| Startup | <100ms | <200ms |

## Open Questions

<!-- TODO: Benchmark CozoDB vs SQLite FTS5 for text search -->
<!-- TODO: Benchmark CozoDB RocksDB vs in-memory at various scales -->
<!-- TODO: Measure RocksDB compaction impact on latency (tail latency) -->
<!-- TODO: Define dataset generation for reproducible benchmarks -->
<!-- TODO: Study CozoDB's query optimizer behavior on complex Datalog -->
<!-- TODO: Evaluate whether WAL mode or other RocksDB tuning improves write latency -->
<!-- TODO: Compare with Kuzu (another embedded graph DB) on equivalent workloads -->
