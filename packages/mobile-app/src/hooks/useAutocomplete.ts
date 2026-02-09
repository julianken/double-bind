/**
 * useAutocomplete hook - Provides autocomplete suggestions for wiki links.
 *
 * This hook manages autocomplete state and search functionality for:
 * - Page links ([[)
 * - Block references ((() - future
 * - Tags (#) - future
 *
 * Features:
 * - Debounced search (300ms)
 * - "Create new page" suggestion when no exact match
 * - Loading state management
 * - Automatic cleanup on unmount
 *
 * @example
 * ```tsx
 * function Editor() {
 *   const { suggestions, isLoading } = useAutocomplete({
 *     trigger: 'page',
 *     query: 'my search',
 *     enabled: true
 *   });
 *
 *   return <WikiLinkSuggestions suggestions={suggestions} />;
 * }
 * ```
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDatabase } from './useDatabase';
import { createServices } from '@double-bind/core';
import type { AutocompleteSuggestion } from '../editor/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useAutocomplete hook.
 */
export interface UseAutocompleteOptions {
  /** Type of autocomplete trigger */
  trigger: 'page' | 'block' | 'tag';
  /** Current search query */
  query: string;
  /** Whether autocomplete is enabled */
  enabled?: boolean;
}

/**
 * Result returned by useAutocomplete hook.
 */
export interface UseAutocompleteResult {
  /** Array of autocomplete suggestions */
  suggestions: AutocompleteSuggestion[];
  /** Whether search is in progress */
  isLoading: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Debounce delay in milliseconds */
const DEBOUNCE_DELAY = 300;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing autocomplete suggestions.
 *
 * Searches the database for matching pages, blocks, or tags based on
 * the trigger type and query string. Results are debounced to avoid
 * excessive database queries.
 *
 * @param options - Autocomplete configuration
 * @returns Suggestions and loading state
 */
export function useAutocomplete({
  trigger,
  query,
  enabled = true,
}: UseAutocompleteOptions): UseAutocompleteResult {
  const { db } = useDatabase();
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  /**
   * Search for pages matching the query.
   * Adds a "Create new page" option if no exact match exists.
   */
  const searchPages = useCallback(
    async (searchQuery: string) => {
      setIsLoading(true);
      try {
        const services = createServices(db!);
        const pages = await services.pageService.searchPages(searchQuery);

        const pageSuggestions: AutocompleteSuggestion[] = pages.map((page) => ({
          type: 'page' as const,
          data: {
            pageId: page.pageId,
            title: page.title,
            isCreateNew: false,
          },
        }));

        // Add "Create new page" option if no exact match
        const hasExactMatch = pages.some(
          (p) => p.title.toLowerCase() === searchQuery.toLowerCase()
        );

        if (!hasExactMatch && searchQuery.trim()) {
          pageSuggestions.push({
            type: 'page' as const,
            data: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              pageId: `create-${searchQuery}` as any, // Temporary ID for create action
              title: searchQuery,
              isCreateNew: true,
            },
          });
        }

        setSuggestions(pageSuggestions);
      } catch {
        // Silent fail - suggestions will be empty array
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [db]
  );

  /**
   * Effect: Debounced search when query changes.
   * Clears suggestions when disabled or trigger is not 'page'.
   */
  useEffect(() => {
    if (!enabled || trigger !== 'page') {
      setSuggestions([]);
      return;
    }

    // Clear suggestions immediately if query is empty
    if (!query.trim() || !db) {
      setSuggestions([]);
      return;
    }

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce search by 300ms
    debounceRef.current = setTimeout(() => {
      searchPages(query);
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [trigger, query, enabled, searchPages, db]);

  return { suggestions, isLoading };
}
