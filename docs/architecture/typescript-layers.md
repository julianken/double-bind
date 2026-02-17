# TypeScript Architecture Layers

<!-- last-verified: 2026-02-16 -->

## Layer Diagram

```
┌──────────────────────────────────────┐
│  React Components                    │  ← UI layer (desktop, mobile)
├──────────────────────────────────────┤
│  Zustand + Query Hooks               │  ← State management
├──────────────────────────────────────┤
│  Services                            │  ← Business logic orchestration
│  (PageService, BlockService, etc.)   │
├──────────────────────────────────────┤
│  Repositories                        │  ← Data access (parameterized SQL)
│  (PageRepo, BlockRepo, etc.)         │
├──────────────────────────────────────┤
│  Database Interface                  │  ← DI boundary (from types package)
├──────────────────────────────────────┤
│  Database Adapter                    │  ← Concrete implementation per platform
│  (TauriDatabaseProvider, SqliteNode) │
└──────────────────────────────────────┘
```

## Database Interface

Defined in `packages/types/src/database.ts`. This is the dependency injection boundary.

Three implementations:

- **TauriDatabaseProvider** (in `desktop`): Calls `invoke()` over Tauri IPC → rusqlite
- **HttpDatabaseProvider** (in `desktop`): HTTP calls to bridge server → better-sqlite3 (dev mode)
- **SqliteNodeAdapter** (in `core`): Wraps better-sqlite3 directly (integration tests, CLI tools)
- **MockDatabase** (in `test-utils`): In-memory mock for unit tests

## Repository Layer

Repositories live in `packages/core/src/repositories/`. Each repository:

- Encapsulates ALL SQL strings for a domain entity
- Uses parameterized queries exclusively (never string interpolation)
- Returns typed domain objects, never raw DB rows

```
core/src/repositories/
├── page-repository.ts        # CRUD for pages
├── block-repository.ts       # CRUD for blocks + tree operations
├── link-repository.ts        # Links and block references
├── tag-repository.ts         # Tags on entities
├── property-repository.ts    # Key-value properties
└── saved-query-repository.ts # Saved queries
```

**Key rule**: No SQL strings exist outside the repository layer.

## Service Layer

Services live in `packages/core/src/services/`. Each service:

- Orchestrates multiple repositories
- Handles cross-cutting concerns (parsing content for links, rebalancing block order keys)
- Is what UI components actually call
- Has no knowledge of Tauri, React, or any UI framework

```
core/src/services/
├── page-service.ts        # Page lifecycle, daily notes, backlinks
├── block-service.ts       # Block CRUD, move, indent/outdent, content parsing
├── graph-service.ts       # Graph algorithms, neighborhood queries
├── search-service.ts      # FTS5 search across blocks and pages
├── saved-query-service.ts # Saved query CRUD and execution
└── index.ts               # createServices() factory
```

## Why This Layering?

1. **Testability**: Services and repositories test against MockDatabase. No Tauri, no SQLite, no browser needed.
2. **Portability**: Desktop, mobile, and CLI all call the same services. Only the Database adapter differs.
3. **Refactoring safety**: Change a SQL query in one repository method. No other code is affected.
4. **Type safety**: TypeScript types enforce the API contract. Runtime parsing validates rows from SQLite.

## Content Parsing Pipeline

```
Raw block text → parseContent() → ParsedContent { pageLinks, blockRefs, tags, properties }
                                          ↓
                           BlockService.updateContent() uses ParsedContent to:
                           1. Remove old links/refs/tags
                           2. Create new entries via repositories
                           3. Auto-create missing pages for [[wiki links]]
                           4. Save updated block content
```

The parser is defined in `packages/core/src/parsers/content-parser.ts`.
