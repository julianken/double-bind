/**
 * Unit tests for SearchService
 *
 * These tests verify correct FTS query construction and result merging.
 * Uses MockDatabase to verify:
 * - Parallel page and block FTS queries
 * - Result merging and sorting by score
 * - Options handling (limit, minScore, includeTypes)
 * - Error wrapping with context
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockDatabase } from '@double-bind/test-utils';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import { SearchService } from '../../../src/services/search-service.js';

describe('SearchService', () => {
  let db: MockDatabase;
  let service: SearchService;

  beforeEach(() => {
    db = new MockDatabase();
    service = new SearchService(db);
  });

  describe('search', () => {
    it('should execute parallel FTS queries for pages and blocks', async () => {
      const querySpy = vi.spyOn(db, 'query');

      // Mock page FTS results
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'score'],
        rows: [['page-1', 'Test Page', 0.9]],
      });

      // Mock block FTS results
      querySpy.mockResolvedValueOnce({
        headers: ['block_id', 'content', 'page_id', 'page_title', 'score'],
        rows: [['block-1', 'Test content', 'page-2', 'Another Page', 0.8]],
      });

      await service.search('test');

      // Verify both queries were called
      expect(querySpy).toHaveBeenCalledTimes(2);

      // Verify page FTS query
      const pageCall = querySpy.mock.calls[0];
      expect(pageCall![0]).toContain('pages_fts');
      expect(pageCall![1]).toMatchObject({ query: 'test' });

      // Verify block FTS query
      const blockCall = querySpy.mock.calls[1];
      expect(blockCall![0]).toContain('blocks_fts');
      expect(blockCall![1]).toMatchObject({ query: 'test' });
    });

    it('should merge and sort results by score descending', async () => {
      const querySpy = vi.spyOn(db, 'query');

      // Page with lower score
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'score'],
        rows: [['page-1', 'Low Score Page', 0.5]],
      });

      // Block with higher score
      querySpy.mockResolvedValueOnce({
        headers: ['block_id', 'content', 'page_id', 'page_title', 'score'],
        rows: [['block-1', 'High score content', 'page-2', 'Parent Page', 0.9]],
      });

      const results = await service.search('test');

      expect(results).toHaveLength(2);
      // Higher score first
      expect(results[0]?.type).toBe('block');
      expect(results[0]?.score).toBe(0.9);
      // Lower score second
      expect(results[1]?.type).toBe('page');
      expect(results[1]?.score).toBe(0.5);
    });

    it('should return correct SearchResult structure for page matches', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'score'],
        rows: [['page-123', 'My Test Page', 0.85]],
      });

      querySpy.mockResolvedValueOnce({
        headers: [],
        rows: [],
      });

      const results = await service.search('test');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        type: 'page',
        id: 'page-123',
        title: 'My Test Page',
        content: 'My Test Page', // For pages, content equals title
        score: 0.85,
        pageId: 'page-123',
      });
    });

    it('should return correct SearchResult structure for block matches', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: [],
        rows: [],
      });

      querySpy.mockResolvedValueOnce({
        headers: ['block_id', 'content', 'page_id', 'page_title', 'score'],
        rows: [['block-456', 'Block content here', 'page-789', 'Parent Page Title', 0.75]],
      });

      const results = await service.search('test');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        type: 'block',
        id: 'block-456',
        title: 'Parent Page Title',
        content: 'Block content here',
        score: 0.75,
        pageId: 'page-789',
        blockId: 'block-456',
      });
    });

    it('should return empty array when no matches found', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });
      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });

      const results = await service.search('nonexistent');

      expect(results).toEqual([]);
    });

    it('should handle multiple results from both sources', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'score'],
        rows: [
          ['page-1', 'First Page', 0.95],
          ['page-2', 'Second Page', 0.7],
        ],
      });

      querySpy.mockResolvedValueOnce({
        headers: ['block_id', 'content', 'page_id', 'page_title', 'score'],
        rows: [
          ['block-1', 'First block', 'page-3', 'Third Page', 0.85],
          ['block-2', 'Second block', 'page-4', 'Fourth Page', 0.6],
        ],
      });

      const results = await service.search('test');

      expect(results).toHaveLength(4);
      // Verify sorted by score descending
      expect(results[0]?.score).toBe(0.95);
      expect(results[1]?.score).toBe(0.85);
      expect(results[2]?.score).toBe(0.7);
      expect(results[3]?.score).toBe(0.6);
    });
  });

  describe('search options', () => {
    it('should respect limit option', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });
      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });

      await service.search('test', { limit: 5 });

      // Verify limit was passed to queries
      expect(querySpy.mock.calls[0]![1]).toMatchObject({ limit: 5 });
      expect(querySpy.mock.calls[1]![1]).toMatchObject({ limit: 5 });
    });

    it('should use default limit of 20 when not specified', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });
      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });

      await service.search('test');

      expect(querySpy.mock.calls[0]![1]).toMatchObject({ limit: 20 });
      expect(querySpy.mock.calls[1]![1]).toMatchObject({ limit: 20 });
    });

    it('should filter results by minScore option', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'score'],
        rows: [
          ['page-1', 'High Score', 0.8],
          ['page-2', 'Low Score', 0.3],
        ],
      });

      querySpy.mockResolvedValueOnce({
        headers: ['block_id', 'content', 'page_id', 'page_title', 'score'],
        rows: [['block-1', 'Medium Score', 'page-3', 'Page', 0.5]],
      });

      const results = await service.search('test', { minScore: 0.5 });

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.score >= 0.5)).toBe(true);
      expect(results.find((r) => r.id === 'page-2')).toBeUndefined();
    });

    it('should only search pages when includeTypes is ["page"]', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'score'],
        rows: [['page-1', 'Test Page', 0.9]],
      });

      const results = await service.search('test', { includeTypes: ['page'] });

      // Only page query should be executed
      expect(querySpy).toHaveBeenCalledTimes(1);
      expect(querySpy.mock.calls[0]![0]).toContain('pages_fts');

      expect(results).toHaveLength(1);
      expect(results[0]?.type).toBe('page');
    });

    it('should only search blocks when includeTypes is ["block"]', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['block_id', 'content', 'page_id', 'page_title', 'score'],
        rows: [['block-1', 'Test content', 'page-1', 'Page', 0.9]],
      });

      const results = await service.search('test', { includeTypes: ['block'] });

      // Only block query should be executed
      expect(querySpy).toHaveBeenCalledTimes(1);
      expect(querySpy.mock.calls[0]![0]).toContain('blocks_fts');

      expect(results).toHaveLength(1);
      expect(results[0]?.type).toBe('block');
    });

    it('should search both by default', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });
      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });

      await service.search('test');

      expect(querySpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should wrap repository errors with context', async () => {
      const querySpy = vi.spyOn(db, 'query');
      const originalError = new Error('FTS index corrupted');
      querySpy.mockRejectedValueOnce(originalError);

      const error = await service.search('test').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toContain('Failed to search');
      expect(error.message).toContain('test');
      expect(error.cause).toBe(originalError);
    });

    it('should re-throw DoubleBindError without wrapping', async () => {
      const querySpy = vi.spyOn(db, 'query');
      const originalError = new DoubleBindError('Custom error', ErrorCode.BLOCKED_OPERATION);
      querySpy.mockRejectedValueOnce(originalError);

      const error = await service.search('test').catch((e) => e);

      expect(error).toBe(originalError);
      expect(error.code).toBe(ErrorCode.BLOCKED_OPERATION);
    });

    it('should handle non-Error thrown values', async () => {
      const querySpy = vi.spyOn(db, 'query');
      querySpy.mockRejectedValueOnce('string error');

      const error = await service.search('test').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.message).toContain('string error');
      expect(error.cause).toBeUndefined();
    });

    it('should throw on invalid page FTS row format', async () => {
      const querySpy = vi.spyOn(db, 'query');

      // Invalid row: missing score
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'score'],
        rows: [['page-1', 'Title']], // Missing score
      });

      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });

      const error = await service.search('test').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toContain('Invalid page FTS result row format');
    });

    it('should throw on invalid block FTS row format', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });

      // Invalid row: wrong number of columns
      querySpy.mockResolvedValueOnce({
        headers: ['block_id', 'content', 'page_id', 'page_title', 'score'],
        rows: [['block-1', 'content', 'page-1']], // Missing page_title and score
      });

      const error = await service.search('test').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toContain('Invalid block FTS result row format');
    });

    it('should throw on invalid page_id type in page results', async () => {
      const querySpy = vi.spyOn(db, 'query');

      // Invalid: page_id should be string, not number
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'score'],
        rows: [[123, 'Title', 0.5]],
      });

      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });

      const error = await service.search('test').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
    });

    it('should throw on invalid score type in results', async () => {
      const querySpy = vi.spyOn(db, 'query');

      // Invalid: score should be number, not string
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'score'],
        rows: [['page-1', 'Title', 'not-a-number']],
      });

      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });

      const error = await service.search('test').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
    });
  });

  describe('query construction', () => {
    it('should construct page FTS query with correct syntax', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });
      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });

      await service.search('my search query');

      const pageScript = querySpy.mock.calls[0]![0] as string;

      // Verify FTS syntax
      expect(pageScript).toContain('pages_fts');
      expect(pageScript).toContain('MATCH $query');
      expect(pageScript).toContain('LIMIT $limit');
      expect(pageScript).toContain('rank');

      // Verify soft-delete filter
      expect(pageScript).toContain('is_deleted = 0');

      // Verify sorting
      expect(pageScript).toContain('ORDER BY');
    });

    it('should construct block FTS query with correct syntax', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });
      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });

      await service.search('my search query');

      const blockScript = querySpy.mock.calls[1]![0] as string;

      // Verify FTS syntax
      expect(blockScript).toContain('blocks_fts');
      expect(blockScript).toContain('MATCH $query');
      expect(blockScript).toContain('LIMIT $limit');
      expect(blockScript).toContain('rank');

      // Verify join with pages for title
      expect(blockScript).toContain('JOIN pages');
      expect(blockScript).toContain('page_title');

      // Verify soft-delete filters for both blocks and pages
      expect(blockScript).toContain('b.is_deleted = 0');
      expect(blockScript).toContain('p.is_deleted = 0');

      // Verify sorting
      expect(blockScript).toContain('ORDER BY');
    });

    it('should pass query parameter to FTS', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });
      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });

      await service.search('specific search term');

      expect(querySpy.mock.calls[0]![1]).toMatchObject({ query: 'specific search term' });
      expect(querySpy.mock.calls[1]![1]).toMatchObject({ query: 'specific search term' });
    });
  });

  describe('edge cases', () => {
    it('should handle empty query string', async () => {
      const querySpy = vi.spyOn(db, 'query');

      const results = await service.search('');

      // sanitizeFtsQuery returns '' for empty input, so search returns early
      expect(results).toEqual([]);
      expect(querySpy).toHaveBeenCalledTimes(0);
    });

    it('should handle special characters in query', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });
      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });

      await service.search('test [special] "chars"');

      // sanitizeFtsQuery strips FTS5 special chars like [] and "
      expect(querySpy.mock.calls[0]![1]).toMatchObject({ query: 'test special chars' });
    });

    it('should handle zero score results', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'score'],
        rows: [['page-1', 'Zero Score', 0]],
      });

      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });

      const results = await service.search('test');

      expect(results).toHaveLength(1);
      expect(results[0]?.score).toBe(0);
    });

    it('should handle minScore of 0 (include all)', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'score'],
        rows: [
          ['page-1', 'Low', 0.1],
          ['page-2', 'Zero', 0],
        ],
      });

      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });

      const results = await service.search('test', { minScore: 0 });

      expect(results).toHaveLength(2);
    });

    it('should handle very high scores', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'score'],
        rows: [['page-1', 'High Score', 999.99]],
      });

      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });

      const results = await service.search('test');

      expect(results[0]?.score).toBe(999.99);
    });

    it('should handle blocks from same page as separate results', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });

      querySpy.mockResolvedValueOnce({
        headers: ['block_id', 'content', 'page_id', 'page_title', 'score'],
        rows: [
          ['block-1', 'First block', 'page-1', 'Same Page', 0.9],
          ['block-2', 'Second block', 'page-1', 'Same Page', 0.8],
        ],
      });

      const results = await service.search('test');

      expect(results).toHaveLength(2);
      expect(results[0]?.pageId).toBe('page-1');
      expect(results[1]?.pageId).toBe('page-1');
      expect(results[0]?.blockId).toBe('block-1');
      expect(results[1]?.blockId).toBe('block-2');
    });
  });
});
