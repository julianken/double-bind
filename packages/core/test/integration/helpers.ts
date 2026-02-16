// Integration test helpers for seeding realistic test data

import type { GraphDB } from '@double-bind/types';

/**
 * Test fixtures returned by seedTestData().
 * Contains IDs and metadata for all seeded entities.
 */
export interface TestFixtures {
  pages: Array<{
    page_id: string;
    title: string;
    is_daily_note: boolean;
    daily_note_date?: string;
  }>;
  blocks: Array<{
    block_id: string;
    page_id: string;
    parent_id: string | null;
    content: string;
    order: string;
    level: number;
  }>;
  links: Array<{
    source_id: string;
    target_id: string;
    link_type: string;
  }>;
  tags: Array<{
    entity_id: string;
    tag: string;
  }>;
  properties: Array<{
    entity_id: string;
    key: string;
    value: string;
  }>;
}

/**
 * Seed a comprehensive set of test data into the database.
 * Creates pages, blocks with hierarchy, links, tags, properties, and a daily note.
 *
 * Data structure:
 * - Page 1: "Getting Started" with 5 blocks (2 top-level, 3 nested)
 * - Page 2: "Concepts" with 3 blocks (1 top-level, 2 nested)
 * - Page 3: "Tasks" with 2 blocks
 * - Daily Note: Today's date with 2 blocks
 * - 3 wiki links between pages
 * - Tags on pages and blocks
 * - Properties on pages
 *
 * @param db - GraphDB instance to seed
 * @returns TestFixtures with all created entity IDs and metadata
 *
 * @example
 * ```typescript
 * const db = await createTestDatabase();
 * const fixtures = await seedTestData(db);
 * // fixtures.pages[0].page_id === 'page-1'
 * // fixtures.blocks.length === 12
 * ```
 */
