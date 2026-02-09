/**
 * BlockRepository - Encapsulates all Datalog queries for Block entities.
 *
 * Each method constructs parameterized Datalog queries that are executed
 * against CozoDB. User data never enters the query string directly;
 * all values are passed as parameters.
 *
 * Key patterns:
 * - Root-level blocks use "__page:<pageId>" sentinel as parent key in blocks_by_parent
 * - Atomic transactions use { } braces to group multiple statements
 * - Index maintenance for blocks_by_page and blocks_by_parent
 */

import { ulid } from 'ulid';
import type {
  GraphDB,
  Block,
  BlockId,
  PageId,
  BlockVersion,
  CreateBlockInput,
  UpdateBlockInput,
} from '@double-bind/types';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import { parseBlockRow, parseBlockVersionRow } from './block-repository.schemas.js';
import { DEFAULT_ORDER } from '../utils/ordering.js';

/**
 * Search result type that includes relevance score.
 */
export interface BlockSearchResult extends Block {
  score: number;
}

/**
 * Computes the parent key for blocks_by_parent index.
 * Root-level blocks (no parent) use "__page:<pageId>" sentinel.
 *
 * @param parentId - The block's parent ID (null for root)
 * @param pageId - The block's page ID
 * @returns The key for blocks_by_parent relation
 */
export function computeParentKey(parentId: BlockId | null, pageId: PageId): string {
  return parentId ?? `__page:${pageId}`;
}

/**
 * Repository for Block entity operations.
 * All methods use parameterized Datalog queries for security.
 */
export class BlockRepository {
  constructor(private readonly db: GraphDB) {}

  /**
   * Get a block by its ID.
   *
   * @param blockId - The block identifier (ULID)
   * @returns The block if found, null otherwise
   */
  async getById(blockId: BlockId): Promise<Block | null> {
    const script = `
?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] :=
    *blocks{ block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at },
    block_id == $id,
    is_deleted == false
`.trim();

    const result = await this.db.query(script, { id: blockId });

    if (result.rows.length === 0) {
      return null;
    }

    return parseBlockRow(result.rows[0] as unknown[]);
  }

  /**
   * Get all blocks for a page, ordered by their position.
   * Joins blocks_by_page index with blocks relation.
   *
   * @param pageId - The page identifier
   * @returns Array of blocks sorted by order
   */
  async getByPage(pageId: PageId): Promise<Block[]> {
    const script = `
?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] :=
    *blocks_by_page{ page_id, block_id },
    page_id == $page_id,
    *blocks{ block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at },
    is_deleted == false
:order order
`.trim();

    const result = await this.db.query(script, { page_id: pageId });

    return result.rows.map((row) => parseBlockRow(row as unknown[]));
  }

  /**
   * Get children of a parent (block or page root).
   * Joins blocks_by_parent index with blocks relation.
   *
   * @param parentKey - Either a block_id or "__page:<page_id>" sentinel for root blocks
   * @returns Array of child blocks sorted by order
   */
  async getChildren(parentKey: string): Promise<Block[]> {
    // NOTE: Use distinct variable names to avoid CozoDB binding conflicts:
    // - `idx_parent` for the blocks_by_parent index key (may be sentinel like __page:X)
    // - `parent_id` for the actual block's parent_id field (may be null for root blocks)
    const script = `
?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] :=
    *blocks_by_parent{ parent_id: idx_parent, block_id },
    idx_parent == $parent_key,
    *blocks{ block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at },
    is_deleted == false
:order order
`.trim();

    const result = await this.db.query(script, { parent_key: parentKey });

    return result.rows.map((row) => parseBlockRow(row as unknown[]));
  }

