/**
 * useDailyNote hook - Manage daily note fetching and creation.
 *
 * This hook provides a convenient interface for working with daily notes,
 * handling date formatting, creation, and loading states.
 *
 * Uses PageService.getOrCreateDailyNote() to ensure daily notes are created
 * with an initial empty block for immediate typing (consistent with regular pages).
 *
 * @example
 * ```tsx
 * function DailyNoteScreen() {
 *   const { dailyNote, isLoading, error, refetch } = useDailyNote('2026-02-09');
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error message={error} />;
 *
 *   return <PageView page={dailyNote} />;
 * }
 * ```
 */
import { useState, useEffect, useCallback } from 'react';
import type { Page } from '@double-bind/types';
import { useDatabase } from './useDatabase';

/**
 * Hook state for daily note operations.
 */
export interface UseDailyNoteResult {
  /** The daily note page (null while loading) */
  dailyNote: Page | null;
  /** Whether the daily note is being fetched/created */
  isLoading: boolean;
  /** Error message if operation failed */
  error: string | null;
  /** Refetch the daily note */
  refetch: () => void;
}

/**
 * Hook to fetch or create a daily note for a specific date.
 *
 * @param date - ISO date string (YYYY-MM-DD format)
 * @returns Daily note state and operations
 */
export function useDailyNote(date: string): UseDailyNoteResult {
  const { services, status } = useDatabase();
  const [dailyNote, setDailyNote] = useState<Page | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    setFetchTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    // Wait for database and services to be ready
    if (status !== 'ready' || !services) {
      return;
    }

    // Capture services to satisfy TypeScript narrowing in async function
    const pageService = services.pageService;
    let mounted = true;

    async function fetchDailyNote() {
      setIsLoading(true);
      setError(null);

      try {
        // Use PageService to get/create daily note with initial block
        const page = await pageService.getOrCreateDailyNote(date);

        if (mounted) {
          setDailyNote(page);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load daily note';
          setError(errorMessage);
          setIsLoading(false);
        }
      }
    }

    void fetchDailyNote();

    return () => {
      mounted = false;
    };
  }, [services, status, date, fetchTrigger]);

  return {
    dailyNote,
    isLoading,
    error,
    refetch,
  };
}