export async function seedTestData(db: GraphDB): Promise<TestFixtures> {
  const now = Date.now() / 1000; // CozoDB uses Unix seconds
  const fixtures: TestFixtures = {
    pages: [],
    blocks: [],
    links: [],
    tags: [],
    properties: [],
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Create Pages
  // ─────────────────────────────────────────────────────────────────────────────

  const pages = [
    { page_id: 'page-1', title: 'Getting Started', is_daily_note: false },
    { page_id: 'page-2', title: 'Concepts', is_daily_note: false },
    { page_id: 'page-3', title: 'Tasks', is_daily_note: false },
  ];

  for (const page of pages) {
    await db.mutate(
      `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [[$id, $title, $now, $now, false, null]]
       :put pages { page_id => title, created_at, updated_at, is_deleted, daily_note_date }`,
      { id: page.page_id, title: page.title, now }
    );
    fixtures.pages.push({ ...page, daily_note_date: undefined });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Create Daily Note
  // ─────────────────────────────────────────────────────────────────────────────

  const todayDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const dailyNoteId = `daily-${todayDate}`;

  // Create the daily note page
  await db.mutate(
    `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [[$id, $title, $now, $now, false, $date]]
     :put pages { page_id => title, created_at, updated_at, is_deleted, daily_note_date }`,
    { id: dailyNoteId, title: todayDate, date: todayDate, now }
  );

  // Add the daily notes index entry
  await db.mutate(
    `?[date, page_id] <- [[$date, $id]]
     :put daily_notes { date => page_id }`,
    { date: todayDate, id: dailyNoteId }
  );

  fixtures.pages.push({
    page_id: dailyNoteId,
    title: todayDate,
    is_daily_note: true,
    daily_note_date: todayDate,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Create Blocks with Hierarchy
  // ─────────────────────────────────────────────────────────────────────────────

  // Block structure for "Getting Started" (page-1):
  // - block-1-1 (top-level)
  //   - block-1-2 (child of block-1-1)
  // - block-1-3 (top-level)
  //   - block-1-4 (child of block-1-3)
  //   - block-1-5 (child of block-1-3)

  const blocksToCreate = [
    // Getting Started blocks
    {
      block_id: 'block-1-1',
      page_id: 'page-1',
      parent_id: null,
      content: 'Welcome to [[Concepts]]',
      order: 'a0',
      level: 0,
    },
    {
      block_id: 'block-1-2',
      page_id: 'page-1',
      parent_id: 'block-1-1',
      content: 'This is a nested block',
      order: 'a0',
      level: 1,
    },
    {
      block_id: 'block-1-3',
      page_id: 'page-1',
      parent_id: null,
      content: 'Key features:',
      order: 'a1',
      level: 0,
    },
    {
      block_id: 'block-1-4',
      page_id: 'page-1',
      parent_id: 'block-1-3',
      content: 'Graph-native architecture',
      order: 'a0',
      level: 1,
    },
    {
      block_id: 'block-1-5',
      page_id: 'page-1',
      parent_id: 'block-1-3',
      content: 'Local-first design',
      order: 'a1',
      level: 1,
    },

    // Concepts blocks
    {
      block_id: 'block-2-1',
      page_id: 'page-2',
      parent_id: null,
      content: 'Core concepts of [[Tasks]]',
      order: 'a0',
      level: 0,
    },
    {
      block_id: 'block-2-2',
      page_id: 'page-2',
      parent_id: 'block-2-1',
      content: 'Pages and blocks',
      order: 'a0',
      level: 1,
    },
    {
      block_id: 'block-2-3',
      page_id: 'page-2',
      parent_id: 'block-2-1',
      content: 'Bidirectional links',
      order: 'a1',
      level: 1,
    },

    // Tasks blocks
    {
      block_id: 'block-3-1',
      page_id: 'page-3',
      parent_id: null,
      content: 'TODO: Write documentation',
      order: 'a0',
      level: 0,
    },
    {
      block_id: 'block-3-2',
      page_id: 'page-3',
      parent_id: null,
      content: 'DONE: Set up project',
      order: 'a1',
      level: 0,
    },

    // Daily note blocks
    {
      block_id: `block-daily-1`,
      page_id: dailyNoteId,
      parent_id: null,
      content: `Today's notes`,
      order: 'a0',
      level: 0,
    },
    {
      block_id: `block-daily-2`,
      page_id: dailyNoteId,
      parent_id: null,
      content: 'Link to [[Getting Started]]',
      order: 'a1',
      level: 0,
    },
  ];

  for (const block of blocksToCreate) {
    // Parent key for blocks_by_parent:
    // - null parent_id -> "__page__" + page_id
    // - non-null parent_id -> parent_id
    const parentKey = block.parent_id ?? `__page__${block.page_id}`;

    // Insert into blocks relation
    await db.mutate(
      `?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] <- [[$id, $page_id, $parent_id, $content, "text", $order, false, false, $now, $now]]
       :put blocks { block_id => page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at }`,
      {
        id: block.block_id,
        page_id: block.page_id,
        parent_id: block.parent_id,
        content: block.content,
        order: block.order,
        now,
      }
    );

    // Add to blocks_by_page index
    await db.mutate(
      `?[page_id, block_id] <- [[$page_id, $id]]
       :put blocks_by_page { page_id, block_id }`,
      { page_id: block.page_id, id: block.block_id }
    );

    // Add to blocks_by_parent index
    await db.mutate(
      `?[parent_id, block_id] <- [[$parent_key, $id]]
       :put blocks_by_parent { parent_id, block_id }`,
      { parent_key: parentKey, id: block.block_id }
    );

    fixtures.blocks.push(block);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Create Links (wiki links between pages)
  // ─────────────────────────────────────────────────────────────────────────────

  const links = [
    {
      source_id: 'page-1',
      target_id: 'page-2',
      link_type: 'reference',
      context_block_id: 'block-1-1',
    },
    {
      source_id: 'page-2',
      target_id: 'page-3',
      link_type: 'reference',
      context_block_id: 'block-2-1',
    },
    {
      source_id: dailyNoteId,
      target_id: 'page-1',
      link_type: 'reference',
      context_block_id: 'block-daily-2',
    },
  ];

  for (const link of links) {
    await db.mutate(
      `?[source_id, target_id, link_type, created_at, context_block_id] <- [[$source, $target, $type, $now, $context]]
       :put links { source_id, target_id, link_type => created_at, context_block_id }`,
      {
        source: link.source_id,
        target: link.target_id,
        type: link.link_type,
        context: link.context_block_id,
        now,
      }
    );
    fixtures.links.push(link);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Create Tags
  // ─────────────────────────────────────────────────────────────────────────────

  const tags = [
    { entity_id: 'page-1', tag: 'documentation' },
    { entity_id: 'page-3', tag: 'tasks' },
    { entity_id: 'block-3-1', tag: 'todo' },
  ];

  for (const tag of tags) {
    await db.mutate(
      `?[entity_id, tag, created_at] <- [[$entity, $tag, $now]]
       :put tags { entity_id, tag => created_at }`,
      { entity: tag.entity_id, tag: tag.tag, now }
    );
    fixtures.tags.push(tag);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Create Properties
  // ─────────────────────────────────────────────────────────────────────────────

  const properties = [
    { entity_id: 'page-1', key: 'status', value: 'published', value_type: 'string' },
    { entity_id: 'page-2', key: 'status', value: 'draft', value_type: 'string' },
    { entity_id: 'page-3', key: 'priority', value: 'high', value_type: 'string' },
  ];

  for (const prop of properties) {
    await db.mutate(
      `?[entity_id, key, value, value_type, updated_at] <- [[$entity, $key, $value, $type, $now]]
       :put properties { entity_id, key => value, value_type, updated_at }`,
      {
        entity: prop.entity_id,
        key: prop.key,
        value: prop.value,
        type: prop.value_type,
        now,
      }
    );
    fixtures.properties.push(prop);
  }

  return fixtures;
}
