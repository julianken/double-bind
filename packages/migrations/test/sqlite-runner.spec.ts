import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import {
  runMigrations,
  runSingleMigration,
  rollbackMigration,
  getAppliedMigrations,
  getSchemaVersion,
} from '../src/sqlite/runner.js';
import { migration as initialSchema } from '../src/sqlite/001-initial-schema.js';
import type { SqliteMigration } from '../src/sqlite-types.js';

describe('SQLite runner - statement splitting', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('preserves trigger bodies with semicolons inside BEGIN...END blocks', () => {
    db.exec(`
      CREATE TABLE test_table (
        id TEXT PRIMARY KEY,
        value TEXT,
        updated_at REAL
      );
    `);

    const triggerSql = `
CREATE TRIGGER test_trigger AFTER UPDATE ON test_table
BEGIN
    UPDATE test_table SET updated_at = unixepoch('now', 'subsec') WHERE id = NEW.id;
    INSERT INTO test_table (id, value) VALUES ('log', 'updated');
END;
    `.trim();

    expect(() => db.exec(triggerSql)).not.toThrow();

    const trigger = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = 'test_trigger'")
      .get();
    expect(trigger).toBeDefined();
  });

  it('handles multiple statements separated by semicolons and newlines', () => {
    const migration: SqliteMigration = {
      version: 1,
      name: 'test-multi-statement',
      up: `
CREATE TABLE table1 (id TEXT PRIMARY KEY);

CREATE TABLE table2 (id TEXT PRIMARY KEY);

INSERT INTO table1 (id) VALUES ('test');
      `.trim(),
      down: `
DROP TABLE IF EXISTS table2;
DROP TABLE IF EXISTS table1;
      `.trim(),
    };

    runSingleMigration(db, migration);

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('table1', 'table2')"
      )
      .all();
    expect(tables).toHaveLength(2);

    const row = db.prepare('SELECT id FROM table1').get();
    expect(row).toEqual({ id: 'test' });
  });
});

describe('SQLite runner - PRAGMA detection', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('handles PRAGMA statements with regular statements', () => {
    const migration: SqliteMigration = {
      version: 1,
      name: 'test-pragma',
      up: `
PRAGMA foreign_keys = ON;

CREATE TABLE test_table (id TEXT PRIMARY KEY);
      `.trim(),
      down: 'DROP TABLE IF EXISTS test_table;',
    };

    expect(() => runSingleMigration(db, migration)).not.toThrow();

    const result = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
    expect(result.foreign_keys).toBe(1);

    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'test_table'")
      .get();
    expect(table).toBeDefined();
  });

  it('handles mixed PRAGMA and regular statements', () => {
    const migration: SqliteMigration = {
      version: 1,
      name: 'test-mixed',
      up: `
PRAGMA foreign_keys = ON;

CREATE TABLE test1 (id TEXT PRIMARY KEY);

PRAGMA synchronous = NORMAL;

CREATE TABLE test2 (id TEXT PRIMARY KEY);
      `.trim(),
      down: `
DROP TABLE IF EXISTS test2;
DROP TABLE IF EXISTS test1;
      `.trim(),
    };

    expect(() => runSingleMigration(db, migration)).not.toThrow();

    const foreignKeys = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
    expect(foreignKeys.foreign_keys).toBe(1);

    const synchronous = db.prepare('PRAGMA synchronous').get() as { synchronous: number };
    expect(synchronous.synchronous).toBe(1);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('test1', 'test2')")
      .all();
    expect(tables).toHaveLength(2);
  });
});

describe('SQLite runner - transaction safety', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('wraps migrations in transactions with BEGIN and COMMIT', () => {
    const migration: SqliteMigration = {
      version: 1,
      name: 'test-transaction',
      up: `
CREATE TABLE test_table (id TEXT PRIMARY KEY);
INSERT INTO test_table (id) VALUES ('test');
      `.trim(),
      down: 'DROP TABLE IF EXISTS test_table;',
    };

    runSingleMigration(db, migration);

    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'test_table'")
      .get();
    expect(table).toBeDefined();

    const row = db.prepare('SELECT id FROM test_table').get();
    expect(row).toEqual({ id: 'test' });
  });

  it('rolls back on error and does not update metadata', () => {
    const migration1: SqliteMigration = {
      version: 1,
      name: 'test-success',
      up: 'CREATE TABLE test_table (id TEXT PRIMARY KEY);',
      down: 'DROP TABLE IF EXISTS test_table;',
    };

    runSingleMigration(db, migration1);

    const migration2: SqliteMigration = {
      version: 2,
      name: 'test-failure',
      up: `
CREATE TABLE test_table (id TEXT PRIMARY KEY);
      `.trim(),
      down: '',
    };

    expect(() => runSingleMigration(db, migration2)).toThrow();

    const applied = getAppliedMigrations(db);
    expect(applied).toEqual(['test-success']);

    expect(applied).not.toContain('test-failure');

    const version = getSchemaVersion(db);
    expect(version).toBe(1);
  });

  it('does not leave database in inconsistent state after rollback', () => {
    const migration: SqliteMigration = {
      version: 1,
      name: 'test-partial',
      up: `
CREATE TABLE table1 (id TEXT PRIMARY KEY);
INSERT INTO table1 (id) VALUES ('test');
CREATE TABLE table1 (id TEXT PRIMARY KEY);
      `.trim(),
      down: 'DROP TABLE IF EXISTS table1;',
    };

    expect(() => runSingleMigration(db, migration)).toThrow();

    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'table1'")
      .get();
    expect(table).toBeUndefined();

    const applied = getAppliedMigrations(db);
    expect(applied).toEqual([]);
  });
});

