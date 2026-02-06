import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useQueryHistoryStore,
  MAX_QUERY_HISTORY_SIZE,
  QUERY_HISTORY_STORAGE_KEY,
  type QueryResult,
} from '../../../src/stores/query-history-store.js';

describe('useQueryHistoryStore', () => {
  beforeEach(() => {
    // Clear localStorage to prevent persistence from affecting tests
    localStorage.clear();

    // Reset store to initial state before each test
    useQueryHistoryStore.setState({ entries: [] });
  });

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('Initial State', () => {
    it('has empty entries array by default', () => {
      const state = useQueryHistoryStore.getState();
      expect(state.entries).toEqual([]);
    });
  });

  // ============================================================================
  // addQuery
  // ============================================================================

  describe('addQuery', () => {
    it('adds a successful query to history', () => {
      const store = useQueryHistoryStore.getState();
      const result: QueryResult = { success: true, rowCount: 10 };

      const entry = store.addQuery('?[x] <- [[1], [2], [3]]', 50, result);

      expect(entry.script).toBe('?[x] <- [[1], [2], [3]]');
      expect(entry.durationMs).toBe(50);
      expect(entry.result).toEqual(result);
      expect(entry.id).toMatch(/^qh-[a-z0-9]+-[a-z0-9]+$/);
      expect(entry.executedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('adds a failed query to history', () => {
      const store = useQueryHistoryStore.getState();
      const result: QueryResult = { success: false, error: 'Syntax error' };

      const entry = store.addQuery('invalid query', 10, result);

      expect(entry.script).toBe('invalid query');
      expect(entry.result).toEqual(result);
      expect(entry.result.success).toBe(false);
    });

    it('adds queries in newest-first order', () => {
      const store = useQueryHistoryStore.getState();

      store.addQuery('query1', 10, { success: true, rowCount: 1 });
      store.addQuery('query2', 20, { success: true, rowCount: 2 });
      store.addQuery('query3', 30, { success: true, rowCount: 3 });

      const entries = useQueryHistoryStore.getState().entries;
      expect(entries.length).toBe(3);
      expect(entries[0].script).toBe('query3');
      expect(entries[1].script).toBe('query2');
      expect(entries[2].script).toBe('query1');
    });

    it('generates unique IDs for each entry', () => {
      const store = useQueryHistoryStore.getState();
      const ids = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const entry = store.addQuery(`query${i}`, i, { success: true, rowCount: i });
        ids.add(entry.id);
      }

      expect(ids.size).toBe(10);
    });

    it('returns the created entry', () => {
      const store = useQueryHistoryStore.getState();
      const result: QueryResult = { success: true, rowCount: 5 };

      const entry = store.addQuery('?[x] <- [[1]]', 100, result);

      expect(entry).toBeDefined();
      expect(entry.script).toBe('?[x] <- [[1]]');
      expect(entry.durationMs).toBe(100);
    });
  });

  // ============================================================================
  // FIFO Eviction
  // ============================================================================

  describe('FIFO Eviction', () => {
    it('limits history to MAX_QUERY_HISTORY_SIZE entries', () => {
      const store = useQueryHistoryStore.getState();

      // Add more than the limit
      for (let i = 0; i < MAX_QUERY_HISTORY_SIZE + 10; i++) {
        store.addQuery(`query${i}`, i, { success: true, rowCount: i });
      }

      const entries = useQueryHistoryStore.getState().entries;
      expect(entries.length).toBe(MAX_QUERY_HISTORY_SIZE);
    });

    it('removes oldest entries when limit is exceeded (FIFO)', () => {
      const store = useQueryHistoryStore.getState();

      // Add MAX_QUERY_HISTORY_SIZE + 5 entries
      for (let i = 0; i < MAX_QUERY_HISTORY_SIZE + 5; i++) {
        store.addQuery(`query${i}`, i, { success: true, rowCount: i });
      }

      const entries = useQueryHistoryStore.getState().entries;

      // Newest should be at index 0
      expect(entries[0].script).toBe(`query${MAX_QUERY_HISTORY_SIZE + 4}`);

      // Oldest kept should be at the end (query5, because 0-4 were evicted)
      expect(entries[entries.length - 1].script).toBe('query5');
    });

    it('MAX_QUERY_HISTORY_SIZE is 50', () => {
      expect(MAX_QUERY_HISTORY_SIZE).toBe(50);
    });
  });

  // ============================================================================
  // clearHistory
  // ============================================================================

  describe('clearHistory', () => {
    it('removes all entries from history', () => {
      const store = useQueryHistoryStore.getState();

      // Add some entries
      store.addQuery('query1', 10, { success: true, rowCount: 1 });
      store.addQuery('query2', 20, { success: true, rowCount: 2 });
      store.addQuery('query3', 30, { success: true, rowCount: 3 });

      expect(useQueryHistoryStore.getState().entries.length).toBe(3);

      // Clear history
      useQueryHistoryStore.getState().clearHistory();

      expect(useQueryHistoryStore.getState().entries).toEqual([]);
    });

    it('works when history is already empty', () => {
      const store = useQueryHistoryStore.getState();
      expect(store.entries.length).toBe(0);

      store.clearHistory();

      expect(useQueryHistoryStore.getState().entries).toEqual([]);
    });
  });

  // ============================================================================
  // removeQuery
  // ============================================================================

  describe('removeQuery', () => {
    it('removes a specific entry by ID', () => {
      const store = useQueryHistoryStore.getState();

      const entry1 = store.addQuery('query1', 10, { success: true, rowCount: 1 });
      const entry2 = store.addQuery('query2', 20, { success: true, rowCount: 2 });
      const entry3 = store.addQuery('query3', 30, { success: true, rowCount: 3 });

      expect(useQueryHistoryStore.getState().entries.length).toBe(3);

      // Remove the middle entry
      useQueryHistoryStore.getState().removeQuery(entry2.id);

      const entries = useQueryHistoryStore.getState().entries;
      expect(entries.length).toBe(2);
      expect(entries.map((e) => e.id)).toContain(entry1.id);
      expect(entries.map((e) => e.id)).toContain(entry3.id);
      expect(entries.map((e) => e.id)).not.toContain(entry2.id);
    });

    it('does nothing if ID does not exist', () => {
      const store = useQueryHistoryStore.getState();

      store.addQuery('query1', 10, { success: true, rowCount: 1 });
      store.addQuery('query2', 20, { success: true, rowCount: 2 });

      const entriesBefore = useQueryHistoryStore.getState().entries;
      expect(entriesBefore.length).toBe(2);

      // Try to remove non-existent entry
      useQueryHistoryStore.getState().removeQuery('non-existent-id');

      const entriesAfter = useQueryHistoryStore.getState().entries;
      expect(entriesAfter.length).toBe(2);
    });

    it('maintains order after removal', () => {
      const store = useQueryHistoryStore.getState();

      store.addQuery('query1', 10, { success: true, rowCount: 1 });
      const entry2 = store.addQuery('query2', 20, { success: true, rowCount: 2 });
      store.addQuery('query3', 30, { success: true, rowCount: 3 });

      // Remove middle entry
      useQueryHistoryStore.getState().removeQuery(entry2.id);

      const entries = useQueryHistoryStore.getState().entries;
      expect(entries[0].script).toBe('query3');
      expect(entries[1].script).toBe('query1');
    });
  });

  // ============================================================================
  // getQuery
  // ============================================================================

  describe('getQuery', () => {
    it('returns the entry with the given ID', () => {
      const store = useQueryHistoryStore.getState();

      store.addQuery('query1', 10, { success: true, rowCount: 1 });
      const entry2 = store.addQuery('query2', 20, { success: true, rowCount: 2 });
      store.addQuery('query3', 30, { success: true, rowCount: 3 });

      const found = useQueryHistoryStore.getState().getQuery(entry2.id);

      expect(found).toBeDefined();
      expect(found?.script).toBe('query2');
      expect(found?.durationMs).toBe(20);
    });

    it('returns undefined if ID does not exist', () => {
      const store = useQueryHistoryStore.getState();

      store.addQuery('query1', 10, { success: true, rowCount: 1 });

      const found = useQueryHistoryStore.getState().getQuery('non-existent-id');

      expect(found).toBeUndefined();
    });
  });

  // ============================================================================
  // Persistence
  // ============================================================================

  describe('Persistence', () => {
    it('persists entries to localStorage', () => {
      const store = useQueryHistoryStore.getState();

      store.addQuery('persisted query', 100, { success: true, rowCount: 5 });

      // Check localStorage was updated
      const stored = localStorage.getItem(QUERY_HISTORY_STORAGE_KEY);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.entries).toHaveLength(1);
      expect(parsed.state.entries[0].script).toBe('persisted query');
    });

    it('clears localStorage when history is cleared', () => {
      const store = useQueryHistoryStore.getState();

      store.addQuery('query', 10, { success: true, rowCount: 1 });
      expect(localStorage.getItem(QUERY_HISTORY_STORAGE_KEY)).not.toBeNull();

      useQueryHistoryStore.getState().clearHistory();

      const stored = localStorage.getItem(QUERY_HISTORY_STORAGE_KEY);
      const parsed = JSON.parse(stored!);
      expect(parsed.state.entries).toEqual([]);
    });

    it('has the correct storage key', () => {
      expect(QUERY_HISTORY_STORAGE_KEY).toBe('double-bind-query-history');
    });
  });

  // ============================================================================
  // QueryResult Types
  // ============================================================================

  describe('QueryResult Types', () => {
    it('handles success result with zero rows', () => {
      const store = useQueryHistoryStore.getState();
      const result: QueryResult = { success: true, rowCount: 0 };

      const entry = store.addQuery('empty result', 5, result);

      expect(entry.result).toEqual({ success: true, rowCount: 0 });
    });

    it('handles success result with large row count', () => {
      const store = useQueryHistoryStore.getState();
      const result: QueryResult = { success: true, rowCount: 1_000_000 };

      const entry = store.addQuery('big result', 5000, result);

      expect(entry.result).toEqual({ success: true, rowCount: 1_000_000 });
    });

    it('handles error result with long error message', () => {
      const store = useQueryHistoryStore.getState();
      const longError = 'Error: '.padEnd(500, 'x');
      const result: QueryResult = { success: false, error: longError };

      const entry = store.addQuery('error query', 10, result);

      expect(entry.result).toEqual({ success: false, error: longError });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles empty script', () => {
      const store = useQueryHistoryStore.getState();

      const entry = store.addQuery('', 0, { success: false, error: 'Empty query' });

      expect(entry.script).toBe('');
    });

    it('handles multiline scripts', () => {
      const store = useQueryHistoryStore.getState();
      const multilineScript = `
        ?[page_id, title] :=
          *pages[page_id, title, _, _, _],
          title != ""
      `;

      const entry = store.addQuery(multilineScript, 50, { success: true, rowCount: 10 });

      expect(entry.script).toBe(multilineScript);
    });

    it('handles special characters in scripts', () => {
      const store = useQueryHistoryStore.getState();
      const specialScript = '?[x] <- [["\u0000\n\r\t\\"]]]';

      const entry = store.addQuery(specialScript, 5, { success: true, rowCount: 1 });

      expect(entry.script).toBe(specialScript);
    });

    it('handles very small duration (< 1ms)', () => {
      const store = useQueryHistoryStore.getState();

      const entry = store.addQuery('fast', 0.1, { success: true, rowCount: 1 });

      expect(entry.durationMs).toBe(0.1);
    });

    it('handles rapid sequential additions', () => {
      const store = useQueryHistoryStore.getState();

      // Rapidly add many queries
      for (let i = 0; i < 100; i++) {
        store.addQuery(`rapid${i}`, i, { success: true, rowCount: i });
      }

      const entries = useQueryHistoryStore.getState().entries;
      expect(entries.length).toBe(MAX_QUERY_HISTORY_SIZE);

      // Verify newest is first
      expect(entries[0].script).toBe('rapid99');
    });

    it('maintains immutability of entries array', () => {
      const store = useQueryHistoryStore.getState();

      store.addQuery('query1', 10, { success: true, rowCount: 1 });
      const entriesBefore = useQueryHistoryStore.getState().entries;

      store.addQuery('query2', 20, { success: true, rowCount: 2 });
      const entriesAfter = useQueryHistoryStore.getState().entries;

      // Arrays should be different references
      expect(entriesBefore).not.toBe(entriesAfter);

      // Original array should still have 1 entry
      expect(entriesBefore.length).toBe(1);

      // New array should have 2 entries
      expect(entriesAfter.length).toBe(2);
    });
  });

  // ============================================================================
  // Timestamp Format
  // ============================================================================

  describe('Timestamp Format', () => {
    it('generates valid ISO-8601 timestamps', () => {
      const store = useQueryHistoryStore.getState();

      const entry = store.addQuery('test', 10, { success: true, rowCount: 1 });

      // Should be parseable as a date
      const date = new Date(entry.executedAt);
      expect(date.getTime()).not.toBeNaN();

      // Should be in ISO format
      expect(entry.executedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it('timestamps are close to current time', () => {
      vi.useFakeTimers();
      const now = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(now);

      const store = useQueryHistoryStore.getState();
      const entry = store.addQuery('test', 10, { success: true, rowCount: 1 });

      expect(entry.executedAt).toBe('2025-01-15T12:00:00.000Z');

      vi.useRealTimers();
    });
  });
});
