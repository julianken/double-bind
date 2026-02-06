# @double-bind/types

## Purpose

Shared TypeScript types, interfaces, and error types used by all other packages. Zero runtime dependencies.

## Public API

### Domain Types

```typescript
// Identifiers
type PageId = string;   // ULID
type BlockId = string;  // ULID

// Core entities
interface Page {
  pageId: PageId;
  title: string;
  createdAt: number;    // Unix timestamp (float)
  updatedAt: number;
  isDeleted: boolean;
  dailyNoteDate: string | null; // YYYY-MM-DD or null
}

interface Block {
  blockId: BlockId;
  pageId: PageId;
  parentId: BlockId | null; // null = root block of page
  content: string;
  contentType: 'text' | 'heading' | 'code' | 'todo' | 'query';
  order: string;            // String-based fractional indexing (rocicorp/fractional-indexing)
  isCollapsed: boolean;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
}

interface BlockRef {
  sourceBlockId: BlockId;
  targetBlockId: BlockId;
  createdAt: number;
}

interface Link {
  sourceId: PageId;
  targetId: PageId;
  linkType: 'reference' | 'embed' | 'tag';
  createdAt: number;
  contextBlockId: BlockId | null;
}

interface Property {
  entityId: string;       // PageId or BlockId
  key: string;
  value: string;
  valueType: 'string' | 'number' | 'boolean' | 'date';
  updatedAt: number;
}

interface Tag {
  entityId: string;
  tag: string;
  createdAt: number;
}

interface BlockVersion {
  blockId: BlockId;
  version: number;
  content: string;
  parentId: BlockId | null;
  order: string;
  isCollapsed: boolean;
  isDeleted: boolean;
  operation: 'create' | 'update' | 'delete' | 'move' | 'restore';
  timestamp: number;
}
```

### GraphDB Interface

```typescript
interface QueryResult<T = unknown> {
  headers: string[];
  rows: T[][];
}

interface MutationResult {
  headers: string[];
  rows: unknown[][];
}

interface GraphDB {
  query<T = unknown>(script: string, params?: Record<string, unknown>): Promise<QueryResult<T>>;
  mutate(script: string, params?: Record<string, unknown>): Promise<MutationResult>;
  importRelations(data: Record<string, unknown[][]>): Promise<void>;
  exportRelations(relations: string[]): Promise<Record<string, unknown[][]>>;
  backup(path: string): Promise<void>;
}
```

### Error Types

```typescript
class DoubleBindError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'DoubleBindError';
  }
}

enum ErrorCode {
  // Database
  DB_CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
  DB_QUERY_FAILED = 'DB_QUERY_FAILED',
  DB_MUTATION_FAILED = 'DB_MUTATION_FAILED',

  // Domain
  PAGE_NOT_FOUND = 'PAGE_NOT_FOUND',
  BLOCK_NOT_FOUND = 'BLOCK_NOT_FOUND',
  INVALID_CONTENT = 'INVALID_CONTENT',
  CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',

  // Import/Export
  IMPORT_PARSE_ERROR = 'IMPORT_PARSE_ERROR',
  EXPORT_WRITE_ERROR = 'EXPORT_WRITE_ERROR',

  // Security
  BLOCKED_OPERATION = 'BLOCKED_OPERATION',
}
```

### Input Types (for create/update operations)

```typescript
interface CreatePageInput {
  title: string;
  dailyNoteDate?: string;
}

interface CreateBlockInput {
  pageId: PageId;
  parentId?: BlockId;
  content: string;
  contentType?: Block['contentType'];
  order?: string;
}

interface UpdateBlockInput {
  content?: string;
  parentId?: BlockId | null;
  order?: string;
  isCollapsed?: boolean;
}
```

## Internal Structure

```
packages/types/src/
├── index.ts          # Barrel export
├── domain.ts         # Page, Block, Link, etc.
├── graph-db.ts       # GraphDB interface, QueryResult
├── errors.ts         # DoubleBindError, ErrorCode
├── inputs.ts         # CreatePageInput, etc.
└── utils.ts          # Type utilities (DeepPartial, etc.)
```

## Dependencies

None. This package has zero dependencies, including zero devDependencies beyond TypeScript itself.

## Testing

Minimal — types are validated by the TypeScript compiler. Test only:
- Error class construction
- Type guard functions (if any)

<!-- TODO: Define type guard functions (isPage, isBlock, etc.) -->
<!-- TODO: Define serialization types (for CozoDB row → domain type mapping) -->
<!-- TODO: Define plugin-related types (PluginManifest, PluginAPI) -->
<!-- TODO: Define event types (for future event bus / pub-sub) -->
