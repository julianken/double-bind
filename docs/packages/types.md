# @double-bind/types

<!-- last-verified: 2026-02-16 -->

## Purpose

Shared TypeScript types, interfaces, and error types used by all other packages. Zero runtime dependencies. This is Layer 0 — every other package depends on it.

## Public API

See `packages/types/src/index.ts` for the complete export list.

### Core Categories

| Category            | Key Exports                                                            | Source File                       |
| ------------------- | ---------------------------------------------------------------------- | --------------------------------- |
| Domain types        | `Page`, `Block`, `Link`, `BlockRef`, `Tag`, `Property`, `BlockVersion` | `src/domain.ts`                   |
| Database interface  | `Database`, `QueryResult`, `MutationResult`, `TransactionContext`      | `src/database.ts`                 |
| Error types         | `DoubleBindError`, `ErrorCode`                                         | `src/errors.ts`                   |
| Input types         | `CreatePageInput`, `CreateBlockInput`, `UpdateBlockInput`              | `src/inputs.ts`                   |
| Saved queries       | `SavedQuery`, `SavedQueryId`, `SavedQueryType`                         | `src/saved-query.ts`              |
| Search              | `SearchResult`, `SearchOptions`                                        | `src/search.ts`                   |
| Sync protocol       | `SyncEnvelope`, `SyncPayload`, `SyncChange`, etc.                      | `src/sync.ts`                     |
| Conflict resolution | `HybridLogicalClock`, `VersionVector`, `ConflictState`, etc.           | `src/conflict.ts`                 |
| Pagination          | `PaginatedResult`, `PaginationOptions`, `PaginatedQuery`               | `src/pagination.ts`               |
| Mobile lifecycle    | `BatteryState`, `MemoryState`, `CacheConfig`                           | `src/battery.ts`, `src/memory.ts` |

### Database Interface

The `Database` interface (in `src/database.ts`) is the dependency injection boundary for the entire application. It abstracts over:

- **rusqlite** via Tauri IPC (desktop production)
- **better-sqlite3** via HTTP bridge or direct adapter (dev, test, CLI)
- **op-sqlite** (mobile)
- **MockDatabase** (unit tests)

Key design: the `script` parameter name (not `sql`) is intentionally engine-agnostic.

## Internal Structure

```
packages/types/src/
├── index.ts          # Barrel export
├── domain.ts         # Page, Block, Link, etc.
├── database.ts       # Database interface, QueryResult, TransactionContext
├── errors.ts         # DoubleBindError, ErrorCode
├── inputs.ts         # CreatePageInput, etc.
├── saved-query.ts    # SavedQuery types
├── search.ts         # SearchResult, SearchOptions
├── sync.ts           # Sync protocol types
├── conflict.ts       # Conflict resolution types
├── pagination.ts     # Pagination types
├── streaming.ts      # Streaming types
├── battery.ts        # Battery optimization types
├── memory.ts         # Memory management types
└── utils.ts          # Type utilities (DeepPartial)
```

## Dependencies

None. Zero dependencies including zero devDependencies beyond TypeScript.

## Testing

Minimal — types are validated by the TypeScript compiler. Test only error class construction and type guard functions.
