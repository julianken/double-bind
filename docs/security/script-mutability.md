# ScriptMutability: Engine-Enforced Read/Write Separation

## The Mechanism

CozoDB's Rust API provides a `ScriptMutability` enum:

```rust
pub enum ScriptMutability {
    Immutable,
    Mutable,
}
```

When `Immutable` is passed to `run_script`, CozoDB **rejects at the engine level** any script containing:
- Mutation operators: `:put`, `:rm`, `:create`, `:replace`, `:insert`, `:update`, `:delete`
- System operations: `::remove`, `::create`, `::rename`, `::set_triggers`, `::access_level`, etc.

This is not string parsing. It is enforced during script compilation/execution by the CozoDB query engine itself.

### Engine-Level Enforcement (Validated)

Architectural review validated via CozoDB source code analysis that `ScriptMutability::Immutable` is enforced comprehensively at every write path:

- **System operations**: `SysOp::Compact`, `SysOp::RemoveRelation`, `SysOp::CreateIndex`, `SysOp::CreateVectorIndex`, `SysOp::CreateFtsIndex`, `SysOp::CreateMinHashLshIndex`, `SysOp::RemoveIndex`, `SysOp::RenameRelation`, `SysOp::SetTriggers`, `SysOp::SetAccessLevel` — all explicitly check `if read_only { bail!(...) }`
- **Single queries**: `if read_only && is_write { bail!("write lock required") }`
- **Imperative scripts**: `if readonly && !write_lock_names.is_empty() { bail!("read-only program attempted to acquire write locks") }` — propagated through all sub-execution paths

This is not advisory — it is engine-level enforcement that blocks every mutation path. The claim that it "should not be trusted" was **refuted** by source code analysis.

## How We Use It

| Tauri Command | Mutability | Security Layer |
|--------------|------------|----------------|
| `query` | `Immutable` | Engine-enforced read-only. Rejects `:put`, `:rm`, `:create`, `::remove`, all system ops |
| `mutate` | `Mutable` | String blocklist rejects: `::remove`, `::rename`, `::set_triggers`, `::access_level`, `:replace`, `::kill`, `::fts`, `::hnsw`, `::lsh` |
| `import_relations` | N/A | Bypasses ScriptMutability — see security note below |

## Why This Matters

The most likely attack is XSS via imported content. If successful:

- XSS calls `invoke('query', { script: '::remove pages' })` → **CozoDB rejects it**. Engine-enforced. Zero data loss.
- XSS calls `invoke('mutate', { script: '::remove pages' })` → **Blocklist rejects it**. String-level check catches `::remove`.
- XSS calls `invoke('mutate', { script: ':rm pages { ... }' })` → This could succeed (`:rm` is allowed in mutate). But `:rm` deletes specific rows, not entire relations. The damage is limited and recoverable from `block_history`.

## Cost

Zero. One enum parameter change between the `query` and `mutate` command implementations. No parsing code, no validation logic, no maintenance burden.

## CozoDB's Own Access Level System

CozoDB also has `::access_level` with four levels:
- `normal`: All operations allowed
- `protected`: Prevents `::remove` and `:replace`
- `read_only`: Additionally prevents all mutations
- `hidden`: Additionally prevents data reads

However, CozoDB's docs explicitly state: *"The access level functionality is to protect data from mistakes of the programmer, not from attacks by malicious parties."*

We use `protected` on critical relations as an additional safety net, but `ScriptMutability` is the primary defense.

## Security Note: `import_relations`

The `import_relations` command is a side channel that bypasses ScriptMutability entirely:

- **Not routed through `run_script`** — ScriptMutability checks do not apply
- **Supports deletion** via `-rel_name` prefix (e.g., `{"-blocks": [["block_id_1"]]}`)
- **Skips FTS/HNSW/LSH indexes** — imported/deleted rows do not update search indexes
- **Does check access levels** — relations at `Hidden` or `ReadOnly` level reject imports

**Mitigation**: The TypeScript `ImportExportService` is the only caller of `import_relations`. It:
1. Validates that no `-` prefixed relation names are passed (unless explicitly importing deletions)
2. Rebuilds FTS indexes after bulk import (drop + recreate)
3. Only runs during explicit user-initiated import operations
