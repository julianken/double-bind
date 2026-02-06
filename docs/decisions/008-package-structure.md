# ADR-008: 10-Package Monorepo

## Status
Accepted

## Context

The project needs a package structure that supports three clients (desktop, TUI, CLI), clean separation of concerns, and independent testability.

## Decision

Full 10-package structure from the start. No iterative splitting — all packages are created in Phase 1.

## Package Rationale

| Package | Why it exists |
|---------|--------------|
| `types` | Prevents circular dependencies. Zero-dep leaf node that everything imports. |
| `test-utils` | DRY testing. One MockGraphDB implementation shared by all packages. |
| `query-lang` | CS contribution #1. Substantial enough to stand alone. Potentially publishable. |
| `graph-algorithms` | CS contribution #2. Pure functions, no DB dependency. Potentially publishable. |
| `migrations` | Schema versioning. Separates schema definition from business logic. |
| `core` | Business logic that all three clients share. Framework-agnostic. |
| `ui-primitives` | Shared React components. Client-agnostic (no Tauri, no Ink specifics). |
| `cli` | Command-line database management tool. |
| `desktop` | Tauri + React. The only package that knows about Tauri. |
| `tui` | Ink terminal client. CS contribution #4. |

## Consequences

- Clean dependency boundaries enforced by TypeScript project references
- Each package is independently buildable and testable
- Adding a new client (e.g., web) only requires a new leaf package
- `query-lang` and `graph-algorithms` could be published as standalone npm packages

See [Dependency Graph](../architecture/dependency-graph.md) for the full dependency tree.
