# ADR-001: Use CozoDB as the Database

## Status
Superseded by [ADR-015: Migrate from CozoDB to SQLite](015-sqlite-migration.md)

## Context

Double-Bind is a Roam Research-like note-taking app where tree generation, graph traversals, and graph visualizations are primary features (not afterthoughts). The database must be:

- Embedded (local-first, no server)
- Fast at recursive tree expansion (blocks nested N levels deep)
- Native graph traversal (not graph queries bolted onto relational tables)
- Full-text search capable
- Single binary (no external dependencies for the user)

## Options Considered

### 1. SQLite
- **Pros**: Battle-tested, ubiquitous, excellent tooling, FTS5 extension
- **Cons**: Tree expansion requires N queries per level (one per child node). Graph algorithms require external libraries. No native Datalog support. Recursive CTEs are verbose and limited.

### 2. CozoDB
- **Pros**: Datalog query language (native), built-in graph algorithms (PageRank, BFS, DFS, shortest path, community detection, betweenness centrality), built-in FTS, RocksDB storage backend, single embedded binary, Rust core with Node.js NAPI bindings.
- **Cons**: Younger project, smaller community, no ALTER TABLE (migrations require recreating relations), no general secondary indexes (must create separate relations).

### 3. Kuzu
- **Pros**: Columnar graph database, fast analytical queries, Cypher query language.
- **Cons**: No embedded JS/TS bindings at the time of evaluation. Cypher is not Datalog. No built-in FTS.

### 4. SurrealDB
- **Pros**: Multi-model, graph queries, embeddable.
- **Cons**: Heavier runtime, SQL-based (not Datalog), less mature embedding story.

## Decision

Use CozoDB with the RocksDB storage backend.

## Consequences

**Positive**:
- Recursive tree expansion is one Datalog query instead of N SQL queries per level
- Graph algorithms are built-in, no external library needed
- Full-text search is built-in
- Datalog as user-facing query language is CS contribution #1
- Single embedded binary keeps deployment simple

**Negative**:
- Smaller community means fewer StackOverflow answers, less tooling
- No ALTER TABLE — schema changes require relation recreation + data migration
- No general secondary indexes — must maintain separate index relations manually
- Younger project — potential for breaking changes in API

**Mitigations**:
- GraphDB interface provides abstraction layer if CozoDB needs to be swapped
- Index relations are simple key-only relations with minimal maintenance overhead
- CozoDB's Rust core is high quality (built by a database researcher)

## Maintenance Risk (Added Post-Review)

Architectural review (Feb 2026) identified significant maintenance concerns:

- **Last CozoDB release**: v0.7.6, December 11, 2023 (25+ months ago)
- **Last maintainer commit**: December 2024 (merging community PRs)
- **GitHub Issue #301** ("Is cozo still being maintained?"): Opened Dec 2025, no maintainer response
- **cozo-node npm**: Single maintainer (zh217), no updates in 2+ years
- **Community fork** (`cozo-community/cozo`): Started Sept 2024, also stalled (last commit Dec 2024)

### Mitigations

1. **GraphDB interface** provides an abstraction layer. If CozoDB must be replaced, only the adapter code changes — all business logic in TypeScript is database-agnostic.
2. **cozo-bin HTTP server** is a viable fallback. Instead of `cozo-node` NAPI bindings, the app can communicate with a standalone CozoDB process via HTTP. This decouples Node.js version compatibility from CozoDB binary compatibility.
3. **N-API stability**: cozo-node uses N-API version 6, which provides ABI stability across Node.js versions. Existing binaries should work on Node.js 20/22 despite no updates. The risk is in surrounding tooling (`@mapbox/node-pre-gyp`, Neon 0.10).
4. **Pin cozo-node@0.7.6** and vendor prebuilt binaries if needed.
5. **Evaluate alternatives at Phase 3+**: If CozoDB remains unmaintained by the time sync/collaboration features are needed, consider Kuzu (graph DB with Cypher) or SQLite + recursive CTEs as replacement candidates.
