/**
 * useWikiLinkAutocomplete hook - Integration layer for wiki link autocomplete.
 *
 * This hook combines useAutocomplete with editor state management to provide
 * a complete autocomplete solution for the mobile editor. It handles:
 * - [[ trigger detection and activation
 * - Suggestion filtering and display
 * - Link insertion with proper formatting
 * - New page creation from autocomplete selection
 *
 * @example
 * ```tsx
 * function EditorScreen() {
 *   const {
 *     isActive,
 *     query,
 *     suggestions,
 *     isLoading,
 *     handleTrigger,
 *     handleSelect,
 *     handleDismiss,
 *   } = useWikiLinkAutocomplete();
 *
 *   return (
 *     <>
 *       <Editor onAutocomplete={handleTrigger} />
 *       <WikiLinkSuggestions
 *         isVisible={isActive}
 *         suggestions={suggestions}
 *         onSelect={handleSelect}
 *         onClose={handleDismiss}
 *       />
 *     </>
 *   );
 * }
 * ```
 */

import { useState, useCallback } from 'react';
import { useAutocomplete } from './useAutocomplete';
import { useDatabase } from './useDatabase';
import { createServices } from '@double-bind/core';
import type { AutocompleteSuggestion } from '../editor/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of selecting an autocomplete suggestion.
 */
export interface AutocompleteSelection {
  /** Formatted text to insert (e.g., "[[Page Title]]") */
  text: string;
  /** Page ID if linking to existing page or newly created page */
  pageId?: string;
}

/**
 * Result returned by useWikiLinkAutocomplete hook.
 */
export interface UseWikiLinkAutocompleteResult {
  /** Whether autocomplete is currently active */
  isActive: boolean;
  /** Current search query */
  query: string;
  /** Available suggestions */
  suggestions: AutocompleteSuggestion[];
  /** Whether suggestions are loading */
  isLoading: boolean;
  /** Activate autocomplete with a trigger and query */
  handleTrigger: (trigger: string, query: string) => void;
  /** Select a suggestion and get formatted text */
  handleSelect: (suggestion: AutocompleteSuggestion) => Promise<AutocompleteSelection>;
  /** Dismiss the autocomplete popup */
  handleDismiss: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for wiki link autocomplete integration.
 *
 * Provides a complete autocomplete solution by combining the data-fetching
 * hook (useAutocomplete) with editor state management. Handles trigger
 * detection, suggestion display, link insertion, and page creation.
 *
 * @returns Autocomplete state and handlers
 */
export function useWikiLinkAutocomplete(): UseWikiLinkAutocompleteResult {
  const [isActive, setIsActive] = useState(false);
  const [query, setQuery] = useState('');
  const { db } = useDatabase();

  // Get suggestions from the data hook
  const { suggestions, isLoading } = useAutocomplete({
    trigger: 'page',
    query,
    enabled: isActive,
  });

  /**
   * Handle autocomplete trigger detection.
   * Activates autocomplete when [[ is typed and updates query as user types.
   *
   * @param trigger - The trigger type (should be 'page' for [[)
   * @param newQuery - The search query after the trigger
   */
  const handleTrigger = useCallback((trigger: string, newQuery: string) => {
    if (trigger === 'page') {
      setIsActive(true);
      setQuery(newQuery);
    }
  }, []);

  /**
   * Handle suggestion selection.
   * Creates a new page if needed and returns formatted link text.
   *
   * @param suggestion - The selected suggestion
   * @returns Formatted link text and page ID
   */
  const handleSelect = useCallback(
    async (suggestion: AutocompleteSuggestion): Promise<AutocompleteSelection> => {
      // Reset autocomplete state
      setIsActive(false);
      setQuery('');

      // Type guard - only handle page suggestions
      if (suggestion.type !== 'page') {
        return { text: '', pageId: undefined };
      }

      const { pageId, title, isCreateNew } = suggestion.data;

      // Create new page if needed
      if (isCreateNew && db) {
        const services = createServices(db);
        const page = await services.pageService.getOrCreateByTitle(title);
        return {
          text: `[[${title}]]`,
          pageId: page.pageId,
        };
      }

      // Link to existing page
      return {
        text: `[[${title}]]`,
        pageId: pageId,
      };
    },
    [db]
  );

  /**
   * Handle autocomplete dismissal.
   * Resets state without inserting any text.
   */
  const handleDismiss = useCallback(() => {
    setIsActive(false);
    setQuery('');
  }, []);

  return {
    isActive,
    query,
    suggestions,
    isLoading,
    handleTrigger,
    handleSelect,
    handleDismiss,
  };
}
