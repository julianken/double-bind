/**
 * Android platform utilities.
 *
 * Provides Android-specific functionality including:
 * - Back button handling with priority system
 * - Exit confirmation (double-tap to exit)
 * - Keyboard dismissal on back press
 * - Gesture navigation support (Android 13+ predictive back)
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
