/**
 * Tests for Android WidgetProvider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AndroidWidgetProvider } from '../../src/android/WidgetProvider';
import { AndroidWidgetKind, AndroidWidgetSize } from '../../src/android/WidgetTypes';
import type { PageService } from '@double-bind/core';
import type { Page } from '@double-bind/types';
import type {
  AndroidWidgetConfiguration,
  AndroidQuickCaptureData,
  AndroidDailyNoteData,
} from '../../src/android/WidgetTypes';

describe('AndroidWidgetProvider', () => {
  let provider: AndroidWidgetProvider;
  let mockPageService: PageService;

  beforeEach(() => {
    // Mock PageService
    mockPageService = {
      getAll: vi.fn(),
      getByTitle: vi.fn(),
      create: vi.fn(),
      getById: vi.fn(),
    } as unknown as PageService;

    provider = new AndroidWidgetProvider(mockPageService);
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

  describe('updateWidgetData', () => {
    it('should fetch recent notes for RecentNotes widget', async () => {
      const config: AndroidWidgetConfiguration = {
        widgetId: 'widget-123',
        kind: AndroidWidgetKind.RecentNotes,
        size: AndroidWidgetSize.Medium,
        options: { maxNotes: 5 },
        lastUpdated: Date.now(),
      };

      const mockPages: Page[] = [
        {
          pageId: 'page-1',
          title: 'Note 1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      vi.mocked(mockPageService.getAll).mockResolvedValue(mockPages);

      const result = await provider.updateWidgetData(config);

      expect(result).toHaveProperty('notes');
      expect(mockPageService.getAll).toHaveBeenCalledWith({
        orderBy: 'updated',
        limit: 5,
      });
    });

    it('should fetch quick capture data for QuickCapture widget', async () => {
      const config: AndroidWidgetConfiguration = {
        widgetId: 'widget-123',
        kind: AndroidWidgetKind.QuickCapture,
        size: AndroidWidgetSize.Small,
        options: { defaultPageId: 'page-456' },
        lastUpdated: Date.now(),
      };

      const result = await provider.updateWidgetData(config);

      expect(result).toHaveProperty('placeholder');
      expect((result as AndroidQuickCaptureData).defaultPageId).toBe('page-456');
    });

    it('should fetch daily note for DailyNote widget', async () => {
      const today = new Date().toISOString().split('T')[0];
      const config: AndroidWidgetConfiguration = {
        widgetId: 'widget-123',
        kind: AndroidWidgetKind.DailyNote,
        size: AndroidWidgetSize.Large,
        options: {},
        lastUpdated: Date.now(),
      };

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

      const result = await provider.updateWidgetData(config);

      expect(result).toHaveProperty('date');
      expect((result as AndroidDailyNoteData).date).toBe(today);
    });

    it('should throw error for unknown widget kind', async () => {
      const config = {
        widgetId: 'widget-123',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        kind: 'unknown' as any,
        size: AndroidWidgetSize.Medium,
        options: {},
        lastUpdated: Date.now(),
      };

      await expect(provider.updateWidgetData(config)).rejects.toThrow(
        'Unknown widget kind: unknown'
      );
    });
  });
});