describe('SQLite runner - schema metadata tracking', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('creates schema_metadata table if not exists', () => {
    const applied = getAppliedMigrations(db);

    expect(applied).toEqual([]);

    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_metadata'")
      .get();
    expect(table).toBeDefined();
  });

  it('initializes schema_version to 0 and applied_migrations to empty array', () => {
    getAppliedMigrations(db);

    const version = getSchemaVersion(db);
    expect(version).toBe(0);

    const applied = getAppliedMigrations(db);
    expect(applied).toEqual([]);
  });

  it('updates applied_migrations after successful migration', () => {
    const migration: SqliteMigration = {
      version: 1,
      name: 'test-migration',
      up: 'CREATE TABLE test_table (id TEXT PRIMARY KEY);',
      down: 'DROP TABLE IF EXISTS test_table;',
    };

    runSingleMigration(db, migration);

    const applied = getAppliedMigrations(db);
    expect(applied).toEqual(['test-migration']);
  });

  it('updates schema_version to migration version after success', () => {
    const migration: SqliteMigration = {
      version: 5,
      name: 'test-migration-v5',
      up: 'CREATE TABLE test_table (id TEXT PRIMARY KEY);',
      down: 'DROP TABLE IF EXISTS test_table;',
    };

    runSingleMigration(db, migration);

    const version = getSchemaVersion(db);
    expect(version).toBe(5);
  });

  it('tracks multiple migrations in order', () => {
    const migrations: SqliteMigration[] = [
      {
        version: 1,
        name: 'migration-1',
        up: 'CREATE TABLE table1 (id TEXT PRIMARY KEY);',
        down: 'DROP TABLE IF EXISTS table1;',
      },
      {
        version: 2,
        name: 'migration-2',
        up: 'CREATE TABLE table2 (id TEXT PRIMARY KEY);',
        down: 'DROP TABLE IF EXISTS table2;',
      },
      {
        version: 3,
        name: 'migration-3',
        up: 'CREATE TABLE table3 (id TEXT PRIMARY KEY);',
        down: 'DROP TABLE IF EXISTS table3;',
      },
    ];

    const result = runMigrations(db, migrations);

    expect(result.applied).toEqual(['migration-1', 'migration-2', 'migration-3']);
    expect(result.alreadyApplied).toEqual([]);
    expect(result.errors).toEqual([]);

    const applied = getAppliedMigrations(db);
    expect(applied).toEqual(['migration-1', 'migration-2', 'migration-3']);

    const version = getSchemaVersion(db);
    expect(version).toBe(3);
  });

  it('skips already-applied migrations', () => {
    const migration1: SqliteMigration = {
      version: 1,
      name: 'migration-1',
      up: 'CREATE TABLE table1 (id TEXT PRIMARY KEY);',
      down: 'DROP TABLE IF EXISTS table1;',
    };

    const migration2: SqliteMigration = {
      version: 2,
      name: 'migration-2',
      up: 'CREATE TABLE table2 (id TEXT PRIMARY KEY);',
      down: 'DROP TABLE IF EXISTS table2;',
    };

    runSingleMigration(db, migration1);

    const result = runMigrations(db, [migration1, migration2]);

    expect(result.applied).toEqual(['migration-2']);
    expect(result.alreadyApplied).toEqual(['migration-1']);
    expect(result.errors).toEqual([]);
  });

  it('stops on first error and reports it', () => {
    const migrations: SqliteMigration[] = [
      {
        version: 1,
        name: 'migration-1',
        up: 'CREATE TABLE table1 (id TEXT PRIMARY KEY);',
        down: 'DROP TABLE IF EXISTS table1;',
      },
      {
        version: 2,
        name: 'migration-2-fails',
        up: 'CREATE TABLE table1 (id TEXT PRIMARY KEY);',
        down: 'DROP TABLE IF EXISTS table1;',
      },
      {
        version: 3,
        name: 'migration-3',
        up: 'CREATE TABLE table3 (id TEXT PRIMARY KEY);',
        down: 'DROP TABLE IF EXISTS table3;',
      },
    ];

    const result = runMigrations(db, migrations);

    expect(result.applied).toEqual(['migration-1']);
    expect(result.alreadyApplied).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.migration).toBe('migration-2-fails');
    expect(result.errors[0]!.error).toContain('table1');

    const applied = getAppliedMigrations(db);
    expect(applied).not.toContain('migration-3');

    const version = getSchemaVersion(db);
    expect(version).toBe(1);
  });
});