  /**
   * Create a new block with atomic index maintenance.
   *
   * Inserts into (atomically via CozoDB transaction block):
   * - blocks: the main block data
   * - blocks_by_page: page-to-blocks index
   * - blocks_by_parent: parent-to-children index
   *
   * @param input - Block creation input (pageId, optional parentId, content, etc.)
   * @returns The ID of the newly created block
   */
  async create(input: CreateBlockInput): Promise<BlockId> {
    const blockId = ulid();
    const now = Date.now();
    const parentId = input.parentId ?? null;
    const contentType = input.contentType ?? 'text';
    const order = input.order ?? DEFAULT_ORDER;
    const parentKey = computeParentKey(parentId, input.pageId);

    // Use CozoDB transaction blocks { } for atomic execution.
    // All three operations succeed or fail together - no orphaned blocks.
    const script = `
{
  ?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] <- [
    [$id, $page_id, $parent_id, $content, $content_type, $order, false, false, $now, $now]
  ]
  :put blocks { block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at }
}
{
  ?[page_id, block_id] <- [[$page_id, $id]]
  :put blocks_by_page { page_id, block_id }
}
{
  ?[parent_id, block_id] <- [[$parent_key, $id]]
  :put blocks_by_parent { parent_id, block_id }
}
`.trim();

    await this.db.mutate(script, {
      id: blockId,
      page_id: input.pageId,
      parent_id: parentId,
      content: input.content,
      content_type: contentType,
      order,
      parent_key: parentKey,
      now,
    });

    return blockId;
  }

  /**
   * Update an existing block.
   *
   * This is a read-modify-write operation: it reads the current state,
   * applies the updates, and writes back the full record.
   *
   * @param blockId - The block to update
   * @param input - Partial block data to update
   * @throws DoubleBindError if block not found
   */
  async update(blockId: BlockId, input: UpdateBlockInput): Promise<void> {
    // First, read the existing block
    const existing = await this.getById(blockId);
    if (!existing) {
      throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
    }

    const now = Date.now();
    const newContent = input.content ?? existing.content;
    const newParentId = input.parentId !== undefined ? input.parentId : existing.parentId;
    const newOrder = input.order ?? existing.order;
    const newIsCollapsed = input.isCollapsed ?? existing.isCollapsed;

    const script = `
?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] <- [
    [$id, $page_id, $parent_id, $content, $content_type, $order, $is_collapsed, $is_deleted, $created_at, $now]
]
:put blocks { block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at }
`.trim();

    await this.db.mutate(script, {
      id: blockId,
      page_id: existing.pageId,
      parent_id: newParentId,
      content: newContent,
      content_type: existing.contentType,
      order: newOrder,
      is_collapsed: newIsCollapsed,
      is_deleted: existing.isDeleted,
      created_at: existing.createdAt,
      now,
    });
  }

  /**
   * Soft-delete a block by setting is_deleted = true.
   *
   * @param blockId - The block to delete
   * @throws DoubleBindError if block not found
   */
  async softDelete(blockId: BlockId): Promise<void> {
    // First, read the existing block to get all fields
    const existing = await this.getById(blockId);
    if (!existing) {
      throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
    }

    const now = Date.now();

    const script = `
?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] <- [
    [$id, $page_id, $parent_id, $content, $content_type, $order, $is_collapsed, true, $created_at, $now]
]
:put blocks { block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at }
`.trim();

    await this.db.mutate(script, {
      id: blockId,
      page_id: existing.pageId,
      parent_id: existing.parentId,
      content: existing.content,
      content_type: existing.contentType,
      order: existing.order,
      is_collapsed: existing.isCollapsed,
      created_at: existing.createdAt,
      now,
    });
  }

  /**
   * Move a block to a new parent and/or position.
   *
   * Atomically updates (via CozoDB transaction block):
   * - Block's parent_id and order
   * - blocks_by_parent index (removes from old, adds to new)
   *
   * @param blockId - The block to move
   * @param newParentId - New parent block ID (null for root)
   * @param newOrder - New order string for positioning
   * @throws DoubleBindError if block not found
   */
  async move(blockId: BlockId, newParentId: BlockId | null, newOrder: string): Promise<void> {
    // First, read the existing block to get all fields
    const existing = await this.getById(blockId);
    if (!existing) {
      throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
    }

    const now = Date.now();
    const oldParentKey = computeParentKey(existing.parentId, existing.pageId);
    const newParentKey = computeParentKey(newParentId, existing.pageId);

    // Use CozoDB transaction blocks { } for atomic execution.
    // All three operations succeed or fail together - no orphaned blocks in indexes.
    const script = `
{
  ?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] <- [
    [$id, $page_id, $new_parent_id, $content, $content_type, $new_order, $is_collapsed, $is_deleted, $created_at, $now]
  ]
  :put blocks { block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at }
}
{
  ?[parent_id, block_id] <- [[$old_parent_key, $id]]
  :rm blocks_by_parent { parent_id, block_id }
}
{
  ?[parent_id, block_id] <- [[$new_parent_key, $id]]
  :put blocks_by_parent { parent_id, block_id }
}
`.trim();

    await this.db.mutate(script, {
      id: blockId,
      page_id: existing.pageId,
      new_parent_id: newParentId,
      content: existing.content,
      content_type: existing.contentType,
      new_order: newOrder,
      is_collapsed: existing.isCollapsed,
      is_deleted: existing.isDeleted,
      created_at: existing.createdAt,
      old_parent_key: oldParentKey,
      new_parent_key: newParentKey,
      now,
    });
  }

