# ADR-015: Migrate from CozoDB to SQLite

## Status
Accepted

## Context

Double-Bind initially chose CozoDB (ADR-001) for its native Datalog queries and built-in graph algorithms. After 6+ months of development, several challenges emerged:

1. **Cross-platform friction**: CozoDB's RocksDB backend is difficult to cross-compile for mobile (iOS/Android). The mobile port required a separate database strategy (ADR-014), creating schema divergence.
2. **Migration limitations**: CozoDB lacks ALTER TABLE. Schema changes require relation recreation, making migrations fragile and slow.
3. **Community and tooling**: CozoDB has limited community support, sparse documentation, and no standard tooling (no DB browser, no migration frameworks).
4. **Debugging difficulty**: Datalog query errors are opaque. No query planner introspection, no EXPLAIN equivalent.
5. **Graph algorithm usage**: In practice, only neighborhood traversal is used on the critical path. PageRank and community detection are graph-view features that run infrequently and can be computed client-side.

## Decision

Migrate all database operations from CozoDB Datalog to SQLite SQL.

### Schema translation

| CozoDB | SQLite |
|--------|--------|
| Datalog relations | SQL tables with FK constraints |
| `blocks_by_page`, `blocks_by_parent` index relations | Partial indexes (`WHERE is_deleted = 0`) |
| `properties` (unified) | `block_properties` + `page_properties` (split for FK enforcement) |
| `tags` (unified) | `block_tags` + `page_tags` (split for FK enforcement) |
| `metadata` | `schema_metadata` |
| Boolean fields (`Bool`) | `INTEGER CHECK (x IN (0, 1))` |
| `:fts create` | FTS5 virtual tables with sync triggers |

### Graph algorithm replacement

| Algorithm | CozoDB | SQLite replacement |
|-----------|--------|-------------------|
| Neighborhood traversal | Recursive Datalog rules | `WITH RECURSIVE` CTE |
| PageRank | Built-in `PageRank()` | Heuristic scoring (uniform + incoming link boost) |
| Community detection | Built-in `CommunityDetectionLouvain()` | Placeholder (all nodes in community 0) |
| Suggested links | Datalog aggregation | SQL CTEs with common-neighbor scoring |

PageRank and community detection can be enhanced with graphology.js in a future iteration.

### Data migration

A migration tool (`@double-bind/migrations`) exports CozoDB data via `exportRelations()` and imports into SQLite with proper FK ordering and data type conversion.

## Consequences

### Positive
- Single database engine across desktop, mobile, and CLI
- Standard SQL tooling (DB Browser for SQLite, `sqlite3` CLI, etc.)
- `ALTER TABLE` support for clean migrations
- Vastly larger community and ecosystem
- Simpler build pipeline (no Rust CozoDB compilation)

### Negative
- Lost built-in graph algorithms (replaceable with graphology.js)
- Lost Datalog query language (Query View feature needs SQL or new DSL)
- Migration effort across all repositories and services

### Neutral
- Performance is comparable for all critical-path operations
- FTS5 is equivalent to CozoDB's simple tokenizer FTS
- Recursive CTEs are more verbose but equally capable for N-hop traversal
