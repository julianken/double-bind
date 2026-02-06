# @double-bind/core

## Purpose

The heart of the application. Contains all business logic: repositories (Datalog query construction), services (orchestration), and the CozoDB client adapter. This package is shared between desktop, CLI, and TUI.

## Public API

### Repositories

Each repository encapsulates Datalog queries for one domain entity.

```typescript
class PageRepository {
  constructor(db: GraphDB);

  getById(pageId: PageId): Promise<Page | null>;
  getAll(options?: { includeDeleted?: boolean }): Promise<Page[]>;
  search(query: string): Promise<Page[]>;
  create(input: CreatePageInput): Promise<PageId>;
  update(pageId: PageId, input: Partial<Page>): Promise<void>;
  softDelete(pageId: PageId): Promise<void>;
  getByDailyNoteDate(date: string): Promise<Page | null>;
  getOrCreateDailyNote(date: string): Promise<Page>;
}

class BlockRepository {
  constructor(db: GraphDB);

  getById(blockId: BlockId): Promise<Block | null>;
  getByPage(pageId: PageId): Promise<Block[]>;
  getChildren(parentKey: string): Promise<Block[]>;  // parentKey is block_id or "__page:<page_id>" sentinel
  create(input: CreateBlockInput): Promise<BlockId>;
  update(blockId: BlockId, input: UpdateBlockInput): Promise<void>;
  softDelete(blockId: BlockId): Promise<void>;
  move(blockId: BlockId, newParentId: BlockId | null, newOrder: string): Promise<void>;
  search(query: string): Promise<Block[]>;
  getHistory(blockId: BlockId): Promise<BlockVersion[]>;
}

class LinkRepository {
  constructor(db: GraphDB);

  getOutLinks(pageId: PageId): Promise<Link[]>;
  getInLinks(pageId: PageId): Promise<Link[]>;  // backlinks
  getBlockBacklinks(blockId: BlockId): Promise<BlockRef[]>;
  createLink(link: Omit<Link, 'createdAt'>): Promise<void>;
  createBlockRef(ref: Omit<BlockRef, 'createdAt'>): Promise<void>;
  removeLinksFromBlock(blockId: BlockId): Promise<void>;
}

class TagRepository {
  constructor(db: GraphDB);

  getByEntity(entityId: string): Promise<Tag[]>;
  getByTag(tag: string): Promise<Tag[]>;
  getAllTags(): Promise<string[]>;
  addTag(entityId: string, tag: string): Promise<void>;
  removeTag(entityId: string, tag: string): Promise<void>;
}

class PropertyRepository {
  constructor(db: GraphDB);

  getByEntity(entityId: string): Promise<Property[]>;
  set(entityId: string, key: string, value: string, valueType?: string): Promise<void>;
  remove(entityId: string, key: string): Promise<void>;
}
```

### Services

Services orchestrate repositories and handle cross-cutting concerns.

```typescript
class PageService {
  constructor(pageRepo: PageRepository, blockRepo: BlockRepository, linkRepo: LinkRepository);

  createPage(title: string): Promise<Page>;
  getPageWithBlocks(pageId: PageId): Promise<{ page: Page; blocks: Block[] }>;
  deletePage(pageId: PageId): Promise<void>;  // soft delete page + all blocks
  getTodaysDailyNote(): Promise<Page>;
  searchPages(query: string): Promise<Page[]>;
}

class BlockService {
  constructor(
    blockRepo: BlockRepository,
    linkRepo: LinkRepository,
    tagRepo: TagRepository,
    propertyRepo: PropertyRepository,
  );

  updateContent(blockId: BlockId, content: string): Promise<void>;
  // ^ Parses content for [[links]], ((refs)), #tags, key:: values
  // ^ Updates block_refs, links, tags, properties accordingly

  createBlock(pageId: PageId, parentId: BlockId | null, content: string, afterBlockId?: BlockId): Promise<Block>;
  deleteBlock(blockId: BlockId): Promise<void>;
  moveBlock(blockId: BlockId, newParentId: BlockId | null, afterBlockId?: BlockId): Promise<void>;
  indentBlock(blockId: BlockId): Promise<void>;
  outdentBlock(blockId: BlockId): Promise<void>;
  toggleCollapse(blockId: BlockId): Promise<void>;
  getBacklinks(blockId: BlockId): Promise<Array<{ block: Block; page: Page }>>;
}

class GraphService {
  constructor(db: GraphDB);

  getFullGraph(): Promise<{ nodes: Page[]; edges: Link[] }>;
  getNeighborhood(pageId: PageId, hops: number): Promise<{ nodes: Page[]; edges: Link[] }>;
  getPageRank(): Promise<Map<PageId, number>>;
  getCommunities(): Promise<Map<PageId, number>>;
  getSuggestedLinks(pageId: PageId): Promise<Array<{ target: Page; score: number }>>;
}

class ImportExportService {
  constructor(db: GraphDB, pageService: PageService, blockService: BlockService);

  importRoamJson(data: unknown): Promise<ImportResult>;
  importMarkdown(files: Array<{ name: string; content: string }>): Promise<ImportResult>;
  exportMarkdown(pageIds?: PageId[]): Promise<Array<{ name: string; content: string }>>;
  exportJson(pageIds?: PageId[]): Promise<unknown>;
  backup(path: string): Promise<void>;
  // restore() is deferred — CozoDB has no "restore from backup" API.
  // Restoring requires replacing the DB file on disk and restarting the app.
  // This will be implemented as a CLI-only operation in a future phase.
}

interface ImportResult {
  pagesCreated: number;
  blocksCreated: number;
  linksCreated: number;
  errors: Array<{ source: string; error: string }>;
}
```

