# @double-bind/migrations

## Purpose

Manages CozoDB schema creation and migration. CozoDB has no `ALTER TABLE` — schema changes require creating new relations and migrating data. This package handles that lifecycle.

## Public API

```typescript
// Run all pending migrations against a database
async function runMigrations(db: GraphDB): Promise<MigrationResult>;

// Check which migrations have been applied
async function getAppliedMigrations(db: GraphDB): Promise<string[]>;

// Get the current schema version
async function getSchemaVersion(db: GraphDB): Promise<number>;

interface MigrationResult {
  applied: string[];       // Migration names that were applied
  alreadyApplied: string[]; // Migrations that were already applied
  errors: Array<{ migration: string; error: string }>;
}

interface Migration {
  version: number;
  name: string;
  up: string;   // CozoScript to apply migration
  down: string; // CozoScript to reverse migration (best-effort)
}
```

## Migration Format

```typescript
// migrations/001-initial-schema.ts
export const migration: Migration = {
  version: 1,
  name: '001-initial-schema',
  up: `
    :create blocks {
      block_id: String
      =>
      page_id: String,
      parent_id: String?,
      content: String,
      content_type: String default 'text',
      order: String,            # string-based fractional indexing
      is_collapsed: Bool default false,
      is_deleted: Bool default false,
      created_at: Float,
      updated_at: Float
    }

    :create blocks_by_page {
      page_id: String,
      block_id: String
    }

    :create blocks_by_parent {
      parent_id: String,
      block_id: String
    }

    :create pages {
      page_id: String
      =>
      title: String,
      created_at: Float,
      updated_at: Float,
      is_deleted: Bool default false,
      daily_note_date: String?
    }

    # ... remaining relations ...

    # Set access level protection on critical relations
    ::access_level blocks protected
    ::access_level pages protected
    ::access_level block_refs protected
    ::access_level links protected

    # Create FTS indexes (with soft-delete filtering)
    ::fts create blocks:fts { extractor: content, extract_filter: !is_deleted }
    ::fts create pages:fts { extractor: title, extract_filter: !is_deleted }

    # Record migration
    :put metadata { key: 'schema_version', value: '1' }
  `,
  down: `
    # WARNING: This drops all data
    ::remove blocks
    ::remove blocks_by_page
    ::remove blocks_by_parent
    ::remove pages
    # ... remaining removals ...
  `,
};
```

## Migration Execution

```typescript
async function runMigrations(db: GraphDB): Promise<MigrationResult> {
  const applied = await getAppliedMigrations(db);
  const pending = ALL_MIGRATIONS.filter(m => !applied.includes(m.name));

  const result: MigrationResult = { applied: [], alreadyApplied: applied, errors: [] };

  for (const migration of pending) {
    try {
      // Each migration.up may contain multiple statements
      // CozoDB executes them as a script (not individual statements)
      await db.mutate(migration.up);
      result.applied.push(migration.name);
    } catch (error) {
      result.errors.push({ migration: migration.name, error: String(error) });
      break; // Stop on first error
    }
  }

  return result;
}
```

## Internal Structure

```
packages/migrations/src/
├── index.ts              # runMigrations, getSchemaVersion
├── runner.ts             # Migration execution logic
├── registry.ts           # Ordered list of all migrations
└── migrations/
    ├── 001-initial-schema.ts
    ├── 002-add-daily-notes.ts   (example future migration)
    └── ...
```

## Dependencies

- `@double-bind/types` (for GraphDB interface)

## Testing

