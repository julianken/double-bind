# System Overview

## Architecture Summary

Double-Bind is a 10-package TypeScript monorepo with a Tauri desktop shell. The core insight: CozoDB's Rust engine handles all heavy computation (graph algorithms, full-text search, recursive queries), so TypeScript handles 100% of business logic with no perceptible performance penalty.

```
┌─────────────────────────────────────────────────┐
│                   Desktop App                    │
│  ┌──────────────────────────────────────────┐   │
│  │            React + ProseMirror            │   │
│  │   (page editor, graph view, search UI)    │   │
│  └──────────────┬───────────────────────────┘   │
│                  │                               │
│  ┌──────────────┴───────────────────────────┐   │
│  │     Zustand + useCozoQuery (state)         │   │
│  └──────────────┬───────────────────────────┘   │
│                  │                               │
│  ┌──────────────┴───────────────────────────┐   │
│  │   Services (PageService, BlockService)    │   │
│  └──────────────┬───────────────────────────┘   │
│                  │                               │
│  ┌──────────────┴───────────────────────────┐   │
│  │  Repositories (parameterized Datalog)     │   │
│  └──────────────┬───────────────────────────┘   │
│                  │                               │
│  ┌──────────────┴───────────────────────────┐   │
│  │     GraphDB Interface (DI boundary)       │   │
│  └──────────────┬───────────────────────────┘   │
│                  │ invoke()                      │
│  ════════════════╪══════════════════════════════ │
│                  │ Tauri IPC                     │
│  ┌──────────────┴───────────────────────────┐   │
│  │      Rust Shim (5 commands, ~40 LOC)      │   │
│  └──────────────┬───────────────────────────┘   │
│                  │                               │
│  ┌──────────────┴───────────────────────────┐   │
│  │         CozoDB Engine (RocksDB)           │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Key Properties

- **Local-first**: All data on the user's machine. No cloud dependency.
- **Graph-native**: CozoDB stores relations with Datalog queries. Not a graph bolted onto SQL.
- **Blocks are first-class**: Every block has a unique ID. References survive moves. Blocks are more fundamental than pages.
- **Minimal Rust**: The Rust shim is infrastructure. It forwards queries to CozoDB and enforces read/write separation. It never changes when the data model changes.
- **Plugin-extensible**: Extension points for commands, importers, exporters, graph algorithms from day 1.

## Shared Core

The `core` package contains all business logic and is consumed by three clients:

| Client | Package | Runtime |
|--------|---------|---------|
| Desktop | `desktop` | Tauri webview (React) |
| Terminal | `tui` | Node.js (Ink/React) |
| CLI | `cli` | Node.js |

All three share the same GraphDB interface. The desktop app uses Tauri IPC to reach CozoDB. The TUI and CLI use `cozo-node` NAPI bindings directly.
