/**
 * StaticShortcuts.ts - Static shortcut definitions for Android
 *
 * Provides pre-defined static shortcuts for common actions.
 * Static shortcuts are defined in AndroidManifest.xml but can be
 * managed and updated via ShortcutManager API.
 */

import { ShortcutAction, type Shortcut, type ShortcutIntent } from './ShortcutTypes';

/**
 * Static shortcut IDs
 * Must match IDs in AndroidManifest.xml
 */
export const STATIC_SHORTCUT_IDS = {
  NEW_NOTE: 'shortcut_new_note',
  DAILY_NOTE: 'shortcut_daily_note',
  SEARCH: 'shortcut_search',
} as const;

/**
 * New Note shortcut
 * Creates a new untitled note
 */
export const NEW_NOTE_SHORTCUT: Shortcut = {
  id: STATIC_SHORTCUT_IDS.NEW_NOTE,
  shortLabel: 'New Note',
  longLabel: 'Create New Note',
  icon: 'ic_shortcut_new_note',
  action: ShortcutAction.NewNote,
  rank: 0,
  enabled: true,
};

/**
 * Daily Note shortcut
 * Opens or creates today's daily note
 */
export const DAILY_NOTE_SHORTCUT: Shortcut = {
  id: STATIC_SHORTCUT_IDS.DAILY_NOTE,
  shortLabel: 'Daily Note',
  longLabel: "Open Today's Note",
  icon: 'ic_shortcut_daily_note',
  action: ShortcutAction.DailyNote,
  rank: 1,
  enabled: true,
};

/**
 * Search shortcut
 * Opens search interface
 */
export const SEARCH_SHORTCUT: Shortcut = {
  id: STATIC_SHORTCUT_IDS.SEARCH,
  shortLabel: 'Search',
  longLabel: 'Search Notes',
  icon: 'ic_shortcut_search',
  action: ShortcutAction.Search,
  rank: 2,
  enabled: true,
};

/**
 * All static shortcuts in display order
 */
export const STATIC_SHORTCUTS: readonly Shortcut[] = [
  NEW_NOTE_SHORTCUT,
  DAILY_NOTE_SHORTCUT,
  SEARCH_SHORTCUT,
] as const;

/**
 * Convert shortcut to intent data
 * Used by native Android bridge
 */
export function shortcutToIntent(shortcut: Shortcut): ShortcutIntent {
  return {
    action: `com.doublebind.${shortcut.action}`,
    data: {
      shortcutId: shortcut.id,
      action: shortcut.action,
      ...(shortcut.payload || {}),
    },
    categories: ['android.shortcut.conversation'],
  };
}

/**
 * Get static shortcut by ID
 */
export function getStaticShortcut(id: string): Shortcut | undefined {
  return STATIC_SHORTCUTS.find((s) => s.id === id);
}

/**
 * Check if shortcut ID is a static shortcut
 */
export function isStaticShortcut(id: string): boolean {
  return Object.values(STATIC_SHORTCUT_IDS).includes(
    id as (typeof STATIC_SHORTCUT_IDS)[keyof typeof STATIC_SHORTCUT_IDS]
  );
}
