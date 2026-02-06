/**
 * Test factories for creating domain objects with sensible defaults.
 *
 * Factory functions enable concise test setup by providing valid default values
 * that can be selectively overridden. Use `createXxxWithId` variants when you
 * need auto-generated ULIDs, or the base `createXxx` functions with placeholder
 * IDs for tests where specific ID values don't matter.
 */

import { ulid } from 'ulid';
import type { Page, Block, Link, BlockRef, Tag, Property } from '@double-bind/types';

// ============================================================================
// Primitive Factories
// ============================================================================

/**
 * Creates a Page with sensible defaults.
 * Uses placeholder ID - call createPageWithId() for auto-generated ULID.
 */
export function createPage(overrides?: Partial<Page>): Page {
  const now = Date.now();
  return {
    pageId: 'page-placeholder',
    title: 'Test Page',
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
    dailyNoteDate: null,
    ...overrides,
  };
}

/**
 * Creates a Block with sensible defaults.
 * Uses placeholder IDs - call createBlockWithId() for auto-generated ULID.
 */
export function createBlock(overrides?: Partial<Block>): Block {
  const now = Date.now();
  return {
    blockId: 'block-placeholder',
    pageId: 'page-placeholder',
    parentId: null,
    content: '',
    contentType: 'text',
    order: 'a0',
    isCollapsed: false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Creates a Link with sensible defaults.
 */
export function createLink(overrides?: Partial<Link>): Link {
  const now = Date.now();
  return {
    sourceId: 'page-source-placeholder',
    targetId: 'page-target-placeholder',
    linkType: 'reference',
    createdAt: now,
    contextBlockId: null,
    ...overrides,
  };
}

/**
 * Creates a BlockRef with sensible defaults.
 */
export function createBlockRef(overrides?: Partial<BlockRef>): BlockRef {
  const now = Date.now();
  return {
    sourceBlockId: 'block-source-placeholder',
    targetBlockId: 'block-target-placeholder',
    createdAt: now,
    ...overrides,
  };
}

/**
 * Creates a Tag with sensible defaults.
 */
export function createTag(overrides?: Partial<Tag>): Tag {
  const now = Date.now();
  return {
    entityId: 'entity-placeholder',
    tag: 'test-tag',
    createdAt: now,
    ...overrides,
  };
}

/**
 * Creates a Property with sensible defaults.
 */
export function createProperty(overrides?: Partial<Property>): Property {
  const now = Date.now();
  return {
    entityId: 'entity-placeholder',
    key: 'test-key',
    value: 'test-value',
    valueType: 'string',
    updatedAt: now,
    ...overrides,
  };
}

// ============================================================================
// Auto-ID Factories
// ============================================================================

/**
 * Creates a Page with an auto-generated ULID.
 */
export function createPageWithId(overrides?: Partial<Page>): Page {
  return createPage({
    pageId: ulid(),
    ...overrides,
  });
}

/**
 * Creates a Block with auto-generated ULIDs for blockId.
 * Note: pageId still defaults to placeholder unless overridden.
 */
export function createBlockWithId(overrides?: Partial<Block>): Block {
  return createBlock({
    blockId: ulid(),
    ...overrides,
  });
}

// ============================================================================
// Composite Factories
// ============================================================================

/**
 * Creates a page with the specified number of blocks.
 * All blocks are root-level (parentId = null) and properly linked to the page.
 *
 * @param blockCount - Number of blocks to create
 * @returns Object with page and array of blocks
 */
export function createPageWithBlocks(blockCount: number): { page: Page; blocks: Block[] } {
  const page = createPageWithId();
  const now = Date.now();

  const blocks: Block[] = [];
  for (let i = 0; i < blockCount; i++) {
    blocks.push(
      createBlockWithId({
        pageId: page.pageId,
        content: `Block ${i + 1} content`,
        order: generateFractionalIndex(i),
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  return { page, blocks };
}

/**
 * Creates multiple pages with inter-page links at the specified density.
 *
 * Link density is a value between 0 and 1 representing the probability
 * that any two pages are linked. A density of 0.5 means roughly half of
 * all possible page pairs will have a link.
 *
 * @param pageCount - Number of pages to create
 * @param linkDensity - Probability of link between any two pages (0-1)
 * @returns Object with pages and links arrays
 */
export function createLinkedPages(
  pageCount: number,
  linkDensity: number
): { pages: Page[]; links: Link[] } {
  if (linkDensity < 0 || linkDensity > 1) {
    throw new Error('linkDensity must be between 0 and 1');
  }

  const pages: Page[] = [];
  const links: Link[] = [];
  const now = Date.now();

  // Create pages
  for (let i = 0; i < pageCount; i++) {
    pages.push(
      createPageWithId({
        title: `Page ${i + 1}`,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  // Create links based on density
  // Use deterministic pseudo-random based on page indices for reproducibility
  for (let i = 0; i < pageCount; i++) {
    for (let j = 0; j < pageCount; j++) {
      if (i === j) continue; // No self-links

      // Deterministic threshold based on indices
      const threshold = deterministicRandom(i, j, pageCount);
      if (threshold < linkDensity) {
        // Pages array bounds are guaranteed by loop indices
        const sourcePage = pages[i]!;
        const targetPage = pages[j]!;
        links.push(
          createLink({
            sourceId: sourcePage.pageId,
            targetId: targetPage.pageId,
            createdAt: now,
          })
        );
      }
    }
  }

  return { pages, links };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates a fractional index string for ordering.
 * Uses a simple scheme: 'a0', 'a1', 'a2', etc.
 * For more sophisticated ordering in production, use fractional-indexing library.
 */
function generateFractionalIndex(position: number): string {
  return `a${position}`;
}

/**
 * Deterministic pseudo-random number generator for reproducible link creation.
 * Returns a value between 0 and 1 based on the input indices.
 */
function deterministicRandom(i: number, j: number, seed: number): number {
  // Simple hash-based pseudo-random
  const hash = ((i * 31 + j) * 17 + seed) % 1000;
  return hash / 1000;
}
