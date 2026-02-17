# Database

SQLite-based data layer with FTS5 full-text search.

## Contents

| Document | Description                                                                         |
| -------- | ----------------------------------------------------------------------------------- |
| Schema   | See `packages/migrations/src/sqlite/001-initial-schema.ts` for the canonical schema |

## Quick Reference

- **Engine:** SQLite 3.x (rusqlite on desktop, op-sqlite on mobile, better-sqlite3 for dev/test)
- **Interface:** `Database` in `packages/types/src/database.ts`
- **Schema:** `packages/migrations/src/sqlite/001-initial-schema.ts`
- **Migration runner:** `packages/migrations/src/sqlite/runner.ts`
- **Adapter:** `SqliteNodeAdapter` in `packages/core/src/adapters/sqlite-node-adapter.ts`

## Key Design Decisions

- **Contentless FTS5** (not external content) — external content is broken with TEXT primary keys
- **Properties/tags split into 4 tables** (block_properties, page_properties, block_tags, page_tags) — enables FK enforcement
- **ON DELETE RESTRICT for blocks.parent_id** — CASCADE is dangerous with soft-deletes
- **ULID primary keys** (TEXT) — see [ADR-012](../decisions/012-id-format.md)
- **Fractional indexing for block ordering** — see [ADR-013](../decisions/013-block-ordering.md)
- **Why SQLite** — see [ADR-015](../decisions/015-sqlite-migration.md) and [alternatives analysis](../architecture/database-alternatives-analysis.md)
