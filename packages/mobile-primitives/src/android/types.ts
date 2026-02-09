/**
 * Android platform types.
 *
 * Type definitions for Android back button handling and gesture navigation.
 */

// =============================================================================
// BACK HANDLER TYPES
// =============================================================================

/**
 * Handler function for back button press.
 * Return true to consume the event, false to pass through to the system.
 */
export type BackHandler = () => boolean;

/**
 * Priority levels for back handler registration.
 * Higher priority handlers are executed first.
 */
export enum BackHandlerPriority {
  /** Modal/dialog level (highest priority) */
  Modal = 100,
  /** Page/screen level */
  Page = 50,
  /** Root/app level (lowest priority) */
  Root = 0,
}

/**
 * Options for useBackHandler hook.
 */
export interface UseBackHandlerOptions {
  /** Whether the handler is enabled */
  enabled?: boolean;

  /** Priority level for this handler */
  priority?: BackHandlerPriority;

  /** Handler function */
  handler: BackHandler;
}

// =============================================================================
// EXIT CONFIRMATION TYPES
// =============================================================================

/**
 * Options for exit confirmation.
 */
export interface ExitConfirmationOptions {
  /** Whether exit confirmation is enabled */
  enabled?: boolean;

  /** Confirmation message to show */
  message?: string;

  /** Timeout between taps in milliseconds (default: 2000) */
  timeout?: number;

  /** Callback when user confirms exit */
  onConfirmExit?: () => void;

  /** Callback when first back press is detected */
  onFirstPress?: () => void;
}

/**
 * Result of useExitConfirmation hook.
 */
export interface UseExitConfirmationResult {
  /** Whether user has pressed back once (waiting for second press) */
  isPendingExit: boolean;

  /** Manually trigger exit confirmation */
  triggerExitConfirmation: () => void;

  /** Reset exit confirmation state */
  resetExitConfirmation: () => void;
}

// =============================================================================
// KEYBOARD DISMISSAL TYPES
// =============================================================================

/**
 * Options for keyboard dismissal on back press.
 */
export interface KeyboardDismissalOptions {
  /** Whether keyboard dismissal is enabled */
  enabled?: boolean;

  /** Priority level (should be higher than page handlers) */
  priority?: BackHandlerPriority;

  /** Callback when keyboard is dismissed */
  onDismiss?: () => void;
}

// =============================================================================
// GESTURE NAVIGATION TYPES
// =============================================================================

/**
 * Back gesture progress state.
 */
export interface BackGestureProgress {
  /** Gesture progress from 0 to 1 */
  progress: number;

  /** Whether gesture is active */
  isActive: boolean;

  /** Start X position of the gesture */
  startX: number;

  /** Current X position of the gesture */
  currentX: number;
}

/**
 * Options for gesture navigation.
 */
export interface GestureNavigationOptions {
  /** Whether gesture navigation is enabled */
  enabled?: boolean;

  /** Edge sensitivity in pixels (default: 20) */
  edgeSensitivity?: number;

  /** Threshold to trigger navigation (0-1, default: 0.3) */
  threshold?: number;

  /** Callback when gesture starts */
  onGestureStart?: () => void;

  /** Callback during gesture progress */
  onGestureProgress?: (progress: BackGestureProgress) => void;

  /** Callback when gesture completes (triggers navigation) */
  onGestureComplete?: () => void;

  /** Callback when gesture is cancelled */
  onGestureCancel?: () => void;
}

/**
 * Result of useGestureNavigation hook.
 */
export interface UseGestureNavigationResult {
  /** Current gesture progress state */
  gestureProgress: BackGestureProgress;

  /** Whether predictive back gesture is supported (Android 13+) */
  isPredictiveBackSupported: boolean;

  /** Manually trigger back navigation */
  triggerBack: () => void;
}
