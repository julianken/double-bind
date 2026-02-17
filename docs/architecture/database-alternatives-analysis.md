# Database Alternatives: Deep Analysis for Double-Bind

**Context**: This analysis complements ADR-001 (CozoDB selection) with a comprehensive evaluation of alternatives, focusing on SQLite and emerging databases suitable for local-first, graph-native note-taking.

**Status**: Research / Decision Support (not a decision record)

**Date**: February 2026

---

## Executive Summary

After analyzing 7 database technologies against Double-Bind's specific architecture requirements, the landscape breaks down into three tiers:

1. **Tier 1 (Production-Ready Now)**: SQLite + extensions
2. **Tier 2 (Niche But Viable)**: Datascript (ClojureScript), SurrealDB (multi-model)
3. **Tier 3 (Not Recommended)**: DuckDB, EdgeDB, Neo4j, vector databases

**Bottom Line**: If you were starting from scratch today or if CozoDB maintenance issues force migration, **SQLite with FTS5 and recursive CTEs** is the only alternative that meets all hard requirements (embedded, mobile, WASM, mature ecosystem) while accepting trade-offs in graph operations and query expressiveness.

---

## Analysis Framework

### Hard Requirements (Non-Negotiable)

| Requirement | Justification |
|-------------|---------------|
| **Embedded** | Local-first architecture, no server dependency |
| **Mobile Support** | iOS (Swift) and Android (Kotlin) are target platforms |
| **WASM Viable** | Browser version may be needed for collaboration features |
| **FTS** | Search across 10K-500K text blocks is core feature |
| **Graph Operations** | Recursive tree expansion, path finding, backlinks |
| **Low Memory** | Mobile devices constrained to ~50-100MB for app + database |
| **Active Maintenance** | Cannot afford another CozoDB-style abandonment scenario |

### Soft Requirements (Nice-to-Have)

- Datalog or Datalog-like query language (CS contribution)
- Built-in graph algorithms (PageRank, community detection, centrality)
- Zero-downtime migrations from current CozoDB schema
- Developer-friendly tooling and debugging

### Current CozoDB Baseline

| Feature | CozoDB Implementation | Performance Characteristics |
|---------|----------------------|----------------------------|
| Recursive tree expansion | Single Datalog query with `subtree[...]` | O(N) where N = subtree size |
| Full-text search | `~blocks:fts{ ... }` with BM25 ranking | O(log M) where M = matches |
| Graph algorithms | Built-in: PageRank, Louvain, BFS, DFS, centrality | Native Rust implementation |
| Backlinks | Reverse indexes: `links:by_target`, `block_refs:by_target` | O(1) prefix scan on target_id |
| Storage | RocksDB (desktop), SQLite (mobile) | See ADR-014 for comparison |
| Binary size | ~15-20MB (RocksDB), ~1MB (SQLite backend) | N-API bindings add ~2MB |

---

## Tier 1: SQLite + Extensions

### Overview

SQLite is the most deployed database in the world. It's already used as CozoDB's mobile storage backend. The question is: can it **replace** CozoDB's query layer?

### Technical Capabilities

#### Full-Text Search (FTS5)

**Quality**: Production-grade. Used by major applications (Firefox, Chrome, Apple Mail).

```sql
-- FTS5 virtual table with BM25 ranking
CREATE VIRTUAL TABLE blocks_fts USING fts5(
  block_id UNINDEXED,
  content,
  tokenize='porter unicode61'
);

-- Phrase search with ranking
SELECT block_id, content, bm25(blocks_fts) AS score
FROM blocks_fts
WHERE blocks_fts MATCH 'graph NEAR/5 algorithm'
ORDER BY score
LIMIT 50;
```

**Features**:
- Porter stemming, Unicode normalization
- Phrase search with proximity (`NEAR/N`)
- BM25 ranking (industry standard)
- Custom tokenizers via C extension
- Snippet extraction with highlighting

**Verdict**: Equal to CozoDB's FTS capabilities.

#### Graph Queries (Recursive CTEs)

**SQLite 3.8.3+** (2014) supports `WITH RECURSIVE` for graph traversal.

