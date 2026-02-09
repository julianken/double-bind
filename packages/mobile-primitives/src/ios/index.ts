/**
 * iOS Sharing Utilities
 *
 * Provides iOS-specific sharing functionality including share extensions,
 * share sheet integration, and content processing.
 */

// Types
export { ShareContentType } from './types';
export type {
  ShareOptions,
  ShareResult,
  SharedContent,
  ParseOptions,
  ValidationResult,
} from './types';

// Share Extension utilities
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
