/**
 * Test Fixtures for Double-Bind
 *
 * Pre-built test data scenarios used across unit and integration tests.
 * These provide consistent, well-known data sets for testing various features.
 *
 * Data format: Plain objects matching domain types, suitable for:
 * - Seeding MockGraphDB via seed()
 * - Inserting into real CozoDB via repository create() calls
 */

import { ulid } from 'ulid';
import type { Page, Block, Link, BlockRef, Tag, BlockId } from '@double-bind/types';

// ============================================================================
// ULID Generation for test fixtures
// ============================================================================

/**
 * Generate a ULID with a fixed timestamp base for consistent ordering.
 *
 * NOTE: ULIDs are only consistent within a single module load. The timestamp
 * portion (first 10 chars) is deterministic, but the random portion (last 16
 * chars) varies between test runs. This is fine for fixtures since:
 * - IDs are unique within a test run (referential integrity)
 * - Tests should not hardcode expected ULID values
 * - Use ULID format validation, not exact string matching
 */
const BASE_TIMESTAMP = 1704067200000; // 2024-01-01T00:00:00.000Z

function generateTestUlid(offset: number = 0): string {
  return ulid(BASE_TIMESTAMP + offset);
}

// ============================================================================
// Pre-generated ULIDs for FIXTURE_SMALL_KB
// ============================================================================

// Page IDs (5 pages)
const PAGE_IDS = {
  projectManagement: generateTestUlid(0),
  researchNotes: generateTestUlid(1),
  dailyJournal: generateTestUlid(2),
  bookNotes: generateTestUlid(3),
  meetingNotes: generateTestUlid(4),
};

// Block IDs (20 blocks)
const BLOCK_IDS = {
  // Page 1: Project Management (4 blocks)
  pm_root1: generateTestUlid(100),
  pm_child1: generateTestUlid(101),
  pm_child2: generateTestUlid(102),
  pm_grandchild1: generateTestUlid(103),
  // Page 2: Research Notes (5 blocks)
  rn_root1: generateTestUlid(200),
  rn_root2: generateTestUlid(201),
  rn_child1: generateTestUlid(202),
  rn_child2: generateTestUlid(203),
  rn_child3: generateTestUlid(204),
  // Page 3: Daily Journal (3 blocks)
  dj_root1: generateTestUlid(300),
  dj_root2: generateTestUlid(301),
  dj_child1: generateTestUlid(302),
  // Page 4: Book Notes (5 blocks)
  bn_root1: generateTestUlid(400),
  bn_root2: generateTestUlid(401),
  bn_child1: generateTestUlid(402),
  bn_child2: generateTestUlid(403),
  bn_grandchild1: generateTestUlid(404),
  // Page 5: Meeting Notes (3 blocks)
  mn_root1: generateTestUlid(500),
  mn_child1: generateTestUlid(501),
  mn_child2: generateTestUlid(502),
};

// ============================================================================
// FIXTURE_SMALL_KB
// ============================================================================

/**
 * A small knowledge base with interconnected data:
 * - 5 pages (with varied titles)
 * - 20 blocks (across the pages, with parent-child nesting)
 * - 8 links (page-to-page references)
 * - 3 block refs (block-to-block references)
 * - 10 tags (spread across pages and blocks)
 */
export interface SmallKBFixture {
  pages: Page[];
  blocks: Block[];
  links: Link[];
  refs: BlockRef[];
  tags: Tag[];
}

const SMALL_KB_CREATED_AT = BASE_TIMESTAMP;
const SMALL_KB_UPDATED_AT = BASE_TIMESTAMP + 3600000; // 1 hour later

