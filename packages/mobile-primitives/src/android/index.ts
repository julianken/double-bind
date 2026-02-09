/**
 * Android platform utilities.
 *
 * Provides Android-specific functionality including:
 * - App shortcuts (static, dynamic, and pinned)
 * - Shortcut management and LRU eviction
 * - Native bridge integration
 */

// =============================================================================
// SHORTCUT TYPES
// =============================================================================

export {
  ShortcutType,
  ShortcutAction,
  type Shortcut,
  type ShortcutIntent,
  type ShortcutResult,
  type ShortcutLaunchEvent,
} from './ShortcutTypes';

// =============================================================================
// STATIC SHORTCUTS
// =============================================================================

export {
  STATIC_SHORTCUT_IDS,
  NEW_NOTE_SHORTCUT,
  DAILY_NOTE_SHORTCUT,
  SEARCH_SHORTCUT,
  STATIC_SHORTCUTS,
  shortcutToIntent,
  getStaticShortcut,
  isStaticShortcut,
} from './StaticShortcuts';

// =============================================================================
// DYNAMIC SHORTCUTS
// =============================================================================

export {
  MAX_DYNAMIC_SHORTCUTS,
  DynamicShortcutManager,
  createDynamicShortcut,
  type RecentPage,
} from './DynamicShortcuts';

// =============================================================================
// PINNED SHORTCUTS
// =============================================================================

export {
  requestPinShortcut,
  requestPinStaticShortcut,
  isPinShortcutSupported,
  MockPinnedShortcutBridge,
  type PinShortcutOptions,
  type PinShortcutCallback,
  type PinnedShortcutBridge,
} from './PinnedShortcuts';

// =============================================================================
// SHORTCUT BRIDGE
// =============================================================================

export {
  useShortcutBridge,
  MockShortcutBridge,
  type ShortcutBridge,
  type ShortcutLaunchHandler,
  type UseShortcutBridgeOptions,
  type UseShortcutBridgeResult,
} from './ShortcutBridge';
