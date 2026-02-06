# CozoDB Patterns and Gotchas

## Parameterized Queries — Always

```typescript
// CORRECT: parameterized
await db.query(
  '?[title] := *pages{ page_id: $id, title }',
  { id: pageId }
);

// WRONG: string interpolation — injection risk
await db.query(`?[title] := *pages{ page_id: "${pageId}", title }`);
```

Parameters can only be used where data values are expected. Relation names, column names, and CozoScript operators cannot be parameterized.

## Multi-Statement Transactions

CozoDB supports atomic multi-statement blocks with `{ ... }`:

```datalog
{
    ?[...] <- [[...]]
    :put relation_a { ... }

    ?[...] <- [[...]]
    :put relation_b { ... }
}
```

All statements succeed or all fail. Use this for maintaining index consistency.

## Soft Deletes

We use `is_deleted: Bool` instead of actually removing rows. This:
- Preserves history for undo
- Avoids cascade-deleting references
- Allows recovery

All read queries must filter `is_deleted: false`.

## Float Timestamps

CozoDB has no native DateTime type. We store timestamps as `Float` (Unix seconds with fractional milliseconds). TypeScript converts with:

```typescript
const now = Date.now() / 1000; // seconds with ms precision
const date = new Date(timestamp * 1000);
```

## CozoDB ::index create vs Manual Index Relations

CozoDB's `::index create` creates a column reordering — a full copy of all data in a different sort order. This is equivalent to our manual `blocks_by_page` relation but:

- **Pro**: Automatically maintained by CozoDB (no manual sync)
- **Con**: Full data copy (not just key columns)
- **Con**: Less control over what's stored in the index

We chose manual index relations because they store only key columns (smaller), and the explicit maintenance makes the write path clear.

## Query Result Format

`run_script_str` returns JSON:
```json
{
  "headers": ["block_id", "content", "order"],
  "rows": [
    ["01HXYZ...", "Hello world", 1.0],
    ["01HXYZ...", "Second block", 2.0]
  ]
}
```

The TypeScript GraphDB wrapper converts this to typed objects using Zod schemas.

## Error Messages

CozoDB errors are returned as strings. Common patterns:

- `"relation 'xxx' not found"` — typo in relation name
- `"arity mismatch"` — wrong number of columns in query
- `"duplicate key"` — using `:create` (strict insert) when key exists
- `"Immutable script attempted mutation"` — ScriptMutability::Immutable rejected a write

<!-- TODO: Document CozoDB's imperative mini-language (%if, %loop) -->
<!-- TODO: Document CozoDB's aggregation functions -->
<!-- TODO: Document CozoDB's built-in graph algorithms and their parameters -->
<!-- TODO: Document RocksDB tuning options accessible through CozoDB -->
<!-- TODO: Document CozoDB's MVCC behavior for concurrent reads -->
