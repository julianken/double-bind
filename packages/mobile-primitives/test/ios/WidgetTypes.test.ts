/**
 * Tests for WidgetTypes
 */

import { describe, it, expect } from 'vitest';
import { WidgetKind, WidgetSize } from '../../src/ios/WidgetTypes';
import type {
  WidgetConfiguration,
  RecentNotesData,
  QuickCaptureData,
  DailyNoteData,
  WidgetUpdatePayload,
  WidgetTapAction,
} from '../../src/ios/WidgetTypes';

describe('WidgetTypes', () => {
  describe('WidgetKind enum', () => {
    it('should define all widget kinds', () => {
      expect(WidgetKind.RecentNotes).toBe('recentNotes');
      expect(WidgetKind.QuickCapture).toBe('quickCapture');
      expect(WidgetKind.DailyNote).toBe('dailyNote');
    });
  });

  describe('WidgetSize enum', () => {
    it('should define all widget sizes', () => {
      expect(WidgetSize.Small).toBe('small');
      expect(WidgetSize.Medium).toBe('medium');
      expect(WidgetSize.Large).toBe('large');
    });
  });

  describe('WidgetConfiguration', () => {
    it('should create valid configuration', () => {
      const config: WidgetConfiguration = {
        widgetId: 'widget-123',
        kind: WidgetKind.RecentNotes,
        size: WidgetSize.Medium,
        options: {
          maxNotes: 5,
          showPreviews: true,
        },
        lastUpdated: Date.now(),
      };

      expect(config.widgetId).toBe('widget-123');
      expect(config.kind).toBe(WidgetKind.RecentNotes);
      expect(config.size).toBe(WidgetSize.Medium);
      expect(config.options.maxNotes).toBe(5);
    });
  });

  describe('RecentNotesData', () => {
    it('should create valid recent notes data', () => {
      const data: RecentNotesData = {
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

  describe('QuickCaptureData', () => {
    it('should create valid quick capture data', () => {
      const data: QuickCaptureData = {
        defaultPageId: 'page-123',
        placeholder: 'Quick note...',
        lastUpdated: Date.now(),
      };

      expect(data.defaultPageId).toBe('page-123');
      expect(data.placeholder).toBe('Quick note...');
    });

    it('should allow null defaultPageId', () => {
      const data: QuickCaptureData = {
        defaultPageId: null,
        placeholder: 'Quick note...',
        lastUpdated: Date.now(),
      };

      expect(data.defaultPageId).toBeNull();
    });
  });

  describe('DailyNoteData', () => {
    it('should create valid daily note data', () => {
      const data: DailyNoteData = {
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
      const data: DailyNoteData = {
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

  describe('WidgetUpdatePayload', () => {
    it('should create valid update payload', () => {
      const payload: WidgetUpdatePayload = {
        widgetId: 'widget-123',
        kind: WidgetKind.RecentNotes,
        data: {
          notes: [],
          lastUpdated: Date.now(),
        },
        timestamp: Date.now(),
      };

      expect(payload.widgetId).toBe('widget-123');
      expect(payload.kind).toBe(WidgetKind.RecentNotes);
      expect(payload.data).toHaveProperty('notes');
    });
  });

  describe('WidgetTapAction', () => {
    it('should create valid tap action with payload', () => {
      const action: WidgetTapAction = {
        widgetId: 'widget-123',
        kind: WidgetKind.RecentNotes,
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
      const action: WidgetTapAction = {
        widgetId: 'widget-123',
        kind: WidgetKind.DailyNote,
        action: 'openDailyNote',
      };

      expect(action.widgetId).toBe('widget-123');
      expect(action.payload).toBeUndefined();
    });
  });
});
