/**
 * iOS platform utilities.
 *
 * Provides iOS-specific functionality including:
 * - Keyboard avoidance and input accessory toolbar
 * - Share extensions and share sheet integration
 */

// Keyboard handling
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

// Share Extension utilities
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
