/**
 * Tests for Android WidgetTypes
 */

import { describe, it, expect } from 'vitest';
import {
  AndroidWidgetKind,
  AndroidWidgetSize,
  getMaxNotesForSize,
} from '../../src/android/WidgetTypes';
import type {
  AndroidWidgetConfiguration,
  AndroidRecentNotesData,
  AndroidQuickCaptureData,
  AndroidDailyNoteData,
  AndroidWidgetUpdatePayload,
  AndroidWidgetTapAction,
} from '../../src/android/WidgetTypes';

describe('Android WidgetTypes', () => {
  describe('AndroidWidgetKind enum', () => {
    it('should define all widget kinds', () => {
      expect(AndroidWidgetKind.RecentNotes).toBe('recentNotes');
      expect(AndroidWidgetKind.QuickCapture).toBe('quickCapture');
      expect(AndroidWidgetKind.DailyNote).toBe('dailyNote');
    });
  });

  describe('AndroidWidgetSize enum', () => {
    it('should define all widget sizes', () => {
      expect(AndroidWidgetSize.Small).toBe('small');
      expect(AndroidWidgetSize.Medium).toBe('medium');
      expect(AndroidWidgetSize.Large).toBe('large');
    });
  });

  describe('getMaxNotesForSize', () => {
    it('should return 3 for small widgets', () => {
      expect(getMaxNotesForSize(AndroidWidgetSize.Small)).toBe(3);
    });

    it('should return 5 for medium widgets', () => {
      expect(getMaxNotesForSize(AndroidWidgetSize.Medium)).toBe(5);
    });

    it('should return 10 for large widgets', () => {
      expect(getMaxNotesForSize(AndroidWidgetSize.Large)).toBe(10);
    });
  });

  describe('AndroidWidgetConfiguration', () => {
    it('should create valid configuration', () => {
      const config: AndroidWidgetConfiguration = {
        widgetId: 'widget-123',
        kind: AndroidWidgetKind.RecentNotes,
        size: AndroidWidgetSize.Medium,
        options: {
          maxNotes: 5,
          showPreviews: true,
        },
        lastUpdated: Date.now(),
      };

      expect(config.widgetId).toBe('widget-123');
      expect(config.kind).toBe(AndroidWidgetKind.RecentNotes);
      expect(config.size).toBe(AndroidWidgetSize.Medium);
      expect(config.options.maxNotes).toBe(5);
    });

    it('should support theme options', () => {
      const config: AndroidWidgetConfiguration = {
        widgetId: 'widget-123',
        kind: AndroidWidgetKind.DailyNote,
        size: AndroidWidgetSize.Large,
        options: {
          theme: 'dark',
          backgroundOpacity: 80,
          accentColor: '#FF5722',
        },
        lastUpdated: Date.now(),
      };

      expect(config.options.theme).toBe('dark');
      expect(config.options.backgroundOpacity).toBe(80);
      expect(config.options.accentColor).toBe('#FF5722');
    });
  });

  describe('AndroidRecentNotesData', () => {
    it('should create valid recent notes data', () => {
      const data: AndroidRecentNotesData = {
        notes: [
          {
            pageId: 'page-1',
            title: 'Note 1',
            preview: 'Preview 1',
            updatedAt: Date.now(),
          },
          {
            pageId: 'page-2',
            title: 'Note 2',
            updatedAt: Date.now(),
          },
        ],
        lastUpdated: Date.now(),
      };

      expect(data.notes).toHaveLength(2);
      expect(data.notes[0].pageId).toBe('page-1');
      expect(data.notes[1].preview).toBeUndefined();
    });
  });

  describe('AndroidQuickCaptureData', () => {
    it('should create valid quick capture data', () => {
      const data: AndroidQuickCaptureData = {
        defaultPageId: 'page-123',
        placeholder: 'Quick note...',
        lastUpdated: Date.now(),
      };

      expect(data.defaultPageId).toBe('page-123');
      expect(data.placeholder).toBe('Quick note...');
    });

    it('should allow null defaultPageId', () => {
      const data: AndroidQuickCaptureData = {
        defaultPageId: null,
        placeholder: 'Quick note...',
        lastUpdated: Date.now(),
      };

      expect(data.defaultPageId).toBeNull();
    });
  });

  describe('AndroidDailyNoteData', () => {
    it('should create valid daily note data', () => {
      const data: AndroidDailyNoteData = {
        pageId: 'page-daily',
        title: '2026-02-09',
        date: '2026-02-09',
        blockCount: 5,
        taskCount: 2,
        linkedPagesCount: 3,
        preview: '5 blocks',
        lastUpdated: Date.now(),
      };

      expect(data.pageId).toBe('page-daily');
      expect(data.title).toBe('2026-02-09');
      expect(data.blockCount).toBe(5);
      expect(data.taskCount).toBe(2);
    });

    it('should allow optional fields', () => {
      const data: AndroidDailyNoteData = {
        pageId: 'page-daily',
        title: '2026-02-09',
        date: '2026-02-09',
        blockCount: 0,
        lastUpdated: Date.now(),
      };

      expect(data.taskCount).toBeUndefined();
      expect(data.linkedPagesCount).toBeUndefined();
      expect(data.preview).toBeUndefined();
    });
  });

  describe('AndroidWidgetUpdatePayload', () => {
    it('should create valid update payload', () => {
      const payload: AndroidWidgetUpdatePayload = {
        widgetId: 'widget-123',
        kind: AndroidWidgetKind.RecentNotes,
        data: {
          notes: [],
          lastUpdated: Date.now(),
        },
        timestamp: Date.now(),
      };

      expect(payload.widgetId).toBe('widget-123');
      expect(payload.kind).toBe(AndroidWidgetKind.RecentNotes);
      expect(payload.data).toHaveProperty('notes');
    });
  });

  describe('AndroidWidgetTapAction', () => {
    it('should create valid tap action with payload', () => {
      const action: AndroidWidgetTapAction = {
        widgetId: 'widget-123',
        kind: AndroidWidgetKind.RecentNotes,
        action: 'openNote',
        payload: {
          pageId: 'page-456',
        },
      };

      expect(action.widgetId).toBe('widget-123');
      expect(action.action).toBe('openNote');
      expect(action.payload?.pageId).toBe('page-456');
    });

    it('should allow tap action without payload', () => {
      const action: AndroidWidgetTapAction = {
        widgetId: 'widget-123',
        kind: AndroidWidgetKind.DailyNote,
        action: 'openDailyNote',
      };

      expect(action.widgetId).toBe('widget-123');
      expect(action.payload).toBeUndefined();
    });

    it('should support content in payload for quick capture', () => {
      const action: AndroidWidgetTapAction = {
        widgetId: 'widget-123',
        kind: AndroidWidgetKind.QuickCapture,
        action: 'createNote',
        payload: {
          content: 'New quick note content',
        },
      };

      expect(action.payload?.content).toBe('New quick note content');
    });
  });
});
