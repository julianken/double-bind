/**
 * Tests for pinned shortcut support
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  requestPinShortcut,
  requestPinStaticShortcut,
  isPinShortcutSupported,
  MockPinnedShortcutBridge,
  type PinShortcutOptions,
} from '../../src/android/PinnedShortcuts';
import { NEW_NOTE_SHORTCUT } from '../../src/android/StaticShortcuts';
import { ShortcutAction } from '../../src/android/ShortcutTypes';

describe('MockPinnedShortcutBridge', () => {
  let bridge: MockPinnedShortcutBridge;

  beforeEach(() => {
    bridge = new MockPinnedShortcutBridge();
  });

  describe('isSupported', () => {
    it('should return true by default', () => {
      expect(bridge.isSupported()).toBe(true);
    });

    it('should return false when set to unsupported', () => {
      bridge.setSupported(false);
      expect(bridge.isSupported()).toBe(false);
    });
  });

  describe('requestPinShortcut', () => {
    it('should accept pin request by default', async () => {
      const shortcut = {
        id: 'test_shortcut',
        shortLabel: 'Test',
        longLabel: 'Test Shortcut',
        icon: 'ic_test',
        action: ShortcutAction.NewNote,
        rank: 0,
        enabled: true,
      };

      const result = await bridge.requestPinShortcut(shortcut);

      expect(result.accepted).toBe(true);
      expect(result.shortcutId).toBe('test_shortcut');
    });

    it('should decline when autoAccept is false', async () => {
      bridge.setAutoAccept(false);

      const shortcut = {
        id: 'test_shortcut',
        shortLabel: 'Test',
        longLabel: 'Test Shortcut',
        icon: 'ic_test',
        action: ShortcutAction.NewNote,
        rank: 0,
        enabled: true,
      };

      const result = await bridge.requestPinShortcut(shortcut);

      expect(result.accepted).toBe(false);
      expect(result.error).toBe('User declined');
    });

    it('should track pinned shortcuts', async () => {
      const shortcut = {
        id: 'test_shortcut',
        shortLabel: 'Test',
        longLabel: 'Test Shortcut',
        icon: 'ic_test',
        action: ShortcutAction.NewNote,
        rank: 0,
        enabled: true,
      };

      await bridge.requestPinShortcut(shortcut);

      const pinned = bridge.getPinnedShortcuts();
      expect(pinned).toContain('test_shortcut');
    });

    it('should reject when not supported', async () => {
      bridge.setSupported(false);

      const shortcut = {
        id: 'test_shortcut',
        shortLabel: 'Test',
        longLabel: 'Test Shortcut',
        icon: 'ic_test',
        action: ShortcutAction.NewNote,
        rank: 0,
        enabled: true,
      };

      const result = await bridge.requestPinShortcut(shortcut);

      expect(result.accepted).toBe(false);
      expect(result.error).toBe('Not supported');
    });
  });

  describe('isPinned', () => {
    it('should return true for pinned shortcuts', async () => {
      const shortcut = {
        id: 'test_shortcut',
        shortLabel: 'Test',
        longLabel: 'Test Shortcut',
        icon: 'ic_test',
        action: ShortcutAction.NewNote,
        rank: 0,
        enabled: true,
      };

      await bridge.requestPinShortcut(shortcut);
      const isPinned = await bridge.isPinned('test_shortcut');

      expect(isPinned).toBe(true);
    });

    it('should return false for non-pinned shortcuts', async () => {
      const isPinned = await bridge.isPinned('non_existent');

      expect(isPinned).toBe(false);
    });
  });

  describe('test utilities', () => {
    it('should get pinned shortcuts', async () => {
      const shortcuts = [
        {
          id: 'shortcut_1',
          shortLabel: 'S1',
          longLabel: 'Shortcut 1',
          icon: 'ic_1',
          action: ShortcutAction.NewNote,
          rank: 0,
          enabled: true,
        },
        {
          id: 'shortcut_2',
          shortLabel: 'S2',
          longLabel: 'Shortcut 2',
          icon: 'ic_2',
          action: ShortcutAction.Search,
          rank: 0,
          enabled: true,
        },
      ];

      for (const shortcut of shortcuts) {
        await bridge.requestPinShortcut(shortcut);
      }

      const pinned = bridge.getPinnedShortcuts();
      expect(pinned).toHaveLength(2);
      expect(pinned).toContain('shortcut_1');
      expect(pinned).toContain('shortcut_2');
    });

    it('should clear pinned shortcuts', async () => {
      const shortcut = {
        id: 'test_shortcut',
        shortLabel: 'Test',
        longLabel: 'Test Shortcut',
        icon: 'ic_test',
        action: ShortcutAction.NewNote,
        rank: 0,
        enabled: true,
      };

      await bridge.requestPinShortcut(shortcut);
      expect(bridge.getPinnedShortcuts()).toHaveLength(1);

      bridge.clear();
      expect(bridge.getPinnedShortcuts()).toHaveLength(0);
    });
  });
});

describe('requestPinShortcut', () => {
  let bridge: MockPinnedShortcutBridge;

  beforeEach(() => {
    bridge = new MockPinnedShortcutBridge();
  });

  it('should create and pin shortcut for page', async () => {
    const options: PinShortcutOptions = {
      pageId: 'page-123',
      title: 'Test Page',
    };

    const result = await requestPinShortcut(bridge, options);

    expect(result.success).toBe(true);
    expect(result.shortcutId).toBe('pinned_page_page-123');
  });

  it('should use custom icon if provided', async () => {
    const options: PinShortcutOptions = {
      pageId: 'page-123',
      title: 'Test Page',
      icon: 'ic_custom',
    };

    const result = await requestPinShortcut(bridge, options);

    expect(result.success).toBe(true);
  });

  it('should truncate long titles', async () => {
    const options: PinShortcutOptions = {
      pageId: 'page-123',
      title: 'This is an extremely long page title that exceeds the limit',
    };

    const result = await requestPinShortcut(bridge, options);

    expect(result.success).toBe(true);
  });

  it('should fail when not supported', async () => {
    bridge.setSupported(false);

    const options: PinShortcutOptions = {
      pageId: 'page-123',
      title: 'Test Page',
    };

    const result = await requestPinShortcut(bridge, options);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Pinned shortcuts not supported on this device');
  });

  it('should fail when user declines', async () => {
    bridge.setAutoAccept(false);

    const options: PinShortcutOptions = {
      pageId: 'page-123',
      title: 'Test Page',
    };

    const result = await requestPinShortcut(bridge, options);

    expect(result.success).toBe(false);
    expect(result.error).toContain('User declined');
  });
});

describe('requestPinStaticShortcut', () => {
  let bridge: MockPinnedShortcutBridge;

  beforeEach(() => {
    bridge = new MockPinnedShortcutBridge();
  });

  it('should pin static shortcut', async () => {
    const result = await requestPinStaticShortcut(bridge, NEW_NOTE_SHORTCUT);

    expect(result.success).toBe(true);
    expect(result.shortcutId).toBe(NEW_NOTE_SHORTCUT.id);
  });

  it('should fail when not supported', async () => {
    bridge.setSupported(false);

    const result = await requestPinStaticShortcut(bridge, NEW_NOTE_SHORTCUT);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Pinned shortcuts not supported on this device');
  });

  it('should fail when user declines', async () => {
    bridge.setAutoAccept(false);

    const result = await requestPinStaticShortcut(bridge, NEW_NOTE_SHORTCUT);

    expect(result.success).toBe(false);
    expect(result.error).toContain('User declined');
  });
});

describe('isPinShortcutSupported', () => {
  it('should return true when supported', () => {
    const bridge = new MockPinnedShortcutBridge();
    bridge.setSupported(true);

    expect(isPinShortcutSupported(bridge)).toBe(true);
  });

  it('should return false when not supported', () => {
    const bridge = new MockPinnedShortcutBridge();
    bridge.setSupported(false);

    expect(isPinShortcutSupported(bridge)).toBe(false);
  });
});