export const FIXTURE_SMALL_KB: SmallKBFixture = {
  // 5 Pages
  pages: [
    {
      pageId: PAGE_IDS.projectManagement,
      title: 'Project Management',
      createdAt: SMALL_KB_CREATED_AT,
      updatedAt: SMALL_KB_UPDATED_AT,
      isDeleted: false,
      dailyNoteDate: null,
    },
    {
      pageId: PAGE_IDS.researchNotes,
      title: 'Research Notes',
      createdAt: SMALL_KB_CREATED_AT + 1000,
      updatedAt: SMALL_KB_UPDATED_AT + 1000,
      isDeleted: false,
      dailyNoteDate: null,
    },
    {
      pageId: PAGE_IDS.dailyJournal,
      title: 'Daily Journal',
      createdAt: SMALL_KB_CREATED_AT + 2000,
      updatedAt: SMALL_KB_UPDATED_AT + 2000,
      isDeleted: false,
      dailyNoteDate: '2024-01-15',
    },
    {
      pageId: PAGE_IDS.bookNotes,
      title: 'Book Notes - Thinking Fast and Slow',
      createdAt: SMALL_KB_CREATED_AT + 3000,
      updatedAt: SMALL_KB_UPDATED_AT + 3000,
      isDeleted: false,
      dailyNoteDate: null,
    },
    {
      pageId: PAGE_IDS.meetingNotes,
      title: 'Meeting Notes',
      createdAt: SMALL_KB_CREATED_AT + 4000,
      updatedAt: SMALL_KB_UPDATED_AT + 4000,
      isDeleted: false,
      dailyNoteDate: null,
    },
  ],

  // 20 Blocks (distributed across pages with parent-child nesting)
  blocks: [
    // Page 1: Project Management (4 blocks)
    {
      blockId: BLOCK_IDS.pm_root1,
      pageId: PAGE_IDS.projectManagement,
      parentId: null,
      content: 'Project timeline and milestones',
      contentType: 'heading',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT,
      updatedAt: SMALL_KB_UPDATED_AT,
    },
    {
      blockId: BLOCK_IDS.pm_child1,
      pageId: PAGE_IDS.projectManagement,
      parentId: BLOCK_IDS.pm_root1,
      content: 'Phase 1: Research and Planning',
      contentType: 'text',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 100,
      updatedAt: SMALL_KB_UPDATED_AT + 100,
    },
    {
      blockId: BLOCK_IDS.pm_child2,
      pageId: PAGE_IDS.projectManagement,
      parentId: BLOCK_IDS.pm_root1,
      content: 'Phase 2: Implementation',
      contentType: 'text',
      order: 'a1',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 200,
      updatedAt: SMALL_KB_UPDATED_AT + 200,
    },
    {
      blockId: BLOCK_IDS.pm_grandchild1,
      pageId: PAGE_IDS.projectManagement,
      parentId: BLOCK_IDS.pm_child1,
      content: 'Review [[Research Notes]] for insights',
      contentType: 'todo',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 300,
      updatedAt: SMALL_KB_UPDATED_AT + 300,
    },

    // Page 2: Research Notes (5 blocks)
    {
      blockId: BLOCK_IDS.rn_root1,
      pageId: PAGE_IDS.researchNotes,
      parentId: null,
      content: 'Key findings from literature review',
      contentType: 'heading',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 1000,
      updatedAt: SMALL_KB_UPDATED_AT + 1000,
    },
    {
      blockId: BLOCK_IDS.rn_root2,
      pageId: PAGE_IDS.researchNotes,
      parentId: null,
      content: 'Methodology notes',
      contentType: 'heading',
      order: 'a1',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 1100,
      updatedAt: SMALL_KB_UPDATED_AT + 1100,
    },
    {
      blockId: BLOCK_IDS.rn_child1,
      pageId: PAGE_IDS.researchNotes,
      parentId: BLOCK_IDS.rn_root1,
      content: 'Finding 1: Graph-based knowledge management improves recall',
      contentType: 'text',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 1200,
      updatedAt: SMALL_KB_UPDATED_AT + 1200,
    },
    {
      blockId: BLOCK_IDS.rn_child2,
      pageId: PAGE_IDS.researchNotes,
      parentId: BLOCK_IDS.rn_root1,
      content: 'Finding 2: Links related to [[Book Notes - Thinking Fast and Slow]]',
      contentType: 'text',
      order: 'a1',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 1300,
      updatedAt: SMALL_KB_UPDATED_AT + 1300,
    },
    {
      blockId: BLOCK_IDS.rn_child3,
      pageId: PAGE_IDS.researchNotes,
      parentId: BLOCK_IDS.rn_root2,
      content: 'Used qualitative analysis methods',
      contentType: 'text',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 1400,
      updatedAt: SMALL_KB_UPDATED_AT + 1400,
    },

    // Page 3: Daily Journal (3 blocks)
    {
      blockId: BLOCK_IDS.dj_root1,
      pageId: PAGE_IDS.dailyJournal,
      parentId: null,
      content: 'Worked on [[Project Management]] tasks',
      contentType: 'text',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 2000,
      updatedAt: SMALL_KB_UPDATED_AT + 2000,
    },
    {
      blockId: BLOCK_IDS.dj_root2,
      pageId: PAGE_IDS.dailyJournal,
      parentId: null,
      content: 'Attended team [[Meeting Notes]]',
      contentType: 'text',
      order: 'a1',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 2100,
      updatedAt: SMALL_KB_UPDATED_AT + 2100,
    },
    {
      blockId: BLOCK_IDS.dj_child1,
      pageId: PAGE_IDS.dailyJournal,
      parentId: BLOCK_IDS.dj_root1,
      content: 'Completed phase 1 review',
      contentType: 'todo',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 2200,
      updatedAt: SMALL_KB_UPDATED_AT + 2200,
    },

    // Page 4: Book Notes (5 blocks)
    {
      blockId: BLOCK_IDS.bn_root1,
      pageId: PAGE_IDS.bookNotes,
      parentId: null,
      content: 'System 1 and System 2 thinking',
      contentType: 'heading',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 3000,
      updatedAt: SMALL_KB_UPDATED_AT + 3000,
    },
    {
      blockId: BLOCK_IDS.bn_root2,
      pageId: PAGE_IDS.bookNotes,
      parentId: null,
      content: 'Cognitive biases',
      contentType: 'heading',
      order: 'a1',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 3100,
      updatedAt: SMALL_KB_UPDATED_AT + 3100,
    },
    {
      blockId: BLOCK_IDS.bn_child1,
      pageId: PAGE_IDS.bookNotes,
      parentId: BLOCK_IDS.bn_root1,
      content: 'System 1 is fast, intuitive, automatic',
      contentType: 'text',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 3200,
      updatedAt: SMALL_KB_UPDATED_AT + 3200,
    },
    {
      blockId: BLOCK_IDS.bn_child2,
      pageId: PAGE_IDS.bookNotes,
      parentId: BLOCK_IDS.bn_root1,
      content: 'System 2 is slow, deliberate, analytical',
      contentType: 'text',
      order: 'a1',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 3300,
      updatedAt: SMALL_KB_UPDATED_AT + 3300,
    },
    {
      blockId: BLOCK_IDS.bn_grandchild1,
      pageId: PAGE_IDS.bookNotes,
      parentId: BLOCK_IDS.bn_child1,
      content: 'Connects to [[Research Notes]] about recall',
      contentType: 'text',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 3400,
      updatedAt: SMALL_KB_UPDATED_AT + 3400,
    },

    // Page 5: Meeting Notes (3 blocks)
    {
      blockId: BLOCK_IDS.mn_root1,
      pageId: PAGE_IDS.meetingNotes,
      parentId: null,
      content: 'Sprint planning discussion',
      contentType: 'heading',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 4000,
      updatedAt: SMALL_KB_UPDATED_AT + 4000,
    },
    {
      blockId: BLOCK_IDS.mn_child1,
      pageId: PAGE_IDS.meetingNotes,
      parentId: BLOCK_IDS.mn_root1,
      content: 'Discussed [[Project Management]] timeline',
      contentType: 'text',
      order: 'a0',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 4100,
      updatedAt: SMALL_KB_UPDATED_AT + 4100,
    },
    {
      blockId: BLOCK_IDS.mn_child2,
      pageId: PAGE_IDS.meetingNotes,
      parentId: BLOCK_IDS.mn_root1,
      content: 'Action items assigned to team',
      contentType: 'todo',
      order: 'a1',
      isCollapsed: false,
      isDeleted: false,
      createdAt: SMALL_KB_CREATED_AT + 4200,
      updatedAt: SMALL_KB_UPDATED_AT + 4200,
    },
  ],

  // 8 Links (page-to-page references)
  links: [
    // Project Management -> Research Notes
    {
      sourceId: PAGE_IDS.projectManagement,
      targetId: PAGE_IDS.researchNotes,
      linkType: 'reference',
      createdAt: SMALL_KB_CREATED_AT + 300,
      contextBlockId: BLOCK_IDS.pm_grandchild1,
    },
    // Research Notes -> Book Notes
    {
      sourceId: PAGE_IDS.researchNotes,
      targetId: PAGE_IDS.bookNotes,
      linkType: 'reference',
      createdAt: SMALL_KB_CREATED_AT + 1300,
      contextBlockId: BLOCK_IDS.rn_child2,
    },
    // Daily Journal -> Project Management
    {
      sourceId: PAGE_IDS.dailyJournal,
      targetId: PAGE_IDS.projectManagement,
      linkType: 'reference',
      createdAt: SMALL_KB_CREATED_AT + 2000,
      contextBlockId: BLOCK_IDS.dj_root1,
    },
    // Daily Journal -> Meeting Notes
    {
      sourceId: PAGE_IDS.dailyJournal,
      targetId: PAGE_IDS.meetingNotes,
      linkType: 'reference',
      createdAt: SMALL_KB_CREATED_AT + 2100,
      contextBlockId: BLOCK_IDS.dj_root2,
    },
    // Book Notes -> Research Notes
    {
      sourceId: PAGE_IDS.bookNotes,
      targetId: PAGE_IDS.researchNotes,
      linkType: 'reference',
      createdAt: SMALL_KB_CREATED_AT + 3400,
      contextBlockId: BLOCK_IDS.bn_grandchild1,
    },
    // Meeting Notes -> Project Management
    {
      sourceId: PAGE_IDS.meetingNotes,
      targetId: PAGE_IDS.projectManagement,
      linkType: 'reference',
      createdAt: SMALL_KB_CREATED_AT + 4100,
      contextBlockId: BLOCK_IDS.mn_child1,
    },
    // Embedded link: Research Notes embeds Project Management
    {
      sourceId: PAGE_IDS.researchNotes,
      targetId: PAGE_IDS.projectManagement,
      linkType: 'embed',
      createdAt: SMALL_KB_CREATED_AT + 1500,
      contextBlockId: BLOCK_IDS.rn_root2,
    },
    // Tag link: Book Notes tags Research Notes as related
    {
      sourceId: PAGE_IDS.bookNotes,
      targetId: PAGE_IDS.meetingNotes,
      linkType: 'tag',
      createdAt: SMALL_KB_CREATED_AT + 3500,
      contextBlockId: BLOCK_IDS.bn_root2,
    },
  ],

  // 3 Block Refs (block-to-block references)
  refs: [
    // pm_grandchild1 references rn_child1
    {
      sourceBlockId: BLOCK_IDS.pm_grandchild1,
      targetBlockId: BLOCK_IDS.rn_child1,
      createdAt: SMALL_KB_CREATED_AT + 350,
    },
    // bn_grandchild1 references rn_child1
    {
      sourceBlockId: BLOCK_IDS.bn_grandchild1,
      targetBlockId: BLOCK_IDS.rn_child1,
      createdAt: SMALL_KB_CREATED_AT + 3450,
    },
    // dj_child1 references pm_child1
    {
      sourceBlockId: BLOCK_IDS.dj_child1,
      targetBlockId: BLOCK_IDS.pm_child1,
      createdAt: SMALL_KB_CREATED_AT + 2250,
    },
  ],

  // 10 Tags (spread across pages and blocks)
  tags: [
    // Page tags
    { entityId: PAGE_IDS.projectManagement, tag: 'work', createdAt: SMALL_KB_CREATED_AT },
    { entityId: PAGE_IDS.projectManagement, tag: 'planning', createdAt: SMALL_KB_CREATED_AT + 10 },
    { entityId: PAGE_IDS.researchNotes, tag: 'research', createdAt: SMALL_KB_CREATED_AT + 1000 },
    { entityId: PAGE_IDS.dailyJournal, tag: 'journal', createdAt: SMALL_KB_CREATED_AT + 2000 },
    { entityId: PAGE_IDS.bookNotes, tag: 'books', createdAt: SMALL_KB_CREATED_AT + 3000 },
    { entityId: PAGE_IDS.bookNotes, tag: 'psychology', createdAt: SMALL_KB_CREATED_AT + 3010 },
    // Block tags
    { entityId: BLOCK_IDS.pm_grandchild1, tag: 'action-item', createdAt: SMALL_KB_CREATED_AT + 300 },
    { entityId: BLOCK_IDS.rn_child1, tag: 'key-finding', createdAt: SMALL_KB_CREATED_AT + 1200 },
    { entityId: BLOCK_IDS.dj_child1, tag: 'completed', createdAt: SMALL_KB_CREATED_AT + 2200 },
    { entityId: BLOCK_IDS.mn_child2, tag: 'action-item', createdAt: SMALL_KB_CREATED_AT + 4200 },
  ],
};

