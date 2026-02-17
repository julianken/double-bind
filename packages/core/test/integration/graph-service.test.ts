// Integration tests for GraphService
// Tests graph algorithms (PageRank, Louvain) and neighborhood queries
//
// Migrated to SQLite SQL queries and graphology algorithms.

import { describe, it, expect, beforeEach } from 'vitest';
import type { Database } from '@double-bind/types';
import { GraphService } from '../../src/services/graph-service.js';
import { createTestDatabase } from './setup.js';

describe('GraphService Integration Tests', () => {
  let db: Database;
  let service: GraphService;

  beforeEach(async () => {
    db = await createTestDatabase();
    service = new GraphService(db);
  });

  // ============================================================================
  // Full Graph Query
  // ============================================================================

  describe('getFullGraph', () => {
    it('should return empty graph when no pages exist', async () => {
      const result = await service.getFullGraph();

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it('should return all pages and links', async () => {
      // Create pages
      const now = Date.now();
      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p1', 'Page 1', $now, $now, 0, NULL),
                ('p2', 'Page 2', $now, $now, 0, NULL),
                ('p3', 'Page 3', $now, $now, 0, NULL)`,
        { now }
      );

      // Create links
      await db.mutate(
        `INSERT INTO links (source_id, target_id, link_type, created_at, context_block_id)
         VALUES ('p1', 'p2', 'reference', $now, NULL),
                ('p2', 'p3', 'reference', $now, NULL)`,
        { now }
      );

      const result = await service.getFullGraph();

      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(2);

      // Verify nodes
      const nodeIds = result.nodes.map((n) => n.pageId);
      expect(nodeIds).toContain('p1');
      expect(nodeIds).toContain('p2');
      expect(nodeIds).toContain('p3');

      // Verify edges
      const edge1 = result.edges.find((e) => e.sourceId === 'p1' && e.targetId === 'p2');
      expect(edge1).toBeDefined();
      expect(edge1?.linkType).toBe('reference');

      const edge2 = result.edges.find((e) => e.sourceId === 'p2' && e.targetId === 'p3');
      expect(edge2).toBeDefined();
    });

    it('should exclude deleted pages and their links', async () => {
      const now = Date.now();

      // Create pages (one deleted)
      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p1', 'Page 1', $now, $now, 0, NULL),
                ('p2', 'Page 2 (Deleted)', $now, $now, 1, NULL),
                ('p3', 'Page 3', $now, $now, 0, NULL)`,
        { now }
      );

      // Create links
      await db.mutate(
        `INSERT INTO links (source_id, target_id, link_type, created_at, context_block_id)
         VALUES ('p1', 'p2', 'reference', $now, NULL),
                ('p2', 'p3', 'reference', $now, NULL),
                ('p1', 'p3', 'reference', $now, NULL)`,
        { now }
      );

      const result = await service.getFullGraph();

      // Should only have 2 non-deleted pages
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes.map((n) => n.pageId)).not.toContain('p2');

      // Should only have 1 edge (p1->p3), not edges involving p2
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]?.sourceId).toBe('p1');
      expect(result.edges[0]?.targetId).toBe('p3');
    });
  });

  // ============================================================================
  // Neighborhood Queries
  // ============================================================================

  describe('getNeighborhood', () => {
    beforeEach(async () => {
      // Create a network:
      // center -> n1 -> n2 -> n3
      // center -> n4
      const now = Date.now();

      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('center', 'Center', $now, $now, 0, NULL),
                ('n1', 'Neighbor 1', $now, $now, 0, NULL),
                ('n2', 'Neighbor 2', $now, $now, 0, NULL),
                ('n3', 'Neighbor 3', $now, $now, 0, NULL),
                ('n4', 'Neighbor 4', $now, $now, 0, NULL),
                ('isolated', 'Isolated', $now, $now, 0, NULL)`,
        { now }
      );

      await db.mutate(
        `INSERT INTO links (source_id, target_id, link_type, created_at, context_block_id)
         VALUES ('center', 'n1', 'reference', $now, NULL),
                ('n1', 'n2', 'reference', $now, NULL),
                ('n2', 'n3', 'reference', $now, NULL),
                ('center', 'n4', 'reference', $now, NULL)`,
        { now }
      );
    });

    it('should return only center page for 0 hops', async () => {
      const result = await service.getNeighborhood('center', 0);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]?.pageId).toBe('center');
      expect(result.edges).toHaveLength(0);
    });

    it('should return 1-hop neighborhood', async () => {
      const result = await service.getNeighborhood('center', 1);

      // Should have center + n1 + n4 (direct neighbors)
      expect(result.nodes).toHaveLength(3);

      const nodeIds = result.nodes.map((n) => n.pageId);
      expect(nodeIds).toContain('center');
      expect(nodeIds).toContain('n1');
      expect(nodeIds).toContain('n4');

      // Should have 2 edges (center->n1, center->n4)
      expect(result.edges).toHaveLength(2);
    });

    it('should return 2-hop neighborhood', async () => {
      const result = await service.getNeighborhood('center', 2);

      // From center: 1-hop = n1, n4; 2-hop = n2 (via n1)
      // Bidirectional traversal means we also get reverse links
      expect(result.nodes.length).toBeGreaterThanOrEqual(4);
      expect(result.nodes.length).toBeLessThanOrEqual(5);

      const nodeIds = result.nodes.map((n) => n.pageId);
      expect(nodeIds).toContain('center');
      expect(nodeIds).toContain('n1');
      expect(nodeIds).toContain('n2');
      expect(nodeIds).toContain('n4');
      expect(nodeIds).not.toContain('isolated'); // not connected

      // Should have at least 3 edges
      expect(result.edges.length).toBeGreaterThanOrEqual(3);
    });

    it('should follow bidirectional links', async () => {
      const now = Date.now();

      // Add reverse link from n1 back to center
      await db.mutate(
        `INSERT INTO links (source_id, target_id, link_type, created_at, context_block_id)
         VALUES ('n1', 'center', 'reference', $now, NULL)`,
        { now }
      );

      const result = await service.getNeighborhood('n1', 1);

      const nodeIds = result.nodes.map((n) => n.pageId);
      expect(nodeIds).toContain('center'); // Via incoming link
      expect(nodeIds).toContain('n2'); // Via outgoing link
    });

    it('should handle isolated nodes', async () => {
      const result = await service.getNeighborhood('isolated', 1);

      // Isolated node has no neighbors
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]?.pageId).toBe('isolated');
      expect(result.edges).toHaveLength(0);
    });

    it('should reject negative hops', async () => {
      await expect(service.getNeighborhood('center', -1)).rejects.toThrow('Invalid hops parameter');
    });

    it('should throw PAGE_NOT_FOUND for non-existent page', async () => {
      await expect(service.getNeighborhood('non-existent', 1)).rejects.toThrow('Page not found');
    });

    it('should handle self-links', async () => {
      const now = Date.now();

      // Create a page with a self-link
      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('self', 'Self-Linked', $now, $now, 0, NULL)`,
        { now }
      );

      await db.mutate(
        `INSERT INTO links (source_id, target_id, link_type, created_at, context_block_id)
         VALUES ('self', 'self', 'reference', $now, NULL)`,
        { now }
      );

      const result = await service.getNeighborhood('self', 1);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]?.pageId).toBe('self');
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]?.sourceId).toBe('self');
      expect(result.edges[0]?.targetId).toBe('self');
    });
  });

  // ============================================================================
  // PageRank Algorithm
  // ============================================================================

  describe('getPageRank', () => {
    it('should return empty map when no pages exist', async () => {
      const ranks = await service.getPageRank();
      expect(ranks.size).toBe(0);
    });

    it('should compute PageRank for interconnected pages', async () => {
      // Create a realistic network with 20+ pages
      // Structure: Hub page with many incoming links should have highest rank
      const now = Date.now();

      const pageValues: string[] = [];
      for (let i = 1; i <= 25; i++) {
        pageValues.push(`('p${i}', 'Page ${i}', ${now}, ${now}, 0, NULL)`);
      }

      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ${pageValues.join(', ')}`
      );

      // Create links: p1 is a hub (many pages link to it)
      // p2-p10 all link to p1 (hub)
      // p11-p20 form a chain
      // p21-p25 are isolated
      const linkValues: string[] = [];
      for (let i = 2; i <= 10; i++) {
        linkValues.push(`('p${i}', 'p1', 'reference', ${now}, NULL)`);
      }
      for (let i = 11; i < 20; i++) {
        linkValues.push(`('p${i}', 'p${i + 1}', 'reference', ${now}, NULL)`);
      }

      await db.mutate(
        `INSERT INTO links (source_id, target_id, link_type, created_at, context_block_id)
         VALUES ${linkValues.join(', ')}`
      );

      const ranks = await service.getPageRank();

      // Should have ranks for pages with links
      expect(ranks.size).toBeGreaterThan(0);

      // p1 (hub with 9 incoming links) should have highest rank
      const hubRank = ranks.get('p1');
      expect(hubRank).toBeDefined();
      expect(hubRank).toBeGreaterThan(0);

      // p1 should have higher rank than pages in the chain
      const chainRank = ranks.get('p15');
      if (chainRank !== undefined) {
        expect(hubRank).toBeGreaterThan(chainRank);
      }

      // All ranks should be positive numbers
      for (const [pageId, score] of ranks.entries()) {
        expect(typeof pageId).toBe('string');
        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThan(0);
      }
    });

    it('should handle pages with no links', async () => {
      const now = Date.now();

      // Create isolated pages
      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p1', 'Page 1', $now, $now, 0, NULL),
                ('p2', 'Page 2', $now, $now, 0, NULL)`,
        { now }
      );

      const ranks = await service.getPageRank();

      // PageRank with no links returns empty result
      expect(ranks.size).toBe(0);
    });

    it('should handle bidirectional links', async () => {
      const now = Date.now();

      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p1', 'Page 1', $now, $now, 0, NULL),
                ('p2', 'Page 2', $now, $now, 0, NULL)`,
        { now }
      );

      await db.mutate(
        `INSERT INTO links (source_id, target_id, link_type, created_at, context_block_id)
         VALUES ('p1', 'p2', 'reference', $now, NULL),
                ('p2', 'p1', 'reference', $now, NULL)`,
        { now }
      );

      const ranks = await service.getPageRank();

      expect(ranks.size).toBe(2);

      const rank1 = ranks.get('p1');
      const rank2 = ranks.get('p2');

      // Both pages should have similar ranks (symmetric links)
      expect(rank1).toBeDefined();
      expect(rank2).toBeDefined();
      expect(Math.abs(rank1! - rank2!)).toBeLessThan(0.01);
    });
  });

  // ============================================================================
  // Louvain Community Detection
  // ============================================================================

  describe('getCommunities', () => {
    it('should return empty map when no pages exist', async () => {
      const communities = await service.getCommunities();
      expect(communities.size).toBe(0);
    });

    it('should detect communities in clustered graph', async () => {
      // Create a graph with two distinct communities
      // Cluster A: p1-p8 densely connected
      // Cluster B: p9-p16 densely connected
      // Cluster C: p17-p24 densely connected
      // Sparse links between clusters
      const now = Date.now();

      const pageValues: string[] = [];
      for (let i = 1; i <= 25; i++) {
        pageValues.push(`('p${i}', 'Page ${i}', ${now}, ${now}, 0, NULL)`);
      }

      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ${pageValues.join(', ')}`
      );

      // Cluster A (p1-p8): Dense internal links
      const clusterALinks: string[] = [];
      for (let i = 1; i <= 8; i++) {
        for (let j = i + 1; j <= 8; j++) {
          clusterALinks.push(`('p${i}', 'p${j}', 'reference', ${now}, NULL)`);
        }
      }

      // Cluster B (p9-p16): Dense internal links
      const clusterBLinks: string[] = [];
      for (let i = 9; i <= 16; i++) {
        for (let j = i + 1; j <= 16; j++) {
          clusterBLinks.push(`('p${i}', 'p${j}', 'reference', ${now}, NULL)`);
        }
      }

      // Cluster C (p17-p24): Dense internal links
      const clusterCLinks: string[] = [];
      for (let i = 17; i <= 24; i++) {
        for (let j = i + 1; j <= 24; j++) {
          clusterCLinks.push(`('p${i}', 'p${j}', 'reference', ${now}, NULL)`);
        }
      }

      // Sparse inter-cluster links
      const bridgeLinks = [
        `('p4', 'p12', 'reference', ${now}, NULL)`,
        `('p12', 'p20', 'reference', ${now}, NULL)`,
      ];

      const allLinks = [...clusterALinks, ...clusterBLinks, ...clusterCLinks, ...bridgeLinks];

      await db.mutate(
        `INSERT INTO links (source_id, target_id, link_type, created_at, context_block_id)
         VALUES ${allLinks.join(', ')}`
      );

      const communities = await service.getCommunities();

      expect(communities.size).toBeGreaterThan(0);

      // Pages in cluster A should be in the same community
      const communityA = communities.get('p1');
      expect(communityA).toBeDefined();
      expect(communities.get('p2')).toBe(communityA);
      expect(communities.get('p3')).toBe(communityA);

      // Pages in cluster B should be in the same community
      const communityB = communities.get('p9');
      expect(communityB).toBeDefined();
      expect(communities.get('p10')).toBe(communityB);
      expect(communities.get('p11')).toBe(communityB);

      // Pages in cluster C should be in the same community
      const communityC = communities.get('p17');
      expect(communityC).toBeDefined();
      expect(communities.get('p18')).toBe(communityC);
      expect(communities.get('p19')).toBe(communityC);

      // Different clusters should have different community IDs
      expect(communityA).not.toBe(communityB);
      expect(communityB).not.toBe(communityC);
      expect(communityA).not.toBe(communityC);

      // All community IDs should be numbers
      for (const [pageId, group] of communities.entries()) {
        expect(typeof pageId).toBe('string');
        expect(typeof group).toBe('number');
        expect(Number.isInteger(group)).toBe(true);
      }
    });

    it('should handle single-community graph', async () => {
      // All pages connected to each other (complete graph)
      const now = Date.now();

      const pageValues: string[] = [];
      for (let i = 1; i <= 10; i++) {
        pageValues.push(`('p${i}', 'Page ${i}', ${now}, ${now}, 0, NULL)`);
      }

      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ${pageValues.join(', ')}`
      );

      const linkValues: string[] = [];
      for (let i = 1; i <= 10; i++) {
        for (let j = i + 1; j <= 10; j++) {
          linkValues.push(`('p${i}', 'p${j}', 'reference', ${now}, NULL)`);
        }
      }

      await db.mutate(
        `INSERT INTO links (source_id, target_id, link_type, created_at, context_block_id)
         VALUES ${linkValues.join(', ')}`
      );

      const communities = await service.getCommunities();

      // All pages should be in the same community
      expect(communities.size).toBe(10);

      const firstCommunity = communities.get('p1');
      for (let i = 2; i <= 10; i++) {
        expect(communities.get(`p${i}`)).toBe(firstCommunity);
      }
    });

    it('should handle graph with no links', async () => {
      const now = Date.now();

      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('p1', 'Page 1', $now, $now, 0, NULL),
                ('p2', 'Page 2', $now, $now, 0, NULL)`,
        { now }
      );

      const communities = await service.getCommunities();

      // No links means no communities
      expect(communities.size).toBe(0);
    });
  });

  // ============================================================================
  // Suggested Links
  // ============================================================================

  describe('getSuggestedLinks', () => {
    beforeEach(async () => {
      // Create a network with potential suggestions
      const now = Date.now();

      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('center', 'Center', $now, $now, 0, NULL),
                ('connected', 'Connected', $now, $now, 0, NULL),
                ('suggested1', 'Suggested 1', $now, $now, 0, NULL),
                ('suggested2', 'Suggested 2', $now, $now, 0, NULL),
                ('distant', 'Distant', $now, $now, 0, NULL)`,
        { now }
      );

      // center -> connected
      // connected -> suggested1
      // connected -> suggested2
      // suggested1 -> distant
      await db.mutate(
        `INSERT INTO links (source_id, target_id, link_type, created_at, context_block_id)
         VALUES ('center', 'connected', 'reference', $now, NULL),
                ('connected', 'suggested1', 'reference', $now, NULL),
                ('connected', 'suggested2', 'reference', $now, NULL),
                ('suggested1', 'distant', 'reference', $now, NULL)`,
        { now }
      );
    });

    it('should suggest pages based on common neighbors', async () => {
      const suggestions = await service.getSuggestedLinks('center');

      // Should suggest suggested1 and suggested2 (both connected via 'connected')
      expect(suggestions.length).toBeGreaterThan(0);

      const suggestionIds = suggestions.map((s) => s.target.pageId);
      expect(suggestionIds).toContain('suggested1');
      expect(suggestionIds).toContain('suggested2');

      // Should not suggest already connected pages
      expect(suggestionIds).not.toContain('connected');

      // Each suggestion should have a score
      for (const suggestion of suggestions) {
        expect(suggestion.score).toBeGreaterThan(0);
      }
    });

    it('should return empty array when no suggestions exist', async () => {
      const now = Date.now();

      // Create an isolated page
      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('isolated', 'Isolated', $now, $now, 0, NULL)`,
        { now }
      );

      const suggestions = await service.getSuggestedLinks('isolated');

      expect(suggestions).toHaveLength(0);
    });

    it('should throw PAGE_NOT_FOUND for non-existent page', async () => {
      await expect(service.getSuggestedLinks('non-existent')).rejects.toThrow('Page not found');
    });

    it('should rank suggestions by number of shared connections', async () => {
      const now = Date.now();

      // Create pages
      await db.mutate(
        `INSERT INTO pages (page_id, title, created_at, updated_at, is_deleted, daily_note_date)
         VALUES ('source', 'Source', $now, $now, 0, NULL),
                ('neighbor1', 'Neighbor 1', $now, $now, 0, NULL),
                ('neighbor2', 'Neighbor 2', $now, $now, 0, NULL),
                ('suggested_high', 'Suggested High', $now, $now, 0, NULL),
                ('suggested_low', 'Suggested Low', $now, $now, 0, NULL)`,
        { now }
      );

      // source -> neighbor1, neighbor2
      // neighbor1, neighbor2 -> suggested_high (2 shared connections)
      // neighbor1 -> suggested_low (1 shared connection)
      await db.mutate(
        `INSERT INTO links (source_id, target_id, link_type, created_at, context_block_id)
         VALUES ('source', 'neighbor1', 'reference', $now, NULL),
                ('source', 'neighbor2', 'reference', $now, NULL),
                ('neighbor1', 'suggested_high', 'reference', $now, NULL),
                ('neighbor2', 'suggested_high', 'reference', $now, NULL),
                ('neighbor1', 'suggested_low', 'reference', $now, NULL)`,
        { now }
      );

      const suggestions = await service.getSuggestedLinks('source');

      // Should have 2 suggestions
      expect(suggestions.length).toBe(2);

      // suggested_high should rank higher than suggested_low
      const high = suggestions.find((s) => s.target.pageId === 'suggested_high');
      const low = suggestions.find((s) => s.target.pageId === 'suggested_low');

      expect(high).toBeDefined();
      expect(low).toBeDefined();
      expect(high!.score).toBeGreaterThan(low!.score);
    });
  });
});
