/**
 * Tests for test fixtures
 *
 * Verifies that all fixtures meet their structural requirements
 * and contain valid data.
 */

import { describe, it, expect } from 'vitest';
import {
  FIXTURE_SMALL_KB,
  FIXTURE_DEEP_TREE,
  FIXTURE_PAGERANK_GRAPH,
  SMALL_KB_PAGE_IDS,
  SMALL_KB_BLOCK_IDS,
  PAGERANK_PAGE_IDS,
} from '../src/fixtures.js';

// ULID validation regex: 26 characters, Crockford base32
const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

describe('FIXTURE_SMALL_KB', () => {
  describe('structure requirements', () => {
    it('has exactly 5 pages', () => {
      expect(FIXTURE_SMALL_KB.pages).toHaveLength(5);
    });

    it('has exactly 20 blocks', () => {
      expect(FIXTURE_SMALL_KB.blocks).toHaveLength(20);
    });

    it('has exactly 8 links', () => {
      expect(FIXTURE_SMALL_KB.links).toHaveLength(8);
    });

    it('has exactly 3 block refs', () => {
      expect(FIXTURE_SMALL_KB.refs).toHaveLength(3);
    });

    it('has exactly 10 tags', () => {
      expect(FIXTURE_SMALL_KB.tags).toHaveLength(10);
    });
  });

  describe('page validation', () => {
    it('all pages have valid ULID pageIds', () => {
      for (const page of FIXTURE_SMALL_KB.pages) {
        expect(page.pageId).toMatch(ULID_REGEX);
      }
    });

    it('all pages have non-empty titles', () => {
      for (const page of FIXTURE_SMALL_KB.pages) {
        expect(page.title.length).toBeGreaterThan(0);
      }
    });

    it('all pages have consistent timestamps (createdAt <= updatedAt)', () => {
      for (const page of FIXTURE_SMALL_KB.pages) {
        expect(page.createdAt).toBeLessThanOrEqual(page.updatedAt);
      }
    });

    it('all pages have isDeleted set to false', () => {
      for (const page of FIXTURE_SMALL_KB.pages) {
        expect(page.isDeleted).toBe(false);
      }
    });

    it('pages have varied titles', () => {
      const titles = FIXTURE_SMALL_KB.pages.map((p) => p.title);
      const uniqueTitles = new Set(titles);
      expect(uniqueTitles.size).toBe(5);
    });

    it('includes at least one daily note', () => {
      const dailyNotes = FIXTURE_SMALL_KB.pages.filter(
        (p) => p.dailyNoteDate !== null
      );
      expect(dailyNotes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('block validation', () => {
    it('all blocks have valid ULID blockIds', () => {
      for (const block of FIXTURE_SMALL_KB.blocks) {
        expect(block.blockId).toMatch(ULID_REGEX);
      }
    });

    it('all blocks have valid ULID pageIds', () => {
      for (const block of FIXTURE_SMALL_KB.blocks) {
        expect(block.pageId).toMatch(ULID_REGEX);
      }
    });

    it('all blocks reference existing pages', () => {
      const pageIds = new Set(FIXTURE_SMALL_KB.pages.map((p) => p.pageId));
      for (const block of FIXTURE_SMALL_KB.blocks) {
        expect(pageIds.has(block.pageId)).toBe(true);
      }
    });

    it('all blocks with parentId reference existing blocks', () => {
      const blockIds = new Set(FIXTURE_SMALL_KB.blocks.map((b) => b.blockId));
      for (const block of FIXTURE_SMALL_KB.blocks) {
        if (block.parentId !== null) {
          expect(blockIds.has(block.parentId)).toBe(true);
        }
      }
    });

    it('all blocks have consistent timestamps (createdAt <= updatedAt)', () => {
      for (const block of FIXTURE_SMALL_KB.blocks) {
        expect(block.createdAt).toBeLessThanOrEqual(block.updatedAt);
      }
    });

    it('blocks are distributed across all pages', () => {
      const blocksPerPage = new Map<string, number>();
      for (const block of FIXTURE_SMALL_KB.blocks) {
        blocksPerPage.set(
          block.pageId,
          (blocksPerPage.get(block.pageId) || 0) + 1
        );
      }
      // Each page should have at least one block
      for (const page of FIXTURE_SMALL_KB.pages) {
        expect(blocksPerPage.get(page.pageId)).toBeGreaterThan(0);
      }
    });

    it('has parent-child nesting (some blocks have parentId)', () => {
      const blocksWithParent = FIXTURE_SMALL_KB.blocks.filter(
        (b) => b.parentId !== null
      );
      expect(blocksWithParent.length).toBeGreaterThan(0);
    });

    it('has root blocks (some blocks have null parentId)', () => {
      const rootBlocks = FIXTURE_SMALL_KB.blocks.filter(
        (b) => b.parentId === null
      );
      expect(rootBlocks.length).toBeGreaterThan(0);
    });

    it('has valid content types', () => {
      const validTypes = ['text', 'heading', 'code', 'todo', 'query'];
      for (const block of FIXTURE_SMALL_KB.blocks) {
        expect(validTypes).toContain(block.contentType);
      }
    });
  });

  describe('link validation', () => {
    it('all links have valid ULID sourceIds', () => {
      for (const link of FIXTURE_SMALL_KB.links) {
        expect(link.sourceId).toMatch(ULID_REGEX);
      }
    });

    it('all links have valid ULID targetIds', () => {
      for (const link of FIXTURE_SMALL_KB.links) {
        expect(link.targetId).toMatch(ULID_REGEX);
      }
    });

    it('all links reference existing pages', () => {
      const pageIds = new Set(FIXTURE_SMALL_KB.pages.map((p) => p.pageId));
      for (const link of FIXTURE_SMALL_KB.links) {
        expect(pageIds.has(link.sourceId)).toBe(true);
        expect(pageIds.has(link.targetId)).toBe(true);
      }
    });

    it('all links have valid link types', () => {
      const validTypes = ['reference', 'embed', 'tag'];
      for (const link of FIXTURE_SMALL_KB.links) {
        expect(validTypes).toContain(link.linkType);
      }
    });

    it('contextBlockId references existing blocks when not null', () => {
      const blockIds = new Set(FIXTURE_SMALL_KB.blocks.map((b) => b.blockId));
      for (const link of FIXTURE_SMALL_KB.links) {
        if (link.contextBlockId !== null) {
          expect(blockIds.has(link.contextBlockId)).toBe(true);
        }
      }
    });
  });

  describe('block ref validation', () => {
    it('all refs have valid ULID sourceBlockIds', () => {
      for (const ref of FIXTURE_SMALL_KB.refs) {
        expect(ref.sourceBlockId).toMatch(ULID_REGEX);
      }
    });

    it('all refs have valid ULID targetBlockIds', () => {
      for (const ref of FIXTURE_SMALL_KB.refs) {
        expect(ref.targetBlockId).toMatch(ULID_REGEX);
      }
    });

    it('all refs reference existing blocks', () => {
      const blockIds = new Set(FIXTURE_SMALL_KB.blocks.map((b) => b.blockId));
      for (const ref of FIXTURE_SMALL_KB.refs) {
        expect(blockIds.has(ref.sourceBlockId)).toBe(true);
        expect(blockIds.has(ref.targetBlockId)).toBe(true);
      }
    });
  });

  describe('tag validation', () => {
    it('all tags have valid entityIds (ULID format)', () => {
      for (const tag of FIXTURE_SMALL_KB.tags) {
        expect(tag.entityId).toMatch(ULID_REGEX);
      }
    });

    it('all tags have non-empty tag strings', () => {
      for (const tag of FIXTURE_SMALL_KB.tags) {
        expect(tag.tag.length).toBeGreaterThan(0);
      }
    });

    it('tags are spread across pages and blocks', () => {
      const pageIds = new Set(FIXTURE_SMALL_KB.pages.map((p) => p.pageId));
      const blockIds = new Set(FIXTURE_SMALL_KB.blocks.map((b) => b.blockId));

      const pageTags = FIXTURE_SMALL_KB.tags.filter((t) =>
        pageIds.has(t.entityId)
      );
      const blockTags = FIXTURE_SMALL_KB.tags.filter((t) =>
        blockIds.has(t.entityId)
      );

      expect(pageTags.length).toBeGreaterThan(0);
      expect(blockTags.length).toBeGreaterThan(0);
    });
  });
});

describe('FIXTURE_DEEP_TREE', () => {
  describe('structure requirements', () => {
    it('has exactly 1 page', () => {
      expect(FIXTURE_DEEP_TREE.page).toBeDefined();
      expect(FIXTURE_DEEP_TREE.page.pageId).toMatch(ULID_REGEX);
    });

    it('has 5-level nesting (levels 0-4)', () => {
      const blocksByLevel = new Map<number, number>();

      // Parse level from block content
      for (const block of FIXTURE_DEEP_TREE.blocks) {
        const match = block.content.match(/Level (\d+)/);
        if (match) {
          const level = parseInt(match[1], 10);
          blocksByLevel.set(level, (blocksByLevel.get(level) || 0) + 1);
        }
      }

      // Should have levels 0, 1, 2, 3, 4
      expect(blocksByLevel.has(0)).toBe(true);
      expect(blocksByLevel.has(1)).toBe(true);
      expect(blocksByLevel.has(2)).toBe(true);
      expect(blocksByLevel.has(3)).toBe(true);
      expect(blocksByLevel.has(4)).toBe(true);
    });

    it('has 3 children per level (branching factor 3)', () => {
      // Count children for each block
      const childCounts = new Map<string | null, number>();

      for (const block of FIXTURE_DEEP_TREE.blocks) {
        childCounts.set(
          block.parentId,
          (childCounts.get(block.parentId) || 0) + 1
        );
      }

      // Root level should have 3 children (null parent)
      expect(childCounts.get(null)).toBe(3);

      // All non-leaf blocks should have exactly 3 children
      for (const block of FIXTURE_DEEP_TREE.blocks) {
        if (!block.content.includes('Level 4')) {
          // Not a leaf
          expect(childCounts.get(block.blockId)).toBe(3);
        }
      }
    });

    it('has correct total block count (3 + 9 + 27 + 81 + 243 = 363)', () => {
      // 3^1 + 3^2 + 3^3 + 3^4 + 3^5 = 3 + 9 + 27 + 81 + 243 = 363
      expect(FIXTURE_DEEP_TREE.blocks).toHaveLength(363);
    });
  });

  describe('block validation', () => {
    it('all blocks have valid ULID blockIds', () => {
      for (const block of FIXTURE_DEEP_TREE.blocks) {
        expect(block.blockId).toMatch(ULID_REGEX);
      }
    });

    it('all blocks reference the single page', () => {
      for (const block of FIXTURE_DEEP_TREE.blocks) {
        expect(block.pageId).toBe(FIXTURE_DEEP_TREE.page.pageId);
      }
    });

    it('all blocks with parentId reference existing blocks', () => {
      const blockIds = new Set(FIXTURE_DEEP_TREE.blocks.map((b) => b.blockId));
      for (const block of FIXTURE_DEEP_TREE.blocks) {
        if (block.parentId !== null) {
          expect(blockIds.has(block.parentId)).toBe(true);
        }
      }
    });

    it('all blocks have consistent timestamps (createdAt <= updatedAt)', () => {
      for (const block of FIXTURE_DEEP_TREE.blocks) {
        expect(block.createdAt).toBeLessThanOrEqual(block.updatedAt);
      }
    });

    it('no circular references exist', () => {
      const blockMap = new Map<string, string | null>();
      for (const block of FIXTURE_DEEP_TREE.blocks) {
        blockMap.set(block.blockId, block.parentId);
      }

      // Check each block's ancestor chain for cycles
      for (const block of FIXTURE_DEEP_TREE.blocks) {
        const visited = new Set<string>();
        let current: string | null = block.blockId;

        while (current !== null) {
          expect(visited.has(current)).toBe(false); // No cycle
          visited.add(current);
          current = blockMap.get(current) ?? null;
        }
      }
    });
  });

  describe('page validation', () => {
    it('page has valid ULID pageId', () => {
      expect(FIXTURE_DEEP_TREE.page.pageId).toMatch(ULID_REGEX);
    });

    it('page has consistent timestamps (createdAt <= updatedAt)', () => {
      expect(FIXTURE_DEEP_TREE.page.createdAt).toBeLessThanOrEqual(
        FIXTURE_DEEP_TREE.page.updatedAt
      );
    });
  });
});

describe('FIXTURE_PAGERANK_GRAPH', () => {
  describe('structure requirements', () => {
    it('has 4 pages', () => {
      expect(FIXTURE_PAGERANK_GRAPH.pages).toHaveLength(4);
    });

    it('has 5 links', () => {
      expect(FIXTURE_PAGERANK_GRAPH.links).toHaveLength(5);
    });

    it('has expected ranks for all pages', () => {
      const pageIds = FIXTURE_PAGERANK_GRAPH.pages.map((p) => p.pageId);
      for (const pageId of pageIds) {
        expect(FIXTURE_PAGERANK_GRAPH.expectedRanks[pageId]).toBeDefined();
      }
    });
  });

  describe('page validation', () => {
    it('all pages have valid ULID pageIds', () => {
      for (const page of FIXTURE_PAGERANK_GRAPH.pages) {
        expect(page.pageId).toMatch(ULID_REGEX);
      }
    });

    it('all pages have consistent timestamps', () => {
      for (const page of FIXTURE_PAGERANK_GRAPH.pages) {
        expect(page.createdAt).toBeLessThanOrEqual(page.updatedAt);
      }
    });
  });

  describe('link validation', () => {
    it('all links reference existing pages', () => {
      const pageIds = new Set(FIXTURE_PAGERANK_GRAPH.pages.map((p) => p.pageId));
      for (const link of FIXTURE_PAGERANK_GRAPH.links) {
        expect(pageIds.has(link.sourceId)).toBe(true);
        expect(pageIds.has(link.targetId)).toBe(true);
      }
    });
  });

  describe('graph properties', () => {
    it('expected ranks sum to approximately 1', () => {
      const rankSum = Object.values(FIXTURE_PAGERANK_GRAPH.expectedRanks).reduce(
        (a, b) => a + b,
        0
      );
      expect(rankSum).toBeCloseTo(1.0, 1);
    });

    it('page C has highest rank (most incoming links)', () => {
      const ranks = FIXTURE_PAGERANK_GRAPH.expectedRanks;
      const maxRank = Math.max(...Object.values(ranks));
      expect(ranks[PAGERANK_PAGE_IDS.c]).toBe(maxRank);
    });
  });
});

describe('exported ID constants', () => {
  it('SMALL_KB_PAGE_IDS contains all page IDs', () => {
    const exportedIds = Object.values(SMALL_KB_PAGE_IDS);
    const fixtureIds = FIXTURE_SMALL_KB.pages.map((p) => p.pageId);
    expect(new Set(exportedIds)).toEqual(new Set(fixtureIds));
  });

  it('SMALL_KB_BLOCK_IDS contains all block IDs', () => {
    const exportedIds = Object.values(SMALL_KB_BLOCK_IDS);
    const fixtureIds = FIXTURE_SMALL_KB.blocks.map((b) => b.blockId);
    expect(new Set(exportedIds)).toEqual(new Set(fixtureIds));
  });

  it('PAGERANK_PAGE_IDS contains all PageRank page IDs', () => {
    const exportedIds = Object.values(PAGERANK_PAGE_IDS);
    const fixtureIds = FIXTURE_PAGERANK_GRAPH.pages.map((p) => p.pageId);
    expect(new Set(exportedIds)).toEqual(new Set(fixtureIds));
  });
});
