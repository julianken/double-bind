/**
 * Android platform types.
 *
 * Type definitions for sharing functionality on Android.
 */

// =============================================================================
// SHARING TYPES
// =============================================================================

/**
 * Types of content that can be shared on Android
 */
export enum ShareContentType {
  /** Plain text content */
  Text = 'text',
  /** URL/link content */
  URL = 'url',
  /** Image content */
  Image = 'image',
  /** HTML content */
  HTML = 'html',
}

/**
 * Android share intent action types
 */
export enum ShareIntentAction {
  /** Single item share */
  SEND = 'android.intent.action.SEND',
  /** Multiple items share */
  SEND_MULTIPLE = 'android.intent.action.SEND_MULTIPLE',
}

/**
 * MIME types for Android sharing
 */
export enum ShareMimeType {
  /** Plain text */
  TEXT_PLAIN = 'text/plain',
  /** HTML */
  TEXT_HTML = 'text/html',
  /** Any image */
  IMAGE_ANY = 'image/*',
  /** PNG image */
  IMAGE_PNG = 'image/png',
  /** JPEG image */
  IMAGE_JPEG = 'image/jpeg',
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
  /** Chooser dialog title (Android-specific) */
  dialogTitle?: string;
  /** Apps to exclude from share menu (Android-specific) */
  excludedApps?: string[];
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
 * Content received from Android share intent
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
  /** Optional source application package name */
  sourceApp?: string;
  /** MIME type from intent */
  mimeType?: string;
  /** Timestamp when content was received */
  receivedAt: number;
  /** Optional image URIs for image shares */
  imageUris?: string[];
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
  /** Whether to convert HTML to markdown */
  convertHtml?: boolean;
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

/**
 * Direct share target configuration
 */
export interface DirectShareTarget {
  /** Unique target identifier */
  id: string;
  /** Display name */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Icon resource name */
  icon?: string;
  /** Target type (e.g., 'note', 'page') */
  type: 'note' | 'page';
  /** Ranking for target priority */
  rank?: number;
}

/**
 * Direct share service configuration
 */
export interface DirectShareServiceConfig {
  /** Maximum number of targets to provide */
  maxTargets?: number;
  /** Whether to include recent notes */
  includeRecentNotes?: boolean;
  /** Whether to include favorite pages */
  includeFavoritePages?: boolean;
}
