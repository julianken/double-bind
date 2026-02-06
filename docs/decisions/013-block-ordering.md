# ADR-013: String-Based Fractional Indexing (Revised)

## Status
Accepted (revised from float-based ordering)

## Context

Blocks within a page (or within a parent block) need a sort order. Reordering blocks (drag-and-drop, indent/outdent) must be efficient.

The original decision was float-based fractional ordering with lazy rebalancing. Architectural review identified that:

1. Float precision gives ~52 halvings before exhaustion — sufficient for most use, but the rebalancing algorithm was entirely unspecified (trigger, mechanism, atomicity, UI flickering).
2. String-based fractional indexing (as used by Figma) eliminates the rebalancing problem entirely at the cost of variable-length keys.
3. The `rocicorp/fractional-indexing` library is a production-ready implementation.

## Decision

String-based fractional indexing using `rocicorp/fractional-indexing`.

## How It Works

- Each block has an `order: String` column (stored in CozoDB as String)
- Keys are base-62 encoded strings that sort lexicographically
- To insert between two blocks, `generateKeyBetween(a, b)` produces a string that sorts between them
- Keys can be generated for any position: start, end, or between any two existing keys
- No precision limit — keys grow by ~1 character per insertion in the same gap

```typescript
import { generateKeyBetween } from 'fractional-indexing';

// Initial blocks
const a = generateKeyBetween(null, null);    // 'a0'
const b = generateKeyBetween(a, null);       // 'a1'
const c = generateKeyBetween(b, null);       // 'a2'

// Insert between a and b
const ab = generateKeyBetween(a, b);         // 'a0V'
```

## Consequences

**Positive**:
- No rebalancing needed — ever
- Insert between any two blocks is O(1): one write, no sibling updates
- Lexicographic ordering works with CozoDB's key comparison
- `rocicorp/fractional-indexing` is small (~2KB), well-tested, zero dependencies
- Compatible with future CRDT sync (keys are globally unique when combined with a site ID)

**Negative**:
- Keys grow with successive insertions in the same gap (~1 char per insertion in base-62)
- In worst case (10,000 insertions at same position), keys reach ~170 characters — negligible storage cost
- Key comparison is O(key_length) instead of O(1) for floats — negligible for typical key lengths
- Human editing patterns produce short keys (typically 2-6 characters)

## Alternatives Considered

- **Float-based with rebalancing**: Works but requires defining trigger threshold, rebalancing algorithm, and handling atomicity/UI-flickering — significant engineering burden for a solved problem.
- **Integer with gaps**: Frequent rebalancing needed.
- **LSEQ**: Discredited — interleaving problem when multiple users insert concurrently.
- **RGA**: Designed for character-level collaborative editing, not block-level reordering. Requires tombstones. Overwheight for this use case.

## Schema Impact

`blocks.order` and `block_history.order` are `String` type (not `Float`).
