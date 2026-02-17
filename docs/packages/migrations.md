# @double-bind/migrations

<!-- last-verified: 2026-02-16 -->

## Purpose

Manages SQLite schema creation and migration. Provides both the schema definitions and the runner that applies them to a database.

## Public API

### SQLite Migration Runner

The primary interface for applying migrations to a SQLite database.

| Export                          | Purpose                                           | Source                 |
| ------------------------------- | ------------------------------------------------- | ---------------------- |
| `runSqliteMigrations(db)`       | Apply pending migrations to a `Database` instance | `src/sqlite/runner.ts` |
| `ensureSchemaMetadataTable(db)` | Create the schema_metadata tracking table         | `src/sqlite/runner.ts` |

### Schema

The SQLite schema is defined in `src/sqlite/001-initial-schema.ts`. It creates:

- **Core tables:** `pages`, `blocks`, `links`, `block_refs`
- **Metadata tables:** `block_properties`, `page_properties`, `block_tags`, `page_tags`
- **History:** `block_versions`
- **Search:** `blocks_fts`, `pages_fts`, `saved_queries_fts` (FTS5 virtual tables)
- **Indexes:** Covering indexes for common queries (by page, by parent, active blocks, etc.)
- **Triggers:** FTS sync triggers, timestamp auto-update triggers
- **Infrastructure:** `schema_metadata`, `saved_queries`

See `packages/migrations/src/sqlite/001-initial-schema.ts` for the complete schema.

## Internal Structure

```
packages/migrations/src/
├── index.ts
├── types.ts                  # Migration type definitions
├── sqlite-types.ts           # SQLite-specific migration types
├── sqlite/
│   ├── 001-initial-schema.ts # Complete SQLite schema
│   ├── registry.ts           # Ordered list of SQLite migrations
│   └── runner.ts             # SQLite migration execution logic
└── migrations/
    └── 001-initial-schema.ts # Legacy CozoDB migration (kept for reference)
```

## Dependencies

**Internal:** `@double-bind/types`

## Testing

Integration tests verify:

- All migrations apply cleanly to a fresh in-memory SQLite database
- Schema version tracking works
- FTS5 indexes are created and operational
- Triggers maintain data integrity

See `packages/core/test/integration/setup.ts` for how the test infrastructure applies migrations.
