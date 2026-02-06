# TypeScript Architecture Layers

## Layer Diagram

```
┌──────────────────────────────────────┐
│  React Components / Ink Components   │  ← UI layer (desktop or tui)
├──────────────────────────────────────┤
│  Zustand + useCozoQuery               │  ← State management
├──────────────────────────────────────┤
│  Services                            │  ← Business logic orchestration
│  (PageService, BlockService, etc.)   │
├──────────────────────────────────────┤
│  Repositories                        │  ← Data access, Datalog queries
│  (PageRepo, BlockRepo, etc.)         │
├──────────────────────────────────────┤
│  GraphDB Interface                   │  ← DI boundary (from types package)
├──────────────────────────────────────┤
│  CozoDB Client                       │  ← Concrete implementation
│  (TauriGraphDB or NodeGraphDB)       │
└──────────────────────────────────────┘
```

## GraphDB Interface

Defined in `packages/types`. This is the dependency injection boundary.

```typescript
interface GraphDB {
  query<T>(script: string, params?: Record<string, unknown>): Promise<QueryResult<T>>;
  mutate(script: string, params?: Record<string, unknown>): Promise<MutationResult>;
  importRelations(data: Record<string, unknown[][]>): Promise<void>;
  exportRelations(relations: string[]): Promise<Record<string, unknown[][]>>;
  backup(path: string): Promise<void>;
}
```

Two implementations:
- **TauriGraphDB** (in `desktop`): Calls `invoke()` over Tauri IPC
- **NodeGraphDB** (in `cli`/`tui`): Calls `cozo-node` NAPI bindings directly
- **MockGraphDB** (in `test-utils`): In-memory mock for unit tests

## Repository Layer

Repositories live in `packages/core`. Each repository:
- Encapsulates ALL Datalog strings for a domain entity
- Uses parameterized queries exclusively (never string interpolation)
- Co-locates queries with their return types and Zod schemas
- Returns typed domain objects, never raw DB rows

```
core/src/repositories/
├── page-repository.ts      # CRUD for pages
├── block-repository.ts     # CRUD for blocks + index maintenance
├── link-repository.ts      # Links and block references
├── tag-repository.ts       # Tags on entities
└── property-repository.ts  # Key-value properties
```

**Key rule**: No Datalog strings exist outside the repository layer.

## Service Layer

Services live in `packages/core`. Each service:
- Orchestrates multiple repositories
- Handles cross-cutting concerns (updating indexes when blocks move, parsing content for references)
- Is what UI components actually call
- Has no knowledge of Tauri, React, or any UI framework

```
core/src/services/
├── page-service.ts             # Page lifecycle, daily notes, search
├── block-service.ts            # Block CRUD, move, indent/outdent, content parsing
├── graph-service.ts            # Graph algorithms, visualization data
└── import-export-service.ts    # Roam JSON / markdown import, markdown / JSON export
```

## Why This Layering?

1. **Testability**: Services and repositories test against MockGraphDB. No Tauri, no CozoDB, no browser needed.
2. **Portability**: Desktop, TUI, and CLI all call the same services. Only the GraphDB implementation differs.
3. **Refactoring safety**: Change a Datalog query in one repository method. No other code is affected.
4. **Type safety**: Zod validation at the repository boundary catches schema drift at runtime. TypeScript types catch it at compile time above that layer.

## Error Handling at Each Layer

```
Repository: throws DoubleBindError with specific ErrorCode (DB_QUERY_FAILED, PAGE_NOT_FOUND, etc.)
     ↓
Service: catches, wraps with context, re-throws DoubleBindError
     ↓
useCozoQuery: catches, stores error in Zustand query entry
     ↓
React component: reads error from hook return, renders error UI
     ↓
Error Boundary: catches unhandled errors, renders fallback
```

## useCozoQuery Hook Pattern

useCozoQuery wraps service calls with Zustand-backed caching and key-based invalidation. See [State Management](../frontend/state-management.md) for the full implementation.

## Content Parsing Pipeline

```
Raw block text → parseContent() → ParsedContent { pageLinks, blockRefs, tags, properties }
                                          ↓
                           BlockService.updateContent() uses ParsedContent to:
                           1. Diff against previous parse result
                           2. Create/remove entries in links, block_refs, tags, properties relations
                           3. Save updated block content
```

The parser uses regex patterns defined in `core/src/parsers/content-parser.ts`. See the [core package](../packages/core.md) for the grammar.
