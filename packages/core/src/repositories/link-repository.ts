/**
 * LinkRepository - Encapsulates all SQL queries for Link and BlockRef entities.
 *
 * Each method constructs parameterized SQL queries that are executed
 * against SQLite. User data never enters the query string directly;
 * all values are passed as parameters.
 *
 * Key patterns:
 * - Backlink queries leverage reverse indexes (idx_links_target, idx_block_refs_target)
 * - removeLinksFromBlock cleans up both links and block_refs atomically
 * - All queries use parameterized variables ($name)
 */

import type { Database, Link, BlockRef, PageId, BlockId } from '@double-bind/types';
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
 * All methods use parameterized SQL queries for security.
 */
export class LinkRepository {
  constructor(private readonly db: Database) {}

  /**
   * Get outgoing links from a page, joined with target page titles.
   *
   * @param pageId - The source page identifier
   * @returns Array of links with target page titles
   */
  async getOutLinks(pageId: PageId): Promise<LinkWithTargetTitle[]> {
    const script = `
      SELECT l.source_id, l.target_id, l.link_type, l.created_at, l.context_block_id, p.title
      FROM links l
      JOIN pages p ON l.target_id = p.page_id
      WHERE l.source_id = $page_id
        AND p.is_deleted = 0
    `;

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
   * Uses the idx_links_target index for performance.
   * Joins with blocks to get the context content.
   *
   * @param pageId - The target page identifier
   * @returns Array of links with context block content
   */
  async getInLinks(pageId: PageId): Promise<InLink[]> {
    const script = `
      SELECT l.source_id, l.target_id, l.link_type, l.created_at, l.context_block_id, b.content
      FROM links l
      JOIN blocks b ON l.context_block_id = b.block_id
      WHERE l.target_id = $page_id
        AND b.is_deleted = 0
    `;

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
   * Uses the idx_block_refs_target index for performance.
   * Joins with blocks to get the source block content and page.
   *
   * @param blockId - The target block identifier
   * @returns Array of block references with source context
   */
  async getBlockBacklinks(blockId: BlockId): Promise<BlockBacklink[]> {
    const script = `
      SELECT br.source_block_id, br.target_block_id, br.created_at, b.content, b.page_id
      FROM block_refs br
      JOIN blocks b ON br.source_block_id = b.block_id
      WHERE br.target_block_id = $target
        AND b.is_deleted = 0
    `;

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
      INSERT OR REPLACE INTO links (source_id, target_id, link_type, created_at, context_block_id)
      VALUES ($source_id, $target_id, $link_type, $now, $context_block_id)
    `;

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
      INSERT OR REPLACE INTO block_refs (source_block_id, target_block_id, created_at)
      VALUES ($source_block_id, $target_block_id, $now)
    `;

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
   * Removes:
   * 1. Links where context_block_id matches (page links from this block)
   * 2. Block refs where source_block_id matches (block refs from this block)
   *
   * @param blockId - The block whose references should be removed
   */
  async removeLinksFromBlock(blockId: BlockId): Promise<void> {
    // Delete links where this block is the context
    await this.db.mutate(
      `DELETE FROM links WHERE context_block_id = $block_id`,
      { block_id: blockId }
    );

    // Delete block refs where this block is the source
    await this.db.mutate(
      `DELETE FROM block_refs WHERE source_block_id = $block_id`,
      { block_id: blockId }
    );
  }
}
