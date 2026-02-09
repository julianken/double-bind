/**
 * ShareReceiver - Component for processing received shares
 *
 * Handles content received from iOS share extension, creating notes
 * from shared content with proper parsing of URLs and wiki links.
 */

import { useCallback, useState, useEffect } from 'react';
import type { PageId } from '@double-bind/types';
import { parseSharedContent, validateShareContent } from './ShareExtension';
import type { SharedContent } from './types';

/**
 * Service interface for creating notes from shared content
 */
export interface NoteService {
  /**
   * Create a new note with the given content
   */
  createNote: (title: string, content: string) => Promise<{ pageId: PageId }>;

  /**
   * Check if a page with the given title exists
   */
  pageExists: (title: string) => Promise<boolean>;
}

/**
 * Props for ShareReceiver component
 */
export interface ShareReceiverProps {
  /**
   * Raw content received from share extension
   */
  rawContent: string;

  /**
   * Note service for creating notes
   */
  noteService: NoteService;

  /**
   * Callback when note is successfully created
   */
  onNoteCreated?: (pageId: PageId, title: string) => void;

  /**
   * Callback when processing fails
   */
  onError?: (error: string) => void;

  /**
   * Callback when processing is cancelled
   */
  onCancel?: () => void;

  /**
   * Whether to auto-process on mount
   */
  autoProcess?: boolean;
}

/**
 * State of share processing
 */
export type ProcessingState = 'idle' | 'processing' | 'success' | 'error';

/**
 * Result of share processing
 */
export interface ProcessingResult {
  state: ProcessingState;
  pageId?: PageId;
  title?: string;
  error?: string;
}

/**
 * ShareReceiver component
 *
 * Processes content received from iOS share extension and creates
 * a new note with proper formatting and link parsing.
 *
 * @example
 * ```tsx
 * function ShareHandler({ sharedContent }: { sharedContent: string }) {
 *   const noteService = useNoteService();
 *
 *   return (
 *     <ShareReceiver
 *       rawContent={sharedContent}
 *       noteService={noteService}
 *       onNoteCreated={(pageId, title) => {
 *         // Navigate to the created note
 *         navigation.navigate('Note', { pageId });
 *       }}
 *       onError={(error) => {
 *         Alert.alert('Error', error);
 *       }}
 *       autoProcess
 *     />
 *   );
 * }
 * ```
 */
export const ShareReceiver: React.FC<ShareReceiverProps> = ({
  rawContent,
  noteService,
  onNoteCreated,
  onError,
  autoProcess = false,
}) => {
  const [result, setResult] = useState<ProcessingResult>({
    state: 'idle',
  });

  /**
   * Process the shared content and create a note
   */
  const processShare = useCallback(async () => {
    setResult({ state: 'processing' });

    try {
      const { pageId, title } = await processSharedContent(rawContent, noteService);

      // Update state
      setResult({
        state: 'success',
        pageId,
        title,
      });

      // Notify parent
      if (onNoteCreated) {
        onNoteCreated(pageId, title);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      setResult({
        state: 'error',
        error: errorMessage,
      });

      if (onError) {
        onError(errorMessage);
      }
    }
  }, [rawContent, noteService, onNoteCreated, onError]);

  // Auto-process if enabled
  useEffect(() => {
    if (autoProcess && result.state === 'idle') {
      processShare();
    }
  }, [autoProcess, result.state, processShare]);

  // This is a headless component - it does not render UI
  // UI should be handled by the parent component based on the result state
  return null;
};

/**
 * Generate a note title from shared content
 */
function generateNoteTitle(shared: SharedContent): string {
  // Use provided title if available
  if (shared.title) {
    return shared.title;
  }

  // For URLs, use the URL as title
  if (shared.type === 'url' && shared.url) {
    try {
      const url = new URL(shared.url);
      return url.hostname + url.pathname;
    } catch {
      return shared.url;
    }
  }

  // For text, try to extract first line as title
  const lines = shared.content.split('\n');
  const firstLine = lines[0]?.trim();

  if (firstLine && firstLine.length > 0) {
    // Limit title length
    const maxLength = 80;
    if (firstLine.length > maxLength) {
      return firstLine.slice(0, maxLength) + '...';
    }
    return firstLine;
  }

  // Default title with timestamp
  const date = new Date(shared.receivedAt);
  return `Quick Note - ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

/**
 * Core processing logic for shared content
 * Shared between ShareReceiver component and useShareProcessor hook
 */
async function processSharedContent(
  rawContent: string,
  noteService: NoteService
): Promise<{ pageId: PageId; title: string }> {
  // Parse the shared content
  const shared: SharedContent = parseSharedContent(rawContent, {
    extractUrls: true,
    preserveWikiLinks: true,
  });

  // Validate the content
  const validation = validateShareContent(shared);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid content');
  }

  // Use sanitized content
  const content = validation.sanitized || shared.content;

  // Generate note title
  const title = generateNoteTitle(shared);

  // Create the note
  const { pageId } = await noteService.createNote(title, content);

  return { pageId, title };
}

/**
 * Hook for processing shared content
 *
 * Provides imperative API for processing shared content without
 * using the ShareReceiver component.
 *
 * @param noteService - Service for creating notes
 * @returns Processing function and state
 *
 * @example
 * ```tsx
 * function ShareScreen() {
 *   const noteService = useNoteService();
 *   const { processShare, result } = useShareProcessor(noteService);
 *
 *   const handleShare = async (content: string) => {
 *     const result = await processShare(content);
 *     if (result.state === 'success') {
 *       navigation.navigate('Note', { pageId: result.pageId });
 *     }
 *   };
 *
 *   return <ShareButton onPress={() => handleShare(content)} />;
 * }
 * ```
 */
export function useShareProcessor(noteService: NoteService) {
  const [result, setResult] = useState<ProcessingResult>({
    state: 'idle',
  });

  const processShare = useCallback(
    async (rawContent: string): Promise<ProcessingResult> => {
      setResult({ state: 'processing' });

      try {
        const { pageId, title } = await processSharedContent(rawContent, noteService);

        const successResult: ProcessingResult = {
          state: 'success',
          pageId,
          title,
        };

        setResult(successResult);
        return successResult;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        const errorResult: ProcessingResult = {
          state: 'error',
          error: errorMessage,
        };

        setResult(errorResult);
        return errorResult;
      }
    },
    [noteService]
  );

  return {
    processShare,
    result,
  };
}
