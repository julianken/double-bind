/**
 * ShortcutTypes.ts - TypeScript types for Android app shortcuts
 *
 * Provides type definitions for Android app shortcuts including
 * static, dynamic, and pinned shortcuts with support for intents and actions.
 */

import type { PageId } from '@double-bind/types';

/**
 * Android shortcut types
 * Static: Defined in manifest, always available
 * Dynamic: Managed at runtime, limited to 4-5 per app
 * Pinned: User-placed on home screen, requires confirmation
 */
export enum ShortcutType {
  Static = 'static',
  Dynamic = 'dynamic',
  Pinned = 'pinned',
}

/**
 * Supported shortcut actions
 */
export enum ShortcutAction {
  NewNote = 'newNote',
  DailyNote = 'dailyNote',
  Search = 'search',
  OpenPage = 'openPage',
}

/**
 * Android shortcut interface
 * Maps to Android ShortcutInfo
 */
export interface Shortcut {
  /**
   * Unique identifier for the shortcut
   * Must be unique across all shortcuts in the app
   */
  id: string;

  /**
   * Short label displayed with the icon
   * Max 10 characters recommended
   */
  shortLabel: string;

  /**
   * Long label for expanded view
   * Max 25 characters recommended
   */
  longLabel: string;

  /**
   * Icon resource name or URI
   * For static: drawable resource name (e.g., "ic_shortcut_new_note")
   * For dynamic/pinned: can be adaptive icon bitmap
   */
  icon: string;

  /**
   * Shortcut action to perform
   */
  action: ShortcutAction;

  /**
   * Optional payload data for the action
   */
  payload?: {
    pageId?: PageId;
    pageName?: string;
    content?: string;
  };

  /**
   * Rank for ordering (0 = highest priority)
   * Used by launcher to determine display order
   */
  rank: number;

  /**
   * Whether shortcut is enabled
   * Disabled shortcuts appear grayed out
   */
  enabled: boolean;
}

/**
 * Shortcut intent data
 * Passed to Android via Intent extras
 */
export interface ShortcutIntent {
  /**
   * Action identifier
   */
  action: string;

  /**
   * Intent extras data
   */
  data: Record<string, string | number | boolean>;

  /**
   * Optional categories
   */
  categories?: string[];
}

/**
 * Result from shortcut operations
 */
export interface ShortcutResult {
  /**
   * Whether operation succeeded
   */
  success: boolean;

  /**
   * Error message if operation failed
   */
  error?: string;

  /**
   * Shortcut ID if operation succeeded
   */
  shortcutId?: string;
}

/**
 * Shortcut launch event
 * Received when user taps a shortcut
 */
export interface ShortcutLaunchEvent {
  /**
   * Shortcut ID that was tapped
   */
  shortcutId: string;

  /**
   * Shortcut action
   */
  action: ShortcutAction;

  /**
   * Optional payload data
   */
  payload?: {
    pageId?: PageId;
    pageName?: string;
    content?: string;
  };

  /**
   * Timestamp when shortcut was launched (milliseconds)
   */
  timestamp: number;
}
