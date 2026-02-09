/**
 * useDailyNote hook - Manage daily note fetching and creation.
 *
 * This hook provides a convenient interface for working with daily notes,
 * handling date formatting, creation, and loading states.
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
import { PageRepository } from '@double-bind/core';
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
  const { db, status } = useDatabase();
  const [dailyNote, setDailyNote] = useState<Page | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    setFetchTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    // Wait for database to be ready
    if (status !== 'ready' || !db) {
      return;
    }

    let mounted = true;

    async function fetchDailyNote() {
      setIsLoading(true);
      setError(null);

      try {
        const pageRepo = new PageRepository(db);
        const page = await pageRepo.getOrCreateDailyNote(date);

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
  }, [db, status, date, fetchTrigger]);

  return {
    dailyNote,
    isLoading,
    error,
    refetch,
  };
}
