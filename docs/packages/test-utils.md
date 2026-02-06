# @double-bind/test-utils

## Purpose

Provides `MockGraphDB` and test data factories for unit testing across all packages. Any package that tests code using the `GraphDB` interface depends on this package.

## Public API

### MockGraphDB

```typescript
class MockGraphDB implements GraphDB {
  // Seed data into mock relations
  seed(relation: string, rows: unknown[][]): void;

  // GraphDB interface
  query<T>(script: string, params?: Record<string, unknown>): Promise<QueryResult<T>>;
  mutate(script: string, params?: Record<string, unknown>): Promise<MutationResult>;
  importRelations(data: Record<string, unknown[][]>): Promise<void>;
  exportRelations(relations: string[]): Promise<Record<string, unknown[][]>>;
  backup(path: string): Promise<void>;

  // Test inspection
  readonly queries: Array<{ script: string; params: Record<string, unknown> }>;
  readonly mutations: Array<{ script: string; params: Record<string, unknown> }>;
  readonly lastQuery: { script: string; params: Record<string, unknown> };
  readonly lastMutation: { script: string; params: Record<string, unknown> };
  reset(): void;
}
```

### How MockGraphDB Works

MockGraphDB does **not** evaluate Datalog. Instead, it uses pattern matching on the query string to determine which seeded data to return:

```typescript
const db = new MockGraphDB();
db.seed('pages', [
  ['page-1', 'My Page', 1700000000, 1700000000, false, null],
  ['page-2', 'Other Page', 1700000000, 1700000000, false, null],
]);

// When query contains '*pages', return seeded pages data
const result = await db.query('?[page_id, title] := *pages{ page_id, title }');
// result.rows = [['page-1', 'My Page'], ['page-2', 'Other Page']]
```

This is sufficient for unit tests that verify:
- Correct query strings are constructed
- Correct params are passed
- Results are correctly mapped to domain types

It is NOT sufficient for testing Datalog semantics — use integration tests with real CozoDB for that.

### Test Factories

```typescript
// Create domain objects with sensible defaults
function createPage(overrides?: Partial<Page>): Page;
function createBlock(overrides?: Partial<Block>): Block;
function createLink(overrides?: Partial<Link>): Link;
function createBlockRef(overrides?: Partial<BlockRef>): BlockRef;

// Create with auto-generated IDs
function createPageWithId(overrides?: Partial<Page>): Page;  // generates ULID
function createBlockWithId(overrides?: Partial<Block>): Block;

// Create test datasets
function createPageWithBlocks(blockCount: number): { page: Page; blocks: Block[] };
function createLinkedPages(pageCount: number, linkDensity: number): { pages: Page[]; links: Link[] };
```

### Fixtures

Pre-built test scenarios:

```typescript
// A small knowledge base for testing
const FIXTURE_SMALL_KB = {
  pages: [/* 5 pages */],
  blocks: [/* 20 blocks */],
  links: [/* 8 links */],
  refs: [/* 3 block refs */],
  tags: [/* 10 tags */],
};

// A page with deep nesting (for tree tests)
const FIXTURE_DEEP_TREE = {
  page: { /* ... */ },
  blocks: [/* 5 levels deep, 3 children per level */],
};

// A graph with known PageRank (for algorithm tests)
const FIXTURE_PAGERANK_GRAPH = {
  pages: [/* ... */],
  links: [/* ... */],
  expectedRanks: { /* page_id -> expected_rank */ },
};
```

## Internal Structure

```
packages/test-utils/src/
├── index.ts           # Barrel export
├── mock-graph-db.ts   # MockGraphDB implementation
├── factories.ts       # createPage, createBlock, etc.
└── fixtures.ts        # Pre-built test scenarios
```

## Dependencies

- `@double-bind/types` (for domain types and GraphDB interface)

## Testing

MockGraphDB itself has tests verifying:
- Seeded data is returned correctly
- Query/mutation history is recorded
- `reset()` clears all state
- Pattern matching on relation names works

## MockGraphDB Pattern Matching Rules

MockGraphDB inspects the query string to determine which seeded relation to return:

1. **Relation extraction**: Scan for `*relation_name{` in the query string. Return seeded data for the first matched relation.
2. **Column filtering**: If the query specifies `?[col1, col2]`, return only those columns from the seeded rows (by header index).
3. **Parameter filtering**: If the query binds a parameter like `page_id: $id`, filter seeded rows where the column matches `params.$id`.

This is deliberately simple — MockGraphDB is **not a Datalog evaluator**. It cannot:
- Evaluate joins across multiple relations
- Execute recursive rules or graph algorithms
- Apply `:order`, `:limit`, `:offset` directives
- Enforce type constraints

**Implication**: Unit tests using MockGraphDB verify that repositories construct the right query strings and map results to domain types correctly. They do **not** verify Datalog correctness. Use Layer 2 integration tests (real CozoDB) to validate query semantics.

### Parameter Validation

MockGraphDB does **not** validate parameter types. It stores and returns whatever is passed. Type correctness is enforced by TypeScript at compile time and validated against real CozoDB in integration tests.

### Large Dataset Generation

For performance testing (1000+ pages), use the factory functions with a loop rather than pre-built fixtures:

```typescript
function createLargeKB(pageCount: number, blocksPerPage: number) {
  const pages = Array.from({ length: pageCount }, () => createPageWithId());
  const blocks = pages.flatMap(page =>
    Array.from({ length: blocksPerPage }, () =>
      createBlockWithId({ pageId: page.pageId })
    )
  );
  return { pages, blocks };
}
```

Large dataset fixtures are generated at test time, not checked into the repository.
