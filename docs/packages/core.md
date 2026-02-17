# @double-bind/core

<!-- last-verified: 2026-02-16 -->

## Purpose

The heart of the application. Contains all business logic: repositories (SQL query construction), services (orchestration), adapters (database wrappers), and providers (platform-agnostic database lifecycle). Shared between desktop, mobile, and CLI tools.

## Public API

See `packages/core/src/index.ts` for the complete export list.

### Repositories

Each repository encapsulates parameterized SQL for one domain entity. All take a `Database` instance via constructor injection.

| Repository             | Domain                           | Source                                       |
| ---------------------- | -------------------------------- | -------------------------------------------- |
| `PageRepository`       | Pages, daily notes, page search  | `src/repositories/page-repository.ts`        |
| `BlockRepository`      | Blocks, tree operations, history | `src/repositories/block-repository.ts`       |
| `LinkRepository`       | Page links, block references     | `src/repositories/link-repository.ts`        |
| `TagRepository`        | Tags with counts                 | `src/repositories/tag-repository.ts`         |
| `PropertyRepository`   | Key-value properties             | `src/repositories/property-repository.ts`    |
| `SavedQueryRepository` | Saved queries                    | `src/repositories/saved-query-repository.ts` |

**Key rule**: No SQL strings exist outside the repository layer.

### Services

Services orchestrate multiple repositories and handle cross-cutting concerns.

| Service             | Responsibilities                                                | Source                                |
| ------------------- | --------------------------------------------------------------- | ------------------------------------- |
| `PageService`       | Page lifecycle, daily notes, backlinks, cascading deletes       | `src/services/page-service.ts`        |
| `BlockService`      | Block CRUD, content parsing, auto-link creation, indent/outdent | `src/services/block-service.ts`       |
| `GraphService`      | Neighborhood queries, graph algorithms, visualization data      | `src/services/graph-service.ts`       |
| `SearchService`     | FTS5 search across blocks and pages                             | `src/services/search-service.ts`      |
| `SavedQueryService` | Saved query CRUD and execution                                  | `src/services/saved-query-service.ts` |

### Service Factory

```
createServices(db: Database) → Services
createServicesFromProvider(provider: DatabaseProvider) → Services
```

Called once at app startup. Creates all repositories and services with their dependencies wired up. See `src/services/index.ts`.

### Adapters and Providers

| Export              | Purpose                                                     | Source                                |
| ------------------- | ----------------------------------------------------------- | ------------------------------------- |
| `SqliteNodeAdapter` | Wraps `better-sqlite3` with async `Database` interface      | `src/adapters/sqlite-node-adapter.ts` |
| `DatabaseProvider`  | Platform-agnostic database lifecycle (init, migrate, close) | `src/providers/database-provider.ts`  |

### Content Parser

`parseContent(text)` extracts `[[wiki links]]`, `((block refs))`, `#tags`, and `key:: value` properties from block text. Returns `ParsedContent` with positions for editor integration. See `src/parsers/content-parser.ts`.

## Internal Structure

```
packages/core/src/
├── index.ts
├── repositories/           # SQL query construction per entity
├── services/               # Business logic orchestration
├── parsers/                # Content parser (links, refs, tags)
├── utils/                  # Fractional indexing, ordering
├── adapters/               # SqliteNodeAdapter (better-sqlite3 wrapper)
└── providers/              # DatabaseProvider interface
```

## Dependencies

**Internal:** `@double-bind/types`, `@double-bind/migrations`
**Key external:** `ulid`, `dompurify`

## Testing

- **Unit tests (Layer 1):** Repository SQL construction, service orchestration, content parser, ordering utilities. Uses `MockDatabase` from `@double-bind/test-utils`.
- **Integration tests (Layer 2):** Full SQL execution against real SQLite via `better-sqlite3`. Repository CRUD, FTS5 search, graph queries, migration application.

See `packages/core/test/` for test files.