  /**
   * Full-text search on block content.
   *
   * @param query - The search query string
   * @param limit - Maximum number of results (default 50)
   * @returns Array of blocks matching the search, sorted by relevance score
   */
  async search(query: string, limit = 50): Promise<Block[]> {
    const script = `
?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at, score] :=
    ~blocks:fts{ block_id, content | query: $query, k: $limit, bind_score: score },
    *blocks{ block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at },
    is_deleted == false
:order -score
`.trim();

    const result = await this.db.query(script, { query, limit });

    // Map rows to Blocks (excluding the score column at index 10)
    return result.rows.map((row) => {
      const blockRow = (row as unknown[]).slice(0, 10);
      return parseBlockRow(blockRow);
    });
  }

  /**
   * Get the version history for a block.
   *
   * @param blockId - The block identifier
   * @param limit - Maximum number of versions (default 100)
   * @returns Array of block versions sorted by version descending
   */
  async getHistory(blockId: BlockId, limit = 100): Promise<BlockVersion[]> {
    const script = `
?[block_id, version, content, parent_id, order, is_collapsed, is_deleted, operation, timestamp] :=
    *block_history{ block_id, version, content, parent_id, order, is_collapsed, is_deleted, operation, timestamp },
    block_id == $id
:order -version
:limit $limit
`.trim();

    const result = await this.db.query(script, { id: blockId, limit });

    return result.rows.map((row) => parseBlockVersionRow(row as unknown[]));
  }

  /**
   * Rebalance the order keys for all siblings under a parent.
   *
   * This method regenerates evenly-spaced order keys for all children
   * of the specified parent in a single atomic transaction. Used when
   * pathological insertion patterns cause keys to grow too long.
   *
   * @param parentKey - The parent key (block_id or "__page:<page_id>" sentinel)
   * @param newOrders - Map of block_id to new order key (must include all siblings)
   * @throws DoubleBindError if the update fails
   */
  async rebalanceSiblings(parentKey: string, newOrders: Map<BlockId, string>): Promise<void> {
    if (newOrders.size === 0) {
      return;
    }

    const now = Date.now();

    // First, fetch all blocks we need to update
    const fetchScript = `
?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] :=
    *blocks_by_parent{ parent_id, block_id },
    parent_id == $parent_key,
    *blocks{ block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at },
    is_deleted == false
`.trim();

    const fetchResult = await this.db.query(fetchScript, { parent_key: parentKey });
    const blocks = fetchResult.rows.map((row) => parseBlockRow(row as unknown[]));

    // Build the update rows with new order keys
    const updateRows: string[] = [];
    for (const block of blocks) {
      const newOrder = newOrders.get(block.blockId);
      if (newOrder !== undefined) {
        // Escape string values for Datalog
        const escapedContent = block.content.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        updateRows.push(
          `["${block.blockId}", "${block.pageId}", ${block.parentId === null ? 'null' : `"${block.parentId}"`}, "${escapedContent}", "${block.contentType}", "${newOrder}", ${block.isCollapsed}, ${block.isDeleted}, ${block.createdAt}, ${now}]`
        );
      }
    }

    if (updateRows.length === 0) {
      return;
    }

    // Execute the batch update in a single transaction
    const updateScript = `
?[block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at] <- [
    ${updateRows.join(',\n    ')}
]
:put blocks { block_id, page_id, parent_id, content, content_type, order, is_collapsed, is_deleted, created_at, updated_at }
`.trim();

    await this.db.mutate(updateScript, {});
  }
}
