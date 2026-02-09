/**
 * iOS keyboard handling utilities.
 *
 * Provides keyboard avoidance, input accessory toolbar, keyboard state tracking,
 * and hardware keyboard detection for iOS platform.
 */

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
