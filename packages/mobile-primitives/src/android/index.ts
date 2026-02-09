/**
 * Android platform utilities.
 *
 * Provides Android-specific functionality including:
 * - Share intents (receiving shares from other apps)
 * - Share sheet integration (sharing from the app)
 * - Content parsing and validation
 * - Direct share targets
 *
 * All Android exports are namespaced to avoid conflicts with iOS.
 * Import via destructuring with 'Android' prefix:
 * ```typescript
 * import { AndroidShareContentType, useAndroidShareIntent } from '@double-bind/mobile-primitives';
 * ```
 */

// =============================================================================
// TYPES - With Android prefix to avoid iOS conflicts
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
