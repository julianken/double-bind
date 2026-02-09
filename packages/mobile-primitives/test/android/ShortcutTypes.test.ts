/**
 * Tests for Android shortcut types and enums
 */

import { describe, it, expect } from 'vitest';
import {
  ShortcutType,
  ShortcutAction,
  type Shortcut,
  type ShortcutIntent,
  type ShortcutLaunchEvent,
} from '../../src/android/ShortcutTypes';

describe('ShortcutType', () => {
  it('should define all shortcut types', () => {
    expect(ShortcutType.Static).toBe('static');
    expect(ShortcutType.Dynamic).toBe('dynamic');
    expect(ShortcutType.Pinned).toBe('pinned');
  });
});

describe('ShortcutAction', () => {
  it('should define all shortcut actions', () => {
    expect(ShortcutAction.NewNote).toBe('newNote');
    expect(ShortcutAction.DailyNote).toBe('dailyNote');
    expect(ShortcutAction.Search).toBe('search');
    expect(ShortcutAction.OpenPage).toBe('openPage');
  });
});

describe('Shortcut interface', () => {
  it('should create valid shortcut with all required fields', () => {
    const shortcut: Shortcut = {
      id: 'test_shortcut',
      shortLabel: 'Test',
      longLabel: 'Test Shortcut',
      icon: 'ic_test',
      action: ShortcutAction.NewNote,
      rank: 0,
      enabled: true,
    };

    expect(shortcut.id).toBe('test_shortcut');
    expect(shortcut.shortLabel).toBe('Test');
    expect(shortcut.action).toBe(ShortcutAction.NewNote);
    expect(shortcut.enabled).toBe(true);
  });

  it('should create shortcut with optional payload', () => {
    const shortcut: Shortcut = {
      id: 'test_shortcut',
      shortLabel: 'Test',
      longLabel: 'Test Shortcut',
      icon: 'ic_test',
      action: ShortcutAction.OpenPage,
      payload: {
        pageId: 'page-123',
        pageName: 'Test Page',
      },
      rank: 0,
      enabled: true,
    };

    expect(shortcut.payload?.pageId).toBe('page-123');
    expect(shortcut.payload?.pageName).toBe('Test Page');
  });

  it('should create disabled shortcut', () => {
    const shortcut: Shortcut = {
      id: 'test_shortcut',
      shortLabel: 'Test',
      longLabel: 'Test Shortcut',
      icon: 'ic_test',
      action: ShortcutAction.NewNote,
      rank: 0,
      enabled: false,
    };

    expect(shortcut.enabled).toBe(false);
  });
});

describe('ShortcutIntent interface', () => {
  it('should create valid intent with action and data', () => {
    const intent: ShortcutIntent = {
      action: 'com.doublebind.newNote',
      data: {
        shortcutId: 'test_shortcut',
        action: 'newNote',
      },
    };

    expect(intent.action).toBe('com.doublebind.newNote');
    expect(intent.data.shortcutId).toBe('test_shortcut');
  });

  it('should create intent with categories', () => {
    const intent: ShortcutIntent = {
      action: 'com.doublebind.openPage',
      data: {
        pageId: 'page-123',
      },
      categories: ['android.shortcut.conversation'],
    };

    expect(intent.categories).toHaveLength(1);
    expect(intent.categories?.[0]).toBe('android.shortcut.conversation');
  });
});

describe('ShortcutLaunchEvent interface', () => {
  it('should create valid launch event', () => {
    const event: ShortcutLaunchEvent = {
      shortcutId: 'test_shortcut',
      action: ShortcutAction.OpenPage,
      payload: {
        pageId: 'page-123',
      },
      timestamp: Date.now(),
    };

    expect(event.shortcutId).toBe('test_shortcut');
    expect(event.action).toBe(ShortcutAction.OpenPage);
    expect(event.payload?.pageId).toBe('page-123');
    expect(event.timestamp).toBeGreaterThan(0);
  });

  it('should create launch event without payload', () => {
    const event: ShortcutLaunchEvent = {
      shortcutId: 'test_shortcut',
      action: ShortcutAction.NewNote,
      timestamp: Date.now(),
    };

    expect(event.shortcutId).toBe('test_shortcut');
    expect(event.payload).toBeUndefined();
  });
});