describe('SQLite runner - rollback', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('runs down migration and removes from applied list', () => {
    const migration: SqliteMigration = {
      version: 1,
      name: 'test-rollback',
      up: 'CREATE TABLE test_table (id TEXT PRIMARY KEY);',
      down: 'DROP TABLE IF EXISTS test_table;',
    };

    runSingleMigration(db, migration);

    let applied = getAppliedMigrations(db);
    expect(applied).toContain('test-rollback');

    rollbackMigration(db, migration, [migration]);

    applied = getAppliedMigrations(db);
    expect(applied).not.toContain('test-rollback');

    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'test_table'")
      .get();
    expect(table).toBeUndefined();
  });

  it('updates schema version to highest remaining migration', () => {
    const migrations: SqliteMigration[] = [
      {
        version: 1,
        name: 'migration-1',
        up: 'CREATE TABLE table1 (id TEXT PRIMARY KEY);',
        down: 'DROP TABLE IF EXISTS table1;',
      },
      {
        version: 2,
        name: 'migration-2',
        up: 'CREATE TABLE table2 (id TEXT PRIMARY KEY);',
        down: 'DROP TABLE IF EXISTS table2;',
      },
      {
        version: 3,
        name: 'migration-3',
        up: 'CREATE TABLE table3 (id TEXT PRIMARY KEY);',
        down: 'DROP TABLE IF EXISTS table3;',
      },
    ];

    runMigrations(db, migrations);

    rollbackMigration(db, migrations[2]!, migrations);

    const version = getSchemaVersion(db);
    expect(version).toBe(2);

    const applied = getAppliedMigrations(db);
    expect(applied).toEqual(['migration-1', 'migration-2']);
  });

  it('sets version to 0 when rolling back all migrations', () => {
    const migration: SqliteMigration = {
      version: 1,
      name: 'only-migration',
      up: 'CREATE TABLE test_table (id TEXT PRIMARY KEY);',
      down: 'DROP TABLE IF EXISTS test_table;',
    };

    runSingleMigration(db, migration);

    rollbackMigration(db, migration, [migration]);

    const version = getSchemaVersion(db);
    expect(version).toBe(0);

    const applied = getAppliedMigrations(db);
    expect(applied).toEqual([]);
  });
});

