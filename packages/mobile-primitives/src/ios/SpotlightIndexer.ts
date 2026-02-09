/**
 * Service for indexing content with iOS Spotlight.
 *
 * Provides methods to add, update, and remove items from the iOS Spotlight
 * search index. Uses CSSearchableIndex from iOS SDK under the hood.
 */

import type { Page } from '@double-bind/types';
import type {
  SpotlightItem,
  SpotlightDomainIdentifier,
  SpotlightIndexResult,
  SpotlightBatchOptions,
} from './SpotlightTypes.js';

/**
 * Default domain identifier for Double-Bind pages.
 */
export const DEFAULT_DOMAIN_IDENTIFIER: SpotlightDomainIdentifier = 'com.doublebind.page';

/**
 * Default content type identifier.
 */
export const DEFAULT_CONTENT_TYPE = 'com.doublebind.note';

/**
 * Native bridge interface for Spotlight operations.
 * Implemented by platform-specific code (e.g., React Native module).
 */
export interface SpotlightBridge {
  /**
   * Index a single item.
   */
  indexItem(item: SpotlightItem): Promise<void>;

  /**
   * Index multiple items in a single batch.
   */
  indexItems(items: SpotlightItem[]): Promise<void>;

  /**
   * Remove an item from the index by identifier.
   */
  deleteItemWithIdentifier(identifier: string): Promise<void>;

  /**
   * Remove all items with a given domain identifier.
   */
  deleteItemsWithDomainIdentifier(domainIdentifier: string): Promise<void>;

  /**
   * Remove all searchable items from the index.
   */
  deleteAllItems(): Promise<void>;

  /**
   * Check if Spotlight is available on this device.
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Mock implementation of SpotlightBridge for testing.
 */
export class MockSpotlightBridge implements SpotlightBridge {
  private items = new Map<string, SpotlightItem>();

  async indexItem(item: SpotlightItem): Promise<void> {
    this.items.set(item.identifier, item);
  }

  async indexItems(items: SpotlightItem[]): Promise<void> {
    for (const item of items) {
      this.items.set(item.identifier, item);
    }
  }

  async deleteItemWithIdentifier(identifier: string): Promise<void> {
    this.items.delete(identifier);
  }

  async deleteItemsWithDomainIdentifier(domainIdentifier: string): Promise<void> {
    for (const [key, item] of this.items.entries()) {
      if (item.domainIdentifier === domainIdentifier) {
        this.items.delete(key);
      }
    }
  }

  async deleteAllItems(): Promise<void> {
    this.items.clear();
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  // Test helpers
  getIndexedItems(): SpotlightItem[] {
    return Array.from(this.items.values());
  }

  getItemByIdentifier(identifier: string): SpotlightItem | undefined {
    return this.items.get(identifier);
  }
}

/**
 * Service for managing iOS Spotlight search index.
 *
 * @example
 * ```ts
 * const indexer = new SpotlightIndexer(bridge);
 * await indexer.indexPage(page);
 * await indexer.removeFromIndex(page.pageId);
 * ```
 */
export class SpotlightIndexer {
  private bridge: SpotlightBridge;
  private domainIdentifier: SpotlightDomainIdentifier;

  constructor(
    bridge: SpotlightBridge,
    domainIdentifier: SpotlightDomainIdentifier = DEFAULT_DOMAIN_IDENTIFIER
  ) {
    this.bridge = bridge;
    this.domainIdentifier = domainIdentifier;
  }

  /**
   * Check if Spotlight is available on this device.
   */
  async isAvailable(): Promise<boolean> {
    return this.bridge.isAvailable();
  }

  /**
   * Convert a Page to a SpotlightItem.
   */
  private pageToSpotlightItem(page: Page, contentDescription = ''): SpotlightItem {
    const keywords: string[] = ['note'];

    if (page.dailyNoteDate) {
      keywords.push('daily', 'journal', page.dailyNoteDate);
    }

    // Extract potential keywords from title
    const titleWords = page.title
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3);
    keywords.push(...titleWords);

    return {
      identifier: page.pageId,
      domainIdentifier: this.domainIdentifier,
      title: page.title,
      contentDescription,
      keywords,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      metadata: {
        contentType: DEFAULT_CONTENT_TYPE,
        pageId: page.pageId,
        isDailyNote: page.dailyNoteDate !== null,
        dailyNoteDate: page.dailyNoteDate ?? undefined,
      },
    };
  }

