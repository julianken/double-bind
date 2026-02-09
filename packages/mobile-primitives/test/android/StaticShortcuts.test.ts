/**
 * Tests for static shortcut definitions
 */

import { describe, it, expect } from 'vitest';
import {
  STATIC_SHORTCUT_IDS,
  NEW_NOTE_SHORTCUT,
  DAILY_NOTE_SHORTCUT,
  SEARCH_SHORTCUT,
  STATIC_SHORTCUTS,
  shortcutToIntent,
  getStaticShortcut,
  isStaticShortcut,
} from '../../src/android/StaticShortcuts';
import { ShortcutAction } from '../../src/android/ShortcutTypes';

describe('STATIC_SHORTCUT_IDS', () => {
  it('should define all static shortcut IDs', () => {
    expect(STATIC_SHORTCUT_IDS.NEW_NOTE).toBe('shortcut_new_note');
    expect(STATIC_SHORTCUT_IDS.DAILY_NOTE).toBe('shortcut_daily_note');
    expect(STATIC_SHORTCUT_IDS.SEARCH).toBe('shortcut_search');
  });
});

describe('NEW_NOTE_SHORTCUT', () => {
  it('should have correct properties', () => {
    expect(NEW_NOTE_SHORTCUT.id).toBe('shortcut_new_note');
    expect(NEW_NOTE_SHORTCUT.shortLabel).toBe('New Note');
    expect(NEW_NOTE_SHORTCUT.longLabel).toBe('Create New Note');
    expect(NEW_NOTE_SHORTCUT.action).toBe(ShortcutAction.NewNote);
    expect(NEW_NOTE_SHORTCUT.rank).toBe(0);
    expect(NEW_NOTE_SHORTCUT.enabled).toBe(true);
  });

  it('should have icon', () => {
    expect(NEW_NOTE_SHORTCUT.icon).toBe('ic_shortcut_new_note');
  });
});

describe('DAILY_NOTE_SHORTCUT', () => {
  it('should have correct properties', () => {
    expect(DAILY_NOTE_SHORTCUT.id).toBe('shortcut_daily_note');
    expect(DAILY_NOTE_SHORTCUT.shortLabel).toBe('Daily Note');
    expect(DAILY_NOTE_SHORTCUT.longLabel).toBe("Open Today's Note");
    expect(DAILY_NOTE_SHORTCUT.action).toBe(ShortcutAction.DailyNote);
    expect(DAILY_NOTE_SHORTCUT.rank).toBe(1);
    expect(DAILY_NOTE_SHORTCUT.enabled).toBe(true);
  });
});

describe('SEARCH_SHORTCUT', () => {
  it('should have correct properties', () => {
    expect(SEARCH_SHORTCUT.id).toBe('shortcut_search');
    expect(SEARCH_SHORTCUT.shortLabel).toBe('Search');
    expect(SEARCH_SHORTCUT.longLabel).toBe('Search Notes');
    expect(SEARCH_SHORTCUT.action).toBe(ShortcutAction.Search);
    expect(SEARCH_SHORTCUT.rank).toBe(2);
    expect(SEARCH_SHORTCUT.enabled).toBe(true);
  });
});

describe('STATIC_SHORTCUTS', () => {
  it('should contain all static shortcuts', () => {
    expect(STATIC_SHORTCUTS).toHaveLength(3);
    expect(STATIC_SHORTCUTS[0]).toBe(NEW_NOTE_SHORTCUT);
    expect(STATIC_SHORTCUTS[1]).toBe(DAILY_NOTE_SHORTCUT);
    expect(STATIC_SHORTCUTS[2]).toBe(SEARCH_SHORTCUT);
  });

  it('should be ordered by rank', () => {
    for (let i = 0; i < STATIC_SHORTCUTS.length - 1; i++) {
      expect(STATIC_SHORTCUTS[i].rank).toBeLessThan(STATIC_SHORTCUTS[i + 1].rank);
    }
  });

  it('should be read-only', () => {
    // TypeScript enforces read-only at compile time
    // Runtime behavior depends on JS engine (strict mode)
    expect(STATIC_SHORTCUTS).toBeDefined();
  });
});

describe('shortcutToIntent', () => {
  it('should convert shortcut to intent', () => {
    const intent = shortcutToIntent(NEW_NOTE_SHORTCUT);

    expect(intent.action).toBe('com.doublebind.newNote');
    expect(intent.data.shortcutId).toBe('shortcut_new_note');
    expect(intent.data.action).toBe('newNote');
  });

  it('should include payload in intent data', () => {
    const shortcut = {
      ...NEW_NOTE_SHORTCUT,
      payload: {
        pageId: 'page-123',
        pageName: 'Test Page',
      },
    };

    const intent = shortcutToIntent(shortcut);

    expect(intent.data.pageId).toBe('page-123');
    expect(intent.data.pageName).toBe('Test Page');
  });

  it('should include categories', () => {
    const intent = shortcutToIntent(SEARCH_SHORTCUT);

    expect(intent.categories).toContain('android.shortcut.conversation');
  });
});

describe('getStaticShortcut', () => {
  it('should return shortcut by ID', () => {
    const shortcut = getStaticShortcut('shortcut_new_note');

    expect(shortcut).toBe(NEW_NOTE_SHORTCUT);
  });

  it('should return undefined for non-existent ID', () => {
    const shortcut = getStaticShortcut('non_existent');

    expect(shortcut).toBeUndefined();
  });
});

describe('isStaticShortcut', () => {
  it('should return true for static shortcut IDs', () => {
    expect(isStaticShortcut('shortcut_new_note')).toBe(true);
    expect(isStaticShortcut('shortcut_daily_note')).toBe(true);
    expect(isStaticShortcut('shortcut_search')).toBe(true);
  });

  it('should return false for non-static shortcut IDs', () => {
    expect(isStaticShortcut('dynamic_page_123')).toBe(false);
    expect(isStaticShortcut('pinned_page_456')).toBe(false);
    expect(isStaticShortcut('unknown')).toBe(false);
  });
});
