# ADR-006: 5-Command Rust Shim with ScriptMutability Enforcement

## Status
Accepted

## Context

The Tauri Rust shim bridges the TypeScript frontend to CozoDB. The question: how many Tauri commands should it expose, and what security boundaries should exist?

This was investigated by three specialized agents analyzing from IPC, security, and developer experience perspectives.

## Options Considered

### Option A: Single `query()` command (~5 lines Rust)
- Maximum flexibility, minimal Rust
- No security boundary between reads and writes
- Cannot access CozoDB's `import_relations`/`export_relations`/`backup` methods (they're not available through `run_script`)

### Option B: 3-5 specialized commands (~50 lines Rust)
- Separates reads from writes
- Dedicated commands for non-script CozoDB operations
- Enables Rust-side security enforcement

### Option C: 10+ domain-specific commands (~200+ lines Rust)
- Maximum type safety at IPC boundary
- Business logic leaks into Rust
- Every data model change requires Rust changes

## Decision

**5 commands, ~40 lines of Rust.**

| Command | CozoDB Method | Mutability |
|---------|--------------|------------|
| `query(script, params)` | `run_script` | `ScriptMutability::Immutable` |
| `mutate(script, params)` | `run_script` | `ScriptMutability::Mutable` + blocklist |
| `import_relations(data)` | `import_relations` | N/A (dedicated API) |
| `export_relations(relations)` | `export_relations` | N/A (dedicated API) |
| `backup(path)` | `backup` | N/A (dedicated API) |

### Critical Security Finding: `ScriptMutability`

CozoDB's Rust API has a `ScriptMutability` enum:
- `Immutable`: CozoDB **engine-rejects** any script containing mutation operators or system operations. This is not string parsing — it's enforced at the query compilation level.
- `Mutable`: CozoDB allows all operations.

The `query` command uses `Immutable`. Even if XSS in rendered markdown calls `invoke('query', { script: '::remove pages' })`, CozoDB itself rejects it. This is defense-in-depth that costs zero lines of parsing code.

### Blocklist for `mutate`

The `mutate` command adds a string-level blocklist rejecting scripts containing:
- `::remove` (drop relations)
- `::rename` (rename relations)
- `::set_triggers` (install persistent code)
- `::access_level` (change access controls)
- `:replace` (drop + recreate relation)
- `::kill` (kill running queries)
- `::fts` (drop/create FTS indexes)
- `::hnsw` (drop/create HNSW indexes)
- `::lsh` (drop/create LSH indexes)

The last three were added after review identified that `::fts drop`, `::hnsw drop`, and `::lsh drop` are destructive operations not covered by the original blocklist. Creating these indexes is also blocked because FTS/HNSW/LSH index creation should only happen in migrations.

## Agent Findings Summary

| Agent | Recommendation | Key Insight |
|-------|---------------|-------------|
| IPC perspective | 4 commands (query + import + export + backup) | Import/export/backup are separate CozoDB API methods, not accessible via `run_script`. No read/write split needed for query. |
| Security perspective | 2 core commands (query + mutate) | `ScriptMutability::Immutable` gives engine-enforced read-only. XSS can't destroy data through `query`. Blocklist on `mutate` prevents catastrophic system operations. |
| DX perspective | 5 commands (query + mutate + import + export + system) | The shim is a "dumb pipe." All domain logic lives in TypeScript repository layer. Typed TypeScript mock for testing. |

## Consequences

**Positive**:
- Engine-enforced read-only on all read operations (no parsing, no heuristics)
- XSS in rendered markdown cannot modify or destroy data through `query`
- Import/export/backup have dedicated commands (these aren't accessible via `run_script`)
- ~40 lines of Rust that rarely change
- TypeScript repository layer provides all domain-specific methods
- Single mock point for testing (`GraphDB` interface with 5 methods)

**Negative**:
- Blocklist is string-based (defense-in-depth, not primary defense)
- Developers must remember to use `mutate` for writes, `query` for reads (enforced by TypeScript interface)
- Five IPC endpoints instead of one (trivial complexity increase)

## Security Note: `import_relations`

Architectural review identified that `import_relations` is a side channel that bypasses both `ScriptMutability` and the blocklist:

- **Deletion**: Prefixing a relation name with `-` deletes rows (e.g., `{"-blocks": [[...]]}`  removes matching rows)
- **FTS bypass**: `import_relations` does NOT update FTS, HNSW, or LSH indexes — imported rows won't appear in search, and deleted rows leave stale index entries
- **No ScriptMutability check**: The API is separate from `run_script`

**Mitigation**: The `import_relations` command should only be called from the `ImportExportService`, which:
1. Validates relation names (rejects `-` prefixed names unless explicitly importing)
2. Rebuilds affected FTS indexes after bulk import (drop + recreate)
3. Logs all import operations for audit

**Future Growth**:
New Tauri commands are added only for genuinely new infrastructure capabilities:
- `subscribe(script, params)` — live query support
- `schedule_backup(interval, path)` — backup scheduling
- `close_db()` / `open_db(path)` — multi-database support
