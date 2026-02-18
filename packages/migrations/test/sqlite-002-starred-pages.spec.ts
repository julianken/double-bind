import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { runSingleMigration, rollbackMigration } from '../src/sqlite/runner.js';
import { migration as initialSchema } from '../src/sqlite/001-initial-schema.js';
import { migration as starredPages } from '../src/sqlite/002-starred-pages.js';

/**
 * Helper: inserts a page row with minimal required fields.
 */
function insertPage(db: DatabaseType, pageId: string): void {
  db.prepare(
    `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted)
     VALUES (?, ?, ?, ?, ?)`
  ).run(pageId, 'Test Page', Date.now() / 1000, Date.now() / 1000, 0);
}

describe('SQLite migration 002-starred-pages - metadata', () => {
  it('has version 2', () => {
    expect(starredPages.version).toBe(2);
  });

  it('has name 002-starred-pages', () => {
    expect(starredPages.name).toBe('002-starred-pages');
  });
});

describe('SQLite migration 002-starred-pages - up migration', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');

    // Apply prerequisite schema (strip schema_metadata INSERTs — runner manages those)
    const schemaWithoutMetadata = initialSchema.up.replace(/INSERT INTO schema_metadata.*?;/gs, '');
    db.exec(schemaWithoutMetadata);

    // Apply the migration under test
    runSingleMigration(db, starredPages);
  });

  afterEach(() => {
    db.close();
  });

  it('creates the starred_pages table', () => {
    const table = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'starred_pages'"
      )
      .get();

    expect(table).toBeDefined();
  });

  it('creates starred_pages with page_id as TEXT primary key', () => {
    const columns = db.prepare('PRAGMA table_info(starred_pages)').all() as Array<{
      name: string;
      type: string;
      notnull: number;
      pk: number;
      dflt_value: string | null;
    }>;

    const pageIdCol = columns.find((c) => c.name === 'page_id');
    expect(pageIdCol).toBeDefined();
    expect(pageIdCol!.type).toBe('TEXT');
    expect(pageIdCol!.notnull).toBe(1);
    expect(pageIdCol!.pk).toBe(1);
  });

  it('creates starred_pages with starred_at as INTEGER NOT NULL with default', () => {
    const columns = db.prepare('PRAGMA table_info(starred_pages)').all() as Array<{
      name: string;
      type: string;
      notnull: number;
      pk: number;
      dflt_value: string | null;
    }>;

    const starredAtCol = columns.find((c) => c.name === 'starred_at');
    expect(starredAtCol).toBeDefined();
    expect(starredAtCol!.type).toBe('INTEGER');
    expect(starredAtCol!.notnull).toBe(1);
    expect(starredAtCol!.dflt_value).toBe('unixepoch()');
  });

  it('creates the idx_starred_pages_starred_at index', () => {
    const index = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_starred_pages_starred_at'"
      )
      .get();

    expect(index).toBeDefined();
  });

  it('enforces FK constraint — insert with non-existent page_id fails', () => {
    expect(() => {
      db.prepare(
        `INSERT INTO starred_pages (page_id, starred_at) VALUES (?, ?)`
      ).run('non-existent-page-id', Math.floor(Date.now() / 1000));
    }).toThrow();
  });

  it('allows insert when referenced page exists', () => {
    const pageId = 'page-star-valid';
    insertPage(db, pageId);

    expect(() => {
      db.prepare(
        `INSERT INTO starred_pages (page_id, starred_at) VALUES (?, ?)`
      ).run(pageId, Math.floor(Date.now() / 1000));
    }).not.toThrow();

    const row = db
      .prepare('SELECT page_id FROM starred_pages WHERE page_id = ?')
      .get(pageId) as { page_id: string } | undefined;

    expect(row).toBeDefined();
    expect(row!.page_id).toBe(pageId);
  });

  it('uses unixepoch() default for starred_at when not supplied', () => {
    const pageId = 'page-default-ts';
    insertPage(db, pageId);

    db.prepare(`INSERT INTO starred_pages (page_id) VALUES (?)`).run(pageId);

    const row = db
      .prepare('SELECT starred_at FROM starred_pages WHERE page_id = ?')
      .get(pageId) as { starred_at: number } | undefined;

    expect(row).toBeDefined();
    expect(typeof row!.starred_at).toBe('number');
    expect(row!.starred_at).toBeGreaterThan(0);
  });

  it('enforces uniqueness — inserting duplicate page_id fails', () => {
    const pageId = 'page-dupe-star';
    insertPage(db, pageId);

    db.prepare(`INSERT INTO starred_pages (page_id) VALUES (?)`).run(pageId);

    expect(() => {
      db.prepare(`INSERT INTO starred_pages (page_id) VALUES (?)`).run(pageId);
    }).toThrow();
  });

  it('CASCADE delete — removing a page removes its starred_pages entry', () => {
    const pageId = 'page-cascade-delete';
    insertPage(db, pageId);

    db.prepare(`INSERT INTO starred_pages (page_id) VALUES (?)`).run(pageId);

    // Confirm the star entry exists
    const before = db
      .prepare('SELECT page_id FROM starred_pages WHERE page_id = ?')
      .get(pageId);
    expect(before).toBeDefined();

    // Delete the page — cascade should remove the star
    db.prepare('DELETE FROM pages WHERE page_id = ?').run(pageId);

    const after = db
      .prepare('SELECT page_id FROM starred_pages WHERE page_id = ?')
      .get(pageId);
    expect(after).toBeUndefined();
  });
});

describe('SQLite migration 002-starred-pages - down migration', () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');

    // Apply prerequisite schema
    const schemaWithoutMetadata = initialSchema.up.replace(/INSERT INTO schema_metadata.*?;/gs, '');
    db.exec(schemaWithoutMetadata);

    // Apply and then roll back the migration
    runSingleMigration(db, starredPages);
    rollbackMigration(db, starredPages, [initialSchema, starredPages]);
  });

  afterEach(() => {
    db.close();
  });

  it('drops the idx_starred_pages_starred_at index', () => {
    const index = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_starred_pages_starred_at'"
      )
      .get();

    expect(index).toBeUndefined();
  });

  it('drops the starred_pages table', () => {
    const table = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'starred_pages'"
      )
      .get();

    expect(table).toBeUndefined();
  });

  it('leaves the prerequisite pages table intact after rollback', () => {
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'pages'")
      .get();

    expect(table).toBeDefined();
  });
});