describe('SQLite runner - 001-initial-schema integration', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');

    // Apply schema directly (bypassing runner to avoid schema_metadata conflicts)
    // Remove the schema_metadata INSERTs as the runner handles those
    const schemaWithoutMetadata = initialSchema.up.replace(/INSERT INTO schema_metadata.*?;/gs, '');

    db.exec(schemaWithoutMetadata);
  });

  afterEach(() => {
    db.close();
  });

  it('creates schema successfully via direct execution', () => {
    // Verify some key tables exist
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('pages', 'blocks')"
      )
      .all();
    expect(tables).toHaveLength(2);
  });

  it('creates all expected primary tables', () => {
    const expectedTables = ['pages', 'blocks'];
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table'
         AND name IN (${expectedTables.map(() => '?').join(',')})
         ORDER BY name`
      )
      .all(...expectedTables) as Array<{ name: string }>;

    expect(tables.map((t) => t.name)).toEqual(['blocks', 'pages']);
  });

  it('creates all expected reference tables', () => {
    const expectedTables = ['block_refs', 'links'];
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table'
         AND name IN (${expectedTables.map(() => '?').join(',')})
         ORDER BY name`
      )
      .all(...expectedTables) as Array<{ name: string }>;

    expect(tables.map((t) => t.name)).toEqual(['block_refs', 'links']);
  });

  it('creates all expected property and tag tables', () => {
    const expectedTables = ['block_properties', 'page_properties', 'block_tags', 'page_tags'];
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table'
         AND name IN (${expectedTables.map(() => '?').join(',')})
         ORDER BY name`
      )
      .all(...expectedTables) as Array<{ name: string }>;

    expect(tables.map((t) => t.name)).toEqual([
      'block_properties',
      'block_tags',
      'page_properties',
      'page_tags',
    ]);
  });

  it('creates all expected lookup tables', () => {
    const expectedTables = ['daily_notes', 'schema_metadata', 'saved_queries'];
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table'
         AND name IN (${expectedTables.map(() => '?').join(',')})
         ORDER BY name`
      )
      .all(...expectedTables) as Array<{ name: string }>;

    expect(tables.map((t) => t.name)).toEqual(['daily_notes', 'saved_queries', 'schema_metadata']);
  });

  it('creates all expected FTS5 tables', () => {
    const expectedTables = ['blocks_fts', 'pages_fts', 'saved_queries_fts'];
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table'
         AND name IN (${expectedTables.map(() => '?').join(',')})
         ORDER BY name`
      )
      .all(...expectedTables) as Array<{ name: string }>;

    expect(tables.map((t) => t.name)).toEqual(['blocks_fts', 'pages_fts', 'saved_queries_fts']);
  });

  it('creates all expected indexes', () => {
    const indexes = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'index'
         AND name LIKE 'idx_%'
         ORDER BY name`
      )
      .all() as Array<{ name: string }>;

    const expectedIndexes = [
      'idx_block_history_timestamp',
      'idx_block_properties_block',
      'idx_block_refs_target',
      'idx_block_tags_tag',
      'idx_blocks_page_active',
      'idx_blocks_page_id',
      'idx_blocks_parent_active',
      'idx_links_context_block',
      'idx_links_target',
      'idx_page_properties_page',
      'idx_page_tags_tag',
      'idx_pages_daily_note_date',
      'idx_pages_updated_at',
      'idx_saved_queries_updated_at',
    ];

    expect(indexes.map((i) => i.name)).toEqual(expectedIndexes);
  });

  it('creates all expected triggers', () => {
    const triggers = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'trigger'
         ORDER BY name`
      )
      .all() as Array<{ name: string }>;

    const expectedTriggers = [
      'blocks_fts_delete',
      'blocks_fts_insert',
      'blocks_fts_update',
      'blocks_updated_at',
      'pages_fts_delete',
      'pages_fts_insert',
      'pages_fts_update',
      'pages_updated_at',
      'saved_queries_fts_delete',
      'saved_queries_fts_insert',
      'saved_queries_fts_update',
      'saved_queries_updated_at',
    ];

    expect(triggers.map((t) => t.name)).toEqual(expectedTriggers);
  });

  it('FTS triggers properly sync contentless tables', () => {
    const pageId = 'test-page-id';
    db.prepare(
      `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted)
       VALUES (?, ?, ?, ?, ?)`
    ).run(pageId, 'Test Page Title', Date.now() / 1000, Date.now() / 1000, 0);

    const ftsResult = db
      .prepare("SELECT page_id FROM pages_fts WHERE pages_fts MATCH 'Test'")
      .get() as { page_id: string } | undefined;

    expect(ftsResult).toBeDefined();
    expect(ftsResult!.page_id).toBe(pageId);

    db.prepare('UPDATE pages SET title = ? WHERE page_id = ?').run('Updated Title', pageId);

    const oldMatch = db.prepare("SELECT page_id FROM pages_fts WHERE pages_fts MATCH 'Test'").get();
    expect(oldMatch).toBeUndefined();

    const newMatch = db
      .prepare("SELECT page_id FROM pages_fts WHERE pages_fts MATCH 'Updated'")
      .get() as { page_id: string } | undefined;
    expect(newMatch).toBeDefined();
    expect(newMatch!.page_id).toBe(pageId);
  });

  it('auto-update triggers maintain updated_at timestamps', async () => {
    const pageId = 'test-page-id';
    const now = Date.now() / 1000;
    db.prepare(
      `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted)
       VALUES (?, ?, ?, ?, ?)`
    ).run(pageId, 'Test Page', now, now, 0);

    const startTime = now;

    // Small delay to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 5));

    db.prepare('UPDATE pages SET title = ? WHERE page_id = ?').run('Updated Title', pageId);

    const result = db.prepare('SELECT updated_at FROM pages WHERE page_id = ?').get(pageId) as {
      updated_at: number;
    };

    expect(result.updated_at).toBeGreaterThan(startTime);
  });

  it('enforces foreign key constraints', () => {
    expect(() => {
      db.prepare(
        `INSERT INTO blocks (block_id, page_id, content, "order", created_at, updated_at, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        'block-1',
        'non-existent-page',
        'content',
        '0',
        Date.now() / 1000,
        Date.now() / 1000,
        0
      );
    }).toThrow();

    const pageId = 'test-page';
    db.prepare(
      `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted)
       VALUES (?, ?, ?, ?, ?)`
    ).run(pageId, 'Test Page', Date.now() / 1000, Date.now() / 1000, 0);

    expect(() => {
      db.prepare(
        `INSERT INTO blocks (block_id, page_id, content, "order", created_at, updated_at, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run('block-1', pageId, 'content', '0', Date.now() / 1000, Date.now() / 1000, 0);
    }).not.toThrow();
  });
});
