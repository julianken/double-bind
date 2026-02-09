/**
 * PinnedShortcuts.ts - Pinned shortcut support for Android
 *
 * Manages pinned shortcuts that users can add to their home screen.
 * Requires user confirmation via system dialog.
 * Available on Android 8.0 (API 26) and above.
 */

import type { PageId } from '@double-bind/types';
import { ShortcutAction, type Shortcut, type ShortcutResult } from './ShortcutTypes';

/**
 * Pinned shortcut options
 */
export interface PinShortcutOptions {
  /**
   * Page to create shortcut for
   */
  pageId: PageId;

  /**
   * Page title
   */
  title: string;

  /**
   * Optional icon (defaults to app icon)
   */
  icon?: string;
}

/**
 * Pin shortcut callback result
 */
export interface PinShortcutCallback {
  /**
   * Whether user accepted the pin request
   */
  accepted: boolean;

  /**
   * Shortcut ID if accepted
   */
  shortcutId?: string;

  /**
   * Error message if operation failed
   */
  error?: string;
}

/**
 * Pinned shortcut bridge interface
 * Implemented by native Android module
 */
export interface PinnedShortcutBridge {
  /**
   * Check if pinned shortcuts are supported
   * Requires Android 8.0+ and launcher support
   */
  isSupported(): boolean;

  /**
   * Request to pin a shortcut
   * Shows system dialog for user confirmation
   */
  requestPinShortcut(shortcut: Shortcut): Promise<PinShortcutCallback>;

  /**
   * Check if a shortcut is already pinned
   * Note: This may not be reliable on all devices
   */
  isPinned(shortcutId: string): Promise<boolean>;
}

/**
 * Request to pin a shortcut for a page
 * User must confirm via system dialog
 */
export async function requestPinShortcut(
  bridge: PinnedShortcutBridge,
  options: PinShortcutOptions
): Promise<ShortcutResult> {
  if (!bridge.isSupported()) {
    return {
      success: false,
      error: 'Pinned shortcuts not supported on this device',
    };
  }

  const shortcut: Shortcut = {
    id: `pinned_page_${options.pageId}`,
    shortLabel: truncateLabel(options.title, 10),
    longLabel: truncateLabel(options.title, 25),
    icon: options.icon || 'ic_launcher',
    action: ShortcutAction.OpenPage,
    payload: {
      pageId: options.pageId,
      pageName: options.title,
    },
    rank: 0,
    enabled: true,
  };

  try {
    const result = await bridge.requestPinShortcut(shortcut);

    if (result.accepted) {
      return {
        success: true,
        shortcutId: result.shortcutId || shortcut.id,
      };
    } else {
      return {
        success: false,
        error: result.error || 'User declined pin request',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pin shortcut',
    };
  }
}

/**
 * Create a pinned shortcut from static shortcut
 * Useful for pinning New Note, Daily Note, or Search shortcuts
 */
export async function requestPinStaticShortcut(
  bridge: PinnedShortcutBridge,
  shortcut: Shortcut
): Promise<ShortcutResult> {
  if (!bridge.isSupported()) {
    return {
      success: false,
      error: 'Pinned shortcuts not supported on this device',
    };
  }

  try {
    const result = await bridge.requestPinShortcut(shortcut);

    if (result.accepted) {
      return {
        success: true,
        shortcutId: result.shortcutId || shortcut.id,
      };
    } else {
      return {
        success: false,
        error: result.error || 'User declined pin request',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pin shortcut',
    };
  }
}

/**
 * Check if pinned shortcuts are supported
 */
export function isPinShortcutSupported(bridge: PinnedShortcutBridge): boolean {
  return bridge.isSupported();
}

/**
 * Truncate label to max length
 */
function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) {
    return label;
  }
  return label.slice(0, maxLength - 1) + '…';
}

/**
 * Mock implementation of PinnedShortcutBridge for testing
 */
export class MockPinnedShortcutBridge implements PinnedShortcutBridge {
  private supported = true;
  private pinnedShortcuts: Set<string> = new Set();
  private autoAccept = true;

  isSupported(): boolean {
    return this.supported;
  }

  async requestPinShortcut(shortcut: Shortcut): Promise<PinShortcutCallback> {
    if (!this.supported) {
      return {
        accepted: false,
        error: 'Not supported',
      };
    }

    if (this.autoAccept) {
      this.pinnedShortcuts.add(shortcut.id);
      return {
        accepted: true,
        shortcutId: shortcut.id,
      };
    }

    return {
      accepted: false,
      error: 'User declined',
    };
  }

  async isPinned(shortcutId: string): Promise<boolean> {
    return this.pinnedShortcuts.has(shortcutId);
  }

  // Test utilities
  setSupported(supported: boolean): void {
    this.supported = supported;
  }

  setAutoAccept(autoAccept: boolean): void {
    this.autoAccept = autoAccept;
  }

  getPinnedShortcuts(): string[] {
    return Array.from(this.pinnedShortcuts);
  }

  clear(): void {
    this.pinnedShortcuts.clear();
  }
}
