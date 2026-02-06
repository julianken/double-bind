# Block Key Design

Detailed analysis of the block key decision. See [ADR-005](../decisions/005-block-key-simple.md) for the summary.

## The Three Options

### Option A: Composite Key `(page_id, block_id)`
- CozoDB key: `{ page_id: String, block_id: String => ... }`
- Page load: prefix scan on `page_id` → O(k) sequential reads
- Block lookup by ID: requires knowing `page_id` first → O(N) scan or secondary index
- Block move: delete old key + insert new → cascade-update all references

### Option B: Simple Key `(block_id)` — no indexes
- CozoDB key: `{ block_id: String => page_id: String, ... }`
- Block lookup: O(1) point read
- Page load: full relation scan with filter → O(N) — ~600ms at 1M blocks
- Unacceptable for production use

### Option C: Simple Key + Index Relations (chosen)
- Primary: `{ block_id: String => page_id: String, ... }`
- Index: `{ page_id: String, block_id: String }` (key-only relation)
- Block lookup: O(1) point read on primary
- Page load: O(log N + k) — prefix scan on index, then k point lookups on primary

## Performance Comparison at 1M Blocks

| Operation | Composite Key | Simple + Index | Ratio |
|-----------|:---:|:---:|:---:|
| Page load (200 blocks) | <1ms | 2-5ms | ~3-5x |
| Block reference `((id))` | Full scan or index | O(1) | ∞ improvement |
| Backlink query | Extra indirection | Direct | Simpler |
| Block move | Delete + insert + cascade | Update 3 values | Much simpler |
| Graph traversal | Carries page_id baggage | Direct block_id edges | Cleaner |
| Write (single block) | 1 relation write | 2-3 relation writes | ~2-3x |

## Why the 2-5ms Page Load Penalty is Acceptable

1. Both <1ms and 2-5ms are below the 16ms threshold for "instant" UI response
2. After first load, RocksDB block cache keeps data warm — subsequent loads are sub-millisecond
3. The user never perceives the difference between 1ms and 5ms

## Why Block Reference Speed Matters More

- Block references `((block_id))` are the defining feature of a Roam-like app
- Every rendered page may contain dozens of references that need resolution
- O(1) resolution vs O(N) scan is the difference between instant and noticeable delay
- Graph algorithms produce block_ids that must be looked up — O(1) is essential

## RocksDB Storage Locality

The performance agent correctly noted that composite keys give better RocksDB data locality (same-page blocks stored contiguously). With simple keys + ULID ordering, blocks from the same page are scattered across the key space.

**Mitigation**: The `blocks_by_page` index relation provides locality for the index scan. The subsequent point lookups hit the block cache (which is populated during normal usage). In practice, the working set of recently-accessed blocks fits comfortably in RocksDB's block cache.

## Migration Safety

This is the decisive argument:

- **Simple → indexed**: Create `blocks_by_page`, populate from existing data. Zero changes to the `blocks` relation. Non-destructive, additive migration.
- **Composite → simple**: Recreate `blocks` with new key structure, migrate all data. Every relation that references blocks by composite key must be updated. Destructive migration.

CozoDB has no ALTER TABLE. Getting the key wrong is expensive to fix. Simple key is the safer starting point.