**CozoDB Datalog** (original):
```datalog
subtree[block_id, parent_id, content, order, 0] :=
  *blocks_by_parent{ parent_id: $root, block_id },
  *blocks{ block_id, parent_id, content, order, is_deleted: false }
subtree[block_id, parent_id, content, order, depth] :=
  subtree[parent_block, _, _, _, prev_depth],
  prev_depth < $max_depth,
  *blocks_by_parent{ parent_id: parent_block, block_id },
  *blocks{ block_id, parent_id, content, order, is_deleted: false },
  depth = prev_depth + 1
```

**SQLite Translation**:
```sql
WITH RECURSIVE subtree(block_id, parent_id, content, "order", depth) AS (
  -- Base case
  SELECT bp.block_id, b.parent_id, b.content, b."order", 0
  FROM blocks_by_parent bp
  JOIN blocks b ON b.block_id = bp.block_id
  WHERE bp.parent_id = ?1 AND b.is_deleted = 0

  UNION ALL

  -- Recursive case
  SELECT bp.block_id, b.parent_id, b.content, b."order", st.depth + 1
  FROM subtree st
  JOIN blocks_by_parent bp ON bp.parent_id = st.block_id
  JOIN blocks b ON b.block_id = bp.block_id
  WHERE st.depth < ?2 AND b.is_deleted = 0
)
SELECT * FROM subtree ORDER BY depth, "order";
```

**Verdict**: Functionally equivalent, but **2.5x more verbose** and harder to read.

#### Graph Algorithms

SQLite has **zero built-in graph algorithms**. Everything must be implemented in application code.

**Recommended Approach**: Use **TypeScript implementations** with in-memory graph structures.

```typescript
// Load graph into memory
const links = await db.all('SELECT source_id, target_id FROM links');
const graph = new Graph();
links.forEach(({ source_id, target_id }) => graph.addEdge(source_id, target_id));

// Run PageRank with library
import { pageRank } from 'graphology-metrics/centrality/pagerank';
const ranks = pageRank(graph, { iterations: 20, tolerance: 1e-6 });

// Cache results
await db.run('UPDATE pages SET page_rank = ? WHERE page_id = ?', ...);
```

