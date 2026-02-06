# ADR-005: Simple Block Key with Secondary Index Relations

## Status
Accepted

## Context

CozoDB relations have key columns and value columns. The key determines the primary access path (prefix scans). For the `blocks` relation, the question is whether `block_id` alone should be the key, or whether `(page_id, block_id)` should be a composite key.

This was investigated by three specialized agents analyzing from database, API, and performance perspectives.

## Options Considered

### Option A: Composite Key `(page_id, block_id)`
- Page load is a single contiguous RocksDB prefix scan (<1ms)
- Block lookup by ID alone requires full scan or secondary index
- Moving a block between pages = delete old key + insert new key + cascade-update all references
- Graph algorithms must carry `page_id` baggage at every edge

### Option B: Simple Key `(block_id)` (no indexes)
- Block lookup is O(1)
- Page load requires full scan of ALL blocks (600-700ms at 1M blocks) — unacceptable
- Good for prototyping, not for production

### Option C: Simple Key `(block_id)` + Secondary Index Relations
- Block lookup is O(1)
- Page load uses `blocks_by_page` index: prefix scan + point lookups (~2-5ms)
- Moving a block = update one value column + update two index entries. No references break.
- Write amplification: 2-3 relation writes per block mutation (negligible at interactive editing rates)

## Decision

**Option C: Simple key `(block_id)` + secondary index relations.**

### Schema

```datalog
blocks           { block_id }  =>  page_id, parent_id, content, order, ...
blocks_by_page   { page_id, block_id }
blocks_by_parent { parent_id, block_id }
```

## Agent Findings Summary

| Agent | Recommendation | Key Argument |
|-------|---------------|--------------|
| DB perspective | Option C | Migration from simple→indexed is additive; composite→anything is destructive. No ALTER TABLE in CozoDB makes this critical. |
| API perspective | Simple key | Block references `((block_id))` are the defining feature. Composite keys double the API surface. Blocks must be first-class entities. |
| Performance perspective | Composite key | Page load is dominant op; RocksDB storage locality gives 5-10x fewer disk reads. BUT acknowledged CozoDB `::index create` solves block lookup. |

## Consequences

**Positive**:
- Block references resolve in O(1) — the app's most distinctive feature works optimally
- Block moves don't break references (only value columns change, not keys)
- Graph algorithms work naturally (edges are pairs of `block_id` values, no `page_id` baggage)
- Migration path is safe: can add more index relations without touching the primary relation
- Backlink queries are direct key lookups

**Negative**:
- Page load is ~2-5ms instead of <1ms (both imperceptible to users)
- Write amplification: every block mutation touches 2-3 relations (negligible at 1-3 writes/sec)
- Must maintain consistency between `blocks` and index relations (solved by atomic transactions)
- Storage doubles for index relations (trivial at note-taking scale: ~400MB for 1M blocks)

**Performance at Scale (1M blocks, 200 blocks per page)**:
- Page load via `blocks_by_page`: ~2-5ms (prefix scan + 200 point lookups)
- Block reference resolution: ~0.01ms (single key lookup)
- Block move: ~0.05ms (3 atomic writes)
- All well under the 16ms "instant" UI threshold
