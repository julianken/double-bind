/**
 * Android platform utilities.
 *
 * Provides Android-specific functionality including:
 * - Back button handling with priority system
 * - Exit confirmation (double-tap to exit)
 * - Keyboard dismissal on back press
 * - Gesture navigation support (Android 13+ predictive back)
 * - Share intents (receiving shares from other apps)
 * - Share sheet integration (sharing from the app)
 * - Content parsing and validation
 * - Direct share targets
 * - Home screen widgets (Recent Notes, Quick Capture, Daily Note)
 * - Widget configuration and appearance settings
 * - App shortcuts (static, dynamic, and pinned)
 */

// =============================================================================
// BACK HANDLER
// =============================================================================

export { useBackHandler, exitApp, getHandlerCount, clearAllHandlers } from './BackHandler';
export { BackHandlerPriority } from './types';
export type { BackHandler, UseBackHandlerOptions } from './types';

// =============================================================================
// EXIT CONFIRMATION
// =============================================================================

export { useExitConfirmation } from './ExitConfirmation';
export type { ExitConfirmationOptions, UseExitConfirmationResult } from './types';

// =============================================================================
// KEYBOARD DISMISSAL
// =============================================================================

export { useKeyboardDismissal, isKeyboardVisible } from './KeyboardDismissal';
export type { KeyboardDismissalOptions } from './types';

// =============================================================================
// GESTURE NAVIGATION
// =============================================================================

export { useGestureNavigation, MockGestureNavigationBridge } from './GestureNavigation';
export type {
  GestureNavigationOptions,
  UseGestureNavigationResult,
  BackGestureProgress,
} from './types';

// =============================================================================
// SHARING TYPES - With Android prefix to avoid iOS conflicts
// =============================================================================

export {
  ShareContentType as AndroidShareContentType,
  ShareIntentAction as AndroidShareIntentAction,
  ShareMimeType as AndroidShareMimeType,
  type ShareOptions as AndroidShareOptions,
  type ShareResult as AndroidShareResult,
  type SharedContent as AndroidSharedContent,
  type ParseOptions as AndroidParseOptions,
  type ValidationResult as AndroidValidationResult,
  type DirectShareTarget,
  type DirectShareServiceConfig,
} from './types';

// =============================================================================
// SHARE INTENTS (Receiving)
// =============================================================================

export {
  useShareIntent as useAndroidShareIntent,
  setShareIntentBridge as setAndroidShareIntentBridge,
  parseActionSend as parseAndroidActionSend,
  parseActionSendMultiple as parseAndroidActionSendMultiple,
  type ShareIntentData as AndroidShareIntentData,
  type ShareIntentBridge as AndroidShareIntentBridge,
  type UseShareIntentResult as UseAndroidShareIntentResult,
} from './ShareIntent';

// =============================================================================
// SHARE SHEET (Sharing)
// =============================================================================

export {
  useShareSheet as useAndroidShareSheet,
  setShareAPI as setAndroidShareAPI,
  shareTextContent as shareAndroidTextContent,
  shareUrlContent as shareAndroidUrlContent,
  type ShareAPI as AndroidShareAPI,
  type UseShareSheetResult as UseAndroidShareSheetResult,
} from './ShareSheet';

// =============================================================================
// CONTENT PARSER
// =============================================================================

export {
  parseSharedContent as parseAndroidSharedContent,
  validateShareContent as validateAndroidShareContent,
  extractWikiLinks as extractAndroidWikiLinks,
  htmlToMarkdown as androidHtmlToMarkdown,
  convertToMarkdown as convertAndroidToMarkdown,
  detectContentType as detectAndroidContentType,
} from './ContentParser';

// =============================================================================
// DIRECT SHARE
// =============================================================================

export {
  DirectShareService as AndroidDirectShareService,
  setDirectShareBridge as setAndroidDirectShareBridge,
  createTargetsFromNotes as createAndroidTargetsFromNotes,
  createTargetsFromPages as createAndroidTargetsFromPages,
  MockDirectShareBridge as MockAndroidDirectShareBridge,
  type DirectShareBridge as AndroidDirectShareBridge,
} from './DirectShare';

// =============================================================================
// WIDGET TYPES
// =============================================================================

export {
  AndroidWidgetKind,
  AndroidWidgetSize,
  getMaxNotesForSize,
  type AndroidWidgetConfiguration,
  type AndroidWidgetOptions,
  type AndroidRecentNotesData,
  type AndroidQuickCaptureData,
  type AndroidDailyNoteData,
  type AndroidWidgetData,
  type AndroidWidgetUpdatePayload,
  type AndroidWidgetTapAction,
} from './WidgetTypes';

// =============================================================================
// WIDGET PROVIDER
// =============================================================================

export { AndroidWidgetProvider } from './WidgetProvider';

// =============================================================================
// WIDGET BRIDGE
// =============================================================================

export {
  useAndroidWidgetBridge,
  MockAndroidWidgetBridge,
  type AndroidWidgetBridge,
  type AndroidWidgetTapHandler,
  type UseAndroidWidgetBridgeOptions,
  type UseAndroidWidgetBridgeResult,
} from './WidgetBridge';

// =============================================================================
// WIDGET CONFIGURATION
// =============================================================================

export {
  InMemoryAndroidWidgetConfigStore,
  AndroidWidgetConfigManager,
  type AndroidWidgetConfigStore,
} from './WidgetConfiguration';

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
