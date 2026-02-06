# ADR-002: TypeScript for All Business Logic

## Status
Accepted

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

## Consequences

**Key insight**: CozoDB's engine is Rust internally. The hot paths (graph traversal, text indexing, recursive Datalog evaluation) execute in compiled Rust regardless of what language calls `run_script`. TypeScript only orchestrates queries and handles UI — operations where microsecond differences are imperceptible when the DB call takes 1-5ms.

**Positive**:
- Fast iteration speed
- Familiar language for the developer
- Shared code across all three clients (desktop, TUI, CLI)
- Large ecosystem for UI, testing, parsing

**Negative**:
- Datalog queries are strings in TypeScript (no compile-time validation)
- IPC serialization adds microseconds per call (negligible)
- Some operations (e.g., parsing very large markdown files) might benefit from Rust/WASM in the future

**Mitigations**:
- Integration tests against real CozoDB validate Datalog queries at test time
- Zod runtime validation catches schema drift at the repository boundary
- The `graph-algorithms` package could be ported to WASM later if needed