### Content Parser

```typescript
// Parse block content for references, tags, properties
function parseContent(content: string): ParsedContent;

interface ParsedContent {
  pageLinks: Array<{ title: string; startIndex: number; endIndex: number }>;
  blockRefs: Array<{ blockId: string; startIndex: number; endIndex: number }>;
  tags: string[];
  properties: Array<{ key: string; value: string }>;
}
```

### Service Factory

```typescript
// All services bundled for dependency injection
interface Services {
  pageService: PageService;
  blockService: BlockService;
  graphService: GraphService;
  importExportService: ImportExportService;
}

// Factory function — creates all services from a single GraphDB instance.
// Called once at app startup (desktop, TUI, CLI).
function createServices(db: GraphDB): Services {
  const pageRepo = new PageRepository(db);
  const blockRepo = new BlockRepository(db);
  const linkRepo = new LinkRepository(db);
  const tagRepo = new TagRepository(db);
  const propertyRepo = new PropertyRepository(db);

  const pageService = new PageService(pageRepo, blockRepo, linkRepo);
  const blockService = new BlockService(blockRepo, linkRepo, tagRepo, propertyRepo);
  const graphService = new GraphService(db);
  const importExportService = new ImportExportService(db, pageService, blockService);

  return { pageService, blockService, graphService, importExportService };
}
```

### Initialization Sequence

Each client (desktop, TUI, CLI) follows the same startup order:

```
1. Open database connection (CozoDb or Tauri invoke)
2. Run migrations (runMigrations(db))          ← must complete before anything else
3. Create services (createServices(db))        ← only if migrations succeed
4. Render UI (React/Ink) or execute command
```

**Desktop (Tauri)**: Migrations run in Rust's `.setup()` hook (before webview loads). If migration fails, the app crashes with a panic — there is no UI to show an error yet. `createServices()` runs in `main.tsx` after the webview loads; migration is already complete by this point.

**TUI/CLI**: Migrations run in the entry point before any UI rendering:

```typescript
// packages/tui/src/index.ts (and similar for CLI)
const db = createCozoNodeGraphDB(dbPath);

const migrationResult = await runMigrations(db);
if (migrationResult.errors.length > 0) {
  console.error('Migration failed:', migrationResult.errors);
  process.exit(3); // database error exit code
}

const services = createServices(db);
// Now safe to render UI or run commands
```

If `createServices()` itself throws (e.g., invalid GraphDB), this is a fatal startup error — the app cannot recover without code changes.

### Zod Validation Schemas

Repositories validate CozoDB query results at the boundary between raw rows and domain types. Zod schemas live alongside their repository:

```
packages/core/src/repositories/
├── page-repository.ts
├── page-repository.schemas.ts     ← Zod schemas for Page results
├── block-repository.ts
├── block-repository.schemas.ts    ← Zod schemas for Block results
└── ...
```

Each schema validates the row→object transformation:

