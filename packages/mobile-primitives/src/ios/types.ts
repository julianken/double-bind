/**
 * iOS platform types.
 *
 * Type definitions for keyboard handling and sharing functionality.
 */

// =============================================================================
// KEYBOARD TYPES
// =============================================================================

/**
 * Keyboard visibility state.
 */
export interface KeyboardState {
  /** Whether keyboard is currently visible */
  isVisible: boolean;

  /** Current keyboard height in pixels */
  height: number;

  /** Keyboard animation duration in milliseconds */
  duration: number;

  /** Animation easing curve */
  easing: 'easeIn' | 'easeOut' | 'easeInOut' | 'linear' | 'keyboard';

  /** End coordinates of keyboard */
  endCoordinates: {
    screenX: number;
    screenY: number;
    width: number;
    height: number;
  };
}

/**
 * Keyboard event data from React Native.
 */
export interface KeyboardEvent {
  /** Keyboard animation duration in seconds */
  duration: number;

  /** Animation easing curve (iOS specific) */
  easing: string;

  /** End coordinates of keyboard frame */
  endCoordinates: {
    screenX: number;
    screenY: number;
    width: number;
    height: number;
  };

  /** Start coordinates (for dismiss events) */
  startCoordinates?: {
    screenX: number;
    screenY: number;
    width: number;
    height: number;
  };
}

/**
 * Hardware keyboard detection state.
 */
export interface HardwareKeyboardState {
  /** Whether hardware keyboard is connected */
  isConnected: boolean;

  /** Whether hardware keyboard is in use */
  isActive: boolean;

  /** Last detected at timestamp */
  lastDetectedAt: number | null;
}

/**
 * Options for useKeyboard hook.
 */
export interface UseKeyboardOptions {
  /** Whether to automatically track keyboard state */
  enabled?: boolean;

  /** Callback when keyboard shows */
  onShow?: (state: KeyboardState) => void;

  /** Callback when keyboard hides */
  onHide?: (state: KeyboardState) => void;

  /** Callback when keyboard height changes */
  onHeightChange?: (height: number) => void;

  /** Callback when hardware keyboard is detected */
  onHardwareKeyboardDetected?: (isConnected: boolean) => void;
}

/**
 * Result of useKeyboard hook.
 */
export interface UseKeyboardResult {
  /** Current keyboard state */
  keyboardState: KeyboardState;

  /** Hardware keyboard state */
  hardwareKeyboard: HardwareKeyboardState;

  /** Manually dismiss keyboard */
  dismiss: () => void;

  /** Whether keyboard is currently animating */
  isAnimating: boolean;
}

/**
 * Input accessory toolbar button configuration.
 */
export interface AccessoryButton {
  /** Unique button identifier */
  id: string;

  /** Button label text */
  label: string;

  /** Icon name (optional) */
  icon?: string;

  /** Button action handler */
  onPress: () => void;

  /** Whether button is disabled */
  disabled?: boolean;

  /** Whether button is highlighted/active */
  highlighted?: boolean;
}

/**
 * Input accessory view configuration.
 */
export interface InputAccessoryViewProps {
  /** Unique identifier for the accessory view */
  nativeID: string;

  /** Toolbar buttons (left side) */
  leftButtons?: AccessoryButton[];

  /** Toolbar buttons (right side) */
  rightButtons?: AccessoryButton[];

  /** Whether to show done button */
  showDoneButton?: boolean;

  /** Done button label (default: "Done") */
  doneButtonLabel?: string;

  /** Callback when done button is pressed */
  onDone?: () => void;

  /** Background color */
  backgroundColor?: string;

  /** Button tint color */
  tintColor?: string;
}

/**
 * Keyboard behavior types for KeyboardAvoidingView.
 */
export type KeyboardBehavior = 'height' | 'position' | 'padding';

/**
 * Props for KeyboardAvoidingView component.
 */
export interface KeyboardAvoidingViewProps {
  /** Child elements */
  children: React.ReactNode;

  /** Keyboard avoidance behavior */
  behavior?: KeyboardBehavior;

  /** Additional offset above keyboard */
  keyboardVerticalOffset?: number;

  /** Whether component is enabled */
  enabled?: boolean;

  /** Custom styles */
  style?: object;

  /** Content container styles */
  contentContainerStyle?: object;

  /** Whether to show scroll indicator */
  showsVerticalScrollIndicator?: boolean;

  /** Ref to underlying ScrollView (when using 'position' behavior) */
  scrollViewRef?: React.RefObject<unknown>;
}

// =============================================================================
// SHARING TYPES
// =============================================================================

/**
 * Types of content that can be shared
 */
export enum ShareContentType {
  /** Plain text content */
  Text = 'text',
  /** URL/link content */
  URL = 'url',
  /** Image content (placeholder for future) */
  Image = 'image',
}

/**
 * Options for sharing content
 */
export interface ShareOptions {
  /** Optional title for the share */
  title?: string;
  /** Whether to preserve wiki links in the content */
  preserveWikiLinks?: boolean;
  /** Whether to convert content to markdown */
  asMarkdown?: boolean;
}

/**
 * Result of a share operation
 */
export interface ShareResult {
  /** Whether the share was successful */
  success: boolean;
  /** Error message if share failed */
  error?: string;
  /** The share action taken (e.g., 'saved', 'copied', 'cancelled') */
  action?: 'saved' | 'copied' | 'cancelled' | 'shared';
}

/**
 * Content received from iOS share extension
 */
export interface SharedContent {
  /** Type of the shared content */
  type: ShareContentType;
  /** The raw content */
  content: string;
  /** Optional title extracted from shared content */
  title?: string;
  /** Optional URL if content is a link */
  url?: string;
  /** Optional source application */
  sourceApp?: string;
  /** Timestamp when content was received */
  receivedAt: number;
}

/**
 * Options for parsing shared content
 */
export interface ParseOptions {
  /** Whether to extract URLs from text */
  extractUrls?: boolean;
  /** Whether to detect and preserve wiki links */
  preserveWikiLinks?: boolean;
  /** Maximum length for parsed content (for truncation) */
  maxLength?: number;
}

/**
 * Validation result for shared content
 */
export interface ValidationResult {
  /** Whether the content is valid */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Sanitized content (if validation passed) */
  sanitized?: string;
}
