# Tech Stack

## Confirmed Choices

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Database | CozoDB (RocksDB backend) | Datalog queries, built-in graph algorithms (PageRank, BFS, DFS, community detection), built-in FTS, single embedded binary. See [ADR-001](../decisions/001-database-cozodb.md). |
| Desktop shell | Tauri v2 | System webview (no bundled Chromium), ~10MB binary vs Electron's ~150MB. See [ADR-003](../decisions/003-shell-tauri.md). |
| Language | TypeScript | All business logic. CozoDB's Rust engine handles heavy computation. See [ADR-002](../decisions/002-language-typescript.md). |
| Frontend | React 18+ | Component model, ecosystem, shared with Ink for TUI. |
| Editor | ProseMirror (direct) | Full control over outliner schema. No TipTap abstraction layer. See [ADR-004](../decisions/004-editor-prosemirror.md). |
| State (DB data) | Zustand + useCozoQuery | Custom reactive hook for CozoDB reads with key-based invalidation. See [ADR-011](../decisions/011-state-management.md). |
| State (UI) | Zustand | Lightweight, TypeScript-native store for UI state. |
| IDs | ULID | Sortable, timestamp-embedded, future-proofs sync. |
| Testing | Vitest + Playwright | Unit/integration (Vitest), E2E (Playwright). |
| Validation | Zod | Runtime type validation at DB boundary. |
| Package manager | pnpm | Disk-efficient, strict dependency management, workspace support. |

## Why Not SQLite?

SQLite is the obvious choice for local-first. We chose CozoDB because:

1. **Tree generation**: Expanding a block tree is N queries per level in SQL (one per child node). In CozoDB, it's one recursive Datalog query.
2. **Graph algorithms**: CozoDB has PageRank, community detection, shortest path, etc. built in. SQLite requires external libraries.
3. **Full-text search**: Built into CozoDB. SQLite requires FTS5 extension.
4. **Datalog**: A user-facing query language is CS contribution #1. CozoDB speaks it natively.

## Why Not Rust for Business Logic?

This decision was formally evaluated by 5 independent analysis agents (DX, Performance, Code Sharing, Testing, Ecosystem). **All recommended keeping TypeScript.** See [ADR-002](../decisions/002-language-typescript.md) for full analysis.

### The Core Insight

CozoDB's engine is Rust regardless of what language calls it. The hot paths (graph traversal, text indexing, recursive queries) execute in Rust inside CozoDB. TypeScript orchestrates queries and handles UI.

**Measured time breakdown for "user types in block":**

| Layer | Time | Impact of Rust? |
|-------|------|-----------------|
| TypeScript orchestration | ~0.2ms | Saves ~0.1ms (imperceptible) |
| IPC serialization | ~0.5ms | Eliminates ~0.3ms |
| CozoDB query (Rust) | **1-5ms** | Already Rust |
| React rendering | **5-15ms** | Rust can't help |

**Total improvement from Rust business logic: <1ms** — imperceptible to users.

### What Rust Would Cost

| Factor | Impact |
|--------|--------|
| Learning curve | 3-6 months to productivity |
| TDD cycle time | 10-20x slower (15-60s vs 2-5s) |
| Code sharing | TUI needs ratatui rewrite, CLI needs NAPI bindings |
| Plugin accessibility | Community contributors must know Rust |
| Documentation | ~25 files need rewriting (~65% of docs) |
| MockGraphDB | Complete rewrite as Rust traits |

### When Rust Would Make Sense

Consider Rust/WASM for specific modules if profiling reveals:
- Graph algorithms slow on >10K nodes in JavaScript
- Content parsing slow on >100KB markdown blocks
- Memory pressure from large datasets

The hybrid approach (TypeScript + selective WASM) is documented as a future option.

## Dependency Budget

<!-- TODO: Track total dependency count and bundle size -->
<!-- TODO: Document dependency audit policy -->
