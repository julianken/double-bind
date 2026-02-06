# ADR-012: ULID for All Entity IDs

## Status
Accepted

## Context

Every entity (page, block, link, tag entry) needs a unique identifier.

## Decision

ULID (Universally Unique Lexicographically Sortable Identifier).

## Why ULID over UUID v4

- **Sortable**: ULIDs sort lexicographically by creation time. This gives natural ordering in RocksDB.
- **Timestamp-embedded**: First 48 bits encode millisecond timestamp. Useful for debugging and ordering.
- **Future-proofs sync**: If/when multi-device sync is added, ULIDs are globally unique without coordination.
- **Compatible**: 128-bit, same entropy as UUID, can be stored in the same fields.

## Consequences

- All IDs are 26-character strings (Crockford Base32 encoding)
- Blocks created in sequence have adjacent IDs in RocksDB (good cache locality for recently-created blocks)
- No need for auto-increment counters or sequence generators

<!-- TODO: Document ULID generation strategy (monotonic vs random within same millisecond) -->
