/**
 * BlockRepository - Encapsulates all SQL queries for Block entities.
 *
 * Each method constructs parameterized SQL queries that are executed
 * against SQLite. User data never enters the query string directly;
 * all values are passed as named parameters.
 *
 * Key patterns:
 * - Root-level blocks have parent_id = NULL (no sentinel values)
 * - SQLite indexes handle page/parent lookups (no manual index maintenance)
 * - Booleans stored as 0/1 integers; Zod schemas handle conversion
 * - The "order" column is a reserved word and must always be quoted
 *
 * Backward compatibility:
 * - computeParentKey() is preserved for callers that use the old sentinel pattern
 * - getChildren() and rebalanceSiblings() accept both sentinel strings and null/pageId
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

/** Sentinel prefix used by the old CozoDB implementation for root blocks */
const PAGE_SENTINEL_PREFIX = '__page:';

/**
 * Search result type that includes relevance score.
 */
export interface BlockSearchResult extends Block {
  score: number;
}

/**
 * Computes the parent key for backward compatibility with block-service.ts.
 *
 * In the CozoDB implementation, root-level blocks used "__page:<pageId>" sentinel
 * in the blocks_by_parent index. In SQLite, root blocks have parent_id = NULL.
 * This function is preserved so callers (e.g., BlockService) continue to work.
 *
 * @param parentId - The block's parent ID (null for root)
 * @param pageId - The block's page ID
 * @returns The key for parent lookups (block_id or "__page:<page_id>" sentinel)
 */
export function computeParentKey(parentId: BlockId | null, pageId: PageId): string {
  return parentId ?? `${PAGE_SENTINEL_PREFIX}${pageId}`;
}