  /**
   * Index a single page for Spotlight search.
   *
   * @param page - Page to index
   * @param contentDescription - Optional content preview (first few lines)
   * @returns Result of the indexing operation
   *
   * @example
   * ```ts
   * const result = await indexer.indexPage(page, 'This is my note content...');
   * if (!result.success) {
   *   console.error('Failed to index page:', result.error);
   * }
   * ```
   */
  async indexPage(page: Page, contentDescription = ''): Promise<SpotlightIndexResult> {
    try {
      if (page.isDeleted) {
        // Don't index deleted pages
        await this.removeFromIndex(page.pageId);
        return {
          success: true,
          itemCount: 0,
        };
      }

      const item = this.pageToSpotlightItem(page, contentDescription);
      await this.bridge.indexItem(item);

      return {
        success: true,
        itemCount: 1,
      };
    } catch (error) {
      return {
        success: false,
        itemCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Index multiple pages in batches.
   *
   * @param pages - Array of pages to index
   * @param contentMap - Optional map of pageId to content description
   * @param options - Batch processing options
   * @returns Result of the batch indexing operation
   *
   * @example
   * ```ts
   * const result = await indexer.indexPages(allPages, contentMap, {
   *   batchSize: 50,
   *   batchDelay: 200,
   * });
   * // Result contains success status and item count
   * ```
   */
  async indexPages(
    pages: Page[],
    contentMap?: Map<string, string>,
    options: SpotlightBatchOptions = {}
  ): Promise<SpotlightIndexResult> {
    const { batchSize = 100, batchDelay = 100, clearExisting = false } = options;

    try {
      if (clearExisting) {
        await this.clearIndex();
      }

      // Filter out deleted pages
      const activePages = pages.filter((page) => !page.isDeleted);

      let totalIndexed = 0;

      // Process in batches to avoid memory pressure
      for (let i = 0; i < activePages.length; i += batchSize) {
        const batch = activePages.slice(i, i + batchSize);
        const items = batch.map((page) => {
          const contentDescription = contentMap?.get(page.pageId) ?? '';
          return this.pageToSpotlightItem(page, contentDescription);
        });

        await this.bridge.indexItems(items);
        totalIndexed += items.length;

        // Add delay between batches to prevent system overload
        if (i + batchSize < activePages.length && batchDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, batchDelay));
        }
      }

      return {
        success: true,
        itemCount: totalIndexed,
      };
    } catch (error) {
      return {
        success: false,
        itemCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Remove a page from the Spotlight index.
   *
   * @param pageId - ID of the page to remove
   * @returns Result of the removal operation
   *
   * @example
   * ```ts
   * await indexer.removeFromIndex('01HQVZ8Y9P3X2K1N0M4F6JWQR');
   * ```
   */
  async removeFromIndex(pageId: string): Promise<SpotlightIndexResult> {
    try {
      await this.bridge.deleteItemWithIdentifier(pageId);
      return {
        success: true,
        itemCount: 1,
      };
    } catch (error) {
      return {
        success: false,
        itemCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Remove multiple pages from the index.
   *
   * @param pageIds - Array of page IDs to remove
   * @returns Result of the batch removal operation
   */
  async removeMultiple(pageIds: string[]): Promise<SpotlightIndexResult> {
    try {
      for (const pageId of pageIds) {
        await this.bridge.deleteItemWithIdentifier(pageId);
      }

      return {
        success: true,
        itemCount: pageIds.length,
      };
    } catch (error) {
      return {
        success: false,
        itemCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clear all items from the Spotlight index.
   *
   * @returns Result of the clear operation
   *
   * @example
   * ```ts
   * // Clear all indexed items (e.g., before re-indexing)
   * await indexer.clearIndex();
   * ```
   */
  async clearIndex(): Promise<SpotlightIndexResult> {
    try {
      await this.bridge.deleteItemsWithDomainIdentifier(this.domainIdentifier);
      return {
        success: true,
        itemCount: 0, // Count not available for bulk operations
      };
    } catch (error) {
      return {
        success: false,
        itemCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clear all searchable items (across all domains).
   *
   * @returns Result of the clear operation
   *
   * @example
   * ```ts
   * // Nuclear option: clear everything
   * await indexer.clearAllItems();
   * ```
   */
  async clearAllItems(): Promise<SpotlightIndexResult> {
    try {
      await this.bridge.deleteAllItems();
      return {
        success: true,
        itemCount: 0,
      };
    } catch (error) {
      return {
        success: false,
        itemCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