```typescript
// page-repository.schemas.ts
import { z } from 'zod';

export const PageRowSchema = z.tuple([
  z.string(),           // page_id
  z.string(),           // title
  z.number(),           // created_at
  z.number(),           // updated_at
  z.string().nullable() // daily_note_date
]);

export const PageSchema = z.object({
  pageId: z.string(),
  title: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  dailyNoteDate: z.string().nullable(),
});

// Used in PageRepository:
function parsePageRow(row: unknown[]): Page {
  const [pageId, title, createdAt, updatedAt, dailyNoteDate] = PageRowSchema.parse(row);
  return PageSchema.parse({ pageId, title, createdAt, updatedAt, dailyNoteDate });
}
```

**Validation only runs on data coming FROM CozoDB** — not on data going TO CozoDB (params are already typed by TypeScript). If Zod validation fails, the repository throws `DoubleBindError(ErrorCode.DB_QUERY_FAILED)` with the Zod error as the cause.

## Internal Structure

```
packages/core/src/
├── index.ts                    # Barrel export
├── repositories/
│   ├── page-repository.ts
│   ├── block-repository.ts
│   ├── link-repository.ts
│   ├── tag-repository.ts
│   └── property-repository.ts
├── services/
│   ├── page-service.ts
│   ├── block-service.ts
│   ├── graph-service.ts
│   └── import-export-service.ts
├── parsers/
│   ├── content-parser.ts       # Extract links, refs, tags from text
│   └── sanitizer.ts            # DOMPurify wrapper for import
├── utils/
│   ├── ordering.ts             # String-based fractional indexing (rocicorp/fractional-indexing)
│   └── ulid.ts                 # ULID generation
└── client/
    └── tauri-graph-db.ts       # GraphDB implementation via Tauri invoke
```

## Dependencies

- `@double-bind/types` — domain types, GraphDB interface
- `@double-bind/query-lang` — query compilation for user queries
- `@double-bind/graph-algorithms` — graph analysis
- `@double-bind/migrations` — schema version checking
- `zod` — runtime validation of CozoDB results
- `ulid` — ID generation
- `dompurify` — content sanitization (for import)

## Testing

### Unit Tests (Layer 1)

- Repository: verify correct Datalog construction and parameter passing
- Service: verify orchestration logic (e.g., content parsing triggers link updates)
- Content parser: verify extraction of links, refs, tags, properties
- Ordering: verify string-based fractional indexing (key generation between existing keys, rebalance trigger)

### Integration Tests (Layer 2)

- Repository: execute against real CozoDB, verify data round-trips
- Service: full stack through repository to CozoDB
- Import: parse real Roam JSON / Markdown and verify correct storage
- Graph: algorithm queries return expected results

## Content Parser Grammar

The content parser uses regex patterns (not a parser combinator — the syntax is simple and fixed):

```typescript
const PATTERNS = {
  // [[Page Name]] — page links
  pageLink: /\[\[([^\]]+)\]\]/g,

  // ((block_id)) — block references (ULID inside parens)
  blockRef: /\(\(([0-9A-HJKMNP-TV-Z]{26})\)\)/g,

  // #tag or #[[multi word tag]] — tags
  tag: /#(?:\[\[([^\]]+)\]\]|(\w[\w-]*))/g,

  // key:: value — properties (at start of block only)
  property: /^(\w[\w\s-]*):: (.+)$/m,
};
```

Parser returns `ParsedContent` with positions for each match. This enables highlighting in ProseMirror and accurate link/ref management on content updates.

## Error Handling Strategy

**Throw `DoubleBindError` everywhere.** The `Result<T, E>` pattern adds complexity without benefit in a UI app where errors bubble to React Error Boundaries.

```
Repository throws DoubleBindError(code)
    ↓
Service catches, wraps with context, re-throws
    ↓
useCozoQuery catches, stores in error state
    ↓
React Error Boundary renders fallback UI
```

**Tauri client error mapping**: The Rust shim returns plain error strings. The TypeScript client maps known prefixes to `ErrorCode`:

```typescript
function mapError(errorString: string): DoubleBindError {
  if (errorString.startsWith('Blocked operation:'))
    return new DoubleBindError(errorString, ErrorCode.BLOCKED_OPERATION);
  // CozoDB query errors contain "query" or the relation name
  return new DoubleBindError(errorString, ErrorCode.DB_QUERY_FAILED);
}
```

## Ordering Rebalance

String-based fractional indexing (`rocicorp/fractional-indexing`) generates keys between any two existing keys. In pathological cases (e.g., always inserting at the same position), keys grow unboundedly long. Rebalance is triggered when any key exceeds 50 characters, regenerating keys for all siblings of the affected block with even spacing.

## DOMPurify Import Configuration