/**
 * Repository for Block entity operations.
 * All methods use parameterized SQL queries for security.
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
SELECT block_id, page_id, parent_id, content, content_type, "order",
       is_collapsed, is_deleted, created_at, updated_at
FROM blocks
WHERE block_id = $id AND is_deleted = 0
`.trim();

    const result = await this.db.query(script, { id: blockId });

    if (result.rows.length === 0) {
      return null;
    }

    return parseBlockRow(result.rows[0] as unknown[]);
  }

  /**
   * Get all blocks for a page, ordered by their position.
   *
   * @param pageId - The page identifier
   * @returns Array of blocks sorted by order
   */
  async getByPage(pageId: PageId): Promise<Block[]> {
    const script = `
SELECT block_id, page_id, parent_id, content, content_type, "order",
       is_collapsed, is_deleted, created_at, updated_at
FROM blocks
WHERE page_id = $page_id AND is_deleted = 0
ORDER BY "order"
`.trim();

    const result = await this.db.query(script, { page_id: pageId });

    return result.rows.map((row) => parseBlockRow(row as unknown[]));
  }

  /**
   * Get children of a parent block, ordered by position.
   *
   * Accepts either:
   * - A direct parent block ID (returns children of that block)
   * - A "__page:<pageId>" sentinel (returns root-level blocks for that page)
   * - null with a pageId parameter (returns root-level blocks for that page)
   *
   * @param parentKey - Parent block ID, "__page:<pageId>" sentinel, or null for root blocks
   * @param pageId - Page ID (used when parentKey is null)
   * @returns Array of child blocks sorted by order
   */
  async getChildren(parentKey: string | null, pageId?: PageId): Promise<Block[]> {
    let script: string;
    let params: Record<string, unknown>;

    // Determine if this is a root-level query
    if (parentKey === null || parentKey === undefined) {
      // Direct null: root-level blocks for the given page
      script = `
SELECT block_id, page_id, parent_id, content, content_type, "order",
       is_collapsed, is_deleted, created_at, updated_at
FROM blocks
WHERE parent_id IS NULL AND page_id = $page_id AND is_deleted = 0
ORDER BY "order"
`.trim();
      params = { page_id: pageId };
    } else if (parentKey.startsWith(PAGE_SENTINEL_PREFIX)) {
      // Legacy sentinel format: "__page:<pageId>"
      const extractedPageId = parentKey.slice(PAGE_SENTINEL_PREFIX.length);
      script = `
SELECT block_id, page_id, parent_id, content, content_type, "order",
       is_collapsed, is_deleted, created_at, updated_at
FROM blocks
WHERE parent_id IS NULL AND page_id = $page_id AND is_deleted = 0
ORDER BY "order"
`.trim();
      params = { page_id: extractedPageId };
    } else {
      // Regular parent block ID
      script = `
SELECT block_id, page_id, parent_id, content, content_type, "order",
       is_collapsed, is_deleted, created_at, updated_at
FROM blocks
WHERE parent_id = $parent_id AND is_deleted = 0
ORDER BY "order"
`.trim();
      params = { parent_id: parentKey };
    }

    const result = await this.db.query(script, params);

    return result.rows.map((row) => parseBlockRow(row as unknown[]));
  }

  /**
   * Create a new block.
   *
   * In SQLite, a single INSERT handles everything. No manual index
   * maintenance is needed (SQLite indexes are automatic).
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

    const script = `
INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order",
                    is_collapsed, is_deleted, created_at, updated_at)
VALUES ($id, $page_id, $parent_id, $content, $content_type, $order,
        0, 0, $now, $now)
`.trim();

    await this.db.mutate(script, {
      id: blockId,
      page_id: input.pageId,
      parent_id: parentId,
      content: input.content,
      content_type: contentType,
      order,
      now,
    });

    return blockId;
  }

  /**
   * Update an existing block.
   *
   * This is a read-modify-write operation: it reads the current state,
   * applies the updates, and writes back the changed fields.
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
UPDATE blocks
SET content = $content,
    parent_id = $parent_id,
    "order" = $order,
    is_collapsed = $is_collapsed,
    updated_at = $now
WHERE block_id = $id
`.trim();

    await this.db.mutate(script, {
      id: blockId,
      content: newContent,
      parent_id: newParentId,
      order: newOrder,
      is_collapsed: newIsCollapsed,
      now,
    });
  }

  /**
   * Soft-delete a block by setting is_deleted = 1.
   *
   * @param blockId - The block to delete
   * @throws DoubleBindError if block not found
   */
  async softDelete(blockId: BlockId): Promise<void> {
    // First, read the existing block to verify it exists
    const existing = await this.getById(blockId);
    if (!existing) {
      throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
    }

    const now = Date.now();

    const script = `
UPDATE blocks
SET is_deleted = 1, updated_at = $now
WHERE block_id = $id
`.trim();

    await this.db.mutate(script, {
      id: blockId,
      now,
    });
  }

  /**
   * Move a block to a new parent and/or position.
   *
   * In SQLite, this is a simple UPDATE. No index maintenance needed.
   *
   * @param blockId - The block to move
   * @param newParentId - New parent block ID (null for root)
   * @param newOrder - New order string for positioning
   * @throws DoubleBindError if block not found
   */
  async move(blockId: BlockId, newParentId: BlockId | null, newOrder: string): Promise<void> {
    // First, read the existing block to verify it exists
    const existing = await this.getById(blockId);
    if (!existing) {
      throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
    }

    const now = Date.now();

    const script = `
UPDATE blocks
SET parent_id = $new_parent_id,
    "order" = $new_order,
    updated_at = $now
WHERE block_id = $id
`.trim();

    await this.db.mutate(script, {
      id: blockId,
      new_parent_id: newParentId,
      new_order: newOrder,
      now,
    });
  }

  /**
   * Full-text search on block content.
   *
   * Uses FTS5 for full-text search. The blocks_fts table is kept in sync
   * via triggers defined in the schema migration.
   *
   * @param query - The search query string
   * @param limit - Maximum number of results (default 50)
   * @returns Array of blocks matching the search, sorted by relevance score
   */
  async search(query: string, limit = 50): Promise<Block[]> {
    const script = `
SELECT b.block_id, b.page_id, b.parent_id, b.content, b.content_type, b."order",
       b.is_collapsed, b.is_deleted, b.created_at, b.updated_at
FROM blocks_fts fts
JOIN blocks b ON b.block_id = fts.block_id
WHERE blocks_fts MATCH $query
  AND b.is_deleted = 0
ORDER BY rank
LIMIT $limit
`.trim();

    const result = await this.db.query(script, { query, limit });

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
SELECT block_id, version, content, parent_id, "order",
       is_collapsed, is_deleted, operation, timestamp
FROM block_history
WHERE block_id = $id
ORDER BY version DESC
LIMIT $limit
`.trim();

    const result = await this.db.query(script, { id: blockId, limit });

    return result.rows.map((row) => parseBlockVersionRow(row as unknown[]));
  }

  /**
   * Rebalance the order keys for all siblings under a parent.
   *
   * This method regenerates evenly-spaced order keys for all children
   * of the specified parent in a single batch update. Used when
   * pathological insertion patterns cause keys to grow too long.
   *
   * Accepts either:
   * - A direct parent block ID
   * - A "__page:<pageId>" sentinel (for root-level blocks)
   * - null with a pageId parameter
   *
   * @param parentKey - Parent block ID, sentinel, or null for root blocks
   * @param newOrders - Map of block_id to new order key (must include all siblings)
   * @param pageId - Page ID (used when parentKey is null)
   * @throws DoubleBindError if the update fails
   */
  async rebalanceSiblings(
    _parentKey: string | null,
    newOrders: Map<BlockId, string>,
    _pageId?: PageId
  ): Promise<void> {
    if (newOrders.size === 0) {
      return;
    }

    const now = Date.now();

    // Update each block's order individually
    for (const [blockId, newOrder] of newOrders) {
      const script = `
UPDATE blocks
SET "order" = $new_order, updated_at = $now
WHERE block_id = $block_id
`.trim();

      await this.db.mutate(script, {
        block_id: blockId,
        new_order: newOrder,
        now,
      });
    }
  }
}
