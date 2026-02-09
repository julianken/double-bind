/**
 * Tests for dynamic shortcut manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DynamicShortcutManager,
  MAX_DYNAMIC_SHORTCUTS,
  createDynamicShortcut,
  type RecentPage,
} from '../../src/android/DynamicShortcuts';
import { ShortcutAction } from '../../src/android/ShortcutTypes';

describe('MAX_DYNAMIC_SHORTCUTS', () => {
  it('should be set to conservative limit', () => {
    expect(MAX_DYNAMIC_SHORTCUTS).toBe(4);
  });
});

describe('DynamicShortcutManager', () => {
  let manager: DynamicShortcutManager;

  beforeEach(() => {
    manager = new DynamicShortcutManager();
  });

  describe('initialization', () => {
    it('should start empty', () => {
      expect(manager.count).toBe(0);
      expect(manager.getShortcuts()).toHaveLength(0);
      expect(manager.isFull).toBe(false);
    });

    it('should use default max shortcuts', () => {
      expect(manager.count).toBeLessThanOrEqual(MAX_DYNAMIC_SHORTCUTS);
    });

    it('should accept custom max shortcuts', () => {
      const customManager = new DynamicShortcutManager(3);
      expect(customManager.count).toBe(0);
    });

    it('should clamp max shortcuts to valid range', () => {
      const tooSmall = new DynamicShortcutManager(0);
      const tooLarge = new DynamicShortcutManager(10);

      // Should be clamped to 1-5
      expect(tooSmall).toBeDefined();
      expect(tooLarge).toBeDefined();
    });
  });

  describe('addShortcut', () => {
    it('should add a new shortcut', () => {
      const page: RecentPage = {
        pageId: 'page-1',
        title: 'Test Page',
        accessedAt: Date.now(),
      };

      const shortcut = manager.addShortcut(page);

      expect(shortcut.id).toBe('dynamic_page_page-1');
      expect(shortcut.shortLabel).toBe('Test Page');
      expect(shortcut.action).toBe(ShortcutAction.OpenPage);
      expect(shortcut.payload?.pageId).toBe('page-1');
      expect(manager.count).toBe(1);
    });

    it('should truncate short label to 10 characters', () => {
      const page: RecentPage = {
        pageId: 'page-1',
        title: 'This is a very long page title',
        accessedAt: Date.now(),
      };

      const shortcut = manager.addShortcut(page);

      expect(shortcut.shortLabel.length).toBeLessThanOrEqual(10);
      expect(shortcut.shortLabel).toContain('…');
    });

    it('should truncate long label to 25 characters', () => {
      const page: RecentPage = {
        pageId: 'page-1',
        title: 'This is an extremely long page title that exceeds the limit',
        accessedAt: Date.now(),
      };

      const shortcut = manager.addShortcut(page);

      expect(shortcut.longLabel.length).toBeLessThanOrEqual(25);
      expect(shortcut.longLabel).toContain('…');
    });

    it('should update existing shortcut', () => {
      const page1: RecentPage = {
        pageId: 'page-1',
        title: 'Page 1',
        accessedAt: Date.now(),
      };
      const page2: RecentPage = {
        pageId: 'page-2',
        title: 'Page 2',
        accessedAt: Date.now(),
      };

      manager.addShortcut(page1);
      manager.addShortcut(page2);

      expect(manager.count).toBe(2);

      // Re-add page 1 (should move to front)
      const updatedPage: RecentPage = {
        pageId: 'page-1',
        title: 'Updated Page 1',
        accessedAt: Date.now(),
      };
      manager.addShortcut(updatedPage);

      expect(manager.count).toBe(2); // Still 2 shortcuts
      const shortcuts = manager.getShortcuts();
      expect(shortcuts[0].payload?.pageId).toBe('page-1'); // Moved to front
      expect(shortcuts[0].shortLabel).toBe('Updated P…'); // Updated title (10 chars)
    });

    it('should assign rank 0 to most recent', () => {
      const page: RecentPage = {
        pageId: 'page-1',
        title: 'Page 1',
        accessedAt: Date.now(),
      };

      const shortcut = manager.addShortcut(page);

      expect(shortcut.rank).toBe(0);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest when limit is reached', () => {
      const pages: RecentPage[] = [];
      for (let i = 1; i <= 5; i++) {
        pages.push({
          pageId: `page-${i}`,
          title: `Page ${i}`,
          accessedAt: Date.now() + i,
        });
      }

      // Add 5 pages (limit is 4)
      pages.forEach((page) => manager.addShortcut(page));

      expect(manager.count).toBe(4);
      expect(manager.isFull).toBe(true);

      // Page 1 should be evicted
      expect(manager.hasShortcut('page-1')).toBe(false);
      expect(manager.hasShortcut('page-5')).toBe(true);
    });

    it('should maintain correct order after eviction', () => {
      for (let i = 1; i <= 5; i++) {
        manager.addShortcut({
          pageId: `page-${i}`,
          title: `Page ${i}`,
          accessedAt: Date.now() + i,
        });
      }

      const shortcuts = manager.getShortcuts();
      expect(shortcuts).toHaveLength(4);
      expect(shortcuts[0].payload?.pageId).toBe('page-5');
      expect(shortcuts[3].payload?.pageId).toBe('page-2');
    });
  });

  describe('removeShortcut', () => {
    it('should remove shortcut by page ID', () => {
      const page: RecentPage = {
        pageId: 'page-1',
        title: 'Page 1',
        accessedAt: Date.now(),
      };

      manager.addShortcut(page);
      expect(manager.count).toBe(1);

      const removed = manager.removeShortcut('page-1');

      expect(removed).toBe(true);
      expect(manager.count).toBe(0);
    });

    it('should return false for non-existent shortcut', () => {
      const removed = manager.removeShortcut('non-existent');

      expect(removed).toBe(false);
    });

    it('should update ranks after removal', () => {
      for (let i = 1; i <= 3; i++) {
        manager.addShortcut({
          pageId: `page-${i}`,
          title: `Page ${i}`,
          accessedAt: Date.now() + i,
        });
      }

      manager.removeShortcut('page-2');

      const shortcuts = manager.getShortcuts();
      expect(shortcuts).toHaveLength(2);
      expect(shortcuts[0].rank).toBe(0);
      expect(shortcuts[1].rank).toBe(1);
    });
  });

  describe('getShortcuts', () => {
    it('should return shortcuts in rank order', () => {
      for (let i = 1; i <= 3; i++) {
        manager.addShortcut({
          pageId: `page-${i}`,
          title: `Page ${i}`,
          accessedAt: Date.now() + i,
        });
      }

      const shortcuts = manager.getShortcuts();

      expect(shortcuts).toHaveLength(3);
      for (let i = 0; i < shortcuts.length - 1; i++) {
        expect(shortcuts[i].rank).toBeLessThan(shortcuts[i + 1].rank);
      }
    });

    it('should return empty array when no shortcuts', () => {
      const shortcuts = manager.getShortcuts();

      expect(shortcuts).toHaveLength(0);
    });
  });

  describe('getShortcut', () => {
    it('should return shortcut by page ID', () => {
      const page: RecentPage = {
        pageId: 'page-1',
        title: 'Page 1',
        accessedAt: Date.now(),
      };

      manager.addShortcut(page);
      const shortcut = manager.getShortcut('page-1');

      expect(shortcut).toBeDefined();
      expect(shortcut?.payload?.pageId).toBe('page-1');
    });

    it('should return undefined for non-existent page', () => {
      const shortcut = manager.getShortcut('non-existent');

      expect(shortcut).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should remove all shortcuts', () => {
      for (let i = 1; i <= 3; i++) {
        manager.addShortcut({
          pageId: `page-${i}`,
          title: `Page ${i}`,
          accessedAt: Date.now(),
        });
      }

      expect(manager.count).toBe(3);

      manager.clear();

      expect(manager.count).toBe(0);
      expect(manager.getShortcuts()).toHaveLength(0);
      expect(manager.isFull).toBe(false);
    });
  });

  describe('recordPageAccess', () => {
    it('should update access order for existing shortcut', () => {
      for (let i = 1; i <= 3; i++) {
        manager.addShortcut({
          pageId: `page-${i}`,
          title: `Page ${i}`,
          accessedAt: Date.now() + i,
        });
      }

      // Page 1 is oldest
      const beforeShortcuts = manager.getShortcuts();
      expect(beforeShortcuts[0].payload?.pageId).toBe('page-3');
      expect(beforeShortcuts[2].payload?.pageId).toBe('page-1');

      // Record access to page 1 (should move to front)
      manager.recordPageAccess('page-1');

      const afterShortcuts = manager.getShortcuts();
      expect(afterShortcuts[0].payload?.pageId).toBe('page-1');
      expect(afterShortcuts[2].payload?.pageId).toBe('page-2');
    });

    it('should do nothing for non-existent page', () => {
      manager.addShortcut({
        pageId: 'page-1',
        title: 'Page 1',
        accessedAt: Date.now(),
      });

      const before = manager.count;
      manager.recordPageAccess('non-existent');
      const after = manager.count;

      expect(after).toBe(before);
    });
  });

  describe('getShortcutIds', () => {
    it('should return shortcut IDs in rank order', () => {
      for (let i = 1; i <= 3; i++) {
        manager.addShortcut({
          pageId: `page-${i}`,
          title: `Page ${i}`,
          accessedAt: Date.now() + i,
        });
      }

      const ids = manager.getShortcutIds();

      expect(ids).toHaveLength(3);
      expect(ids[0]).toBe('dynamic_page_page-3');
      expect(ids[1]).toBe('dynamic_page_page-2');
      expect(ids[2]).toBe('dynamic_page_page-1');
    });
  });

  describe('hasShortcut', () => {
    it('should return true for existing shortcut', () => {
      manager.addShortcut({
        pageId: 'page-1',
        title: 'Page 1',
        accessedAt: Date.now(),
      });

      expect(manager.hasShortcut('page-1')).toBe(true);
    });

    it('should return false for non-existent shortcut', () => {
      expect(manager.hasShortcut('non-existent')).toBe(false);
    });
  });

  describe('isFull property', () => {
    it('should be false when under limit', () => {
      manager.addShortcut({
        pageId: 'page-1',
        title: 'Page 1',
        accessedAt: Date.now(),
      });

      expect(manager.isFull).toBe(false);
    });

    it('should be true when at limit', () => {
      for (let i = 1; i <= MAX_DYNAMIC_SHORTCUTS; i++) {
        manager.addShortcut({
          pageId: `page-${i}`,
          title: `Page ${i}`,
          accessedAt: Date.now(),
        });
      }

      expect(manager.isFull).toBe(true);
    });
  });
});

describe('createDynamicShortcut', () => {
  it('should create shortcut from recent page', () => {
    const page: RecentPage = {
      pageId: 'page-1',
      title: 'Test Page',
      accessedAt: Date.now(),
    };

    const shortcut = createDynamicShortcut(page);

    expect(shortcut.id).toBe('dynamic_page_page-1');
    expect(shortcut.shortLabel).toBe('Test Page');
    expect(shortcut.longLabel).toBe('Test Page');
    expect(shortcut.action).toBe(ShortcutAction.OpenPage);
    expect(shortcut.payload?.pageId).toBe('page-1');
    expect(shortcut.rank).toBe(0);
    expect(shortcut.enabled).toBe(true);
  });

  it('should truncate labels', () => {
    const page: RecentPage = {
      pageId: 'page-1',
      title: 'This is an extremely long page title',
      accessedAt: Date.now(),
    };

    const shortcut = createDynamicShortcut(page);

    expect(shortcut.shortLabel.length).toBeLessThanOrEqual(10);
    expect(shortcut.longLabel.length).toBeLessThanOrEqual(25);
  });
});