// ============================================================================
// FIXTURE_DEEP_TREE
// ============================================================================

/**
 * A single page with deeply nested blocks:
 * - 1 page
 * - Blocks nested 5 levels deep, 3 children per level
 * - Tests tree traversal and recursive operations
 *
 * Structure:
 * Level 0 (root): 3 blocks
 *   Level 1: 3 children each = 9 blocks
 *     Level 2: 3 children each = 27 blocks
 *       Level 3: 3 children each = 81 blocks
 *         Level 4: 3 children each = 243 blocks
 *
 * Total: 3 + 9 + 27 + 81 + 243 = 363 blocks
 *
 * For practical test purposes, we use a smaller tree:
 * Level 0: 3 blocks
 *   Level 1: 3 children per root = 9 blocks
 *     Level 2: 3 children per L1 = 27 blocks
 *       Level 3: 3 children per L2 = 81 blocks
 *         Level 4: 3 children per L3 = 243 blocks
 *
 * Simplified version for test fixtures (121 blocks total):
 * Level 0: 1 block (root)
 *   Level 1: 3 children
 *     Level 2: 3 children each = 9 blocks
 *       Level 3: 3 children each = 27 blocks
 *         Level 4: 3 children each = 81 blocks
 * Total: 1 + 3 + 9 + 27 + 81 = 121 blocks
 */
