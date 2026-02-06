# Double-Bind Documentation

Local-first note-taking application with graph-native architecture. A Roam Research-like tool built on CozoDB, Tauri, TypeScript, and React.

## Documentation Map

| Section | Description |
|---------|-------------|
| [Architecture](./architecture/) | System design, tech stack, data flow, layer boundaries |
| [Decisions](./decisions/) | Architecture Decision Records (ADRs) for every major choice |
| [Database](./database/) | CozoDB schema, key design, indexes, query patterns, migrations |
| [Security](./security/) | Threat model, injection prevention, ScriptMutability, XSS |
| [Testing](./testing/) | 4-layer testing strategy, CI pipeline, agent verification |
| [Frontend](./frontend/) | React architecture, ProseMirror editor, state management |
| [Infrastructure](./infrastructure/) | Rust shim, Tauri config, monorepo, build tooling |
| [Research](./research/) | CS contribution goals: Datalog, graph algorithms, local-first, TUI |
| [Packages](./packages/) | Per-package specifications and API surface |

## Quick Reference

**Tech Stack**: CozoDB (RocksDB) + Tauri v2 + TypeScript + React + ProseMirror

**Core Principle**: All business logic in TypeScript. Rust is infrastructure only (~40 lines). CozoDB's engine handles heavy computation.

**4 CS Contributions**:
1. Datalog as a user-facing query language for personal knowledge
2. Graph algorithms (PageRank, community detection, link prediction) applied to PKM
3. Local-first graph-native architecture that is actually fast
4. Terminal client for graph-based knowledge management
