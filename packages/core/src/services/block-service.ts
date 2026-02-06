/**
 * BlockService - Orchestrates block mutations with content parsing.
 *
 * This is the most complex service. It handles:
 * - CRUD operations on blocks with proper ordering
 * - Content parsing to extract [[links]], ((refs)), #tags, key:: values
 * - Syncing parsed content to appropriate relations (links, block_refs, tags, properties)
 * - Tree operations (indent, outdent) that change parent relationships
 *
 * All errors are wrapped with context before re-throwing to provide
 * better debugging information at higher layers.
 */

import type { Block, BlockId, PageId, Page } from '@double-bind/types';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import type { BlockRepository } from '../repositories/block-repository.js';
import { computeParentKey } from '../repositories/block-repository.js';
import type { LinkRepository } from '../repositories/link-repository.js';
import type { PageRepository } from '../repositories/page-repository.js';
import type { TagRepository } from '../repositories/tag-repository.js';
import type { PropertyRepository } from '../repositories/property-repository.js';
import { parseContent, type ParsedContent } from '../parsers/content-parser.js';
import {
  keyBetween,
  keyForInsertAfter,
  DEFAULT_ORDER,
  needsRebalance,
  rebalanceKeys,
} from '../utils/ordering.js';

/**
 * Backlink result including the referencing block and its page context.
 */
export interface BlockBacklinkResult {
  block: Block;
  page: Page;
}

/**
 * Callback invoked when a rebalance operation occurs.
 * The parentKey identifies which siblings were rebalanced.
 */
export type RebalanceCallback = (parentKey: string) => void;

/**
 * Service for high-level block operations.
 *
 * Orchestrates BlockRepository, LinkRepository, TagRepository, and PropertyRepository
 * to provide atomic block mutations with automatic content parsing.
 */
export class BlockService {
  private onRebalance?: RebalanceCallback;

  constructor(
    private readonly blockRepo: BlockRepository,
    private readonly linkRepo: LinkRepository,
    private readonly pageRepo: PageRepository,
    private readonly tagRepo: TagRepository,
    private readonly propertyRepo: PropertyRepository
  ) {}

  /**
   * Set the callback to be invoked when a rebalance operation occurs.
   * Used by the UI layer to invalidate query caches.
   *
   * @param callback - Function called with the parentKey of rebalanced siblings
   */
  setRebalanceCallback(callback: RebalanceCallback): void {
    this.onRebalance = callback;
  }

