/**
 * iOS Sharing Types
 *
 * TypeScript types for iOS share extension and share sheet functionality.
 */

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
