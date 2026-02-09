/**
 * Tests for WidgetActions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WidgetActions, MockWidgetNavigator } from '../../src/ios/WidgetActions';
import type { PageService, BlockService } from '@double-bind/core';
import type { Page, Block } from '@double-bind/types';

describe('MockWidgetNavigator', () => {
  let navigator: MockWidgetNavigator;

  beforeEach(() => {
    navigator = new MockWidgetNavigator();
  });

  it('should track navigateToPage calls', () => {
    navigator.navigateToPage('page-123');

    const history = navigator.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual({
      action: 'navigateToPage',
      params: { pageId: 'page-123' },
    });
  });

  it('should track navigateToBlock calls', () => {
    navigator.navigateToBlock('page-123', 'block-456');

    const history = navigator.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual({
      action: 'navigateToBlock',
      params: { pageId: 'page-123', blockId: 'block-456' },
    });
  });

  it('should track navigateToDailyNote calls', () => {
    navigator.navigateToDailyNote();

    const history = navigator.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual({
      action: 'navigateToDailyNote',
      params: {},
    });
  });

  it('should track openQuickCapture calls', () => {
    navigator.openQuickCapture();

    const history = navigator.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual({
      action: 'openQuickCapture',
      params: {},
    });
  });

  it('should clear history', () => {
    navigator.navigateToPage('page-123');
    navigator.clearHistory();

    const history = navigator.getHistory();
    expect(history).toHaveLength(0);
  });
});

describe('WidgetActions', () => {
  let actions: WidgetActions;
  let mockPageService: PageService;
  let mockBlockService: BlockService;
  let mockNavigator: MockWidgetNavigator;

  beforeEach(() => {
    mockPageService = {
      getById: vi.fn(),
      getByTitle: vi.fn(),
      create: vi.fn(),
    } as unknown as PageService;

    mockBlockService = {
      create: vi.fn(),
    } as unknown as BlockService;

    mockNavigator = new MockWidgetNavigator();

    actions = new WidgetActions(mockPageService, mockBlockService, mockNavigator);
  });

  describe('openNote', () => {
    it('should open existing note', async () => {
      const mockPage: Page = {
        pageId: 'page-123',
        title: 'Test Page',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(mockPageService.getById).mockResolvedValue({
        ...mockPage,
        blocks: [],
      });

      await actions.openNote('page-123');

      expect(mockPageService.getById).toHaveBeenCalledWith('page-123');

      const history = mockNavigator.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({
        action: 'navigateToPage',
        params: { pageId: 'page-123' },
      });
    });

    it('should throw error for non-existent note', async () => {
      vi.mocked(mockPageService.getById).mockResolvedValue(null);

      await expect(actions.openNote('non-existent')).rejects.toThrow(
        'Page not found: non-existent'
      );
    });
  });

  describe('openDailyNote', () => {
    it('should open existing daily note', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockPage: Page = {
        pageId: 'page-daily',
        title: today,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(mockPageService.getByTitle).mockResolvedValue(mockPage);

      await actions.openDailyNote();

      expect(mockPageService.getByTitle).toHaveBeenCalledWith(today);

      const history = mockNavigator.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({
        action: 'navigateToPage',
        params: { pageId: 'page-daily' },
      });
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

      await actions.openDailyNote();

      expect(mockPageService.create).toHaveBeenCalledWith({
        title: today,
        createdAt: expect.any(Number),
      });

      const history = mockNavigator.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({
        action: 'navigateToPage',
        params: { pageId: 'page-new-daily' },
      });
    });
  });

  describe('createQuickNote', () => {
    it('should create note in specified page', async () => {
      const mockPage: Page = {
        pageId: 'page-123',
        title: 'Test Page',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockBlock: Block = {
        blockId: 'block-456',
        pageId: 'page-123',
        content: 'Quick note content',
        parentId: null,
        order: 'a0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(mockPageService.getById).mockResolvedValue({
        ...mockPage,
        blocks: [],
      });
      vi.mocked(mockBlockService.create).mockResolvedValue(mockBlock);

      const blockId = await actions.createQuickNote('Quick note content', 'page-123');

      expect(mockPageService.getById).toHaveBeenCalledWith('page-123');
      expect(mockBlockService.create).toHaveBeenCalledWith({
        pageId: 'page-123',
        content: 'Quick note content',
        parentId: null,
        createdAt: expect.any(Number),
      });
      expect(blockId).toBe('block-456');

      const history = mockNavigator.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({
        action: 'navigateToBlock',
        params: { pageId: 'page-123', blockId: 'block-456' },
      });
    });

    it('should create note in daily note by default', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockPage: Page = {
        pageId: 'page-daily',
        title: today,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockBlock: Block = {
        blockId: 'block-789',
        pageId: 'page-daily',
        content: 'Quick note',
        parentId: null,
        order: 'a0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(mockPageService.getByTitle).mockResolvedValue(mockPage);
      vi.mocked(mockPageService.getById).mockResolvedValue({
        ...mockPage,
        blocks: [],
      });
      vi.mocked(mockBlockService.create).mockResolvedValue(mockBlock);

      const blockId = await actions.createQuickNote('Quick note');

      expect(mockPageService.getByTitle).toHaveBeenCalledWith(today);
      expect(blockId).toBe('block-789');
    });

    it('should create daily note if it does not exist', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockPage: Page = {
        pageId: 'page-new-daily',
        title: today,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockBlock: Block = {
        blockId: 'block-789',
        pageId: 'page-new-daily',
        content: 'Quick note',
        parentId: null,
        order: 'a0',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(mockPageService.getByTitle).mockResolvedValue(null);
      vi.mocked(mockPageService.create).mockResolvedValue(mockPage);
      vi.mocked(mockPageService.getById).mockResolvedValue({
        ...mockPage,
        blocks: [],
      });
      vi.mocked(mockBlockService.create).mockResolvedValue(mockBlock);

      const blockId = await actions.createQuickNote('Quick note');

      expect(mockPageService.create).toHaveBeenCalledWith({
        title: today,
        createdAt: expect.any(Number),
      });
      expect(blockId).toBe('block-789');
    });

    it('should throw error for non-existent target page', async () => {
      vi.mocked(mockPageService.getById).mockResolvedValue(null);

      await expect(actions.createQuickNote('Quick note', 'non-existent')).rejects.toThrow(
        'Target page not found: non-existent'
      );
    });
  });

  describe('openQuickCaptureInterface', () => {
    it('should open quick capture interface', () => {
      actions.openQuickCaptureInterface();

      const history = mockNavigator.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({
        action: 'openQuickCapture',
        params: {},
      });
    });
  });
});
