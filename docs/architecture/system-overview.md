# System Overview

<!-- last-verified: 2026-02-16 -->

## Architecture Summary

Double-Bind is a TypeScript monorepo with a Tauri desktop shell and React Native mobile app. SQLite handles data persistence; graph algorithms and business logic run in TypeScript. The Rust layer is a thin IPC shim wrapping rusqlite.

```
┌─────────────────────────────────────────────────┐
│                   Desktop App                    │
│  ┌──────────────────────────────────────────┐   │
│  │            React + ProseMirror            │   │
│  │   (page editor, graph view, search UI)    │   │
│  └──────────────┬───────────────────────────┘   │
│                  │                               │
│  ┌──────────────┴───────────────────────────┐   │
│  │       Zustand + Query Hooks (state)       │   │
│  └──────────────┬───────────────────────────┘   │
│                  │                               │
│  ┌──────────────┴───────────────────────────┐   │
│  │   Services (PageService, BlockService)    │   │
│  └──────────────┬───────────────────────────┘   │
│                  │                               │
│  ┌──────────────┴───────────────────────────┐   │
│  │     Repositories (parameterized SQL)      │   │
│  └──────────────┬───────────────────────────┘   │
│                  │                               │
│  ┌──────────────┴───────────────────────────┐   │
│  │      Database Interface (DI boundary)     │   │
│  └──────────────┬───────────────────────────┘   │
│                  │ invoke()                      │
│  ════════════════╪══════════════════════════════ │
│                  │ Tauri IPC                     │
│  ┌──────────────┴───────────────────────────┐   │
│  │        Rust Shim (IPC → rusqlite)         │   │
│  └──────────────┬───────────────────────────┘   │
│                  │                               │
│  ┌──────────────┴───────────────────────────┐   │
│  │            SQLite (WAL mode)              │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Key Properties

- **Local-first**: All data on the user's machine. No cloud dependency.
- **Graph-native**: Recursive CTEs for graph traversal, FTS5 for search, TypeScript for graph algorithms. Graph operations are first-class, not bolted on.
- **Blocks are first-class**: Every block has a unique ULID. References survive moves. Blocks are more fundamental than pages.
- **Minimal Rust**: The Rust shim forwards SQL to rusqlite and returns results. It never changes when the data model changes.
- **Plugin-extensible**: Extension points for commands, importers, exporters, graph algorithms from day 1.

## Shared Core

The `core` package contains all business logic and is consumed by multiple clients:

| Client               | Package      | Database Adapter                                          |
| -------------------- | ------------ | --------------------------------------------------------- |
| Desktop (production) | `desktop`    | `TauriDatabaseProvider` → rusqlite via IPC                |
| Desktop (dev/test)   | `desktop`    | `HttpDatabaseProvider` → better-sqlite3 via bridge server |
| Mobile               | `mobile-app` | `MobileDatabaseProvider` → op-sqlite                      |
| Integration tests    | `core`       | `SqliteNodeAdapter` → better-sqlite3 directly             |

All share the same `Database` interface (defined in `packages/types/src/database.ts`). The adapter is the only thing that differs per platform.
