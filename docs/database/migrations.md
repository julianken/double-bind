# Migration Strategy

## The Problem

CozoDB has no ALTER TABLE. To change a relation's schema:
1. Create a new relation with the desired schema
2. Copy all data from the old relation to the new one
3. Drop the old relation
4. Rename the new relation (via `::rename`)

This makes schema migrations more involved than in SQL databases.

## Migration Architecture

Migrations live in `packages/migrations`. Each migration is a numbered CozoScript file.

```
packages/migrations/src/
├── 001-initial-schema.ts    # Creates all relations
├── 002-add-fts-indexes.ts   # Adds FTS indexes
├── ...
└── index.ts                 # Migration runner
```

### Migration Format

```typescript
export interface Migration {
  version: number;
  name: string;
  up: string;    // CozoScript to apply
  down: string;  // CozoScript to reverse (best-effort)
}
```

### Migration Tracking

The `metadata` relation stores the current schema version:

```datalog
:put metadata { key: 'schema_version', value: '1' }
```

On app startup, the migration runner:
1. Reads current `schema_version` from metadata
2. Finds all migrations with version > current
3. Applies them in order
4. Updates `schema_version`

## Adding New Relations (Easy)

Simply `:create` the new relation. No existing data is affected.

```datalog
:create new_relation { key: String => value: String }
```

## Adding New Value Columns (Hard)

CozoDB relations have a fixed schema. Adding a column requires:

```typescript
export const migration_NNN: Migration = {
  version: NNN,
  name: 'add_field_to_blocks',
  up: `
    # 1. Create new relation with additional column
    :create blocks_v2 {
      block_id: String => page_id: String, parent_id: String?,
      content: String, new_field: String default '',
      content_type: String default 'text', order: String,
      is_collapsed: Bool default false, is_deleted: Bool default false,
      created_at: Float, updated_at: Float
    }

    # 2. Copy data (CozoDB will use default for new_field)
    ?[block_id, page_id, parent_id, content, new_field, content_type, order, is_collapsed, is_deleted, created_at, updated_at] :=
      *blocks{ block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at },
      new_field = ''
    :put blocks_v2 { ... }

    # 3. Remove old relation
    ::remove blocks

    # 4. Rename new relation
    ::rename blocks_v2 -> blocks
  `,
  down: `# Reverse migration...`
};
```

## Access Level Protection

After initial schema creation, set access levels to prevent accidental schema destruction:

```datalog
::access_level blocks protected
::access_level pages protected
::access_level blocks_by_page protected
::access_level blocks_by_parent protected
```

`protected` prevents `::remove` and `:replace` — the two most destructive operations. Only the migration runner should temporarily lower access levels when needed.

## Resolved Decisions

- **Migration runner**: Implemented in both TypeScript (`packages/migrations/`) and Rust (`run_migrations()` in shim). See [migrations package](../packages/migrations.md) and [Rust shim](../infrastructure/rust-shim.md).
- **Rollback strategy**: Forward-only in production. `down` scripts are dev-only convenience.
- **Backup policy**: Not enforced automatically. Users are responsible for backups before upgrades. The CLI provides `double-bind backup` for manual use.
- **Testing**: Integration tests (Layer 2) apply all migrations to a fresh in-memory CozoDB, then verify schema via `::relations` and `::columns`.
