# Index Strategy

CozoDB has no general-purpose secondary indexes (like SQL's `CREATE INDEX`). It has:
- **HNSW indexes** for vector similarity search
- **FTS indexes** for full-text search
- **`::index create`** which creates column reorderings (full data copies in different sort order)

For our needs, we maintain **separate key-only relations** as manual secondary indexes, plus CozoDB's built-in FTS.

## Secondary Index Relations

| Index Relation | Key Columns | Indexes Into | Purpose |
|---------------|-------------|-------------|---------|
| `blocks_by_page` | `(page_id, block_id)` | `blocks` | Fast page load via page_id prefix scan |
| `blocks_by_parent` | `(parent_id, block_id)` | `blocks` | Fast tree traversal (find children of a block) |

### How They Work

**Page load query**:
```datalog
?[block_id, content, parent_id, order] :=
    *blocks_by_page{ page_id: $target_page, block_id },
    *blocks{ block_id, content, parent_id, order }
```

Step 1: Prefix scan on `blocks_by_page` with bound `page_id` → returns all `block_id` values for the page.
Step 2: For each `block_id`, direct key lookup in `blocks`.

**Tree traversal query**:
```datalog
?[child_id, content, order] :=
    *blocks_by_parent{ parent_id: $parent, block_id: child_id },
    *blocks{ block_id: child_id, content, order }
```

Same pattern: prefix scan on index, then point lookups on primary.

## FTS Indexes

```datalog
::fts create blocks:fts { extractor: content }
::fts create pages:fts { extractor: title }
```

These are CozoDB's built-in full-text search indexes, backed by the `tantivy` Rust library. They support:
- Tokenized search
- Relevance scoring
- Prefix matching

### Soft-Delete Awareness

FTS indexes are created with `extract_filter: !is_deleted` to automatically exclude soft-deleted rows from search results. When a block is soft-deleted via `:put` (setting `is_deleted = true`), CozoDB:

1. Deletes the old FTS entry
2. Evaluates the `extract_filter` — returns false for deleted rows
3. Skips re-indexing the row

**Important**: `import_relations` bypasses FTS indexes entirely. After bulk imports, FTS indexes must be rebuilt by dropping and recreating them.

## Reverse Indexes (CozoDB ::index create)

CozoDB's `::index create` creates column reorderings — a full copy of the relation data sorted in a different key order. These are necessary because CozoDB only supports efficient prefix scans on **leading** key columns.

### Backlink Indexes

Without reverse indexes, backlink queries require a full scan:
- `links(source_id, target_id, link_type)` — querying "all links TO page X" binds `target_id` (the second column), requiring a full scan
- `block_refs(source_block_id, target_block_id)` — querying "all refs TO block X" has the same problem

**Solution**: CozoDB indexes that reorder columns:

```datalog
::index create links:by_target { target_id, source_id, link_type }
::index create block_refs:by_target { target_block_id, source_block_id }
```

These are maintained automatically by CozoDB on every `:put` and `:rm` to the base relation. No application-level maintenance needed (unlike the manual `blocks_by_page` and `blocks_by_parent` relations).

### When to Use ::index vs Manual Index Relations

| Approach | When to Use |
|----------|-------------|
| `::index create` | Reordering existing columns for different scan patterns |
| Manual relation | When the index stores a subset of columns (smaller storage footprint) |

Our `blocks_by_page` and `blocks_by_parent` are manual relations because they store only `(key1, key2)` — much smaller than a full copy of the blocks relation. The `links:by_target` and `block_refs:by_target` indexes use `::index create` because those relations are small (key columns only, minimal value columns).

## Consistency Maintenance

Index relations must be kept in sync with the primary relations. This is the application's responsibility.

**On block create**:
```datalog
:put blocks { block_id: $id, page_id: $page, parent_id: $parent, ... }
:put blocks_by_page { page_id: $page, block_id: $id }
:put blocks_by_parent { parent_id: $parent, block_id: $id }
```

**On block move (change parent or page)**:
```datalog
# Remove old index entries
:rm blocks_by_page { page_id: $old_page, block_id: $id }
:rm blocks_by_parent { parent_id: $old_parent, block_id: $id }
# Update primary
:put blocks { block_id: $id, page_id: $new_page, parent_id: $new_parent, ... }
# Insert new index entries
:put blocks_by_page { page_id: $new_page, block_id: $id }
:put blocks_by_parent { parent_id: $new_parent, block_id: $id }
```

All within a single atomic CozoDB transaction.

## Storage Overhead

At 1M blocks with ULID IDs (26 chars each):
- `blocks_by_page`: ~52 bytes/row × 1M = ~52MB
- `blocks_by_parent`: ~52 bytes/row × 1M = ~52MB
- Total index overhead: ~104MB

Acceptable for a desktop application.

## Index Design Notes

**`::index create` vs manual relations**: Use `::index create` for column reorderings on small relations (links, block_refs). Use manual key-only relations for indexes into large relations (blocks) where storage matters.

**Future indexes to consider**: `blocks_by_tag` (tag → block_id), `blocks_by_date` (date range → block_id) — add when query patterns demand them.
