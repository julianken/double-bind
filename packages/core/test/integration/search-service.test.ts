// Integration tests for SearchService against real SQLite FTS5
// Tests full-text search, ranking, phrase queries, and special characters

import { describe, it, expect, beforeEach } from 'vitest';
import type { Database } from '@double-bind/types';
import { SearchService } from '../../src/services/search-service.js';
import { createTestDatabase } from './setup.js';

describe('SearchService Integration Tests', () => {
  let db: Database;
  let service: SearchService;

  beforeEach(async () => {
    db = await createTestDatabase();
    service = new SearchService(db);
  });

  // ============================================================================
  // Basic FTS Block Search
  // ============================================================================

  describe('Block Search', () => {
    beforeEach(async () => {
      const now = Date.now();

      // Create pages
      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p1', 'Testing Guide', $now, $now, 0, NULL)`,
        { now }
      );
      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p2', 'Architecture', $now, $now, 0, NULL)`,
        { now }
      );

      // Create blocks with searchable content
      await db.mutate(
        `INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order", is_collapsed, is_deleted, created_at, updated_at)
         VALUES ('b1', 'p1', NULL, 'integration testing ensures database queries work correctly', 'text', 'a0', 0, 0, $now, $now)`,
        { now }
      );
      await db.mutate(
        `INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order", is_collapsed, is_deleted, created_at, updated_at)
         VALUES ('b2', 'p1', NULL, 'unit testing isolates business logic', 'text', 'a1', 0, 0, $now, $now)`,
        { now }
      );
      await db.mutate(
        `INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order", is_collapsed, is_deleted, created_at, updated_at)
         VALUES ('b3', 'p2', NULL, 'the system architecture follows hexagonal design', 'text', 'a0', 0, 0, $now, $now)`,
        { now }
      );
      await db.mutate(
        `INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order", is_collapsed, is_deleted, created_at, updated_at)
         VALUES ('b4', 'p2', NULL, 'testing is critical for quality', 'text', 'a1', 0, 0, $now, $now)`,
        { now }
      );
    });

    it('should find blocks by single word', async () => {
      const results = await service.search('testing');

      expect(results.length).toBeGreaterThan(0);

      // Should find blocks containing "testing"
      const blockResults = results.filter((r) => r.type === 'block');
      expect(blockResults.length).toBeGreaterThan(0);

      // Verify content contains search term
      for (const result of blockResults) {
        expect(result.content.toLowerCase()).toContain('test');
      }
    });

    it('should find blocks by multiple words', async () => {
      const results = await service.search('integration');

      expect(results.length).toBeGreaterThan(0);

      // Should find blocks containing the term
      const blockResults = results.filter((r) => r.type === 'block');
      expect(blockResults.length).toBeGreaterThan(0);
    });

    it('should rank results by relevance (BM25)', async () => {
      // Search for "testing" - should appear in multiple blocks
      const results = await service.search('testing');

      expect(results.length).toBeGreaterThan(1);

      // Results should be sorted by score descending
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i]!.score).toBeGreaterThanOrEqual(results[i + 1]!.score);
      }

      // All results should have positive scores
      for (const result of results) {
        expect(result.score).toBeGreaterThan(0);
      }
    });

    it('should exclude deleted blocks', async () => {
      const now = Date.now();

      // Create a deleted block with search term
      // Note: is_deleted=1 means the FTS trigger will NOT insert into blocks_fts
      await db.mutate(
        `INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order", is_collapsed, is_deleted, created_at, updated_at)
         VALUES ('b_deleted', 'p1', NULL, 'This deleted block mentions hexagonal', 'text', 'a2', 0, 1, $now, $now)`,
        { now }
      );

      // Search for a term that exists in both active and deleted blocks
      const results = await service.search('hexagonal');

      // Should not find the deleted block
      const deletedBlock = results.find((r) => r.id === 'b_deleted');
      expect(deletedBlock).toBeUndefined();
    });

    it('should exclude blocks on deleted pages', async () => {
      const now = Date.now();

      // Create a deleted page with blocks
      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p_deleted', 'Deleted Page', $now, $now, 1, NULL)`,
        { now }
      );

      // Note: is_deleted=0 for block, but page is deleted
      // The FTS trigger fires because block is_deleted=0, so it goes into blocks_fts
      // But the SearchService query JOINs with pages and checks p.is_deleted = 0
      await db.mutate(
        `INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order", is_collapsed, is_deleted, created_at, updated_at)
         VALUES ('b_orphan', 'p_deleted', NULL, 'This block is on a deleted page with unique keyword orphaned', 'text', 'a0', 0, 0, $now, $now)`,
        { now }
      );

      const results = await service.search('orphaned');

      // Should not find blocks on deleted pages
      expect(results).toHaveLength(0);
    });

    it('should return empty array for non-matching query', async () => {
      const results = await service.search('nonexistent_xyz_term');

      expect(results).toHaveLength(0);
    });
  });

  // ============================================================================
  // FTS Page Search
  // ============================================================================

  describe('Page Search', () => {
    beforeEach(async () => {
      const now = Date.now();

      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p1', 'JavaScript Programming Guide', $now, $now, 0, NULL)`,
        { now }
      );
      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p2', 'TypeScript Best Practices', $now, $now, 0, NULL)`,
        { now }
      );
      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p3', 'Python Tutorial', $now, $now, 0, NULL)`,
        { now }
      );
      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p4', 'JavaScript Testing', $now, $now, 0, NULL)`,
        { now }
      );
    });

    it('should find pages by title', async () => {
      const results = await service.search('JavaScript');

      expect(results.length).toBeGreaterThan(0);

      // Should find pages with "JavaScript" in title
      const pageResults = results.filter((r) => r.type === 'page');
      expect(pageResults.length).toBe(2); // p1 and p4

      const titles = pageResults.map((r) => r.title);
      expect(titles).toContain('JavaScript Programming Guide');
      expect(titles).toContain('JavaScript Testing');
    });

    it('should rank page matches by relevance', async () => {
      const results = await service.search('TypeScript');

      expect(results.length).toBeGreaterThan(0);

      // TypeScript page should be highly ranked
      const typeScriptPage = results.find((r) => r.title === 'TypeScript Best Practices');
      expect(typeScriptPage).toBeDefined();
      expect(typeScriptPage?.score).toBeGreaterThan(0);
    });

    it('should exclude deleted pages', async () => {
      // Delete page p2
      await db.mutate(
        `UPDATE pages SET is_deleted = 1, updated_at = $now WHERE page_id = 'p2'`,
        { now: Date.now() }
      );

      const results = await service.search('TypeScript');

      // Should not find deleted page
      const deletedPage = results.find((r) => r.id === 'p2');
      expect(deletedPage).toBeUndefined();
    });
  });

  // ============================================================================
  // Combined Page + Block Search
  // ============================================================================

  describe('Combined Search', () => {
    beforeEach(async () => {
      const now = Date.now();

      // Create page with search term in title
      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p1', 'testing strategies', $now, $now, 0, NULL)`,
        { now }
      );
      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p2', 'architecture', $now, $now, 0, NULL)`,
        { now }
      );

      // Create block with search term in content
      await db.mutate(
        `INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order", is_collapsed, is_deleted, created_at, updated_at)
         VALUES ('b1', 'p2', NULL, 'unit testing is essential for quality', 'text', 'a0', 0, 0, $now, $now)`,
        { now }
      );
    });

    it('should return both page and block matches', async () => {
      const results = await service.search('testing');

      expect(results.length).toBeGreaterThanOrEqual(1);

      const pageResults = results.filter((r) => r.type === 'page');
      const blockResults = results.filter((r) => r.type === 'block');

      expect(pageResults).toHaveLength(1);
      expect(blockResults).toHaveLength(1);

      // Verify page result
      expect(pageResults[0]?.title).toBe('testing strategies');
      expect(pageResults[0]?.id).toBe('p1');

      // Verify block result
      expect(blockResults[0]?.pageId).toBe('p2');
      expect(blockResults[0]?.content).toContain('testing');
    });

    it('should merge and sort results by score', async () => {
      const results = await service.search('testing');

      // Results should be sorted by score descending
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i]!.score).toBeGreaterThanOrEqual(results[i + 1]!.score);
      }
    });
  });

  // ============================================================================
  // Search Options
  // ============================================================================

  describe('Search Options', () => {
    beforeEach(async () => {
      const now = Date.now();

      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p1', 'Search Test', $now, $now, 0, NULL)`,
        { now }
      );

      for (let i = 1; i <= 30; i++) {
        await db.mutate(
          `INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order", is_collapsed, is_deleted, created_at, updated_at)
           VALUES ($block_id, 'p1', NULL, $content, 'text', $order, 0, 0, $now, $now)`,
          { block_id: `b${i}`, content: `Block ${i} contains the word search`, order: `a${String(i).padStart(2, '0')}`, now }
        );
      }
    });

    it('should respect limit option', async () => {
      const results = await service.search('search', { limit: 5 });

      // Should return at most 5 results per type (5 blocks + 1 page max)
      expect(results.length).toBeLessThanOrEqual(6);
    });

    it('should filter by includeTypes (pages only)', async () => {
      const results = await service.search('search', { includeTypes: ['page'] });

      // The important thing is no blocks are returned
      const blockResults = results.filter((r) => r.type === 'block');
      expect(blockResults).toHaveLength(0);
    });

    it('should filter by includeTypes (blocks only)', async () => {
      const results = await service.search('search', { includeTypes: ['block'] });

      expect(results.length).toBeGreaterThan(0);

      for (const result of results) {
        expect(result.type).toBe('block');
      }
    });

    it('should filter by minScore', async () => {
      const allResults = await service.search('search');
      expect(allResults.length).toBeGreaterThan(0);

      // Get median score (but handle case where all scores are the same)
      const scores = allResults.map((r) => r.score).sort((a, b) => b - a);
      const medianScore = scores[Math.floor(scores.length / 2)]!;
      const maxScore = scores[0]!;

      // Use a threshold higher than median
      const threshold = medianScore + (maxScore - medianScore) * 0.5;

      const filteredResults = await service.search('search', { minScore: threshold });

      // All results should have score >= minScore
      for (const result of filteredResults) {
        expect(result.score).toBeGreaterThanOrEqual(threshold);
      }

      // Should have fewer or equal results than unfiltered
      expect(filteredResults.length).toBeLessThanOrEqual(allResults.length);
    });
  });

  // ============================================================================
  // Phrase Queries
  // ============================================================================

  describe('Phrase Queries', () => {
    beforeEach(async () => {
      const now = Date.now();

      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p1', 'Test Page', $now, $now, 0, NULL)`,
        { now }
      );

      await db.mutate(
        `INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order", is_collapsed, is_deleted, created_at, updated_at)
         VALUES ('b1', 'p1', NULL, 'The quick brown fox jumps over the lazy dog', 'text', 'a0', 0, 0, $now, $now)`,
        { now }
      );
      await db.mutate(
        `INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order", is_collapsed, is_deleted, created_at, updated_at)
         VALUES ('b2', 'p1', NULL, 'A fox jumps quickly', 'text', 'a1', 0, 0, $now, $now)`,
        { now }
      );
      await db.mutate(
        `INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order", is_collapsed, is_deleted, created_at, updated_at)
         VALUES ('b3', 'p1', NULL, 'The brown dog is lazy', 'text', 'a2', 0, 0, $now, $now)`,
        { now }
      );
    });

    it('should handle multi-word queries', async () => {
      const results = await service.search('quick brown');

      expect(results.length).toBeGreaterThan(0);

      // Should find blocks containing both words
      const matchingBlocks = results.filter(
        (r) => r.type === 'block' && r.content.toLowerCase().includes('quick') && r.content.toLowerCase().includes('brown')
      );
      expect(matchingBlocks.length).toBeGreaterThan(0);
    });

    it('should handle quoted phrases', async () => {
      // FTS5 uses double quotes for phrase search
      // Our sanitizer strips quotes, so this becomes a regular multi-word search
      const results = await service.search('"quick brown fox"');

      // Should not throw an error
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ============================================================================
  // Special Character Handling
  // ============================================================================

  describe('Special Character Handling', () => {
    beforeEach(async () => {
      const now = Date.now();

      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p1', 'Special Page', $now, $now, 0, NULL)`,
        { now }
      );

      await db.mutate(
        `INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order", is_collapsed, is_deleted, created_at, updated_at)
         VALUES ('b1', 'p1', NULL, 'Link to [[Another Page]] in double brackets', 'text', 'a0', 0, 0, $now, $now)`,
        { now }
      );
      await db.mutate(
        `INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order", is_collapsed, is_deleted, created_at, updated_at)
         VALUES ('b2', 'p1', NULL, 'Code snippet: function test() { return true; }', 'text', 'a1', 0, 0, $now, $now)`,
        { now }
      );
      await db.mutate(
        `INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order", is_collapsed, is_deleted, created_at, updated_at)
         VALUES ('b3', 'p1', NULL, 'Unicode characters: cafe, naive, Japanese', 'text', 'a2', 0, 0, $now, $now)`,
        { now }
      );
      await db.mutate(
        `INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order", is_collapsed, is_deleted, created_at, updated_at)
         VALUES ('b4', 'p1', NULL, 'Email: user@example.com and URL: https://example.com', 'text', 'a3', 0, 0, $now, $now)`,
        { now }
      );
    });

    it('should handle wiki link brackets', async () => {
      const results = await service.search('Another Page');

      expect(results.length).toBeGreaterThan(0);

      // Should find the block with wiki link
      const wikiLinkBlock = results.find((r) => r.content.includes('[[Another Page]]'));
      expect(wikiLinkBlock).toBeDefined();
    });

    it('should handle code snippets with special characters', async () => {
      const results = await service.search('function test');

      expect(results.length).toBeGreaterThan(0);

      // Should find the code snippet block
      const codeBlock = results.find((r) => r.content.includes('function test()'));
      expect(codeBlock).toBeDefined();
    });

    it('should handle unicode characters', async () => {
      const results = await service.search('cafe');

      // Should handle unicode search
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle email addresses', async () => {
      const results = await service.search('example');

      // Should find the block with email/URL
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle parentheses and brackets', async () => {
      const results = await service.search('brackets');

      expect(results.length).toBeGreaterThan(0);

      const bracketBlock = results.find((r) => r.content.includes('double brackets'));
      expect(bracketBlock).toBeDefined();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty search query', async () => {
      const results = await service.search('');
      expect(results).toHaveLength(0);
    });

    it('should handle search immediately after content creation', async () => {
      const now = Date.now();

      // Create page
      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p_new', 'Fresh Content with Unique Term XYZABC123', $now, $now, 0, NULL)`,
        { now }
      );

      // Search immediately (FTS5 triggers should have updated the index)
      const results = await service.search('XYZABC123');

      expect(results.length).toBeGreaterThan(0);

      const freshPage = results.find((r) => r.id === 'p_new');
      expect(freshPage).toBeDefined();
      expect(freshPage?.type).toBe('page');
    });

    it('should handle search with whitespace only', async () => {
      const results = await service.search('   ');
      expect(results).toHaveLength(0);
    });

    it('should handle very long search queries', async () => {
      const now = Date.now();

      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p1', 'Test', $now, $now, 0, NULL)`,
        { now }
      );

      const longQuery = 'test '.repeat(100);

      // Should not throw an error
      const results = await service.search(longQuery);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle case-insensitive search', async () => {
      const now = Date.now();

      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p_case', 'CamelCase Testing Title', $now, $now, 0, NULL)`,
        { now }
      );

      // Search for a common term that should match
      const lowerResults = await service.search('testing');
      const upperResults = await service.search('TESTING');

      // Case-insensitive search should work (FTS5 tokenizer normalizes case)
      expect(lowerResults.length).toBe(upperResults.length);
    });
  });

  // ============================================================================
  // Search Result Structure
  // ============================================================================

  describe('Search Result Structure', () => {
    beforeEach(async () => {
      const now = Date.now();

      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p1', 'Test Page', $now, $now, 0, NULL)`,
        { now }
      );

      await db.mutate(
        `INSERT INTO blocks (block_id, page_id, parent_id, content, content_type, "order", is_collapsed, is_deleted, created_at, updated_at)
         VALUES ('b1', 'p1', NULL, 'Test block content', 'text', 'a0', 0, 0, $now, $now)`,
        { now }
      );
    });

    it('should return correct structure for page results', async () => {
      const results = await service.search('Test Page');

      const pageResult = results.find((r) => r.type === 'page');
      expect(pageResult).toBeDefined();

      // Verify page result structure
      expect(pageResult?.type).toBe('page');
      expect(pageResult?.id).toBe('p1');
      expect(pageResult?.title).toBe('Test Page');
      expect(pageResult?.content).toBe('Test Page'); // For pages, content is title
      expect(pageResult?.score).toBeGreaterThan(0);
      expect(pageResult?.pageId).toBe('p1');
      expect(pageResult?.blockId).toBeUndefined();
    });

    it('should return correct structure for block results', async () => {
      const results = await service.search('block content');

      const blockResult = results.find((r) => r.type === 'block');
      expect(blockResult).toBeDefined();

      // Verify block result structure
      expect(blockResult?.type).toBe('block');
      expect(blockResult?.id).toBe('b1');
      expect(blockResult?.title).toBe('Test Page'); // Parent page title
      expect(blockResult?.content).toContain('block content');
      expect(blockResult?.score).toBeGreaterThan(0);
      expect(blockResult?.pageId).toBe('p1');
      expect(blockResult?.blockId).toBe('b1');
    });
  });
});
