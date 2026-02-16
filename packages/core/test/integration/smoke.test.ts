// Smoke test for Layer 2 integration test infrastructure
// Verifies that cozo-node adapter, migrations, and data seeding work correctly

import { describe, it, expect, beforeEach } from 'vitest';
import type { GraphDB } from '@double-bind/types';
import { createTestDatabase } from './setup.js';
import { seedTestData } from './helpers.js';

describe('Integration Test Infrastructure Smoke Test', () => {
  let db: GraphDB;

  beforeEach(async () => {
    // Create fresh database with migrations applied
    db = await createTestDatabase();
  });

  it('should create database and apply migrations', async () => {
    // Verify schema_version metadata exists
    const result = await db.query<string>(`?[value] := *metadata{ key: "schema_version", value }`);

    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.[0]).toBe('2'); // Latest migration version
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
    const result = await db.query<[string, string, boolean]>(
      `?[page_id, title, is_deleted] := *pages{ page_id, title, is_deleted }`
    );

    // Should have 4 pages total
    expect(result.rows.length).toBe(4);

    // Verify specific page exists
    const gettingStartedPage = result.rows.find((row) => row[0] === 'page-1');
    expect(gettingStartedPage).toBeDefined();
    expect(gettingStartedPage?.[1]).toBe('Getting Started');
    expect(gettingStartedPage?.[2]).toBe(false);
  });

  it('should query blocks with hierarchy', async () => {
    await seedTestData(db);

    // Query blocks for "Getting Started" page
    const result = await db.query<[string, string, string | null, string]>(
      `?[block_id, page_id, parent_id, content] := *blocks{ block_id, page_id, parent_id, content }, page_id == "page-1"`
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

  it('should query blocks_by_page index', async () => {
    await seedTestData(db);

    // Query blocks for page-2 using the index
    const result = await db.query<[string, string]>(
      `?[page_id, block_id] := *blocks_by_page{ page_id, block_id }, page_id == "page-2"`
    );

    expect(result.rows.length).toBe(3); // 3 blocks on page-2
  });

  it('should query blocks_by_parent index', async () => {
    await seedTestData(db);

    // Query children of block-1-3 using the index
    const result = await db.query<[string, string]>(
      `?[parent_id, block_id] := *blocks_by_parent{ parent_id, block_id }, parent_id == "block-1-3"`
    );

    expect(result.rows.length).toBe(2); // 2 children (block-1-4 and block-1-5)
  });

  it('should query page-level blocks using blocks_by_parent', async () => {
    await seedTestData(db);

    // Query top-level blocks for page-1 (parent_id is "__page__page-1")
    const result = await db.query<[string, string]>(
      `?[parent_id, block_id] := *blocks_by_parent{ parent_id, block_id }, parent_id == "__page__page-1"`
    );

    expect(result.rows.length).toBe(2); // 2 top-level blocks (block-1-1 and block-1-3)
  });

  it('should query links between pages', async () => {
    await seedTestData(db);

    // Query all links
    const result = await db.query<[string, string, string]>(
      `?[source_id, target_id, link_type] := *links{ source_id, target_id, link_type }`
    );

    expect(result.rows.length).toBe(3);

    // Verify specific link
    const link = result.rows.find((row) => row[0] === 'page-1' && row[1] === 'page-2');
    expect(link).toBeDefined();
    expect(link?.[2]).toBe('reference');
  });

  it('should query links by target using reverse index', async () => {
    await seedTestData(db);

    // Query backlinks to page-2
    const result = await db.query<[string, string, string]>(
      `?[target_id, source_id, link_type] := *links:by_target{ target_id, source_id, link_type }, target_id == "page-2"`
    );

    expect(result.rows.length).toBe(1); // Only page-1 links to page-2
    expect(result.rows[0]?.[1]).toBe('page-1');
  });

  it('should query tags', async () => {
    await seedTestData(db);

    // Query all tags
    const result = await db.query<[string, string]>(`?[entity_id, tag] := *tags{ entity_id, tag }`);

    expect(result.rows.length).toBe(3);

    // Verify specific tag
    const tag = result.rows.find((row) => row[0] === 'page-1' && row[1] === 'documentation');
    expect(tag).toBeDefined();
  });

  it('should query properties', async () => {
    await seedTestData(db);

    // Query all properties
    const result = await db.query<[string, string, string, string]>(
      `?[entity_id, key, value, value_type] := *properties{ entity_id, key, value, value_type }`
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
      `?[date, page_id] := *daily_notes{ date, page_id }, date == $date`,
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
      `?[page_id, title, count(block_id)] :=
        *pages{ page_id, title },
        *blocks_by_page{ page_id, block_id }`
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
    const now = Date.now() / 1000;
    await db.mutate(
      `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [["page-new", "New Page", $now, $now, false, null]]
       :put pages { page_id => title, created_at, updated_at, is_deleted, daily_note_date }`,
      { now }
    );

    // Query all pages
    const result = await db.query<[string, string]>(
      `?[page_id, title] := *pages{ page_id, title }`
    );

    expect(result.rows.length).toBe(5); // 4 original + 1 new

    const newPage = result.rows.find((row) => row[0] === 'page-new');
    expect(newPage).toBeDefined();
    expect(newPage?.[1]).toBe('New Page');
  });
});
