# ADR-002: TypeScript for All Business Logic

## Status
Accepted (Revalidated February 2026)

## Context

The project needs a primary language for business logic (repositories, services, content parsing, UI). The database engine (CozoDB) is Rust regardless of choice. The question is whether the application layer should be Rust or TypeScript.

## Options Considered

### 1. Rust
- **Pros**: Maximum performance, type safety, no GC pauses, single language for entire stack
- **Cons**: Steep learning curve (developer has no Rust experience), slower iteration, verbose for business logic, harder to test

### 2. TypeScript
- **Pros**: Developer familiarity, fast iteration, excellent tooling, large ecosystem, React integration, shared code between desktop/TUI/CLI
- **Cons**: Runtime type errors possible, GC pauses (negligible for this workload), serialization overhead at IPC boundary

## Decision

TypeScript for all business logic. Rust only for the ~40-line Tauri shim.

## Revalidation (February 2026)

This decision was re-evaluated by 5 independent analysis agents examining Developer Experience, Performance, Code Sharing, Testing, and Ecosystem perspectives. **All 5 agents recommended keeping TypeScript.**

### Performance Analysis

Actual time breakdown for a typical user interaction (typing in a block):

| Operation | Time | Language |
|-----------|------|----------|
| ProseMirror state update | ~0ms | TypeScript |
| 300ms debounce | — | — |
| Content parsing (regex) | ~0.1ms | TypeScript |
| Service orchestration | ~0.1ms | TypeScript |
| Tauri IPC serialization | ~0.5ms | JSON |
| CozoDB query execution | **1-5ms** | Rust |

**TypeScript business logic contributes ~0.2ms total.** The bottleneck is CozoDB query execution (already Rust) and React rendering.

### Developer Experience Analysis

| Aspect | TypeScript | Rust |
|--------|------------|------|
| TDD cycle time | 2-5 seconds | 15-60+ seconds |
| Learning curve | Immediate | 3-6 months |
| Mocking | `vi.fn()`, flexible | `mockall` crate, trait-based |
| Hot reload | ~100ms | Requires recompile |

### Code Sharing Analysis

- **TUI would require rewrite**: Ink (React for terminals) → ratatui (Rust)
- **Plugin system less accessible**: Rust plugins harder for community contributors
- **FFI complexity**: NAPI bindings needed for Node.js CLI/TUI

### Testing Analysis

- **MockGraphDB would need rewrite** as Rust traits
- **"Tests on every save" no longer practical** with Rust compile times
- **E2E tests unchanged** (Playwright tests React regardless)

## Consequences

**Key insight**: CozoDB's engine is Rust internally. The hot paths (graph traversal, text indexing, recursive Datalog evaluation) execute in compiled Rust regardless of what language calls `run_script`. TypeScript only orchestrates queries and handles UI — operations where microsecond differences are imperceptible when the DB call takes 1-5ms.

**Positive**:
- Fast iteration speed (2-5 second TDD cycles)
- Familiar language for the developer
- Shared code across all three clients (desktop, TUI, CLI) — >80% reuse
- Large ecosystem for UI, testing, parsing
- Plugin system accessible to JavaScript community

**Negative**:
- Datalog queries are strings in TypeScript (no compile-time validation)
- IPC serialization adds microseconds per call (negligible)
- Some operations (e.g., parsing very large markdown files) might benefit from Rust/WASM in the future

**Mitigations**:
- Integration tests against real CozoDB validate Datalog queries at test time
- Zod runtime validation catches schema drift at the repository boundary
- Hybrid WASM acceleration available for specific hot paths (see below)

## Future Option: Hybrid WASM Acceleration

If profiling reveals specific bottlenecks, individual modules can be ported to Rust and compiled to WASM without full architecture migration:

| Candidate | Rationale | Trigger |
|-----------|-----------|---------|
| `graph-algorithms` | Pure computation, no DB calls | If JS proves slow for large graphs |
| Content parser | Regex-heavy, large file support | If parsing >100KB blocks is slow |
| Fractional index rebalance | Compute-intensive | If rebalancing >10K blocks is slow |

This preserves TypeScript's benefits (fast iteration, code sharing) while surgically adding Rust where profiling proves necessary.

**Documentation impact for hybrid: ~3-5 files** vs **~25 files for full migration.**
