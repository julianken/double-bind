# Layer 1: Unit Tests

## Tool

Vitest with workspace configuration. Each package has its own test files co-located with source.

## MockGraphDB

The `test-utils` package provides `MockGraphDB` — an in-memory implementation of the `GraphDB` interface that simulates CozoDB's behavior without any native dependencies.

```typescript
import { MockGraphDB } from '@double-bind/test-utils';

const db = new MockGraphDB();
// Pre-seed with test data
db.seed('blocks', [
  ['block-1', 'page-1', null, 'Hello world', 'text', 1.0, false, false, 1700000000, 1700000000],
]);

const repo = new BlockRepository(db);
const result = await repo.getById('block-1');
expect(result.content).toBe('Hello world');
```

### MockGraphDB Behavior

| Feature | Behavior |
|---------|----------|
| `query()` | Returns seeded data matching simple pattern matching |
| `mutate()` | Stores data in memory, validates relation exists |
| `importRelations()` | Bulk loads into memory store |
| `exportRelations()` | Returns memory store contents |
| `backup()` | No-op (returns success) |

### Limitations

MockGraphDB does NOT implement:
- Datalog evaluation (queries are matched by pattern, not executed)
- FTS indexing
- Graph algorithms
- Transaction isolation
- `ScriptMutability` enforcement

These are covered by Layer 2 (integration tests with real CozoDB).

## What to Unit Test

### `core` package — Repositories

```typescript
describe('BlockRepository', () => {
  it('constructs correct Datalog for getById', async () => {
    const db = new MockGraphDB();
    const repo = new BlockRepository(db);
    await repo.getById('block-1');

    // Verify the query string and params passed to db.query()
    expect(db.lastQuery.script).toContain('*blocks{ block_id: $id');
    expect(db.lastQuery.params).toEqual({ id: 'block-1' });
  });

  it('constructs correct Datalog for create with index updates', async () => {
    const db = new MockGraphDB();
    const repo = new BlockRepository(db);
    await repo.create({ pageId: 'page-1', content: 'test' });

    // Verify mutate was called with :put for blocks, blocks_by_page, blocks_by_parent
    expect(db.lastMutation.script).toContain(':put blocks');
    expect(db.lastMutation.script).toContain(':put blocks_by_page');
  });
});
```

### `core` package — Services

```typescript
describe('BlockService', () => {
  it('parses references from content and creates block_refs', async () => {
    const db = new MockGraphDB();
    const blockRepo = new BlockRepository(db);
    const service = new BlockService(blockRepo);

    await service.updateContent('block-1', 'See ((block-2)) and ((block-3))');

    // Verify block_refs were created for both references
    const refMutations = db.mutations.filter(m => m.script.includes(':put block_refs'));
    expect(refMutations).toHaveLength(2);
  });
});
```

### `query-lang` package

```typescript
describe('DatalogParser', () => {
  it('parses a simple find query', () => {
    const ast = parse('find pages where title contains "meeting"');
    expect(ast.type).toBe('find');
    expect(ast.relation).toBe('pages');
    expect(ast.filters[0]).toEqual({ field: 'title', op: 'contains', value: 'meeting' });
  });

  it('transpiles to valid CozoScript', () => {
    const cozoscript = transpile('find pages where title contains "meeting"');
    expect(cozoscript.script).toContain('*pages{');
    expect(cozoscript.script).toContain('contains(title, $filter_0)');
    expect(cozoscript.params.filter_0).toBe('meeting');
  });
});
```

### `graph-algorithms` package

```typescript
describe('PageRank', () => {
  it('assigns higher rank to pages with more inlinks', () => {
    const graph = {
      nodes: ['a', 'b', 'c'],
      edges: [['a', 'b'], ['c', 'b']], // b has 2 inlinks
    };
    const ranks = pageRank(graph);
    expect(ranks['b']).toBeGreaterThan(ranks['a']);
    expect(ranks['b']).toBeGreaterThan(ranks['c']);
  });
});
```

### `ui-primitives` package

```typescript
describe('BacklinksPanel', () => {
  it('renders linked references grouped by source page', () => {
    render(<BacklinksPanel blockId="block-1" references={mockRefs} />);
    expect(screen.getByText('Source Page Title')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});
```

## Configuration

```typescript
// vitest.workspace.ts
export default defineWorkspace([
  'packages/types',
  'packages/test-utils',
  'packages/query-lang',
  'packages/graph-algorithms',
  'packages/core',
  'packages/ui-primitives',
]);
```

Each package's `vitest.config.ts`:
```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // or 'jsdom' for UI packages
  },
});
```

<!-- TODO: Define MockGraphDB pattern matching strategy -->
<!-- TODO: Define test data factory functions -->
<!-- TODO: Define coverage thresholds per package -->
<!-- TODO: Decide on snapshot testing policy -->