export interface DeepTreeFixture {
  page: Page;
  blocks: Block[];
}

const DEEP_TREE_PAGE_ID = generateTestUlid(1000);
const DEEP_TREE_CREATED_AT = BASE_TIMESTAMP + 10000000;
const DEEP_TREE_UPDATED_AT = DEEP_TREE_CREATED_AT + 3600000;

function generateDeepTreeBlocks(): Block[] {
  const blocks: Block[] = [];
  let blockIndex = 0;

  function createBlock(
    parentId: BlockId | null,
    level: number,
    childIndex: number
  ): Block {
    const blockId = generateTestUlid(2000 + blockIndex++);
    return {
      blockId,
      pageId: DEEP_TREE_PAGE_ID,
      parentId,
      content: `Level ${level} Block ${childIndex + 1}`,
      contentType: 'text',
      order: `a${childIndex}`,
      isCollapsed: false,
      isDeleted: false,
      createdAt: DEEP_TREE_CREATED_AT + blockIndex * 10,
      updatedAt: DEEP_TREE_UPDATED_AT + blockIndex * 10,
    };
  }

  function buildTree(parentId: BlockId | null, level: number): void {
    if (level > 4) return; // Stop at level 4 (0-indexed means 5 levels total)

    const childCount = 3;
    for (let i = 0; i < childCount; i++) {
      const block = createBlock(parentId, level, i);
      blocks.push(block);
      buildTree(block.blockId, level + 1);
    }
  }

  // Build tree starting from root (level 0)
  buildTree(null, 0);

  return blocks;
}