Shared with `content-rendering.md` — same allowlist. Configured in `parsers/sanitizer.ts` and used by `ImportExportService` before any content enters the database.

## Database Path Resolution

Each client resolves the database path differently, but all access the same RocksDB database:

| Client | Resolution Order | Default Path |
|--------|-----------------|--------------|
| Desktop (Tauri) | `app.path().app_data_dir()/db` (hardcoded) | macOS: `~/Library/Application Support/com.double-bind.app/db` |
| | | Linux: `~/.local/share/double-bind/db` |
| | | Windows: `%APPDATA%/double-bind/db` |
| TUI | `DOUBLE_BIND_DB_PATH` env → platform default | Same paths as desktop |
| CLI | `--db` flag → `DOUBLE_BIND_DB_PATH` env → config file → platform default | Same paths as desktop |
| Tests (integration) | In-memory (`new CozoDb('mem')`) | No disk path |
| Tests (E2E full) | Temp directory per test run | `/tmp/double-bind-test-<uuid>/db` |

**File locking**: RocksDB enforces exclusive access at the OS level. If the desktop app has the database open, TUI/CLI will fail with a `DB_CONNECTION_FAILED` error. Only one process can access the database at a time. This is acceptable for a local-first single-user app.

**Platform default path for TUI/CLI** (when no flag/env var is set):

```typescript
function getDefaultDbPath(): string {
  const platform = process.platform;
  const home = os.homedir();
  if (platform === 'darwin') return path.join(home, 'Library/Application Support/com.double-bind.app/db');
  if (platform === 'win32') return path.join(process.env.APPDATA!, 'double-bind/db');
  // Linux / other: XDG_DATA_HOME or ~/.local/share
  const dataHome = process.env.XDG_DATA_HOME || path.join(home, '.local/share');
  return path.join(dataHome, 'double-bind/db');
}
```

## Daily Notes System

Daily notes use ISO date format (`YYYY-MM-DD`) and are stored in the `daily_notes` lookup relation.

- **Date format**: ISO 8601 date string, e.g., `"2025-03-15"`. Always the local date in the user's timezone.
- **Page title**: The ISO date string itself (e.g., `"2025-03-15"`). UI rendering can format this for display.
- **Collision handling**: `getOrCreateDailyNote(date)` checks `daily_notes` first. If a page exists for that date, it returns it. If not, it creates a new page and inserts into `daily_notes`. This is a read-then-write (not atomic), but collisions are impossible in a single-user app.
- **Automatic creation**: `getTodaysDailyNote()` calls `getOrCreateDailyNote(new Date().toISOString().split('T')[0])`. The desktop app calls this on startup to show today's note as the home screen.

## Query Invalidation Matrix

After each mutation, the calling code must invalidate affected `useCozoQuery` cache keys:

| Mutation | Invalidate Keys |
|----------|----------------|
| `pageService.createPage()` | `['pages']` |
| `pageService.deletePage(id)` | `['pages']`, `['blocks', 'byPage', id]`, `['backlinks']` |
| `blockService.createBlock(pageId, ...)` | `['blocks', 'byPage', pageId]`, `['blocks', 'byParent']` |
| `blockService.updateContent(blockId, ...)` | `['blocks']`, `['backlinks']`, `['search']`, `['links']` |
| `blockService.deleteBlock(blockId)` | `['blocks']`, `['backlinks']`, `['search']` |
| `blockService.moveBlock(blockId, ...)` | `['blocks', 'byPage']`, `['blocks', 'byParent']` |
| `blockService.indentBlock(blockId)` | `['blocks', 'byParent']` |
| `blockService.outdentBlock(blockId)` | `['blocks', 'byParent']` |
| `importExportService.importRoamJson(...)` | `['pages']`, `['blocks']`, `['backlinks']`, `['search']` |

Invalidation is called by the mutation wrapper functions in the desktop's hooks layer (e.g., `useUpdateBlock`), not inside the core services themselves. This keeps the core package UI-framework-agnostic.

## Resolved Decisions

- **Datalog query strings**: Defined in `query-patterns.md`; each repository method maps to one query pattern.
- **Content parser**: Regex-based (see grammar above). Simple, fast, no parser library dependency.
- **Ordering rebalance**: Triggered at key length > 50 chars, regenerates sibling keys.
- **DOMPurify config**: Shared allowlist from `content-rendering.md`.
- **Error handling**: Throw `DoubleBindError`, catch with Error Boundaries.
- **Tauri error mapping**: String prefix matching in the TypeScript client.
