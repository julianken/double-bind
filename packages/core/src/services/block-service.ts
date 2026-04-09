/**
 * BlockService - Orchestrates block mutations with content parsing.
 *
 * Handles CRUD, content parsing ([[links]], ((refs)), #tags, key:: values),
 * syncing parsed content to relations, and tree operations (indent/outdent).
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
  keysBetween,
  keyForInsertAfter,
  DEFAULT_ORDER,
  needsRebalance,
  rebalanceKeys,
} from '../utils/ordering.js';

export interface BlockBacklinkResult {
  block: Block;
  page: Page;
}

/** Callback invoked when sibling order keys are rebalanced. */
export type RebalanceCallback = (parentKey: string) => void;

export class BlockService {
  private onRebalance?: RebalanceCallback;

  constructor(
    private readonly blockRepo: BlockRepository,
    private readonly linkRepo: LinkRepository,
    private readonly pageRepo: PageRepository,
    private readonly tagRepo: TagRepository,
    private readonly propertyRepo: PropertyRepository
  ) {}

  /** Used by the UI layer to invalidate query caches after rebalance. */
  setRebalanceCallback(callback: RebalanceCallback): void {
    this.onRebalance = callback;
  }

  /** Update block content, re-parse, and sync links/refs/tags/properties. */
  async updateContent(blockId: BlockId, content: string): Promise<void> {
    try {
      const block = await this.blockRepo.getById(blockId);
      if (!block) {
        throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
      }

      const parsed = parseContent(content);
      await this.blockRepo.update(blockId, { content });
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

  async createBlock(
    pageId: PageId,
    parentId: BlockId | null,
    content: string,
    afterBlockId?: BlockId
  ): Promise<Block> {
    try {
      const order = await this.calculateOrderForInsert(pageId, parentId, afterBlockId ?? null);

      const blockId = await this.blockRepo.create({
        pageId,
        parentId: parentId ?? undefined,
        content,
        order,
      });

      const parsed = parseContent(content);
      await this.syncParsedContent(blockId, pageId, parsed);

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
   * Soft-delete a block. Children are promoted to siblings of the deleted block,
   * positioned immediately after where it was located.
   */
  async deleteBlock(blockId: BlockId): Promise<void> {
    try {
      const block = await this.blockRepo.getById(blockId);
      if (!block) {
        throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
      }

      const children = await this.blockRepo.getChildren(blockId);

      if (children.length > 0) {
        const parentKey = computeParentKey(block.parentId, block.pageId);
        const siblings = await this.blockRepo.getChildren(parentKey);

        const deletedIndex = siblings.findIndex((s) => s.blockId === blockId);
        const afterSibling = siblings[deletedIndex];
        const nextSibling = deletedIndex < siblings.length - 1 ? siblings[deletedIndex + 1] : null;

        const newOrderKeys = keysBetween(
          afterSibling?.order ?? null,
          nextSibling?.order ?? null,
          children.length
        );

        for (let i = 0; i < children.length; i++) {
          const child = children[i]!;
          await this.blockRepo.move(child.blockId, block.parentId, newOrderKeys[i]!);
        }
      }

      await this.linkRepo.removeLinksFromBlock(blockId);

      const tags = await this.tagRepo.getByEntity(blockId);
      for (const tag of tags) {
        await this.tagRepo.removeTag(blockId, tag.tag);
      }

      const properties = await this.propertyRepo.getByEntity(blockId);
      for (const prop of properties) {
        await this.propertyRepo.remove(blockId, prop.key);
      }

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

  async moveBlock(
    blockId: BlockId,
    newParentId: BlockId | null,
    afterBlockId?: BlockId
  ): Promise<void> {
    try {
      const block = await this.blockRepo.getById(blockId);
      if (!block) {
        throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
      }

      const newOrder = await this.calculateOrderForInsert(
        block.pageId,
        newParentId,
        afterBlockId ?? null
      );

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

  /** Swap with previous sibling. No-op if already first. */
  async moveBlockUp(blockId: BlockId): Promise<void> {
    try {
      const block = await this.blockRepo.getById(blockId);
      if (!block) {
        throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
      }

      const parentKey = computeParentKey(block.parentId, block.pageId);
      const siblings = await this.blockRepo.getChildren(parentKey);

      const currentIndex = siblings.findIndex((s) => s.blockId === blockId);
      if (currentIndex <= 0) {
        return;
      }

      let newOrder: string;
      if (currentIndex === 1) {
        const firstSibling = siblings[0];
        newOrder = keyBetween(null, firstSibling?.order ?? null);
      } else {
        const beforeSibling = siblings[currentIndex - 2];
        const afterSibling = siblings[currentIndex - 1];
        newOrder = keyBetween(beforeSibling?.order ?? null, afterSibling?.order ?? null);
      }

      if (needsRebalance(newOrder)) {
        const rebalancedKeys = rebalanceKeys(siblings.length);

        const newOrders = new Map<string, string>();
        let keyIndex = 0;
        for (let i = 0; i < siblings.length; i++) {
          const sibling = siblings[i]!;
          if (i === currentIndex - 1) {
            newOrders.set(blockId, rebalancedKeys[keyIndex]!);
            keyIndex++;
            newOrders.set(sibling.blockId, rebalancedKeys[keyIndex]!);
            keyIndex++;
          } else if (i === currentIndex) {
            continue;
          } else {
            newOrders.set(sibling.blockId, rebalancedKeys[keyIndex]!);
            keyIndex++;
          }
        }

        await this.blockRepo.rebalanceSiblings(parentKey, newOrders);

        if (this.onRebalance) {
          this.onRebalance(parentKey);
        }
      } else {
        await this.blockRepo.move(blockId, block.parentId, newOrder);
      }
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to move block up "${blockId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_MUTATION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /** Swap with next sibling. No-op if already last. */
  async moveBlockDown(blockId: BlockId): Promise<void> {
    try {
      const block = await this.blockRepo.getById(blockId);
      if (!block) {
        throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
      }

      const parentKey = computeParentKey(block.parentId, block.pageId);
      const siblings = await this.blockRepo.getChildren(parentKey);

      const currentIndex = siblings.findIndex((s) => s.blockId === blockId);
      if (currentIndex < 0 || currentIndex >= siblings.length - 1) {
        return;
      }

      let newOrder: string;
      if (currentIndex === siblings.length - 2) {
        const lastSibling = siblings[siblings.length - 1];
        newOrder = keyBetween(lastSibling?.order ?? null, null);
      } else {
        const beforeSibling = siblings[currentIndex + 1];
        const afterSibling = siblings[currentIndex + 2];
        newOrder = keyBetween(beforeSibling?.order ?? null, afterSibling?.order ?? null);
      }

      if (needsRebalance(newOrder)) {
        const rebalancedKeys = rebalanceKeys(siblings.length);

        const newOrders = new Map<string, string>();
        let keyIndex = 0;
        for (let i = 0; i < siblings.length; i++) {
          const sibling = siblings[i]!;
          if (i === currentIndex) {
            continue;
          } else if (i === currentIndex + 1) {
            newOrders.set(sibling.blockId, rebalancedKeys[keyIndex]!);
            keyIndex++;
            newOrders.set(blockId, rebalancedKeys[keyIndex]!);
            keyIndex++;
          } else {
            newOrders.set(sibling.blockId, rebalancedKeys[keyIndex]!);
            keyIndex++;
          }
        }

        await this.blockRepo.rebalanceSiblings(parentKey, newOrders);

        if (this.onRebalance) {
          this.onRebalance(parentKey);
        }
      } else {
        await this.blockRepo.move(blockId, block.parentId, newOrder);
      }
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to move block down "${blockId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_MUTATION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  /** Make this block a child of its previous sibling. No-op if no previous sibling. */
  async indentBlock(blockId: BlockId): Promise<void> {
    try {
      const block = await this.blockRepo.getById(blockId);
      if (!block) {
        throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
      }

      const parentKey = computeParentKey(block.parentId, block.pageId);
      const siblings = await this.blockRepo.getChildren(parentKey);

      const currentIndex = siblings.findIndex((s) => s.blockId === blockId);
      if (currentIndex <= 0) {
        return;
      }

      const previousSibling = siblings[currentIndex - 1];
      if (!previousSibling) {
        return;
      }

      const newSiblings = await this.blockRepo.getChildren(previousSibling.blockId);
      const newOrder =
        newSiblings.length > 0
          ? keyBetween(newSiblings[newSiblings.length - 1]!.order, null)
          : DEFAULT_ORDER;

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

  /** Make this block a sibling of its parent. No-op if already at root level. */
  async outdentBlock(blockId: BlockId): Promise<void> {
    try {
      const block = await this.blockRepo.getById(blockId);
      if (!block) {
        throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
      }

      if (block.parentId === null) {
        return;
      }

      const parent = await this.blockRepo.getById(block.parentId);
      if (!parent) {
        throw new DoubleBindError(
          `Parent block not found: ${block.parentId}`,
          ErrorCode.BLOCK_NOT_FOUND
        );
      }

      const grandparentId = parent.parentId;

      const grandparentKey = computeParentKey(grandparentId, block.pageId);
      const parentSiblings = await this.blockRepo.getChildren(grandparentKey);

      const parentIndex = parentSiblings.findIndex((s) => s.blockId === parent.blockId);

      let newOrder: string;
      if (parentIndex < 0) {
        newOrder = DEFAULT_ORDER;
      } else if (parentIndex >= parentSiblings.length - 1) {
        newOrder = keyBetween(parent.order, null);
      } else {
        const nextSibling = parentSiblings[parentIndex + 1];
        newOrder = keyBetween(parent.order, nextSibling?.order ?? null);
      }

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

  async toggleCollapse(blockId: BlockId): Promise<void> {
    try {
      const block = await this.blockRepo.getById(blockId);
      if (!block) {
        throw new DoubleBindError(`Block not found: ${blockId}`, ErrorCode.BLOCK_NOT_FOUND);
      }

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

  async getById(blockId: BlockId): Promise<Block | null> {
    try {
      return await this.blockRepo.getById(blockId);
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to get block "${blockId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getChildren(blockId: BlockId, pageId: PageId): Promise<Block[]> {
    try {
      const parentKey = computeParentKey(blockId, pageId);
      return await this.blockRepo.getChildren(parentKey);
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to get children for block "${blockId}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getBacklinks(blockId: BlockId): Promise<BlockBacklinkResult[]> {
    try {
      const backlinks = await this.linkRepo.getBlockBacklinks(blockId);

      const results: BlockBacklinkResult[] = [];
      for (const backlink of backlinks) {
        const block = await this.blockRepo.getById(backlink.sourceBlockId);
        if (block) {
          // Minimal Page stub -- UI layer can fetch full page details if needed
          results.push({
            block,
            page: {
              pageId: backlink.pageId,
              title: '',
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

  /**
   * Calculate the order key for inserting a block. Triggers a rebalance
   * if the generated key exceeds the length threshold.
   */
  private async calculateOrderForInsert(
    pageId: PageId,
    parentId: BlockId | null,
    afterBlockId: BlockId | null
  ): Promise<string> {
    const parentKey = computeParentKey(parentId, pageId);
    const siblings = await this.blockRepo.getChildren(parentKey);

    if (siblings.length === 0) {
      return DEFAULT_ORDER;
    }

    let newOrder: string;
    if (afterBlockId === null) {
      const lastSibling = siblings[siblings.length - 1]!;
      newOrder = keyBetween(lastSibling.order, null);
    } else {
      const afterIndex = siblings.findIndex((s) => s.blockId === afterBlockId);
      newOrder = keyForInsertAfter(siblings, afterIndex);
    }

    if (needsRebalance(newOrder)) {
      const rebalancedKeys = rebalanceKeys(siblings.length + 1);

      let insertPosition: number;
      if (afterBlockId === null) {
        insertPosition = siblings.length;
      } else {
        const afterIndex = siblings.findIndex((s) => s.blockId === afterBlockId);
        insertPosition = afterIndex < 0 ? siblings.length : afterIndex + 1;
      }

      const newOrders = new Map<string, string>();
      let keyIndex = 0;
      for (let i = 0; i < siblings.length; i++) {
        if (i === insertPosition) {
          keyIndex++;
        }
        const sibling = siblings[i]!;
        newOrders.set(sibling.blockId, rebalancedKeys[keyIndex]!);
        keyIndex++;
      }

      await this.blockRepo.rebalanceSiblings(parentKey, newOrders);

      if (this.onRebalance) {
        this.onRebalance(parentKey);
      }

      return rebalancedKeys[insertPosition]!;
    }

    return newOrder;
  }

  /** Replace all links/refs/tags/properties for a block with freshly parsed content. */
  private async syncParsedContent(
    blockId: BlockId,
    pageId: PageId,
    parsed: ParsedContent
  ): Promise<void> {
    await this.linkRepo.removeLinksFromBlock(blockId);

    for (const pageLink of parsed.pageLinks) {
      const targetPage = await this.pageRepo.getOrCreateByTitle(pageLink.title);
      await this.linkRepo.createLink({
        sourceId: pageId,
        targetId: targetPage.pageId,
        linkType: 'reference',
        contextBlockId: blockId,
      });
    }

    for (const blockRef of parsed.blockRefs) {
      await this.linkRepo.createBlockRef({
        sourceBlockId: blockId,
        targetBlockId: blockRef.blockId,
      });
    }

    const existingTags = await this.tagRepo.getByEntity(blockId);
    const existingTagNames = new Set(existingTags.map((t) => t.tag));
    const newTagNames = new Set(parsed.tags.map((t) => t.tag));

    for (const tag of existingTags) {
      if (!newTagNames.has(tag.tag)) {
        await this.tagRepo.removeTag(blockId, tag.tag);
      }
    }

    for (const tagRef of parsed.tags) {
      if (!existingTagNames.has(tagRef.tag)) {
        await this.tagRepo.addTag(blockId, tagRef.tag);
      }
    }

    const existingProperties = await this.propertyRepo.getByEntity(blockId);
    const newKeys = new Map(parsed.properties.map((p) => [p.key, p.value]));

    for (const prop of existingProperties) {
      if (!newKeys.has(prop.key)) {
        await this.propertyRepo.remove(blockId, prop.key);
      }
    }

    for (const prop of parsed.properties) {
      const existing = existingProperties.find((p) => p.key === prop.key);
      if (!existing || existing.value !== prop.value) {
        await this.propertyRepo.set(blockId, prop.key, prop.value);
      }
    }
  }
}