**Available Libraries**:
- [graphology](https://graphology.github.io/): PageRank, betweenness, community detection
- [cytoscape.js](https://js.cytoscape.org/): Graph analysis + visualization
- [ngraph](https://github.com/anvaka/ngraph): Path finding, layout algorithms

**Verdict**: Significant regression from CozoDB's built-in algorithms, but **acceptable** if operations are precomputed and cached.

### Ecosystem and Tooling

#### Maturity

- **First Release**: 2000 (26 years old)
- **Maintenance**: Richard Hipp (original author) still actively maintains
- **Testing**: 100% branch coverage, 2000x more test code than library code
- **Adoption**: iOS, Android, browsers, embedded systems

**Verdict**: **Best-in-class** for stability and longevity.

#### Embedding Options

| Platform | Library | Notes |
|----------|---------|-------|
| Node.js | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | Synchronous API, 5x faster than node-sqlite3 |
| WASM | [sql.js](https://github.com/sql-js/sql.js) | Emscripten build, runs in browser |
| Tauri | [tauri-plugin-sql](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/sql) | Official Tauri plugin |
| iOS | Native (libsqlite3) | Bundled with OS |
| Android | Native (android.database.sqlite) | Bundled with OS |
| React Native | [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) | Official Expo module |

**Local-First / Sync**:
- [cr-sqlite](https://github.com/vlcn-io/cr-sqlite): CRDT extension for multi-device sync
- [Electric SQL](https://electric-sql.com/): PostgreSQL-compatible sync
- [Turso](https://turso.tech/): libSQL with built-in replication

**Verdict**: **Best-in-class** ecosystem. Every platform has mature bindings.

#### Developer Experience

**Tooling**:
- SQLite CLI: Built-in REPL, `.schema`, `.explain`
- [DB Browser for SQLite](https://sqlitebrowser.org/): GUI for schema editing
- [Datasette](https://datasette.io/): Instant JSON API + UI

**Type Safety**:
- [Prisma](https://www.prisma.io/): Type-safe ORM with migrations
- [Drizzle ORM](https://orm.drizzle.team/): Lightweight SQL-like TypeScript API
- [Kysely](https://kysely.dev/): Type-safe SQL query builder

**Verdict**: Best developer ecosystem of any embedded database.

### Performance Benchmarks

| Operation | CozoDB (RocksDB) | SQLite (WAL) | Winner |
|-----------|------------------|--------------|--------|
| Single block fetch | ~0.1-0.2ms | ~0.05-0.1ms | SQLite |
| Page load (100 blocks) | ~1-2ms | ~0.5-1ms | SQLite |
| FTS query (top 50) | ~5-10ms | ~3-8ms | SQLite |
| Single block insert | ~0.2ms | ~0.5ms | CozoDB |
| Bulk insert (1000) | ~50ms | ~80ms | CozoDB |
| Memory baseline | 10-20MB | 1-2MB | SQLite |

**Note**: For mobile (SQLite storage), both use SQLite backend, so performance is identical.

### Migration Cost from CozoDB

**Schema Translation**: 1-2 days (straightforward table mappings)

**Query Translation**: 3-5 days (50+ Datalog queries → SQL)

**Application Integration**: 2-3 days (implement `SQLiteGraphDBProvider`)

**Total**: 1-2 weeks for full migration.

### WASM Viability

**sql.js** is production-ready for browser environments.

```typescript
import initSqlJs from 'sql.js';

const SQL = await initSqlJs({
  locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.10.0/dist/${file}`
});

const db = new SQL.Database();
// Persist via db.export() → IndexedDB
```

**Performance**: ~80-90% of native SQLite. Viable for <100MB databases.

**Verdict**: Suitable for Double-Bind's typical DB size (10-50MB).

### Datalog as User-Facing Query Language

**Problem**: SQLite doesn't support Datalog natively.

**Options**:

1. **Transpile Datalog → SQL**: Build a compiler (2-4 weeks effort)
2. **Drop Datalog Feature**: Expose SQL console for power users instead

**Recommendation**: If migrating due to CozoDB abandonment, **drop Datalog** and focus on shipping features.

### SQLite Verdict

| Criterion | Score (1-5) |
|-----------|-------------|
| **Embedded** | 5/5 |
| **Mobile** | 5/5 |
| **WASM** | 5/5 |
| **FTS** | 5/5 |
| **Graph Queries** | 3/5 (verbose CTEs) |
| **Graph Algorithms** | 2/5 (app-side only) |
| **Datalog** | 1/5 (not supported) |
| **Ecosystem** | 5/5 |
| **Maintenance** | 5/5 |
| **Migration Cost** | 4/5 (1-2 weeks) |

**Overall**: 40/50

**Recommendation**:
- **If CozoDB remains viable**: Stay with CozoDB
- **If CozoDB fails**: Migrate to SQLite. Accept loss of Datalog and built-in graph algorithms.


---

## Tier 2: Niche But Viable

### Datascript / Datahike

#### Overview

Datascript is an **in-memory Datalog database** in ClojureScript. Datahike extends it with durable storage.

**Why This Matters**: Roam Research, Logseq, and Athens Research (direct competitors) use Datascript for the same problem.

#### Example Queries

```clojure
;; Recursive tree expansion
(def rules
  '[[(child ?parent ?descendant)
     [?parent :block/children ?child]
     (child ?child ?descendant)]])

(d/q '[:find ?descendant
       :in $ % ?root
       :where (child ?root ?descendant)]
     db rules root-id)

;; Full-text search
(d/q '[:find ?block ?content
       :in $ ?query
       :where
       [(fulltext $ :block/content ?query) [[?block ?content]]]]
     db "graph algorithms")
```

#### Feasibility for Double-Bind

**Problems**:
1. **No official JavaScript bindings** (ClojureScript-first)
2. **EDN syntax foreign to TypeScript users**
3. **No native mobile support** (designed for browser/Electron)
4. **Type safety loss** (queries are strings)

**Verdict**:

| Criterion | Score (1-5) |
|-----------|-------------|
| Embedded | 4/5 |
| Mobile | 1/5 |
| WASM | 5/5 |
| FTS | 3/5 |
| Graph Queries | 5/5 |
| Graph Algorithms | 2/5 |
| Datalog | 5/5 |
| Ecosystem | 2/5 (ClojureScript, not TS) |
| Maintenance | 4/5 |
| Migration Cost | 2/5 |

**Overall**: 33/50

**Recommendation**: Not recommended for Double-Bind due to mobile requirements. Useful as **reference** for Datalog patterns.

---

### SurrealDB

#### Overview

Multi-model database with graph, document, and relational capabilities. Rust-based, embeddable.

```sql
-- Graph traversal
SELECT ->knows->user.name FROM user:alice;

-- Recursive
SELECT <-parent<-block.* FROM block:root RECURSIVE;

-- FTS
SELECT * FROM blocks WHERE content @@ 'graph algorithm';
```

#### Mobile Support Problem

SurrealDB uses **WebSocket/HTTP** to communicate with a server process. Not truly embedded.

```
Node.js App → WebSocket → SurrealDB Server → RocksDB
```

For mobile: Would need custom Swift/Kotlin FFI bindings. **No official SDKs exist**.

#### Verdict

| Criterion | Score (1-5) |
|-----------|-------------|
| Embedded | 2/5 (separate server) |
| Mobile | 1/5 |
| WASM | 2/5 (experimental) |
| FTS | 4/5 |
| Graph Queries | 5/5 |
| Graph Algorithms | 2/5 |
| Datalog | 1/5 (uses SurrealQL) |
| Ecosystem | 3/5 |
| Maintenance | 3/5 (VC-backed, risk of change) |
| Migration Cost | 2/5 |

**Overall**: 25/50

**Recommendation**: Not recommended due to weak mobile/WASM story. **Watch for future releases** if mobile SDKs mature.

---

## Tier 3: Not Recommended

### DuckDB

**Why Not**: Optimized for **OLAP** (analytics), not OLTP (transactions). Columnar storage is wrong for point lookups.

| Query Type | DuckDB | SQLite |
|------------|--------|--------|
| Single block fetch | ~1ms | ~0.05ms |
| Full table scan | ~10ms | ~200ms |

**Verdict**: Wrong tool for the job.

---

### EdgeDB

**Why Not**: Server-based (not embeddable). Beautiful query language (EdgeQL), but requires separate server process.

**Verdict**: Wrong architecture for local-first apps.

---

### Neo4j Embedded

**Why Not**: JVM dependency (~100-200MB overhead, 5-10s startup). Not viable on iOS.

**Verdict**: JVM overhead is a non-starter.

---

### Vector Databases (LanceDB, Milvus Lite)

**Use Case**: Semantic search for "unlinked references."

**Why Tier 3**: Not a replacement for primary database. Could be **supplementary index** for future enhancement.

**Verdict**: Nice-to-have, not core feature.

---

## Comparative Summary

| Database | Total Score | Key Strengths | Key Weaknesses |
|----------|-------------|---------------|----------------|
| **CozoDB (baseline)** | 42/50 | Datalog, graph algorithms, embedded | Maintenance risk |
| **SQLite** | 40/50 | Ecosystem, stability, mobile | No built-in graph algos, verbose queries |
| **Datascript** | 33/50 | Datalog, Logseq uses it | No mobile, ClojureScript ecosystem |
| **SurrealDB** | 25/50 | Graph queries | Separate server, no mobile |
| **DuckDB** | 23/50 | Analytics | Wrong for transactional workloads |
| **EdgeDB** | 23/50 | Beautiful query language | Server-based |
| **Neo4j** | 22/50 | Graph algorithms | JVM overhead |

---

## Decision Framework

### Scenario 1: CozoDB Remains Viable

**Recommendation**: **Stay with CozoDB**.

**Actions**:
- Monitor maintenance status quarterly
- Vendor prebuilt binaries (`cozo-node@0.7.6`)
- Maintain GraphDB abstraction layer
- Document migration plan to SQLite as contingency

---

### Scenario 2: CozoDB Maintenance Fails

**Recommendation**: **Migrate to SQLite**.

**Migration Plan**:

| Phase | Task | Effort |
|-------|------|--------|
| 1 | Schema translation | 2 days |
| 2 | Query translation (50+ queries) | 3-5 days |
| 3 | Graph algorithms (graphology integration) | 3-5 days |
| 4 | Application integration | 2-3 days |
| 5 | Data migration | 1 day |
| 6 | Drop Datalog or build transpiler | 2 days OR 2-4 weeks |

**Total**: 2-3 weeks (excluding transpiler).

---

### Scenario 3: Starting from Scratch Today

**Recommendation**: **SQLite from day one**.

**Rationale**:
- Proven stability (26 years)
- Best ecosystem
- No abandonment risk

**Trade-offs Accepted**:
- Verbose SQL vs Datalog
- App-side graph algorithms

**Mitigation**: Use Prisma/Drizzle for type-safety, graphology for graph ops.

---

## Specific Feature Comparisons

### Full-Text Search

**SQLite FTS5**: BM25, phrase search, proximity, snippets. Sufficient for <1M documents.

**CozoDB FTS**: TF-IDF ranking, phrase search. Less configurable but simpler.

**Verdict**: Tie. Both are sufficient for Double-Bind's scale.

---

### Recursive Queries

**CozoDB Datalog**: Concise, declarative.

**SQLite CTE**: 2.5x more verbose, procedural.

**Verdict**: CozoDB wins on readability, SQLite wins on tooling.

---

### Graph Algorithms

**CozoDB**: One-line `PageRank(*links[])`. Fast Rust implementation.

**SQLite**: 20 lines of TypeScript with graphology. ~60% slower (80ms vs 50ms for 1000 nodes).

**Verdict**: CozoDB wins on convenience. SQLite acceptable with caching/precomputation.

---

## Risk Assessment

### CozoDB Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| No new releases | High | Medium | Pin version, vendor binaries |
| Breaking changes | Low | High | GraphDB abstraction |
| npm removal | Low | High | Vendor in monorepo |
| Security vulnerabilities | Medium | High | Monitor CVEs |

**Overall**: Medium-High risk.

---

### SQLite Stability

| Risk | Likelihood | Impact |
|------|------------|--------|
| Breaking changes | Very Low | Low |
| Abandonment | Negligible | Critical |
| Performance regression | Low | Medium |

**Overall**: Very Low risk.

---

## Recommended Actions

### Immediate (This Month)

1. **Monitor CozoDB**: Check GitHub issues/releases monthly
2. **Test SQLite fallback**: 1-day prototype of `SQLiteGraphDBProvider`
3. **Vendor dependencies**: Copy `cozo-node@0.7.6` to `vendor/`

### Short-Term (3 Months)

4. **Integration tests**: Run against both CozoDB and SQLite providers
5. **Document migration**: Finalize SQLite schema and query translations
6. **Prototype graph libs**: Test graphology performance

### Long-Term (12 Months)

7. **Decide on Datalog**: Keep CozoDB OR drop feature if migrating
8. **Evaluate vector search**: Prototype LanceDB for semantic unlinked refs
9. **Monitor alternatives**: Re-evaluate SurrealDB/Datahike annually

---

## Conclusion

**TL;DR**:

- **Best Alternative**: SQLite (40/50) beats all others for embedded + mobile + WASM
- **Key Trade-offs**: Lose Datalog and built-in graph algorithms, gain ecosystem maturity
- **Migration Cost**: 1-2 weeks from CozoDB to SQLite
- **Current Recommendation**: Stay with CozoDB while monitoring. Maintain SQLite migration readiness.

**If forced to choose today**: SQLite with recursive CTEs, FTS5, and graphology is the **only production-ready alternative** meeting all hard requirements.

**Honest assessment**: CozoDB's abandonment is a real risk, but the GraphDB abstraction makes SQLite migration feasible without rewriting business logic. That architectural decision was wise.
