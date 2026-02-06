# Layer 2: Integration Tests

## Purpose

Verify that TypeScript code works correctly against a real CozoDB instance. This catches issues that MockGraphDB cannot: Datalog syntax errors, query semantics, FTS behavior, and graph algorithm execution.

## Tool

Vitest + `cozo-node` (CozoDB's Node.js NAPI bindings) with in-memory storage engine.

## Setup

Each test file gets a fresh CozoDB instance:

```typescript
import { CozoDb } from 'cozo-node';
import { runMigrations } from '@double-bind/migrations';

let db: CozoDb;

beforeEach(async () => {
  db = new CozoDb('mem'); // In-memory, no disk I/O
  await runMigrations(db);
});
```

No teardown needed — in-memory databases are garbage collected.

## What to Test

### Schema Migrations

```typescript
describe('migrations', () => {
  it('creates all relations', async () => {
    const db = new CozoDb('mem');
    await runMigrations(db);

    const result = db.run('::relations', {});
    const relations = result.rows.map(r => r[0]);

    expect(relations).toContain('blocks');
    expect(relations).toContain('pages');
    expect(relations).toContain('block_refs');
    expect(relations).toContain('links');
    expect(relations).toContain('blocks_by_page');
    expect(relations).toContain('blocks_by_parent');
  });

  it('sets protected access level on critical relations', async () => {
    const db = new CozoDb('mem');
    await runMigrations(db);

    // Verify ::remove is rejected on protected relations
    expect(() => db.run('::remove blocks', {})).toThrow();
  });
});
```

### Repository Queries Against Real CozoDB

```typescript
describe('BlockRepository (integration)', () => {
  it('creates and retrieves a block with all fields', async () => {
    const repo = new BlockRepository(wrapCozoDb(db));

    const blockId = await repo.create({
      pageId: 'page-1',
      content: 'Hello world',
      order: 1.0,
    });

    const block = await repo.getById(blockId);
    expect(block.content).toBe('Hello world');
    expect(block.pageId).toBe('page-1');
    expect(block.isDeleted).toBe(false);
  });

  it('maintains blocks_by_page index on create', async () => {
    const repo = new BlockRepository(wrapCozoDb(db));
    await repo.create({ pageId: 'page-1', content: 'Block 1', order: 1.0 });
    await repo.create({ pageId: 'page-1', content: 'Block 2', order: 2.0 });
    await repo.create({ pageId: 'page-2', content: 'Block 3', order: 1.0 });

    const page1Blocks = await repo.getByPage('page-1');
    expect(page1Blocks).toHaveLength(2);
  });

  it('soft deletes block and removes from indexes', async () => {
    const repo = new BlockRepository(wrapCozoDb(db));
    const blockId = await repo.create({ pageId: 'page-1', content: 'test', order: 1.0 });
    await repo.softDelete(blockId);

    const block = await repo.getById(blockId);
    expect(block.isDeleted).toBe(true);

    // Should not appear in page listing
    const pageBlocks = await repo.getByPage('page-1');
    expect(pageBlocks).toHaveLength(0);
  });
});
```

### ScriptMutability Enforcement

```typescript
describe('ScriptMutability', () => {
  it('Immutable mode rejects :put operations', () => {
    expect(() => {
      db.run(':put blocks { ... }', {}, true); // immutable=true
    }).toThrow();
  });

  it('Immutable mode allows read queries', () => {
    const result = db.run('?[x] := x = 1', {}, true);
    expect(result.rows).toEqual([[1]]);
  });

  it('Mutable mode allows :put operations', () => {
    expect(() => {
      db.run(':put blocks { block_id: "b1", page_id: "p1", content: "test", order: 1.0, created_at: 0.0, updated_at: 0.0 }', {});
    }).not.toThrow();
  });
});
```

### Full-Text Search

```typescript
describe('FTS', () => {
  it('finds blocks by content search', async () => {
    // Insert test blocks
    db.run(':put blocks { block_id: "b1", page_id: "p1", content: "quantum computing research", ... }', {});
    db.run(':put blocks { block_id: "b2", page_id: "p1", content: "classical algorithms", ... }', {});

    const result = db.run(`
      ?[block_id, content, score] :=
        ~blocks:fts { block_id, content | query: $q, score }
    `, { q: 'quantum' });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0][0]).toBe('b1');
  });
});
```

### Graph Algorithms

```typescript
describe('CozoDB built-in graph algorithms', () => {
  it('computes PageRank over link graph', async () => {
    // Create pages and links
    // ...seed data...

    const result = db.run(`
      rank[page_id, score] <~ PageRank(*links[source_id, target_id])
      ?[page_id, score] := rank[page_id, score]
    `, {});

    // Page with most inlinks should have highest rank
    expect(result.rows[0][1]).toBeGreaterThan(result.rows[1][1]);
  });
});
```

### Edge Cases

```typescript
describe('edge cases', () => {
  it('handles blocks with null parent_id (root blocks)', async () => {
    // Root blocks of a page have parent_id = null
  });

  it('handles fractional order rebalancing', async () => {
    // Insert blocks until order values get too close, trigger rebalance
  });

  it('handles concurrent writes to same block', async () => {
    // Last write wins (no conflict resolution in v1)
  });

  it('handles 10,000 blocks on a single page', async () => {
    // Performance boundary test
  });
});
```

## File Structure

```
packages/core/test/integration/
├── setup.ts                    # CozoDb initialization helper
├── block-repository.test.ts
├── page-repository.test.ts
├── block-ref-repository.test.ts
├── link-repository.test.ts
├── search.test.ts
├── graph-algorithms.test.ts
├── migrations.test.ts
└── script-mutability.test.ts
```

## The `wrapCozoDb` Adapter

Integration tests need to wrap `cozo-node`'s API to match the `GraphDB` interface:

```typescript
function wrapCozoDb(db: CozoDb): GraphDB {
  return {
    async query(script, params = {}) {
      return db.run(script, params, true); // immutable
    },
    async mutate(script, params = {}) {
      return db.run(script, params, false); // mutable
    },
    // ...
  };
}
```

This adapter is also useful for understanding the mapping between the abstract `GraphDB` interface and the concrete CozoDB API.

<!-- TODO: Define cozo-node version and compatibility -->
<!-- TODO: Define performance benchmark thresholds -->
<!-- TODO: Define data seeding utilities for integration tests -->
<!-- TODO: Investigate cozo-node WASM alternative for CI environments -->
