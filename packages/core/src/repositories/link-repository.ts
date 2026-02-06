/**
 * LinkRepository - Encapsulates all Datalog queries for Link and BlockRef entities.
 *
 * Each method constructs parameterized Datalog queries that are executed
 * against CozoDB. User data never enters the query string directly;
 * all values are passed as parameters.
 *
 * Key patterns:
 * - Backlink queries leverage reverse indexes (links:by_target, block_refs:by_target)
 * - removeLinksFromBlock cleans up both links and block_refs
 * - All queries use parameterized variables
 */

import type { GraphDB, Link, BlockRef, PageId, BlockId } from '@double-bind/types';
import { parseLinkRow, parseBlockRefRow } from './link-repository.schemas.js';

/**
 * Input type for creating a link (createdAt is auto-generated).
 */
export interface CreateLinkInput {
  sourceId: PageId;
  targetId: PageId;
  linkType: 'reference' | 'embed' | 'tag';
  contextBlockId: BlockId | null;
}

/**
 * Input type for creating a block reference (createdAt is auto-generated).
 */
export interface CreateBlockRefInput {
  sourceBlockId: BlockId;
  targetBlockId: BlockId;
}

/**
 * Extended link result with target page title for UI display.
 */
export interface LinkWithTargetTitle extends Link {
  targetTitle: string;
}

/**
 * Extended link result with source context for backlink display.
 */
export interface InLink extends Link {
  contextContent: string;
}

/**
 * Extended block ref result with source context for backlink display.
 */
export interface BlockBacklink extends BlockRef {
  content: string;
  pageId: PageId;
}

/**
 * Repository for Link and BlockRef entity operations.
 * All methods use parameterized Datalog queries for security.
 */
export class LinkRepository {
  constructor(private readonly db: GraphDB) {}

  /**
   * Get outgoing links from a page, joined with target page titles.
   *
   * @param pageId - The source page identifier
   * @returns Array of links with target page titles
   */
  async getOutLinks(pageId: PageId): Promise<LinkWithTargetTitle[]> {
    const script = `
?[source_id, target_id, link_type, created_at, context_block_id, title] :=
    *links{ source_id: $page_id, target_id, link_type, created_at, context_block_id },
    *pages{ page_id: target_id, title, is_deleted: false }
`.trim();

    const result = await this.db.query(script, { page_id: pageId });

    return result.rows.map((row) => {
      const [sourceId, targetId, linkType, createdAt, contextBlockId, targetTitle] = row as [
        string,
        string,
        string,
        number,
        string | null,
        string,
      ];

      // Parse the link portion using schema validation
      const link = parseLinkRow([sourceId, targetId, linkType, createdAt, contextBlockId]);

      return {
        ...link,
        targetTitle,
      };
    });
  }

  /**
   * Get incoming links (backlinks) to a page.
   * Uses the links:by_target reverse index for performance.
   * Joins with blocks to get the context content.
   *
   * @param pageId - The target page identifier
   * @returns Array of links with context block content
   */
  async getInLinks(pageId: PageId): Promise<InLink[]> {
    const script = `
?[source_id, target_id, link_type, created_at, context_block_id, content] :=
    *links{ target_id: $page_id, source_id, link_type, created_at, context_block_id },
    *blocks{ block_id: context_block_id, content, is_deleted: false }
`.trim();

    const result = await this.db.query(script, { page_id: pageId });

    return result.rows.map((row) => {
      const [sourceId, targetId, linkType, createdAt, contextBlockId, content] = row as [
        string,
        string,
        string,
        number,
        string | null,
        string,
      ];

      // Parse the link portion using schema validation
      const link = parseLinkRow([sourceId, targetId, linkType, createdAt, contextBlockId]);

      return {
        ...link,
        contextContent: content,
      };
    });
  }

  /**
   * Get backlinks to a specific block.
   * Uses the block_refs:by_target reverse index for performance.
   * Joins with blocks to get the source block content and page.
   *
   * @param blockId - The target block identifier
   * @returns Array of block references with source context
   */
  async getBlockBacklinks(blockId: BlockId): Promise<BlockBacklink[]> {
    const script = `
?[source_block_id, target_block_id, created_at, content, page_id] :=
    *block_refs{ target_block_id: $target, source_block_id, created_at },
    *blocks{ block_id: source_block_id, content, page_id, is_deleted: false }
`.trim();

    const result = await this.db.query(script, { target: blockId });

    return result.rows.map((row) => {
      const [sourceBlockId, targetBlockId, createdAt, content, pageId] = row as [
        string,
        string,
        number,
        string,
        string,
      ];

      // Parse the block ref portion using schema validation
      const blockRef = parseBlockRefRow([sourceBlockId, targetBlockId, createdAt]);

      return {
        ...blockRef,
        content,
        pageId,
      };
    });
  }

  /**
   * Create a new page-to-page link.
   * Auto-generates the created_at timestamp.
   *
   * @param input - Link creation input (without createdAt)
   */
  async createLink(input: CreateLinkInput): Promise<void> {
    const now = Date.now();

    const script = `
?[source_id, target_id, link_type, created_at, context_block_id] <- [
    [$source_id, $target_id, $link_type, $now, $context_block_id]
]
:put links { source_id, target_id, link_type, created_at, context_block_id }
`.trim();

    await this.db.mutate(script, {
      source_id: input.sourceId,
      target_id: input.targetId,
      link_type: input.linkType,
      now,
      context_block_id: input.contextBlockId,
    });
  }

  /**
   * Create a new block-to-block reference.
   * Auto-generates the created_at timestamp.
   *
   * @param input - Block reference creation input (without createdAt)
   */
  async createBlockRef(input: CreateBlockRefInput): Promise<void> {
    const now = Date.now();

    const script = `
?[source_block_id, target_block_id, created_at] <- [
    [$source_block_id, $target_block_id, $now]
]
:put block_refs { source_block_id, target_block_id, created_at }
`.trim();

    await this.db.mutate(script, {
      source_block_id: input.sourceBlockId,
      target_block_id: input.targetBlockId,
      now,
    });
  }

  /**
   * Remove all links and block refs originating from a specific block.
   * Called when block content is updated to clear old references
   * before creating new ones.
   *
   * This removes:
   * 1. Links where context_block_id matches (page links from this block)
   * 2. Block refs where source_block_id matches (block refs from this block)
   *
   * @param blockId - The block whose references should be removed
   */
  async removeLinksFromBlock(blockId: BlockId): Promise<void> {
    // Remove links where this block is the context
    const removeLinksScript = `
?[source_id, target_id, link_type] :=
    *links{ source_id, target_id, link_type, context_block_id: $block_id }
:rm links { source_id, target_id, link_type }
`.trim();

    // Remove block refs where this block is the source
    const removeBlockRefsScript = `
?[source_block_id, target_block_id] :=
    *block_refs{ source_block_id: $block_id, target_block_id }
:rm block_refs { source_block_id, target_block_id }
`.trim();

    // Execute both removals
    await this.db.mutate(removeLinksScript, { block_id: blockId });
    await this.db.mutate(removeBlockRefsScript, { block_id: blockId });
  }
}
