# Architecture Decision Records

Each ADR documents a significant architectural choice: the context, options considered, decision made, and consequences.

## Index

| ADR                                      | Decision                                      | Status                |
| ---------------------------------------- | --------------------------------------------- | --------------------- |
| [001](./001-database-cozodb.md)          | Use CozoDB as the database                    | Superseded by ADR-015 |
| [002](./002-language-typescript.md)      | TypeScript for all business logic             | Accepted              |
| [003](./003-shell-tauri.md)              | Tauri v2 as desktop shell                     | Accepted              |
| [004](./004-editor-prosemirror.md)       | ProseMirror directly (not TipTap)             | Accepted              |
| [005](./005-block-key-simple.md)         | Simple block key + index relations            | Accepted              |
| [006](./006-shim-scope.md)               | Minimal Rust shim with read/write separation  | Accepted              |
| [007](./007-content-format.md)           | Plain text with lightweight markers           | Accepted              |
| [008](./008-package-structure.md)        | Monorepo with layered packages                | Accepted              |
| [009](./009-plugin-architecture.md)      | Plugin system from day 1                      | Accepted              |
| [010](./010-undo-redo-hybrid.md)         | Hybrid undo/redo (ProseMirror + DB snapshots) | Accepted              |
| [011](./011-state-management.md)         | Zustand + query hooks                         | Accepted              |
| [012](./012-id-format.md)                | ULID for all entity IDs                       | Accepted              |
| [013](./013-block-ordering.md)           | String-based fractional indexing              | Accepted              |
| [014](./014-mobile-database-strategy.md) | Mobile database strategy                      | Superseded by ADR-015 |
| [015](./015-sqlite-migration.md)         | Migrate from CozoDB to SQLite                 | Accepted              |

## ADR Template

```markdown
# ADR-NNN: Title

## Status

Accepted | Superseded by [ADR-NNN](link) | Deprecated

## Context

What is the issue that we're seeing that is motivating this decision?

## Options Considered

1. Option A — description
2. Option B — description

## Decision

What is the change that we're proposing and/or doing?

## Consequences

What becomes easier or more difficult because of this change?

## References

- Related ADRs, source files, or external documentation
```
