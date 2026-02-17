// Smoke test for Layer 2 integration test infrastructure
// Verifies that SQLite adapter, migrations, and data seeding work correctly

import { describe, it, expect, beforeEach } from 'vitest';
import type { Database } from '@double-bind/types';
import { createTestDatabase } from './setup.js';
import { seedTestData } from './helpers.js';

describe('Integration Test Infrastructure Smoke Test', () => {
  let db: Database;

  beforeEach(async () => {
    // Create fresh database with migrations applied
    db = await createTestDatabase();
  });

  it('should create database and apply migrations', async () => {
    // Verify schema_metadata table exists and has entries
    const result = await db.query<string>(
      `SELECT value FROM schema_metadata WHERE key = 'schema_version'`
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.[0]).toBeTruthy();
  });

  it('should seed test data successfully', async () => {
    const fixtures = await seedTestData(db);

    // Verify fixtures structure
    expect(fixtures.pages.length).toBe(4); // 3 regular + 1 daily note
    expect(fixtures.blocks.length).toBe(12); // 5 + 3 + 2 + 2
    expect(fixtures.links.length).toBe(3);
    expect(fixtures.tags.length).toBe(3);
    expect(fixtures.properties.length).toBe(3);
  });

  it('should query pages after seeding', async () => {
    await seedTestData(db);

    // Query all non-deleted pages
    const result = await db.query<[string, string, number]>(
      `SELECT page_id, title, is_deleted FROM pages WHERE is_deleted = 0`
    );

    // Should have 4 pages total
    expect(result.rows.length).toBe(4);

    // Verify specific page exists
    const gettingStartedPage = result.rows.find((row) => row[0] === 'page-1');
    expect(gettingStartedPage).toBeDefined();
    expect(gettingStartedPage?.[1]).toBe('Getting Started');
    expect(gettingStartedPage?.[2]).toBe(0); // SQLite: 0 = false
  });

  it('should query blocks with hierarchy', async () => {
    await seedTestData(db);

    // Query blocks for "Getting Started" page
    const result = await db.query<[string, string, string | null, string]>(
      `SELECT block_id, page_id, parent_id, content FROM blocks WHERE page_id = 'page-1' AND is_deleted = 0`
    );

    expect(result.rows.length).toBe(5); // 5 blocks on page-1

    // Verify top-level blocks (parent_id is null)
    const topLevel = result.rows.filter((row) => row[2] === null);
    expect(topLevel.length).toBe(2); // block-1-1 and block-1-3

    // Verify nested blocks
    const nestedUnderBlock1_1 = result.rows.filter((row) => row[2] === 'block-1-1');
    expect(nestedUnderBlock1_1.length).toBe(1); // block-1-2

    const nestedUnderBlock1_3 = result.rows.filter((row) => row[2] === 'block-1-3');
    expect(nestedUnderBlock1_3.length).toBe(2); // block-1-4 and block-1-5
  });

  it('should query blocks by page', async () => {
    await seedTestData(db);

    // Query blocks for page-2
    const result = await db.query<[string, string]>(
      `SELECT page_id, block_id FROM blocks WHERE page_id = 'page-2' AND is_deleted = 0`
    );

    expect(result.rows.length).toBe(3); // 3 blocks on page-2
  });

  it('should query blocks by parent', async () => {
    await seedTestData(db);

    // Query children of block-1-3
    const result = await db.query<[string, string]>(
      `SELECT parent_id, block_id FROM blocks WHERE parent_id = 'block-1-3' AND is_deleted = 0`
    );

    expect(result.rows.length).toBe(2); // 2 children (block-1-4 and block-1-5)
  });

  it('should query root-level blocks for a page', async () => {
    await seedTestData(db);

    // In SQLite, root blocks have parent_id = NULL (no sentinel)
    const result = await db.query<[string]>(
      `SELECT block_id FROM blocks WHERE parent_id IS NULL AND page_id = 'page-1' AND is_deleted = 0`
    );

    expect(result.rows.length).toBe(2); // 2 top-level blocks (block-1-1 and block-1-3)
  });

  it('should query links between pages', async () => {
    await seedTestData(db);

    // Query all links
    const result = await db.query<[string, string, string]>(
      `SELECT source_id, target_id, link_type FROM links`
    );

    expect(result.rows.length).toBe(3);

    // Verify specific link
    const link = result.rows.find((row) => row[0] === 'page-1' && row[1] === 'page-2');
    expect(link).toBeDefined();
    expect(link?.[2]).toBe('reference');
  });

  it('should query links by target (backlinks)', async () => {
    await seedTestData(db);

    // Query backlinks to page-2
    const result = await db.query<[string, string, string]>(
      `SELECT target_id, source_id, link_type FROM links WHERE target_id = 'page-2'`
    );

    expect(result.rows.length).toBe(1); // Only page-1 links to page-2
    expect(result.rows[0]?.[1]).toBe('page-1');
  });

  it('should query tags', async () => {
    await seedTestData(db);

    // Query all tags (from both page_tags and block_tags)
    const result = await db.query<[string, string]>(
      `SELECT page_id AS entity_id, tag FROM page_tags
       UNION ALL
       SELECT block_id AS entity_id, tag FROM block_tags`
    );

    expect(result.rows.length).toBe(3);

    // Verify specific tag
    const tag = result.rows.find((row) => row[0] === 'page-1' && row[1] === 'documentation');
    expect(tag).toBeDefined();
  });

  it('should query properties', async () => {
    await seedTestData(db);

    // Query page properties
    const result = await db.query<[string, string, string, string]>(
      `SELECT page_id AS entity_id, key, value, value_type FROM page_properties`
    );

    expect(result.rows.length).toBe(3);

    // Verify specific property
    const prop = result.rows.find((row) => row[0] === 'page-1' && row[1] === 'status');
    expect(prop).toBeDefined();
    expect(prop?.[2]).toBe('published');
    expect(prop?.[3]).toBe('string');
  });

  it('should query daily notes', async () => {
    await seedTestData(db);

    const todayDate = new Date().toISOString().split('T')[0];

    // Query daily note by date
    const result = await db.query<[string, string]>(
      `SELECT date, page_id FROM daily_notes WHERE date = $date`,
      { date: todayDate }
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.[0]).toBe(todayDate);
    expect(result.rows[0]?.[1]).toBe(`daily-${todayDate}`);
  });

  it('should perform complex join query across pages and blocks', async () => {
    await seedTestData(db);

    // Query: Get page titles and their block counts
    const result = await db.query<[string, string, number]>(
      `SELECT p.page_id, p.title, COUNT(b.block_id) as block_count
       FROM pages p
       JOIN blocks b ON b.page_id = p.page_id AND b.is_deleted = 0
       WHERE p.is_deleted = 0
       GROUP BY p.page_id, p.title`
    );

    expect(result.rows.length).toBe(4); // 4 pages

    // Verify "Getting Started" has 5 blocks
    const gettingStarted = result.rows.find((row) => row[0] === 'page-1');
    expect(gettingStarted).toBeDefined();
    expect(gettingStarted?.[1]).toBe('Getting Started');
    expect(gettingStarted?.[2]).toBe(5);
  });

  it('should mutate data and query updated results', async () => {
    await seedTestData(db);

    // Add a new page
    const now = Date.now();
    await db.mutate(
      `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
       VALUES ($id, $title, $now, $now, 0, NULL)`,
      { id: 'page-new', title: 'New Page', now }
    );

    // Query all pages
    const result = await db.query<[string, string]>(
      `SELECT page_id, title FROM pages WHERE is_deleted = 0`
    );

    expect(result.rows.length).toBe(5); // 4 original + 1 new

    const newPage = result.rows.find((row) => row[0] === 'page-new');
    expect(newPage).toBeDefined();
    expect(newPage?.[1]).toBe('New Page');
  });
});