  /**
   * Update block content and sync parsed elements.
   *
   * This method:
   * 1. Updates the block's content text
   * 2. Parses the new content for [[links]], ((refs)), #tags, key:: values
   * 3. Removes old links/refs/tags/properties from this block
   * 4. Creates new links/refs/tags/properties based on parsed content
   *
   * @param blockId - The block to update
   * @param content - The new content text
   * @throws DoubleBindError with BLOCK_NOT_FOUND if block doesn't exist
   * @throws DoubleBindError with context on repository failure
   */
  async updateContent(blockId: BlockId, content: string): Promise<void> {
    try {
      // Get existing block to verify it exists and get page context
      const block = await this.blockRepo.getById(blockId);
      if (!block) {
        throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
      }

      // Parse the new content
      const parsed = parseContent(content);

      // Update the block content
      await this.blockRepo.update(blockId, { content });

      // Sync parsed content to relations
      await this.syncParsedContent(blockId, block.pageId, parsed);
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to update content for block "${blockId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_MUTATION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create a new block with parsed content.
   *
   * @param pageId - The page to create the block in
   * @param parentId - Parent block ID (null for root-level block)
   * @param content - Initial block content
   * @param afterBlockId - Optional block ID to insert after (null for first position)
   * @returns The newly created block
   * @throws DoubleBindError with context on repository failure
   */
  async createBlock(
    pageId: PageId,
    parentId: BlockId | null,
    content: string,
    afterBlockId?: BlockId
  ): Promise<Block> {
    try {
      // Calculate the order key based on siblings
      const order = await this.calculateOrderForInsert(pageId, parentId, afterBlockId ?? null);

      // Create the block
      const blockId = await this.blockRepo.create({
        pageId,
        parentId: parentId ?? undefined,
        content,
        order,
      });

      // Parse content and sync to relations
      const parsed = parseContent(content);
      await this.syncParsedContent(blockId, pageId, parsed);

      // Retrieve and return the created block
      const block = await this.blockRepo.getById(blockId);
      if (!block) {
        throw new DoubleBindError(
          `Failed to retrieve created block: ${blockId}`,
          ErrorCode.DB_QUERY_FAILED
        );
      }

      return block;
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to create block in page "${pageId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_MUTATION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Soft-delete a block and remove associated links/refs/tags/properties.
   *
   * @param blockId - The block to delete
   * @throws DoubleBindError with BLOCK_NOT_FOUND if block doesn't exist
   * @throws DoubleBindError with context on repository failure
   */
  async deleteBlock(blockId: BlockId): Promise<void> {
    try {
      // Verify block exists
      const block = await this.blockRepo.getById(blockId);
      if (!block) {
        throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
      }

      // Remove all associated links and block refs
      await this.linkRepo.removeLinksFromBlock(blockId);

      // Remove all tags for this block
      const tags = await this.tagRepo.getByEntity(blockId);
      for (const tag of tags) {
        await this.tagRepo.removeTag(blockId, tag.tag);
      }

      // Remove all properties for this block
      const properties = await this.propertyRepo.getByEntity(blockId);
      for (const prop of properties) {
        await this.propertyRepo.remove(blockId, prop.key);
      }

      // Soft-delete the block
      await this.blockRepo.softDelete(blockId);
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to delete block "${blockId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_MUTATION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Move a block to a new parent and/or position.
   *
   * @param blockId - The block to move
   * @param newParentId - New parent block ID (null for root-level)
   * @param afterBlockId - Optional block ID to insert after (null for first position)
   * @throws DoubleBindError with BLOCK_NOT_FOUND if block doesn't exist
   * @throws DoubleBindError with context on repository failure
   */
  async moveBlock(
    blockId: BlockId,
    newParentId: BlockId | null,
    afterBlockId?: BlockId
  ): Promise<void> {
    try {
      // Verify block exists
      const block = await this.blockRepo.getById(blockId);
      if (!block) {
        throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
      }

      // Calculate new order key
      const newOrder = await this.calculateOrderForInsert(
        block.pageId,
        newParentId,
        afterBlockId ?? null
      );

      // Move the block
      await this.blockRepo.move(blockId, newParentId, newOrder);
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to move block "${blockId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_MUTATION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Indent a block by making it a child of its previous sibling.
   *
   * If the block has no previous sibling, this operation does nothing.
   *
   * @param blockId - The block to indent
   * @throws DoubleBindError with BLOCK_NOT_FOUND if block doesn't exist
   * @throws DoubleBindError with context on repository failure
   */
  async indentBlock(blockId: BlockId): Promise<void> {
    try {
      // Get the block to indent
      const block = await this.blockRepo.getById(blockId);
      if (!block) {
        throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
      }

      // Get siblings under the same parent
      const parentKey = computeParentKey(block.parentId, block.pageId);
      const siblings = await this.blockRepo.getChildren(parentKey);

      // Find this block's position among siblings
      const currentIndex = siblings.findIndex((s) => s.blockId === blockId);
      if (currentIndex <= 0) {
        // No previous sibling - cannot indent
        return;
      }

      // Previous sibling becomes the new parent
      const previousSibling = siblings[currentIndex - 1];
      if (!previousSibling) {
        return;
      }

      // Get children of the new parent to calculate order
      const newSiblings = await this.blockRepo.getChildren(previousSibling.blockId);
      const newOrder =
        newSiblings.length > 0
          ? keyBetween(newSiblings[newSiblings.length - 1]!.order, null)
          : DEFAULT_ORDER;

      // Move the block to be a child of the previous sibling
      await this.blockRepo.move(blockId, previousSibling.blockId, newOrder);
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to indent block "${blockId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_MUTATION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Outdent a block by making it a sibling of its parent.
   *
   * If the block is already at the root level, this operation does nothing.
   *
   * @param blockId - The block to outdent
   * @throws DoubleBindError with BLOCK_NOT_FOUND if block doesn't exist
   * @throws DoubleBindError with context on repository failure
   */
  async outdentBlock(blockId: BlockId): Promise<void> {
    try {
      // Get the block to outdent
      const block = await this.blockRepo.getById(blockId);
      if (!block) {
        throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
      }

      // If already at root level, nothing to do
      if (block.parentId === null) {
        return;
      }

      // Get the parent block
      const parent = await this.blockRepo.getById(block.parentId);
      if (!parent) {
        throw new DoubleBindError(
          `Parent block not found: ${block.parentId}`,
          ErrorCode.BLOCK_NOT_FOUND
        );
      }

      // The grandparent becomes the new parent (could be null for root level)
      const grandparentId = parent.parentId;

      // Get siblings of the parent (future siblings of this block)
      const grandparentKey = computeParentKey(grandparentId, block.pageId);
      const parentSiblings = await this.blockRepo.getChildren(grandparentKey);

      // Find parent's position among its siblings
      const parentIndex = parentSiblings.findIndex((s) => s.blockId === parent.blockId);

      // Calculate new order: insert immediately after the parent
      let newOrder: string;
      if (parentIndex < 0) {
        // Parent not found in siblings (shouldn't happen)
        newOrder = DEFAULT_ORDER;
      } else if (parentIndex >= parentSiblings.length - 1) {
        // Parent is the last sibling - insert after parent
        newOrder = keyBetween(parent.order, null);
      } else {
        // Insert between parent and next sibling
        const nextSibling = parentSiblings[parentIndex + 1];
        newOrder = keyBetween(parent.order, nextSibling?.order ?? null);
      }

      // Move the block to be a sibling of its former parent
      await this.blockRepo.move(blockId, grandparentId, newOrder);
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to outdent block "${blockId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_MUTATION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Toggle the collapsed state of a block.
   *
   * @param blockId - The block to toggle
   * @throws DoubleBindError with BLOCK_NOT_FOUND if block doesn't exist
   * @throws DoubleBindError with context on repository failure
   */
  async toggleCollapse(blockId: BlockId): Promise<void> {
    try {
      // Get the block to toggle
      const block = await this.blockRepo.getById(blockId);
      if (!block) {
        throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
      }

      // Toggle the collapsed state
      await this.blockRepo.update(blockId, { isCollapsed: !block.isCollapsed });
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to toggle collapse for block "${blockId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_MUTATION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get all blocks that reference this block (backlinks).
   *
   * Returns blocks with their page context. The page info is populated
   * from the block_refs join which includes page_id.
   *
   * @param blockId - The block to find backlinks for
   * @returns Array of { block, page } pairs for blocks referencing this block
   */
  async getBacklinks(blockId: BlockId): Promise<BlockBacklinkResult[]> {
    try {
      const backlinks = await this.linkRepo.getBlockBacklinks(blockId);

      // Fetch the full block data for each backlink source
      const results: BlockBacklinkResult[] = [];
      for (const backlink of backlinks) {
        const block = await this.blockRepo.getById(backlink.sourceBlockId);
        if (block) {
          // Note: We don't have PageRepository access here, so we construct
          // a minimal Page object using the pageId from the backlink.
          // The UI layer can fetch full page details if needed.
          results.push({
            block,
            page: {
              pageId: backlink.pageId,
              title: '', // Would need PageRepository to populate
              createdAt: 0,
              updatedAt: 0,
              isDeleted: false,
              dailyNoteDate: null,
            },
          });
        }
      }

      return results;
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to get backlinks for block "${blockId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Calculate the order key for inserting a block at a specific position.
   * If the generated key exceeds the maximum length threshold, triggers
   * a rebalance of all sibling order keys.
   *
   * @param pageId - The page context
   * @param parentId - Parent block ID (null for root level)
   * @param afterBlockId - Block ID to insert after (null to insert at end)
   * @returns The order key for the new block
   */
  private async calculateOrderForInsert(
    pageId: PageId,
    parentId: BlockId | null,
    afterBlockId: BlockId | null
  ): Promise<string> {
    // Get siblings under the target parent
    const parentKey = computeParentKey(parentId, pageId);
    const siblings = await this.blockRepo.getChildren(parentKey);

    if (siblings.length === 0) {
      return DEFAULT_ORDER;
    }

    // Calculate the new order key
    let newOrder: string;
    if (afterBlockId === null) {
      // Insert at the end
      const lastSibling = siblings[siblings.length - 1]!;
      newOrder = keyBetween(lastSibling.order, null);
    } else {
      // Find the position of afterBlockId
      const afterIndex = siblings.findIndex((s) => s.blockId === afterBlockId);
      newOrder = keyForInsertAfter(siblings, afterIndex);
    }

    // Check if the new key exceeds the threshold
    if (needsRebalance(newOrder)) {
      // Trigger rebalance of all siblings plus the new position
      // We need siblings.length + 1 keys (for the new block)
      const rebalancedKeys = rebalanceKeys(siblings.length + 1);

      // Determine where the new block should be inserted
      let insertPosition: number;
      if (afterBlockId === null) {
        // Insert at the end
        insertPosition = siblings.length;
      } else {
        const afterIndex = siblings.findIndex((s) => s.blockId === afterBlockId);
        insertPosition = afterIndex < 0 ? siblings.length : afterIndex + 1;
      }

      // Build the new order map for existing siblings
      const newOrders = new Map<string, string>();
      let keyIndex = 0;
      for (let i = 0; i < siblings.length; i++) {
        if (i === insertPosition) {
          // Skip one key for the new block
          keyIndex++;
        }
        const sibling = siblings[i]!;
        newOrders.set(sibling.blockId, rebalancedKeys[keyIndex]!);
        keyIndex++;
      }

      // Handle case where insert position is at the end
      if (insertPosition >= siblings.length) {
        // The last key is for the new block
      }

      // Update all sibling orders in a single transaction
      await this.blockRepo.rebalanceSiblings(parentKey, newOrders);

      // Notify the callback about the rebalance
      if (this.onRebalance) {
        this.onRebalance(parentKey);
      }

      // Return the key for the new block
      return rebalancedKeys[insertPosition]!;
    }

    return newOrder;
  }

  /**
   * Sync parsed content to the appropriate relations.
   *
   * This method:
   * 1. Removes existing links/refs from this block
   * 2. Creates new page links for [[Page Name]] references
   * 3. Creates new block refs for ((blockId)) references
   * 4. Syncs tags (removes old, adds new)
   * 5. Syncs properties (removes old, adds new)
   *
   * @param blockId - The block whose content was parsed
   * @param pageId - The page containing this block (source for links)
   * @param parsed - The parsed content result
   */
  private async syncParsedContent(
    blockId: BlockId,
    pageId: PageId,
    parsed: ParsedContent
  ): Promise<void> {
    // Remove existing links and block refs from this block
    await this.linkRepo.removeLinksFromBlock(blockId);

    // Create page links for [[Page Name]] references
    // This resolves page titles to IDs, creating pages if they don't exist
    for (const pageLink of parsed.pageLinks) {
      // Get or create the target page by title
      const targetPage = await this.pageRepo.getOrCreateByTitle(pageLink.title);

      // Create the link record
      await this.linkRepo.createLink({
        sourceId: pageId,
        targetId: targetPage.pageId,
        linkType: 'reference',
        contextBlockId: blockId,
      });
    }

    // Create block refs for ((blockId)) references
    for (const blockRef of parsed.blockRefs) {
      await this.linkRepo.createBlockRef({
        sourceBlockId: blockId,
        targetBlockId: blockRef.blockId,
      });
    }

    // Sync tags - get existing, compute diff, remove old, add new
    const existingTags = await this.tagRepo.getByEntity(blockId);
    const existingTagNames = new Set(existingTags.map((t) => t.tag));
    const newTagNames = new Set(parsed.tags);

    // Remove tags that are no longer in content
    for (const tag of existingTags) {
      if (!newTagNames.has(tag.tag)) {
        await this.tagRepo.removeTag(blockId, tag.tag);
      }
    }

    // Add new tags
    for (const tagName of parsed.tags) {
      if (!existingTagNames.has(tagName)) {
        await this.tagRepo.addTag(blockId, tagName);
      }
    }

    // Sync properties - get existing, compute diff, remove old, add new
    const existingProperties = await this.propertyRepo.getByEntity(blockId);
    const newKeys = new Map(parsed.properties.map((p) => [p.key, p.value]));

    // Remove properties that are no longer in content
    for (const prop of existingProperties) {
      if (!newKeys.has(prop.key)) {
        await this.propertyRepo.remove(blockId, prop.key);
      }
    }

    // Add or update properties
    for (const prop of parsed.properties) {
      const existing = existingProperties.find((p) => p.key === prop.key);
      // Add if new or update if value changed
      if (!existing || existing.value !== prop.value) {
        await this.propertyRepo.set(blockId, prop.key, prop.value);
      }
    }
  }
}
