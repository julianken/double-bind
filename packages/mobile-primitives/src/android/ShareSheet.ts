/**
 * ShareSheet - Share content via Android share sheet
 *
 * Provides utilities for sharing content from the app using the native
 * Android share sheet (Intent.ACTION_CHOOSER).
 */

import { useCallback, useState } from 'react';
import type { ShareOptions, ShareResult } from './types';
import { convertToMarkdown, extractWikiLinks } from './ContentParser';

/**
 * Android Share API interface
 * Mirrors the react-native Share API but with Android-specific options
 */
export interface ShareAPI {
  share: (
    options: {
      message?: string;
      title?: string;
      url?: string;
    },
    dialogOptions?: {
      dialogTitle?: string;
      subject?: string;
      excludedActivityTypes?: string[];
    }
  ) => Promise<{ action: 'sharedAction' | 'dismissedAction' }>;
}

/**
 * Default Share API implementation
 * In a real React Native environment, this would be imported from 'react-native'
 */
let shareAPI: ShareAPI | null = null;

/**
 * Set the Share API implementation
 * This allows injection of the react-native Share module in production
 * or a mock implementation in tests
 */
export function setShareAPI(api: ShareAPI): void {
  shareAPI = api;
}

/**
 * Result returned by useShareSheet hook
 */
export interface UseShareSheetResult {
  /**
   * Share text content
   */
  shareText: (text: string, options?: ShareOptions) => Promise<ShareResult>;

  /**
   * Share URL
   */
  shareUrl: (url: string, options?: ShareOptions) => Promise<ShareResult>;

  /**
   * Share content with wiki links preserved
   */
  shareWithWikiLinks: (content: string, options?: ShareOptions) => Promise<ShareResult>;

  /**
   * Share content as markdown
   */
  shareAsMarkdown: (content: string, options?: ShareOptions) => Promise<ShareResult>;

  /**
   * Whether a share operation is in progress
   */
  isSharing: boolean;

  /**
   * Error from the last share operation
   */
  error: string | null;
}

/**
 * Hook for opening Android share sheet
 *
 * Provides methods to share different types of content using the native
 * Android share sheet with proper formatting and wiki link preservation.
 *
 * @returns Methods and state for sharing content
 *
 * @example
 * ```tsx
 * function NoteScreen({ content }: { content: string }) {
 *   const { shareText, shareWithWikiLinks, isSharing } = useShareSheet();
 *
 *   const handleShare = async () => {
 *     const result = await shareWithWikiLinks(content, {
 *       title: 'My Note',
 *       dialogTitle: 'Share note'
 *     });
 *     if (result.success) {
 *       // Share successful
 *     }
 *   };
 *
 *   return (
 *     <Button onPress={handleShare} disabled={isSharing}>
 *       Share
 *     </Button>
 *   );
 * }
 * ```
 */
export function useShareSheet(): UseShareSheetResult {
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Share text content
   */
  const shareText = useCallback(
    async (text: string, options: ShareOptions = {}): Promise<ShareResult> => {
      setIsSharing(true);
      setError(null);

      try {
        // Validate input
        if (!text || text.trim().length === 0) {
          throw new Error('Content cannot be empty');
        }

        // Check if Share API is available
        if (!shareAPI) {
          throw new Error('Share API not available. Call setShareAPI() first.');
        }

        // Prepare share options
        const shareOptions: {
          message?: string;
          title?: string;
        } = {
          message: text,
        };

        if (options.title) {
          shareOptions.title = options.title;
        }

        // Prepare dialog options
        const dialogOptions: {
          dialogTitle?: string;
          excludedActivityTypes?: string[];
        } = {};

        if (options.dialogTitle) {
          dialogOptions.dialogTitle = options.dialogTitle;
        }

        if (options.excludedApps && options.excludedApps.length > 0) {
          dialogOptions.excludedActivityTypes = options.excludedApps;
        }

        // Open share sheet
        const result = await shareAPI.share(shareOptions, dialogOptions);

        setIsSharing(false);

        if (result.action === 'sharedAction') {
          return {
            success: true,
            action: 'shared',
          };
        } else {
          return {
            success: false,
            action: 'cancelled',
          };
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setIsSharing(false);

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    []
  );

  /**
   * Share URL
   */
  const shareUrl = useCallback(
    async (url: string, options: ShareOptions = {}): Promise<ShareResult> => {
      // Validate URL
      try {
        new URL(url);
      } catch {
        const errorMessage = 'Invalid URL format';
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      }

      // Share as text with URL
      return shareText(url, options);
    },
    [shareText]
  );

  /**
   * Share content with wiki links preserved
   */
  const shareWithWikiLinks = useCallback(
    async (content: string, options: ShareOptions = {}): Promise<ShareResult> => {
      // Extract wiki links for context
      const wikiLinks = extractWikiLinks(content);

      // Add context about wiki links if present
      let enhancedContent = content;
      if (wikiLinks.length > 0 && options.preserveWikiLinks !== false) {
        // Wiki links are preserved in their [[Page Name]] format
        // They will be recognized when shared back to the app
        enhancedContent = content;
      }

      return shareText(enhancedContent, {
        ...options,
        preserveWikiLinks: true,
      });
    },
    [shareText]
  );

  /**
   * Share content as markdown
   */
  const shareAsMarkdown = useCallback(
    async (content: string, options: ShareOptions = {}): Promise<ShareResult> => {
      // Convert to markdown format
      const markdown = convertToMarkdown(content, {
        title: options.title,
      });

      return shareText(markdown, {
        ...options,
        asMarkdown: true,
      });
    },
    [shareText]
  );

  return {
    shareText,
    shareUrl,
    shareWithWikiLinks,
    shareAsMarkdown,
    isSharing,
    error,
  };
}

/**
 * Share text content
 *
 * Standalone function to share text without using the hook.
 *
 * @param text - Text content to share
 * @param options - Share options
 * @returns Promise with share result
 */
export async function shareTextContent(
  text: string,
  options: ShareOptions = {}
): Promise<ShareResult> {
  if (!shareAPI) {
    return {
      success: false,
      error: 'Share API not available. Call setShareAPI() first.',
    };
  }

  try {
    const shareOptions: {
      message?: string;
      title?: string;
    } = {
      message: text,
    };

    if (options.title) {
      shareOptions.title = options.title;
    }

    const dialogOptions: {
      dialogTitle?: string;
      excludedActivityTypes?: string[];
    } = {};

    if (options.dialogTitle) {
      dialogOptions.dialogTitle = options.dialogTitle;
    }

    if (options.excludedApps && options.excludedApps.length > 0) {
      dialogOptions.excludedActivityTypes = options.excludedApps;
    }

    const result = await shareAPI.share(shareOptions, dialogOptions);

    if (result.action === 'sharedAction') {
      return {
        success: true,
        action: 'shared',
      };
    } else {
      return {
        success: false,
        action: 'cancelled',
      };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Share URL content
 *
 * Standalone function to share a URL without using the hook.
 *
 * @param url - URL to share
 * @param options - Share options
 * @returns Promise with share result
 */
export async function shareUrlContent(
  url: string,
  options: ShareOptions = {}
): Promise<ShareResult> {
  // Validate URL
  try {
    new URL(url);
  } catch {
    return {
      success: false,
      error: 'Invalid URL format',
    };
  }

  return shareTextContent(url, options);
}
