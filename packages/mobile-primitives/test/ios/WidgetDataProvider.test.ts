/**
 * Tests for WidgetDataProvider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WidgetDataProvider, InMemoryWidgetConfigStore } from '../../src/ios/WidgetDataProvider';
import { WidgetKind, WidgetSize } from '../../src/ios/WidgetTypes';
import type { PageService } from '@double-bind/core';
import type { Page } from '@double-bind/types';

describe('InMemoryWidgetConfigStore', () => {
  let store: InMemoryWidgetConfigStore;

  beforeEach(() => {
    store = new InMemoryWidgetConfigStore();
  });

  it('should store and retrieve configuration', async () => {
    const config = {
      widgetId: 'widget-1',
      kind: WidgetKind.RecentNotes,
      size: WidgetSize.Medium,
      options: { maxNotes: 5 },
      lastUpdated: Date.now(),
    };

    await store.setConfiguration('widget-1', config);
    const retrieved = await store.getConfiguration('widget-1');

    expect(retrieved).toEqual(config);
  });

  it('should return null for non-existent configuration', async () => {
    const result = await store.getConfiguration('non-existent');
    expect(result).toBeNull();
  });

  it('should list all configurations', async () => {
    const config1 = {
      widgetId: 'widget-1',
      kind: WidgetKind.RecentNotes,
      size: WidgetSize.Medium,
      options: {},
      lastUpdated: Date.now(),
    };
    const config2 = {
      widgetId: 'widget-2',
      kind: WidgetKind.DailyNote,
      size: WidgetSize.Small,
      options: {},
      lastUpdated: Date.now(),
    };

    await store.setConfiguration('widget-1', config1);
    await store.setConfiguration('widget-2', config2);

    const all = await store.getAllConfigurations();
    expect(all).toHaveLength(2);
    expect(all).toContainEqual(config1);
    expect(all).toContainEqual(config2);
  });

  it('should delete configuration', async () => {
    const config = {
      widgetId: 'widget-1',
      kind: WidgetKind.RecentNotes,
      size: WidgetSize.Medium,
      options: {},
      lastUpdated: Date.now(),
    };

    await store.setConfiguration('widget-1', config);
    await store.deleteConfiguration('widget-1');

    const result = await store.getConfiguration('widget-1');
    expect(result).toBeNull();
  });
});

describe('WidgetDataProvider', () => {
  let provider: WidgetDataProvider;
  let mockPageService: PageService;
  let store: InMemoryWidgetConfigStore;

  beforeEach(() => {
    store = new InMemoryWidgetConfigStore();

    // Mock PageService
    mockPageService = {
      getAll: vi.fn(),
      getByTitle: vi.fn(),
      create: vi.fn(),
      getById: vi.fn(),
    } as unknown as PageService;

    provider = new WidgetDataProvider(mockPageService, store);
  });

  describe('getRecentNotes', () => {
    it('should fetch recent notes with default limit', async () => {
      const mockPages: Page[] = [
        {
          pageId: 'page-1',
          title: 'Note 1',
          createdAt: Date.now() - 1000,
          updatedAt: Date.now() - 1000,
        },
        {
          pageId: 'page-2',
          title: 'Note 2',
          createdAt: Date.now() - 2000,
          updatedAt: Date.now() - 2000,
        },
      ];

      vi.mocked(mockPageService.getAll).mockResolvedValue(mockPages);

      const result = await provider.getRecentNotes();

      expect(mockPageService.getAll).toHaveBeenCalledWith({
        orderBy: 'updated',
        limit: 5,
      });
      expect(result.notes).toHaveLength(2);
      expect(result.notes[0].pageId).toBe('page-1');
      expect(result.notes[0].title).toBe('Note 1');
      expect(result.notes[0].preview).toBeDefined();
      expect(result.lastUpdated).toBeDefined();
    });

    it('should fetch recent notes with custom limit', async () => {
      const mockPages: Page[] = [];
      vi.mocked(mockPageService.getAll).mockResolvedValue(mockPages);

      await provider.getRecentNotes(10);

      expect(mockPageService.getAll).toHaveBeenCalledWith({
        orderBy: 'updated',
        limit: 10,
      });
    });

    it('should clamp limit to maximum (10)', async () => {
      const mockPages: Page[] = [];
      vi.mocked(mockPageService.getAll).mockResolvedValue(mockPages);

      await provider.getRecentNotes(100);

      expect(mockPageService.getAll).toHaveBeenCalledWith({
        orderBy: 'updated',
        limit: 10,
      });
    });

    it('should clamp limit to minimum (1)', async () => {
      const mockPages: Page[] = [];
      vi.mocked(mockPageService.getAll).mockResolvedValue(mockPages);

      await provider.getRecentNotes(0);

      expect(mockPageService.getAll).toHaveBeenCalledWith({
        orderBy: 'updated',
        limit: 1,
      });
    });
  });

  describe('getDailyNote', () => {
    it('should return existing daily note', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockPage: Page = {
        pageId: 'page-daily',
        title: today,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(mockPageService.getByTitle).mockResolvedValue(mockPage);
      vi.mocked(mockPageService.getById).mockResolvedValue({
        ...mockPage,
        blocks: [
          {
            blockId: 'block-1',
            pageId: 'page-daily',
            content: 'Test content',
            parentId: null,
            order: 'a0',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      });

      const result = await provider.getDailyNote();

      expect(result.pageId).toBe('page-daily');
      expect(result.title).toBe(today);
      expect(result.date).toBe(today);
      expect(result.blockCount).toBe(1);
      expect(result.lastUpdated).toBeDefined();
    });

    it('should create daily note if it does not exist', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockPage: Page = {
        pageId: 'page-new-daily',
        title: today,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(mockPageService.getByTitle).mockResolvedValue(null);
      vi.mocked(mockPageService.create).mockResolvedValue(mockPage);
      vi.mocked(mockPageService.getById).mockResolvedValue({
        ...mockPage,
        blocks: [],
      });

      const result = await provider.getDailyNote();

      expect(mockPageService.create).toHaveBeenCalledWith({
        title: today,
        createdAt: expect.any(Number),
      });
      expect(result.pageId).toBe('page-new-daily');
      expect(result.blockCount).toBe(0);
    });

    it('should generate appropriate preview for empty daily note', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockPage: Page = {
        pageId: 'page-daily',
        title: today,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(mockPageService.getByTitle).mockResolvedValue(mockPage);
      vi.mocked(mockPageService.getById).mockResolvedValue({
        ...mockPage,
        blocks: [],
      });

      const result = await provider.getDailyNote();

      expect(result.preview).toBe('No blocks yet');
    });

    it('should generate appropriate preview for daily note with one block', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockPage: Page = {
        pageId: 'page-daily',
        title: today,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(mockPageService.getByTitle).mockResolvedValue(mockPage);
      vi.mocked(mockPageService.getById).mockResolvedValue({
        ...mockPage,
        blocks: [
          {
            blockId: 'block-1',
            pageId: 'page-daily',
            content: 'Test',
            parentId: null,
            order: 'a0',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      });

      const result = await provider.getDailyNote();

      expect(result.preview).toBe('1 block');
    });

    it('should generate appropriate preview for daily note with multiple blocks', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockPage: Page = {
        pageId: 'page-daily',
        title: today,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(mockPageService.getByTitle).mockResolvedValue(mockPage);
      vi.mocked(mockPageService.getById).mockResolvedValue({
        ...mockPage,
        blocks: [
          {
            blockId: 'block-1',
            pageId: 'page-daily',
            content: 'Test 1',
            parentId: null,
            order: 'a0',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          {
            blockId: 'block-2',
            pageId: 'page-daily',
            content: 'Test 2',
            parentId: null,
            order: 'a1',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      });

      const result = await provider.getDailyNote();

      expect(result.preview).toBe('2 blocks');
    });
  });

  describe('getWidgetConfiguration', () => {
    it('should return widget configuration', async () => {
      const config = {
        widgetId: 'widget-1',
        kind: WidgetKind.RecentNotes,
        size: WidgetSize.Medium,
        options: { maxNotes: 5 },
        lastUpdated: Date.now(),
      };

      await store.setConfiguration('widget-1', config);

      const result = await provider.getWidgetConfiguration('widget-1');

      expect(result).toEqual(config);
    });

    it('should return null for non-existent configuration', async () => {
      const result = await provider.getWidgetConfiguration('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getQuickCaptureData', () => {
    it('should return quick capture data with default page', async () => {
      const result = await provider.getQuickCaptureData('page-123');

      expect(result.defaultPageId).toBe('page-123');
      expect(result.placeholder).toBe('Quick capture...');
      expect(result.lastUpdated).toBeDefined();
    });

    it('should return quick capture data without default page', async () => {
      const result = await provider.getQuickCaptureData();

      expect(result.defaultPageId).toBeNull();
      expect(result.placeholder).toBe('Quick capture...');
    });
  });
});
