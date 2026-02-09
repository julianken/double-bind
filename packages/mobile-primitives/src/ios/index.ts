/**
 * iOS platform utilities.
 *
 * Provides iOS-specific functionality including:
 * - Keyboard avoidance and input accessory toolbar
 * - Share extensions and share sheet integration
 * - Home screen widgets
 */

// =============================================================================
// KEYBOARD HANDLING
// =============================================================================

export { KeyboardAvoidingView } from './KeyboardAvoidingView';
export { InputAccessoryView } from './InputAccessoryView';
export { useKeyboard } from './useKeyboard';
export type {
  KeyboardState,
  KeyboardEvent,
  HardwareKeyboardState,
  UseKeyboardOptions,
  UseKeyboardResult,
  AccessoryButton,
  InputAccessoryViewProps,
  KeyboardBehavior,
  KeyboardAvoidingViewProps,
} from './types';

// =============================================================================
// SHARE EXTENSIONS
// =============================================================================

export { ShareContentType } from './types';
export type {
  ShareOptions,
  ShareResult,
  SharedContent,
  ParseOptions,
  ValidationResult,
} from './types';

export {
  parseSharedContent,
  validateShareContent,
  extractWikiLinks,
  convertToMarkdown,
} from './ShareExtension';

// Share Sheet hook
export { useShareSheet, setShareAPI, type UseShareSheetResult } from './useShareSheet';

// Share Receiver component and hook
export {
  ShareReceiver,
  useShareProcessor,
  type ShareReceiverProps,
  type NoteService,
  type ProcessingState,
  type ProcessingResult,
} from './ShareReceiver';

// =============================================================================
// WIDGETS
// =============================================================================

// Types
export {
  WidgetKind,
  WidgetSize,
  type WidgetConfiguration,
  type WidgetOptions,
  type RecentNotesData,
  type QuickCaptureData,
  type DailyNoteData,
  type WidgetData,
  type WidgetUpdatePayload,
  type WidgetTapAction,
} from './WidgetTypes';

// Data Provider
export {
  WidgetDataProvider,
  InMemoryWidgetConfigStore,
  type WidgetConfigStore,
} from './WidgetDataProvider';

// Widget Bridge Hook
export {
  useWidgetBridge,
  MockWidgetBridge,
  type WidgetBridge,
  type WidgetTapHandler,
  type UseWidgetBridgeOptions,
  type UseWidgetBridgeResult,
} from './useWidgetBridge';

// Widget Actions
export { WidgetActions, MockWidgetNavigator, type WidgetNavigator } from './WidgetActions';
