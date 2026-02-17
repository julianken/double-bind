# Tech Stack

<!-- last-verified: 2026-02-16 -->

## Confirmed Choices

| Layer            | Technology                                     | Rationale                                                                                                                                   |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Database         | SQLite (rusqlite / better-sqlite3 / op-sqlite) | Universal embedded database, FTS5 for search, recursive CTEs for graph traversal. See [ADR-015](../decisions/015-sqlite-migration.md).      |
| Desktop shell    | Tauri v2                                       | System webview (~10MB binary vs Electron's ~150MB). See [ADR-003](../decisions/003-shell-tauri.md).                                         |
| Language         | TypeScript                                     | All business logic. SQLite handles persistence; graph algorithms run in TypeScript. See [ADR-002](../decisions/002-language-typescript.md). |
| Frontend         | React 19                                       | Component model, ecosystem, hooks for state management.                                                                                     |
| Editor           | ProseMirror (direct)                           | Full control over outliner schema. No TipTap abstraction layer. See [ADR-004](../decisions/004-editor-prosemirror.md).                      |
| State (DB reads) | Zustand + query hooks                          | Reactive hooks with key-based invalidation. See [ADR-011](../decisions/011-state-management.md).                                            |
| State (UI)       | Zustand                                        | Lightweight, TypeScript-native store for UI state.                                                                                          |
| IDs              | ULID                                           | Sortable, timestamp-embedded, future-proofs sync. See [ADR-012](../decisions/012-id-format.md).                                             |
| Testing          | Vitest + Playwright                            | Unit/integration (Vitest), E2E (Playwright).                                                                                                |
| Package manager  | pnpm                                           | Disk-efficient, strict dependency management, workspace support.                                                                            |
| Mobile           | React Native (Expo) + op-sqlite                | Cross-platform mobile with native SQLite access.                                                                                            |

## Why SQLite?

The project migrated from CozoDB to SQLite (see [ADR-015](../decisions/015-sqlite-migration.md) and [alternatives analysis](database-alternatives-analysis.md)). Key reasons:

1. **Universal platform support**: rusqlite (desktop), op-sqlite (mobile), better-sqlite3 (dev/test) — all wrap the same engine.
2. **FTS5**: Built-in full-text search with Porter stemmer and unicode61 tokenizer.
3. **Recursive CTEs**: Tree traversal and graph algorithms without external libraries.
4. **Ecosystem**: Mature tooling, extensive documentation, battle-tested in production.
5. **Simplicity**: No custom binary compilation, no C++ build chain, no platform-specific patches.

## Why TypeScript for Business Logic?

See [ADR-002](../decisions/002-language-typescript.md) for the full analysis by 5 independent agents.

The core insight: SQLite is already native code. The hot paths (query execution, FTS indexing, B-tree traversal) run in C inside SQLite. TypeScript orchestrates queries and handles UI. Rewriting business logic in Rust would save <1ms per operation — imperceptible to users.

## When Rust/WASM Would Make Sense

Consider selective WASM acceleration if profiling reveals:

- Graph algorithms slow on >10K nodes in JavaScript
- Content parsing slow on >100KB blocks
- Memory pressure from large datasets

The hybrid approach is documented in [WASM Acceleration](wasm-acceleration.md).
