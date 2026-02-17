# Double-Bind Documentation

Local-first note-taking application with graph-native architecture. A Roam Research-like tool built on SQLite, Tauri, TypeScript, and React.

## Documentation Map

| Section                             | Description                                                 |
| ----------------------------------- | ----------------------------------------------------------- |
| [Architecture](./architecture/)     | System design, tech stack, layer boundaries                 |
| [Decisions](./decisions/)           | Architecture Decision Records (ADRs) for every major choice |
| [Database](./database/)             | SQLite schema, query patterns, FTS5, migrations             |
| [Security](./security/)             | Threat model, injection prevention, content rendering       |
| [Testing](./testing/)               | 4-layer testing strategy, CI pipeline                       |
| [Frontend](./frontend/)             | React architecture, ProseMirror editor, state management    |
| [Infrastructure](./infrastructure/) | Tauri config, monorepo, build tooling                       |
| [Research](./research/)             | CS contribution goals: graph algorithms, local-first, TUI   |
| [Packages](./packages/)             | Per-package specifications and API surface                  |

## Quick Reference

**Tech Stack**: SQLite (via rusqlite / better-sqlite3) + Tauri v2 + TypeScript + React + ProseMirror

**Core Principle**: All business logic in TypeScript. Rust is a thin IPC shim wrapping rusqlite. Graph algorithms run in TypeScript with recursive CTEs for traversal.

**CS Contributions**:

1. Graph algorithms (PageRank, community detection, link prediction) applied to PKM
2. Local-first graph-native architecture that is actually fast
3. Terminal client for graph-based knowledge management