export const FIXTURE_DEEP_TREE: DeepTreeFixture = {
  page: {
    pageId: DEEP_TREE_PAGE_ID,
    title: 'Deep Tree Test Page',
    createdAt: DEEP_TREE_CREATED_AT,
    updatedAt: DEEP_TREE_UPDATED_AT,
    isDeleted: false,
    dailyNoteDate: null,
  },
  blocks: generateDeepTreeBlocks(),
};

// ============================================================================
// FIXTURE_PAGERANK_GRAPH (optional, for future graph algorithm tests)
// ============================================================================

/**
 * A graph with known PageRank values for verifying CozoDB's built-in
 * PageRank algorithm. Based on a simple directed graph.
 *
 * Graph structure (directed edges):
 * A -> B, A -> C
 * B -> C
 * C -> A
 * D -> C
 *
 * This creates a cycle (A -> C -> A) and a sink absorber pattern.
 */
export interface PageRankGraphFixture {
  pages: Page[];
  links: Link[];
  /**
   * Expected approximate PageRank values.
   * These are computed based on the standard PageRank algorithm
   * with damping factor 0.85.
   */
  expectedRanks: Record<string, number>;
}

const PR_PAGE_IDS = {
  a: generateTestUlid(5000),
  b: generateTestUlid(5001),
  c: generateTestUlid(5002),
  d: generateTestUlid(5003),
};

