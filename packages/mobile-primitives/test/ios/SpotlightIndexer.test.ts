/**
 * Tests for SpotlightIndexer service.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Page } from '@double-bind/types';
import {
  SpotlightIndexer,
  MockSpotlightBridge,
  DEFAULT_DOMAIN_IDENTIFIER,
} from '../../src/ios/SpotlightIndexer.js';

describe('MockSpotlightBridge', () => {
  let bridge: MockSpotlightBridge;

  beforeEach(() => {
    bridge = new MockSpotlightBridge();
  });

  it('should start with no items', () => {
    expect(bridge.getIndexedItems()).toHaveLength(0);
  });

  it('should index a single item', async () => {
    await bridge.indexItem({
      identifier: 'test-id',
      domainIdentifier: 'com.test',
      title: 'Test Item',
      contentDescription: 'Test content',
      keywords: ['test'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    expect(bridge.getIndexedItems()).toHaveLength(1);
    expect(bridge.getItemByIdentifier('test-id')).toBeDefined();
  });

  it('should index multiple items', async () => {
    await bridge.indexItems([
      {
        identifier: 'item-1',
        domainIdentifier: 'com.test',
        title: 'Item 1',
        contentDescription: '',
        keywords: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        identifier: 'item-2',
        domainIdentifier: 'com.test',
        title: 'Item 2',
        contentDescription: '',
        keywords: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    expect(bridge.getIndexedItems()).toHaveLength(2);
  });

  it('should delete item by identifier', async () => {
    await bridge.indexItem({
      identifier: 'test-id',
      domainIdentifier: 'com.test',
      title: 'Test',
      contentDescription: '',
      keywords: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await bridge.deleteItemWithIdentifier('test-id');
    expect(bridge.getIndexedItems()).toHaveLength(0);
  });

  it('should delete items by domain identifier', async () => {
    await bridge.indexItems([
      {
        identifier: 'item-1',
        domainIdentifier: 'com.test.a',
        title: 'Item 1',
        contentDescription: '',
        keywords: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        identifier: 'item-2',
        domainIdentifier: 'com.test.b',
        title: 'Item 2',
        contentDescription: '',
        keywords: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        identifier: 'item-3',
        domainIdentifier: 'com.test.a',
        title: 'Item 3',
        contentDescription: '',
        keywords: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    await bridge.deleteItemsWithDomainIdentifier('com.test.a');
    expect(bridge.getIndexedItems()).toHaveLength(1);
    expect(bridge.getItemByIdentifier('item-2')).toBeDefined();
  });

  it('should delete all items', async () => {
    await bridge.indexItems([
      {
        identifier: 'item-1',
        domainIdentifier: 'com.test',
        title: 'Item 1',
        contentDescription: '',
        keywords: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        identifier: 'item-2',
        domainIdentifier: 'com.test',
        title: 'Item 2',
        contentDescription: '',
        keywords: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    await bridge.deleteAllItems();
    expect(bridge.getIndexedItems()).toHaveLength(0);
  });

  it('should report as available', async () => {
    expect(await bridge.isAvailable()).toBe(true);
  });
});

describe('SpotlightIndexer', () => {
  let indexer: SpotlightIndexer;
  let bridge: MockSpotlightBridge;

  beforeEach(() => {
    bridge = new MockSpotlightBridge();
    indexer = new SpotlightIndexer(bridge);
  });

  const createTestPage = (overrides: Partial<Page> = {}): Page => ({
    pageId: 'test-page-id',
    title: 'Test Page',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDeleted: false,
    dailyNoteDate: null,
    ...overrides,
  });

  describe('isAvailable', () => {
    it('should report availability from bridge', async () => {
      expect(await indexer.isAvailable()).toBe(true);
    });
  });

  describe('indexPage', () => {
    it('should index a page successfully', async () => {
      const page = createTestPage();
      const result = await indexer.indexPage(page, 'Content preview');

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(1);
      expect(result.error).toBeUndefined();

      const indexed = bridge.getItemByIdentifier(page.pageId);
      expect(indexed).toBeDefined();
      expect(indexed?.title).toBe(page.title);
      expect(indexed?.contentDescription).toBe('Content preview');
    });

    it('should index page with default domain identifier', async () => {
      const page = createTestPage();
      await indexer.indexPage(page);

      const indexed = bridge.getItemByIdentifier(page.pageId);
      expect(indexed?.domainIdentifier).toBe(DEFAULT_DOMAIN_IDENTIFIER);
    });

    it('should extract keywords from title', async () => {
      const page = createTestPage({ title: 'Project Research Meeting Notes' });
      await indexer.indexPage(page);

      const indexed = bridge.getItemByIdentifier(page.pageId);
      expect(indexed?.keywords).toContain('project');
      expect(indexed?.keywords).toContain('research');
      expect(indexed?.keywords).toContain('meeting');
      expect(indexed?.keywords).toContain('notes');
    });

    it('should add daily note keywords for daily notes', async () => {
      const page = createTestPage({
        dailyNoteDate: '2024-01-15',
      });
      await indexer.indexPage(page);

      const indexed = bridge.getItemByIdentifier(page.pageId);
      expect(indexed?.keywords).toContain('daily');
      expect(indexed?.keywords).toContain('journal');
      expect(indexed?.keywords).toContain('2024-01-15');
    });

    it('should include page metadata', async () => {
      const page = createTestPage({
        dailyNoteDate: '2024-01-15',
      });
      await indexer.indexPage(page);

      const indexed = bridge.getItemByIdentifier(page.pageId);
      expect(indexed?.metadata?.pageId).toBe(page.pageId);
      expect(indexed?.metadata?.isDailyNote).toBe(true);
      expect(indexed?.metadata?.dailyNoteDate).toBe('2024-01-15');
    });

    it('should not index deleted pages', async () => {
      const page = createTestPage({ isDeleted: true });
      const result = await indexer.indexPage(page);

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(0);
      expect(bridge.getIndexedItems()).toHaveLength(0);
    });

    it('should remove page from index if marked as deleted', async () => {
      const page = createTestPage();
      await indexer.indexPage(page);
      expect(bridge.getIndexedItems()).toHaveLength(1);

      const deletedPage = createTestPage({ isDeleted: true });
      await indexer.indexPage(deletedPage);
      expect(bridge.getIndexedItems()).toHaveLength(0);
    });

    it('should include timestamps', async () => {
      const now = Date.now();
      const page = createTestPage({
        createdAt: now,
        updatedAt: now + 1000,
      });
      await indexer.indexPage(page);

      const indexed = bridge.getItemByIdentifier(page.pageId);
      expect(indexed?.createdAt).toBe(now);
      expect(indexed?.updatedAt).toBe(now + 1000);
    });
  });

  describe('indexPages', () => {
    it('should index multiple pages', async () => {
      const pages = [
        createTestPage({ pageId: 'page-1', title: 'Page 1' }),
        createTestPage({ pageId: 'page-2', title: 'Page 2' }),
        createTestPage({ pageId: 'page-3', title: 'Page 3' }),
      ];

      const result = await indexer.indexPages(pages);

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(3);
      expect(bridge.getIndexedItems()).toHaveLength(3);
    });

    it('should use content map if provided', async () => {
      const pages = [createTestPage({ pageId: 'page-1' }), createTestPage({ pageId: 'page-2' })];

      const contentMap = new Map([
        ['page-1', 'Content for page 1'],
        ['page-2', 'Content for page 2'],
      ]);

      await indexer.indexPages(pages, contentMap);

      expect(bridge.getItemByIdentifier('page-1')?.contentDescription).toBe('Content for page 1');
      expect(bridge.getItemByIdentifier('page-2')?.contentDescription).toBe('Content for page 2');
    });

    it('should filter out deleted pages', async () => {
      const pages = [
        createTestPage({ pageId: 'page-1' }),
        createTestPage({ pageId: 'page-2', isDeleted: true }),
        createTestPage({ pageId: 'page-3' }),
      ];

      const result = await indexer.indexPages(pages);

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(2);
      expect(bridge.getIndexedItems()).toHaveLength(2);
    });

    it('should process pages in batches', async () => {
      const pages = Array.from({ length: 250 }, (_, i) => createTestPage({ pageId: `page-${i}` }));

      const result = await indexer.indexPages(pages, undefined, {
        batchSize: 100,
        batchDelay: 0,
      });

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(250);
    });

    it('should clear existing items if requested', async () => {
      // Index some items first
      await indexer.indexPages([
        createTestPage({ pageId: 'old-1' }),
        createTestPage({ pageId: 'old-2' }),
      ]);

      expect(bridge.getIndexedItems()).toHaveLength(2);

      // Index new items with clearExisting
      const result = await indexer.indexPages([createTestPage({ pageId: 'new-1' })], undefined, {
        clearExisting: true,
      });

      expect(result.success).toBe(true);
      expect(bridge.getIndexedItems()).toHaveLength(1);
      expect(bridge.getItemByIdentifier('new-1')).toBeDefined();
      expect(bridge.getItemByIdentifier('old-1')).toBeUndefined();
    });

    it('should handle empty array', async () => {
      const result = await indexer.indexPages([]);

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(0);
    });
  });

  describe('removeFromIndex', () => {
    it('should remove a page from index', async () => {
      const page = createTestPage();
      await indexer.indexPage(page);
      expect(bridge.getIndexedItems()).toHaveLength(1);

      const result = await indexer.removeFromIndex(page.pageId);

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(1);
      expect(bridge.getIndexedItems()).toHaveLength(0);
    });

    it('should succeed even if item does not exist', async () => {
      const result = await indexer.removeFromIndex('non-existent-id');

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(1);
    });
  });

  describe('removeMultiple', () => {
    it('should remove multiple pages', async () => {
      await indexer.indexPages([
        createTestPage({ pageId: 'page-1' }),
        createTestPage({ pageId: 'page-2' }),
        createTestPage({ pageId: 'page-3' }),
      ]);

      const result = await indexer.removeMultiple(['page-1', 'page-3']);

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(2);
      expect(bridge.getIndexedItems()).toHaveLength(1);
      expect(bridge.getItemByIdentifier('page-2')).toBeDefined();
    });

    it('should handle empty array', async () => {
      const result = await indexer.removeMultiple([]);

      expect(result.success).toBe(true);
      expect(result.itemCount).toBe(0);
    });
  });

  describe('clearIndex', () => {
    it('should clear all items with domain identifier', async () => {
      await indexer.indexPages([
        createTestPage({ pageId: 'page-1' }),
        createTestPage({ pageId: 'page-2' }),
      ]);

      const result = await indexer.clearIndex();

      expect(result.success).toBe(true);
      expect(bridge.getIndexedItems()).toHaveLength(0);
    });
  });

  describe('clearAllItems', () => {
    it('should clear all searchable items', async () => {
      await indexer.indexPages([
        createTestPage({ pageId: 'page-1' }),
        createTestPage({ pageId: 'page-2' }),
      ]);

      const result = await indexer.clearAllItems();

      expect(result.success).toBe(true);
      expect(bridge.getIndexedItems()).toHaveLength(0);
    });
  });

  describe('custom domain identifier', () => {
    it('should use custom domain identifier', async () => {
      const customIndexer = new SpotlightIndexer(bridge, 'com.custom.domain');
      const page = createTestPage();

      await customIndexer.indexPage(page);

      const indexed = bridge.getItemByIdentifier(page.pageId);
      expect(indexed?.domainIdentifier).toBe('com.custom.domain');
    });
  });
});