Integration tests (Layer 2) verify:
- All migrations apply cleanly to a fresh database
- Migrations are idempotent (running twice doesn't error)
- Schema version tracking works
- Access level protection is applied
- FTS indexes are created

## Migration Execution Strategy

**Desktop (Tauri)**: Migration CozoScript strings are extracted from the TypeScript source and embedded into the Rust binary at build time (via `include_str!`). They run inside the `.setup()` hook before the webview loads. This means:

1. **No IPC round-trip**: Migrations don't go through the Tauri command layer or its blocklist
2. **Full access**: Migration scripts can use `::create`, `::remove`, `::fts`, `::access_level`, etc.
3. **Blocking startup**: The app won't load until migrations complete (fast for schema DDL, acceptable)

**TUI/CLI (cozo-node)**: The TypeScript `runMigrations()` function calls `db.mutate(migration.up)` directly against `cozo-node`. Since `cozo-node` has no blocklist, migration scripts with `::create`, `::fts`, `::access_level` etc. execute normally.

### Build-Time Integration (TypeScript → Rust)

The desktop app embeds migration CozoScript into the Rust binary via `include_str!`. A **pnpm pre-build script** extracts the `.up` strings from each TypeScript migration and writes them as plain `.sql` files:

```
Build Pipeline:
1. pnpm build:migrations        → compiles packages/migrations/src/ with tsc
2. pnpm extract-migrations      → runs extract-migrations.ts (below)
3. cargo build                  → Rust compiles with include_str!("migrations/*.sql")
```

#### Extraction Script

```typescript
// scripts/extract-migrations.ts
// Run via: pnpm extract-migrations (defined in root package.json)
import { ALL_MIGRATIONS } from '@double-bind/migrations';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const outDir = join(__dirname, '../packages/desktop/src-tauri/migrations');
mkdirSync(outDir, { recursive: true });

for (const migration of ALL_MIGRATIONS) {
  const filename = `${migration.name}.sql`;
  writeFileSync(join(outDir, filename), migration.up, 'utf-8');
  console.log(`Extracted ${filename}`);
}
```

#### Root package.json Scripts

```json
{
  "scripts": {
    "build:migrations": "pnpm --filter @double-bind/migrations build",
    "extract-migrations": "tsx scripts/extract-migrations.ts",
    "build:desktop": "pnpm build:migrations && pnpm extract-migrations && pnpm --filter @double-bind/desktop build"
  }
}
```

#### CI/Development Workflow

- `pnpm dev` (Vite dev server): does NOT need extracted migrations — TUI/CLI call `runMigrations()` directly via `cozo-node`
- `pnpm build:desktop` (Tauri build): extracts migrations before `cargo build`
- `pnpm tauri dev` (Tauri dev mode): needs migrations extracted first — run `pnpm extract-migrations` before `pnpm tauri dev`

The `.sql` files in `src-tauri/migrations/` are gitignored (build artifacts). CI always runs `pnpm extract-migrations` before building the desktop app.

### Migration versioning

Schema version is tracked in the `metadata` relation:

```datalog
?[value] := *metadata{ key: 'schema_version', value }
```

Each migration bumps this value. The runner compares the stored version against the list of known migrations and applies any that are newer.

## Migration Rollback Strategy

`down` scripts are **best-effort only** and should never be used in production. CozoDB's `::remove` drops the entire relation including data — there is no `ALTER TABLE DROP COLUMN`. Rollback is only useful during development for resetting to a clean state.

In production, forward-only migrations are the rule. If a migration has a bug, ship a new forward migration that fixes it.

## Data Migration Patterns

CozoDB has no `ALTER TABLE ADD COLUMN`. To add a column to an existing relation:

1. Create a new relation with the additional column
2. Copy data from the old relation to the new one (via a Datalog query)
3. Remove the old relation (`::remove`)
4. Rename the new relation if needed (note: CozoDB `::rename` exists but is in the blocklist — migrations bypass the blocklist)

This is rare in practice. Most "schema changes" are new relations or new indexes, not column additions.

## Resolved Decisions

- **Testing strategy**: Integration tests (Layer 2) apply all migrations to a fresh in-memory CozoDB, then verify schema via `::relations` and `::columns`. Idempotency tested by running migrations twice.
- **Rollback strategy**: Forward-only in production; `down` scripts are dev-only convenience.
- **Data migration pattern**: Create new relation → copy data → remove old relation.
- **Versioning**: Integer version in `metadata` relation, checked on every app startup.