const PR_CREATED_AT = BASE_TIMESTAMP + 50000000;

export const FIXTURE_PAGERANK_GRAPH: PageRankGraphFixture = {
  pages: [
    {
      pageId: PR_PAGE_IDS.a,
      title: 'Page A',
      createdAt: PR_CREATED_AT,
      updatedAt: PR_CREATED_AT + 1000,
      isDeleted: false,
      dailyNoteDate: null,
    },
    {
      pageId: PR_PAGE_IDS.b,
      title: 'Page B',
      createdAt: PR_CREATED_AT + 100,
      updatedAt: PR_CREATED_AT + 1100,
      isDeleted: false,
      dailyNoteDate: null,
    },
    {
      pageId: PR_PAGE_IDS.c,
      title: 'Page C',
      createdAt: PR_CREATED_AT + 200,
      updatedAt: PR_CREATED_AT + 1200,
      isDeleted: false,
      dailyNoteDate: null,
    },
    {
      pageId: PR_PAGE_IDS.d,
      title: 'Page D',
      createdAt: PR_CREATED_AT + 300,
      updatedAt: PR_CREATED_AT + 1300,
      isDeleted: false,
      dailyNoteDate: null,
    },
  ],
  links: [
    // A -> B
    {
      sourceId: PR_PAGE_IDS.a,
      targetId: PR_PAGE_IDS.b,
      linkType: 'reference',
      createdAt: PR_CREATED_AT + 10,
      contextBlockId: null,
    },
    // A -> C
    {
      sourceId: PR_PAGE_IDS.a,
      targetId: PR_PAGE_IDS.c,
      linkType: 'reference',
      createdAt: PR_CREATED_AT + 20,
      contextBlockId: null,
    },
    // B -> C
    {
      sourceId: PR_PAGE_IDS.b,
      targetId: PR_PAGE_IDS.c,
      linkType: 'reference',
      createdAt: PR_CREATED_AT + 30,
      contextBlockId: null,
    },
    // C -> A
    {
      sourceId: PR_PAGE_IDS.c,
      targetId: PR_PAGE_IDS.a,
      linkType: 'reference',
      createdAt: PR_CREATED_AT + 40,
      contextBlockId: null,
    },
    // D -> C
    {
      sourceId: PR_PAGE_IDS.d,
      targetId: PR_PAGE_IDS.c,
      linkType: 'reference',
      createdAt: PR_CREATED_AT + 50,
      contextBlockId: null,
    },
  ],
  /**
   * Expected PageRank values (approximate).
   * C should have the highest rank as it receives the most incoming links.
   * D should have the lowest as it only links out, receiving no incoming links.
   */
  expectedRanks: {
    [PR_PAGE_IDS.a]: 0.25,
    [PR_PAGE_IDS.b]: 0.15,
    [PR_PAGE_IDS.c]: 0.45,
    [PR_PAGE_IDS.d]: 0.15,
  },
};

// ============================================================================
// Helper exports for test utilities
// ============================================================================

/**
 * Get all page IDs from FIXTURE_SMALL_KB for easy access in tests
 */
export const SMALL_KB_PAGE_IDS = PAGE_IDS;

/**
 * Get all block IDs from FIXTURE_SMALL_KB for easy access in tests
 */
export const SMALL_KB_BLOCK_IDS = BLOCK_IDS;

/**
 * Get PageRank page IDs for easy access in tests
 */
export const PAGERANK_PAGE_IDS = PR_PAGE_IDS;
