/**
 * ShareIntent - Receive share intents from Android
 *
 * Provides utilities for handling content received from Android share intents,
 * including ACTION_SEND and ACTION_SEND_MULTIPLE support.
 */

import { useEffect, useState, useCallback } from 'react';
import type { SharedContent } from './types';
import { ShareIntentAction, ShareMimeType } from './types';
import { parseSharedContent } from './ContentParser';

/**
 * Android share intent data structure
 */
export interface ShareIntentData {
  /** Intent action (SEND or SEND_MULTIPLE) */
  action: ShareIntentAction;
  /** MIME type */
  type: string;
  /** Text content (for text/plain and text/html) */
  text?: string;
  /** HTML content (for text/html) */
  htmlText?: string;
  /** URL/URI content */
  url?: string;
  /** Subject/title */
  subject?: string;
  /** Source application package name */
  sourceApp?: string;
  /** Image URIs (for image shares) */
  imageUris?: string[];
}

/**
 * Mock Android share intent bridge for testing
 */
export interface ShareIntentBridge {
  /** Get the current share intent data */
  getInitialIntent: () => Promise<ShareIntentData | null>;
  /** Clear the current intent */
  clearIntent: () => Promise<void>;
  /** Listen for new share intents */
  addListener: (callback: (intent: ShareIntentData) => void) => () => void;
}

/**
 * Default mock implementation for testing
 */
let shareIntentBridge: ShareIntentBridge | null = null;

/**
 * Set the share intent bridge implementation
 * This allows injection of the react-native module in production
 * or a mock implementation in tests
 */
export function setShareIntentBridge(bridge: ShareIntentBridge): void {
  shareIntentBridge = bridge;
}

/**
 * Hook result for useShareIntent
 */
export interface UseShareIntentResult {
  /** Current shared content */
  content: SharedContent | null;
  /** Whether content is being loaded */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Clear the current shared content */
  clearContent: () => void;
  /** Manually trigger intent check */
  checkIntent: () => Promise<void>;
}

/**
 * Hook for receiving share intents from Android
 *
 * Automatically checks for share intents on mount and listens for new intents.
 * Parses the intent data into structured SharedContent.
 *
 * @returns Methods and state for handling share intents
 *
 * @example
 * ```tsx
 * function ShareReceiverScreen() {
 *   const { content, isLoading, clearContent } = useShareIntent();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (!content) return <NoShareContent />;
 *
 *   return (
 *     <View>
 *       <Text>{content.content}</Text>
 *       <Button onPress={clearContent}>Done</Button>
 *     </View>
 *   );
 * }
 * ```
 */
export function useShareIntent(): UseShareIntentResult {
  const [content, setContent] = useState<SharedContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Parse intent data into SharedContent
   */
  const parseIntent = useCallback((intent: ShareIntentData): SharedContent | null => {
    try {
      // Determine the content to parse
      let rawContent = '';
      let mimeType = intent.type || ShareMimeType.TEXT_PLAIN;

      if (intent.htmlText) {
        rawContent = intent.htmlText;
        mimeType = ShareMimeType.TEXT_HTML;
      } else if (intent.text) {
        rawContent = intent.text;
      } else if (intent.url) {
        rawContent = intent.url;
      }

      // Parse image intents
      if (intent.imageUris && intent.imageUris.length > 0) {
        const parsed = parseSharedContent(
          `Shared ${intent.imageUris.length} image(s)`,
          ShareMimeType.IMAGE_ANY
        );
        return {
          ...parsed,
          imageUris: intent.imageUris,
          title: intent.subject,
          sourceApp: intent.sourceApp,
        };
      }

      // Parse text/HTML content
      if (rawContent) {
        const parsed = parseSharedContent(rawContent, mimeType, {
          extractUrls: true,
          convertHtml: mimeType === ShareMimeType.TEXT_HTML,
        });

        return {
          ...parsed,
          title: intent.subject || parsed.title,
          sourceApp: intent.sourceApp,
        };
      }

      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error parsing intent';
      setError(errorMessage);
      return null;
    }
  }, []);

  /**
   * Check for share intent
   */
  const checkIntent = useCallback(async () => {
    if (!shareIntentBridge) {
      setIsLoading(false);
      setError('Share intent bridge not available. Call setShareIntentBridge() first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const intent = await shareIntentBridge.getInitialIntent();

      if (intent) {
        const parsed = parseIntent(intent);
        setContent(parsed);
        // Clear the intent so it doesn't get processed again
        await shareIntentBridge.clearIntent();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [parseIntent]);

  /**
   * Clear the current shared content
   */
  const clearContent = useCallback(() => {
    setContent(null);
    setError(null);
  }, []);

  // Check for initial intent on mount
  useEffect(() => {
    checkIntent();
  }, [checkIntent]);

  // Listen for new share intents
  useEffect(() => {
    if (!shareIntentBridge) return;

    const unsubscribe = shareIntentBridge.addListener((intent) => {
      const parsed = parseIntent(intent);
      setContent(parsed);
    });

    return unsubscribe;
  }, [parseIntent]);

  return {
    content,
    isLoading,
    error,
    clearContent,
    checkIntent,
  };
}

/**
 * Parse ACTION_SEND intent
 *
 * Helper function to parse a single-item share intent.
 *
 * @param intent - The share intent data
 * @returns Parsed SharedContent or null
 */
export function parseActionSend(intent: ShareIntentData): SharedContent | null {
  if (intent.action !== ShareIntentAction.SEND) {
    return null;
  }

  const rawContent = intent.htmlText || intent.text || intent.url || '';
  const mimeType = intent.type || ShareMimeType.TEXT_PLAIN;

  return parseSharedContent(rawContent, mimeType, {
    extractUrls: true,
    convertHtml: mimeType === ShareMimeType.TEXT_HTML,
  });
}

/**
 * Parse ACTION_SEND_MULTIPLE intent
 *
 * Helper function to parse a multi-item share intent.
 * Currently returns the first item only.
 *
 * @param intent - The share intent data
 * @returns Parsed SharedContent or null
 */
export function parseActionSendMultiple(intent: ShareIntentData): SharedContent | null {
  if (intent.action !== ShareIntentAction.SEND_MULTIPLE) {
    return null;
  }

  // For now, handle multiple images
  if (intent.imageUris && intent.imageUris.length > 0) {
    const parsed = parseSharedContent(
      `Shared ${intent.imageUris.length} image(s)`,
      ShareMimeType.IMAGE_ANY
    );

    return {
      ...parsed,
      imageUris: intent.imageUris,
      title: intent.subject,
      sourceApp: intent.sourceApp,
    };
  }

  return null;
}
