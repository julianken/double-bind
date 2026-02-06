/**
 * Unit tests for GraphService
 *
 * These tests verify correct graph traversal and error handling.
 * Uses MockGraphDB to verify:
 * - Full graph queries return all pages and links
 * - Neighborhood queries traverse correct number of hops
 * - Error wrapping with context
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockGraphDB } from '@double-bind/test-utils';
import { DoubleBindError, ErrorCode } from '@double-bind/types';
import { GraphService } from '../../../src/services/graph-service.js';

describe('GraphService', () => {
  let db: MockGraphDB;
  let service: GraphService;

  // Test data timestamps
  const now = Date.now();

  // Sample page data
  const page1 = ['page-1', 'Page One', now, now, false, null];
  const page2 = ['page-2', 'Page Two', now, now, false, null];
  const page3 = ['page-3', 'Page Three', now, now, false, null];
  const page4 = ['page-4', 'Page Four', now, now, false, null];
  const deletedPage = ['page-deleted', 'Deleted Page', now, now, true, null];
  const dailyNotePage = ['page-daily', '2024-01-15', now, now, false, '2024-01-15'];

  // Sample link data: [source_id, target_id, link_type, created_at, context_block_id]
  const link1to2 = ['page-1', 'page-2', 'reference', now, 'block-1'];
  const link2to3 = ['page-2', 'page-3', 'reference', now, 'block-2'];
  const link3to4 = ['page-3', 'page-4', 'embed', now, 'block-3'];
  const link1to3 = ['page-1', 'page-3', 'tag', now, null];

  beforeEach(() => {
    db = new MockGraphDB();
    service = new GraphService(db);
  });

  describe('getFullGraph', () => {
    it('should return all non-deleted pages and their links', async () => {
      // Seed pages
      db.seed('pages', [page1, page2, page3, deletedPage]);

      // Seed links
      db.seed('links', [link1to2, link2to3]);

      // Mock the query method to handle both queries
      const querySpy = vi.spyOn(db, 'query');

      // First call: pages query
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [page1, page2, page3],
      });

      // Second call: links query
      querySpy.mockResolvedValueOnce({
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id'],
        rows: [link1to2, link2to3],
      });

      const result = await service.getFullGraph();

      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(2);

      // Verify pages are correctly mapped
      expect(result.nodes.map((n) => n.pageId)).toContain('page-1');
      expect(result.nodes.map((n) => n.pageId)).toContain('page-2');
      expect(result.nodes.map((n) => n.pageId)).toContain('page-3');
      expect(result.nodes.map((n) => n.pageId)).not.toContain('page-deleted');

      // Verify links are correctly mapped
      expect(result.edges[0]?.sourceId).toBe('page-1');
      expect(result.edges[0]?.targetId).toBe('page-2');
    });

    it('should return empty arrays when no pages exist', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });
      querySpy.mockResolvedValueOnce({ headers: [], rows: [] });

      const result = await service.getFullGraph();

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('should filter out links to/from deleted pages', async () => {
      const querySpy = vi.spyOn(db, 'query');

      // Pages query returns only non-deleted
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [page1, page2],
      });

      // Links query - CozoDB already filters, but we double-check in JS
      querySpy.mockResolvedValueOnce({
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id'],
        rows: [link1to2],
      });

      const result = await service.getFullGraph();

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
    });

    it('should handle pages with daily note dates', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [dailyNotePage],
      });

      querySpy.mockResolvedValueOnce({
        headers: [],
        rows: [],
      });

      const result = await service.getFullGraph();

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]?.dailyNoteDate).toBe('2024-01-15');
    });

    it('should wrap repository errors with context', async () => {
      const querySpy = vi.spyOn(db, 'query');
      const originalError = new Error('Database connection lost');
      querySpy.mockRejectedValueOnce(originalError);

      const error = await service.getFullGraph().catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toContain('Failed to get full graph');
      expect(error.cause).toBe(originalError);
    });

    it('should re-throw DoubleBindError without wrapping', async () => {
      const querySpy = vi.spyOn(db, 'query');
      const originalError = new DoubleBindError('Custom error', ErrorCode.BLOCKED_OPERATION);
      querySpy.mockRejectedValueOnce(originalError);

      const error = await service.getFullGraph().catch((e) => e);

      expect(error).toBe(originalError);
      expect(error.code).toBe(ErrorCode.BLOCKED_OPERATION);
    });

    it('should handle different link types', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [page1, page2, page3, page4],
      });

      querySpy.mockResolvedValueOnce({
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id'],
        rows: [link1to2, link3to4, link1to3],
      });

      const result = await service.getFullGraph();

      expect(result.edges).toHaveLength(3);

      const linkTypes = result.edges.map((e) => e.linkType);
      expect(linkTypes).toContain('reference');
      expect(linkTypes).toContain('embed');
      expect(linkTypes).toContain('tag');
    });

    it('should handle null context_block_id in links', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [page1, page3],
      });

      querySpy.mockResolvedValueOnce({
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id'],
        rows: [link1to3], // This link has null context_block_id
      });

      const result = await service.getFullGraph();

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]?.contextBlockId).toBeNull();
    });
  });

  describe('getNeighborhood', () => {
    it('should return center page with no edges when hops is 0', async () => {
      const querySpy = vi.spyOn(db, 'query');

      // Center page query
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [page1],
      });

      const result = await service.getNeighborhood('page-1', 0);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]?.pageId).toBe('page-1');
      expect(result.edges).toHaveLength(0);
    });

    it('should throw PAGE_NOT_FOUND when center page does not exist', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: [],
        rows: [],
      });

      await expect(service.getNeighborhood('nonexistent', 1)).rejects.toThrow(DoubleBindError);
      await expect(service.getNeighborhood('nonexistent', 1)).rejects.toMatchObject({
        code: ErrorCode.PAGE_NOT_FOUND,
      });
    });

    it('should include error message with pageId', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: [],
        rows: [],
      });

      const error = await service.getNeighborhood('my-page-id', 1).catch((e) => e);

      expect(error.message).toContain('my-page-id');
    });

    it('should return 1-hop neighbors with their edges', async () => {
      const querySpy = vi.spyOn(db, 'query');

      // Center page query
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [page1],
      });

      // Neighborhood recursive query - returns neighbor page IDs
      querySpy.mockResolvedValueOnce({
        headers: ['neighbor'],
        rows: [['page-2'], ['page-3']],
      });

      // Full page data for neighbors
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [page1, page2, page3],
      });

      // Edges between neighbors
      querySpy.mockResolvedValueOnce({
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id'],
        rows: [link1to2, link1to3],
      });

      const result = await service.getNeighborhood('page-1', 1);

      expect(result.nodes).toHaveLength(3);
      expect(result.nodes.map((n) => n.pageId)).toContain('page-1');
      expect(result.nodes.map((n) => n.pageId)).toContain('page-2');
      expect(result.nodes.map((n) => n.pageId)).toContain('page-3');

      expect(result.edges).toHaveLength(2);
    });

    it('should return 2-hop neighbors', async () => {
      const querySpy = vi.spyOn(db, 'query');

      // Center page query
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [page1],
      });

      // Neighborhood recursive query - returns all neighbors within 2 hops
      querySpy.mockResolvedValueOnce({
        headers: ['neighbor'],
        rows: [['page-2'], ['page-3'], ['page-4']],
      });

      // Full page data for neighbors
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [page1, page2, page3, page4],
      });

      // Edges between all neighbors
      querySpy.mockResolvedValueOnce({
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id'],
        rows: [link1to2, link2to3, link3to4],
      });

      const result = await service.getNeighborhood('page-1', 2);

      expect(result.nodes).toHaveLength(4);
      expect(result.edges).toHaveLength(3);
    });

    it('should throw INVALID_CONTENT for negative hops', async () => {
      await expect(service.getNeighborhood('page-1', -1)).rejects.toThrow(DoubleBindError);
      await expect(service.getNeighborhood('page-1', -1)).rejects.toMatchObject({
        code: ErrorCode.INVALID_CONTENT,
      });
    });

    it('should wrap repository errors with context', async () => {
      const querySpy = vi.spyOn(db, 'query');
      const originalError = new Error('Network timeout');
      querySpy.mockRejectedValueOnce(originalError);

      const error = await service.getNeighborhood('page-1', 1).catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toContain('Failed to get neighborhood');
      expect(error.message).toContain('page-1');
      expect(error.message).toContain('1 hops');
      expect(error.cause).toBe(originalError);
    });

    it('should re-throw DoubleBindError without wrapping', async () => {
      const querySpy = vi.spyOn(db, 'query');
      const originalError = new DoubleBindError('Blocked', ErrorCode.BLOCKED_OPERATION);
      querySpy.mockRejectedValueOnce(originalError);

      const error = await service.getNeighborhood('page-1', 1).catch((e) => e);

      expect(error).toBe(originalError);
      expect(error.code).toBe(ErrorCode.BLOCKED_OPERATION);
    });

    it('should handle bidirectional links (incoming edges)', async () => {
      // Test that links pointing TO the center are also included
      const querySpy = vi.spyOn(db, 'query');

      // Center page query - page-2 is in the middle
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [page2],
      });

      // Neighborhood query should find page-1 (which links TO page-2) and page-3 (which page-2 links TO)
      querySpy.mockResolvedValueOnce({
        headers: ['neighbor'],
        rows: [['page-1'], ['page-3']],
      });

      // Full page data
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [page1, page2, page3],
      });

      // Edges
      querySpy.mockResolvedValueOnce({
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id'],
        rows: [link1to2, link2to3],
      });

      const result = await service.getNeighborhood('page-2', 1);

      expect(result.nodes).toHaveLength(3);
      expect(result.nodes.map((n) => n.pageId)).toContain('page-1');
      expect(result.nodes.map((n) => n.pageId)).toContain('page-2');
      expect(result.nodes.map((n) => n.pageId)).toContain('page-3');
    });

    it('should handle isolated pages with no neighbors', async () => {
      const isolatedPage = ['page-isolated', 'Isolated Page', now, now, false, null];

      const querySpy = vi.spyOn(db, 'query');

      // Center page query
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [isolatedPage],
      });

      // Neighborhood query - no neighbors
      querySpy.mockResolvedValueOnce({
        headers: ['neighbor'],
        rows: [],
      });

      // Full page data - just the isolated page
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [isolatedPage],
      });

      // Edges - none
      querySpy.mockResolvedValueOnce({
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id'],
        rows: [],
      });

      const result = await service.getNeighborhood('page-isolated', 1);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]?.pageId).toBe('page-isolated');
      expect(result.edges).toHaveLength(0);
    });

    it('should handle large hop counts', async () => {
      const querySpy = vi.spyOn(db, 'query');

      // Center page query
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [page1],
      });

      // Neighborhood query for 5 hops
      querySpy.mockResolvedValueOnce({
        headers: ['neighbor'],
        rows: [['page-2'], ['page-3'], ['page-4']],
      });

      // Full page data
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [page1, page2, page3, page4],
      });

      // Edges
      querySpy.mockResolvedValueOnce({
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id'],
        rows: [link1to2, link2to3, link3to4],
      });

      const result = await service.getNeighborhood('page-1', 5);

      // Should include all reachable pages
      expect(result.nodes).toHaveLength(4);
      expect(result.edges).toHaveLength(3);
    });
  });

  describe('error handling patterns', () => {
    it('should preserve DoubleBindError code when re-throwing', async () => {
      const querySpy = vi.spyOn(db, 'query');
      const originalError = new DoubleBindError('Page locked', ErrorCode.BLOCKED_OPERATION);
      querySpy.mockRejectedValueOnce(originalError);

      const error = await service.getFullGraph().catch((e) => e);

      // Should NOT wrap - should re-throw original
      expect(error).toBe(originalError);
      expect(error.code).toBe(ErrorCode.BLOCKED_OPERATION);
    });

    it('should handle non-Error thrown values', async () => {
      const querySpy = vi.spyOn(db, 'query');
      querySpy.mockRejectedValueOnce('string error');

      const error = await service.getFullGraph().catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.message).toContain('string error');
      expect(error.cause).toBeUndefined();
    });
  });

  describe('row validation', () => {
    it('should throw on invalid page_id type', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [[123, 'Title', now, now, false, null]], // Invalid: page_id should be string
      });

      const error = await service.getFullGraph().catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
    });

    it('should throw on invalid link_type', async () => {
      const querySpy = vi.spyOn(db, 'query');

      // First query returns valid pages
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
        rows: [page1, page2],
      });

      // Second query returns link with invalid link_type
      querySpy.mockResolvedValueOnce({
        headers: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id'],
        rows: [['page-1', 'page-2', 'invalid_type', now, null]],
      });

      const error = await service.getFullGraph().catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
    });
  });

  describe('getPageRank', () => {
    it('should return PageRank scores for all non-deleted pages', async () => {
      const querySpy = vi.spyOn(db, 'query');

      // PageRank query result
      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'score'],
        rows: [
          ['page-1', 0.35],
          ['page-2', 0.25],
          ['page-3', 0.4],
        ],
      });

      const result = await service.getPageRank();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(3);
      expect(result.get('page-1')).toBe(0.35);
      expect(result.get('page-2')).toBe(0.25);
      expect(result.get('page-3')).toBe(0.4);
    });

    it('should return empty map when no pages exist', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'score'],
        rows: [],
      });

      const result = await service.getPageRank();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should throw on invalid page_id type in result', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'score'],
        rows: [[123, 0.5]], // Invalid: page_id should be string
      });

      const error = await service.getPageRank().catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toContain('Invalid page_id type');
    });

    it('should throw on invalid score type in result', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'score'],
        rows: [['page-1', 'not-a-number']], // Invalid: score should be number
      });

      const error = await service.getPageRank().catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toContain('Invalid score type');
    });

    it('should wrap repository errors with context', async () => {
      const querySpy = vi.spyOn(db, 'query');
      const originalError = new Error('Database connection lost');
      querySpy.mockRejectedValueOnce(originalError);

      const error = await service.getPageRank().catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toContain('Failed to compute PageRank');
      expect(error.cause).toBe(originalError);
    });

    it('should re-throw DoubleBindError without wrapping', async () => {
      const querySpy = vi.spyOn(db, 'query');
      const originalError = new DoubleBindError('Custom error', ErrorCode.BLOCKED_OPERATION);
      querySpy.mockRejectedValueOnce(originalError);

      const error = await service.getPageRank().catch((e) => e);

      expect(error).toBe(originalError);
      expect(error.code).toBe(ErrorCode.BLOCKED_OPERATION);
    });

    it('should call query with correct PageRank script', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'score'],
        rows: [],
      });

      await service.getPageRank();

      expect(querySpy).toHaveBeenCalledTimes(1);
      const script = querySpy.mock.calls[0]![0] as string;
      expect(script).toContain('PageRank');
      expect(script).toContain('*links');
      expect(script).toContain('is_deleted: false');
    });
  });

  describe('getCommunities', () => {
    it('should return community IDs for all non-deleted pages', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'group'],
        rows: [
          ['page-1', 0],
          ['page-2', 0],
          ['page-3', 1],
          ['page-4', 1],
        ],
      });

      const result = await service.getCommunities();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(4);
      expect(result.get('page-1')).toBe(0);
      expect(result.get('page-2')).toBe(0);
      expect(result.get('page-3')).toBe(1);
      expect(result.get('page-4')).toBe(1);
    });

    it('should return empty map when no pages exist', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'group'],
        rows: [],
      });

      const result = await service.getCommunities();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should throw on invalid page_id type in result', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'group'],
        rows: [[123, 0]], // Invalid: page_id should be string
      });

      const error = await service.getCommunities().catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toContain('Invalid page_id type');
    });

    it('should throw on invalid group type in result', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'group'],
        rows: [['page-1', 'not-a-number']], // Invalid: group should be number
      });

      const error = await service.getCommunities().catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toContain('Invalid group type');
    });

    it('should wrap repository errors with context', async () => {
      const querySpy = vi.spyOn(db, 'query');
      const originalError = new Error('Database timeout');
      querySpy.mockRejectedValueOnce(originalError);

      const error = await service.getCommunities().catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toContain('Failed to detect communities');
      expect(error.cause).toBe(originalError);
    });

    it('should re-throw DoubleBindError without wrapping', async () => {
      const querySpy = vi.spyOn(db, 'query');
      const originalError = new DoubleBindError('Custom error', ErrorCode.BLOCKED_OPERATION);
      querySpy.mockRejectedValueOnce(originalError);

      const error = await service.getCommunities().catch((e) => e);

      expect(error).toBe(originalError);
      expect(error.code).toBe(ErrorCode.BLOCKED_OPERATION);
    });

    it('should call query with correct Louvain script', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: ['page_id', 'group'],
        rows: [],
      });

      await service.getCommunities();

      expect(querySpy).toHaveBeenCalledTimes(1);
      const script = querySpy.mock.calls[0]![0] as string;
      expect(script).toContain('CommunityDetectionLouvain');
      expect(script).toContain('*links');
      expect(script).toContain('is_deleted: false');
    });
  });

  describe('getSuggestedLinks', () => {
    it('should return suggested pages with scores', async () => {
      const querySpy = vi.spyOn(db, 'query');

      // First call: verify page exists
      querySpy.mockResolvedValueOnce({
        headers: ['page_id'],
        rows: [['page-1']],
      });

      // Second call: get suggestions
      querySpy.mockResolvedValueOnce({
        headers: [
          'page_id',
          'title',
          'created_at',
          'updated_at',
          'is_deleted',
          'daily_note_date',
          'score',
        ],
        rows: [
          ['page-3', 'Page Three', now, now, false, null, 5],
          ['page-4', 'Page Four', now, now, false, null, 3],
        ],
      });

      const result = await service.getSuggestedLinks('page-1');

      expect(result).toHaveLength(2);
      expect(result[0]?.target.pageId).toBe('page-3');
      expect(result[0]?.target.title).toBe('Page Three');
      expect(result[0]?.score).toBe(5);
      expect(result[1]?.target.pageId).toBe('page-4');
      expect(result[1]?.score).toBe(3);
    });

    it('should return empty array when no suggestions', async () => {
      const querySpy = vi.spyOn(db, 'query');

      // Verify page exists
      querySpy.mockResolvedValueOnce({
        headers: ['page_id'],
        rows: [['page-1']],
      });

      // No suggestions
      querySpy.mockResolvedValueOnce({
        headers: [],
        rows: [],
      });

      const result = await service.getSuggestedLinks('page-1');

      expect(result).toHaveLength(0);
    });

    it('should throw PAGE_NOT_FOUND when page does not exist', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: [],
        rows: [],
      });

      await expect(service.getSuggestedLinks('nonexistent')).rejects.toThrow(DoubleBindError);
      await expect(service.getSuggestedLinks('nonexistent')).rejects.toMatchObject({
        code: ErrorCode.PAGE_NOT_FOUND,
      });
    });

    it('should include error message with pageId', async () => {
      const querySpy = vi.spyOn(db, 'query');

      querySpy.mockResolvedValueOnce({
        headers: [],
        rows: [],
      });

      const error = await service.getSuggestedLinks('my-page-id').catch((e) => e);

      expect(error.message).toContain('my-page-id');
    });

    it('should throw on invalid score type in result', async () => {
      const querySpy = vi.spyOn(db, 'query');

      // Verify page exists
      querySpy.mockResolvedValueOnce({
        headers: ['page_id'],
        rows: [['page-1']],
      });

      // Invalid score type
      querySpy.mockResolvedValueOnce({
        headers: [
          'page_id',
          'title',
          'created_at',
          'updated_at',
          'is_deleted',
          'daily_note_date',
          'score',
        ],
        rows: [['page-2', 'Page Two', now, now, false, null, 'not-a-number']],
      });

      const error = await service.getSuggestedLinks('page-1').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toContain('Invalid score type');
    });

    it('should wrap repository errors with context', async () => {
      const querySpy = vi.spyOn(db, 'query');
      const originalError = new Error('Query timeout');
      querySpy.mockRejectedValueOnce(originalError);

      const error = await service.getSuggestedLinks('page-1').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toContain('Failed to get suggested links');
      expect(error.message).toContain('page-1');
      expect(error.cause).toBe(originalError);
    });

    it('should re-throw DoubleBindError without wrapping', async () => {
      const querySpy = vi.spyOn(db, 'query');
      const originalError = new DoubleBindError('Custom error', ErrorCode.BLOCKED_OPERATION);
      querySpy.mockRejectedValueOnce(originalError);

      const error = await service.getSuggestedLinks('page-1').catch((e) => e);

      expect(error).toBe(originalError);
      expect(error.code).toBe(ErrorCode.BLOCKED_OPERATION);
    });

    it('should pass correct pageId parameter to query', async () => {
      const querySpy = vi.spyOn(db, 'query');

      // Verify page exists
      querySpy.mockResolvedValueOnce({
        headers: ['page_id'],
        rows: [['test-page-123']],
      });

      // Suggestions query
      querySpy.mockResolvedValueOnce({
        headers: [],
        rows: [],
      });

      await service.getSuggestedLinks('test-page-123');

      // Verify both queries received the correct page_id parameter
      expect(querySpy).toHaveBeenCalledTimes(2);
      expect(querySpy.mock.calls[0]![1]).toEqual({ page_id: 'test-page-123' });
      expect(querySpy.mock.calls[1]![1]).toEqual({ page_id: 'test-page-123' });
    });

    it('should handle pages with daily note dates in suggestions', async () => {
      const querySpy = vi.spyOn(db, 'query');

      // Verify page exists
      querySpy.mockResolvedValueOnce({
        headers: ['page_id'],
        rows: [['page-1']],
      });

      // Suggestion includes a daily note page
      querySpy.mockResolvedValueOnce({
        headers: [
          'page_id',
          'title',
          'created_at',
          'updated_at',
          'is_deleted',
          'daily_note_date',
          'score',
        ],
        rows: [['page-daily', '2024-01-15', now, now, false, '2024-01-15', 4]],
      });

      const result = await service.getSuggestedLinks('page-1');

      expect(result).toHaveLength(1);
      expect(result[0]?.target.dailyNoteDate).toBe('2024-01-15');
    });
  });
});
