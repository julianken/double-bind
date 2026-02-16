// Integration tests for GraphService
// Tests graph algorithms (PageRank, Louvain) and neighborhood queries
//
// SKIPPED: GraphService still uses CozoDB Datalog queries (PageRank, Louvain).
// Will be migrated to SQL in Phase 3 (DBB-436).

import { describe, it, expect, beforeEach } from 'vitest';
import type { GraphDB } from '@double-bind/types';
import { GraphService } from '../../src/services/graph-service.js';
import { createTestDatabase } from './setup.js';

describe.skip('GraphService Integration Tests', () => {
  let db: GraphDB;
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
      const now = Date.now() / 1000;
      await db.mutate(
        `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [
          ["p1", "Page 1", $now, $now, false, null],
          ["p2", "Page 2", $now, $now, false, null],
          ["p3", "Page 3", $now, $now, false, null]
        ]
         :put pages { page_id => title, created_at, updated_at, is_deleted, daily_note_date }`,
        { now }
      );

      // Create links
      await db.mutate(
        `?[source_id, target_id, link_type, created_at, context_block_id] <- [
          ["p1", "p2", "reference", $now, null],
          ["p2", "p3", "reference", $now, null]
        ]
         :put links { source_id, target_id, link_type => created_at, context_block_id }`,
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
      const now = Date.now() / 1000;

      // Create pages (one deleted)
      await db.mutate(
        `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [
          ["p1", "Page 1", $now, $now, false, null],
          ["p2", "Page 2 (Deleted)", $now, $now, true, null],
          ["p3", "Page 3", $now, $now, false, null]
        ]
         :put pages { page_id => title, created_at, updated_at, is_deleted, daily_note_date }`,
        { now }
      );

      // Create links
      await db.mutate(
        `?[source_id, target_id, link_type, created_at, context_block_id] <- [
          ["p1", "p2", "reference", $now, null],
          ["p2", "p3", "reference", $now, null],
          ["p1", "p3", "reference", $now, null]
        ]
         :put links { source_id, target_id, link_type => created_at, context_block_id }`,
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
      const now = Date.now() / 1000;

      await db.mutate(
        `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [
          ["center", "Center", $now, $now, false, null],
          ["n1", "Neighbor 1", $now, $now, false, null],
          ["n2", "Neighbor 2", $now, $now, false, null],
          ["n3", "Neighbor 3", $now, $now, false, null],
          ["n4", "Neighbor 4", $now, $now, false, null],
          ["isolated", "Isolated", $now, $now, false, null]
        ]
         :put pages { page_id => title, created_at, updated_at, is_deleted, daily_note_date }`,
        { now }
      );

      await db.mutate(
        `?[source_id, target_id, link_type, created_at, context_block_id] <- [
          ["center", "n1", "reference", $now, null],
          ["n1", "n2", "reference", $now, null],
          ["n2", "n3", "reference", $now, null],
          ["center", "n4", "reference", $now, null]
        ]
         :put links { source_id, target_id, link_type => created_at, context_block_id }`,
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

      // CozoDB's recursive rules traverse bidirectionally
      // Links are: center->n1, n1->n2, n2->n3, center->n4
      // From center: 1-hop = n1, n4; 2-hop = n2 (via n1), n3 (via n1->n2 if bidirectional)
      // The actual result depends on CozoDB's traversal behavior
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
      const now = Date.now() / 1000;

      // Add reverse link from n1 back to center
      await db.mutate(
        `?[source_id, target_id, link_type, created_at, context_block_id] <- [["n1", "center", "reference", $now, null]]
         :put links { source_id, target_id, link_type => created_at, context_block_id }`,
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
      const now = Date.now() / 1000;

      // Create a page with a self-link
      await db.mutate(
        `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [["self", "Self-Linked", $now, $now, false, null]]
         :put pages { page_id => title, created_at, updated_at, is_deleted, daily_note_date }`,
        { now }
      );

      await db.mutate(
        `?[source_id, target_id, link_type, created_at, context_block_id] <- [["self", "self", "reference", $now, null]]
         :put links { source_id, target_id, link_type => created_at, context_block_id }`,
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
      const now = Date.now() / 1000;

      const pages = [];
      for (let i = 1; i <= 25; i++) {
        pages.push(`["p${i}", "Page ${i}", ${now}, ${now}, false, null]`);
      }

      await db.mutate(
        `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [${pages.join(', ')}]
         :put pages { page_id => title, created_at, updated_at, is_deleted, daily_note_date }`
      );

      // Create links: p1 is a hub (many pages link to it)
      // p2-p10 all link to p1 (hub)
      // p11-p20 form a chain
      // p21-p25 are isolated
      const links = [];
      for (let i = 2; i <= 10; i++) {
        links.push(`["p${i}", "p1", "reference", ${now}, null]`);
      }
      for (let i = 11; i < 20; i++) {
        links.push(`["p${i}", "p${i + 1}", "reference", ${now}, null]`);
      }

      await db.mutate(
        `?[source_id, target_id, link_type, created_at, context_block_id] <- [${links.join(', ')}]
         :put links { source_id, target_id, link_type => created_at, context_block_id }`
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
      const now = Date.now() / 1000;

      // Create isolated pages
      await db.mutate(
        `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [
          ["p1", "Page 1", $now, $now, false, null],
          ["p2", "Page 2", $now, $now, false, null]
        ]
         :put pages { page_id => title, created_at, updated_at, is_deleted, daily_note_date }`,
        { now }
      );

      const ranks = await service.getPageRank();

      // PageRank with no links returns empty result
      expect(ranks.size).toBe(0);
    });

    it('should handle bidirectional links', async () => {
      const now = Date.now() / 1000;

      await db.mutate(
        `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [
          ["p1", "Page 1", $now, $now, false, null],
          ["p2", "Page 2", $now, $now, false, null]
        ]
         :put pages { page_id => title, created_at, updated_at, is_deleted, daily_note_date }`,
        { now }
      );

      await db.mutate(
        `?[source_id, target_id, link_type, created_at, context_block_id] <- [
          ["p1", "p2", "reference", $now, null],
          ["p2", "p1", "reference", $now, null]
        ]
         :put links { source_id, target_id, link_type => created_at, context_block_id }`,
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
      // Cluster A: p1-p5 densely connected
      // Cluster B: p6-p10 densely connected
      // Sparse links between clusters
      const now = Date.now() / 1000;

      const pages = [];
      for (let i = 1; i <= 25; i++) {
        pages.push(`["p${i}", "Page ${i}", ${now}, ${now}, false, null]`);
      }

      await db.mutate(
        `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [${pages.join(', ')}]
         :put pages { page_id => title, created_at, updated_at, is_deleted, daily_note_date }`
      );

      // Cluster A (p1-p8): Dense internal links
      const clusterALinks = [];
      for (let i = 1; i <= 8; i++) {
        for (let j = i + 1; j <= 8; j++) {
          clusterALinks.push(`["p${i}", "p${j}", "reference", ${now}, null]`);
        }
      }

      // Cluster B (p9-p16): Dense internal links
      const clusterBLinks = [];
      for (let i = 9; i <= 16; i++) {
        for (let j = i + 1; j <= 16; j++) {
          clusterBLinks.push(`["p${i}", "p${j}", "reference", ${now}, null]`);
        }
      }

      // Cluster C (p17-p24): Dense internal links
      const clusterCLinks = [];
      for (let i = 17; i <= 24; i++) {
        for (let j = i + 1; j <= 24; j++) {
          clusterCLinks.push(`["p${i}", "p${j}", "reference", ${now}, null]`);
        }
      }

      // Sparse inter-cluster links
      const bridgeLinks = [
        `["p4", "p12", "reference", ${now}, null]`,
        `["p12", "p20", "reference", ${now}, null]`,
      ];

      const allLinks = [...clusterALinks, ...clusterBLinks, ...clusterCLinks, ...bridgeLinks];

      await db.mutate(
        `?[source_id, target_id, link_type, created_at, context_block_id] <- [${allLinks.join(', ')}]
         :put links { source_id, target_id, link_type => created_at, context_block_id }`
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
      const now = Date.now() / 1000;

      const pages = [];
      for (let i = 1; i <= 10; i++) {
        pages.push(`["p${i}", "Page ${i}", ${now}, ${now}, false, null]`);
      }

      await db.mutate(
        `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [${pages.join(', ')}]
         :put pages { page_id => title, created_at, updated_at, is_deleted, daily_note_date }`
      );

      const links = [];
      for (let i = 1; i <= 10; i++) {
        for (let j = i + 1; j <= 10; j++) {
          links.push(`["p${i}", "p${j}", "reference", ${now}, null]`);
        }
      }

      await db.mutate(
        `?[source_id, target_id, link_type, created_at, context_block_id] <- [${links.join(', ')}]
         :put links { source_id, target_id, link_type => created_at, context_block_id }`
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
      const now = Date.now() / 1000;

      await db.mutate(
        `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [
          ["p1", "Page 1", $now, $now, false, null],
          ["p2", "Page 2", $now, $now, false, null]
        ]
         :put pages { page_id => title, created_at, updated_at, is_deleted, daily_note_date }`,
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
      const now = Date.now() / 1000;

      await db.mutate(
        `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [
          ["center", "Center", $now, $now, false, null],
          ["connected", "Connected", $now, $now, false, null],
          ["suggested1", "Suggested 1", $now, $now, false, null],
          ["suggested2", "Suggested 2", $now, $now, false, null],
          ["distant", "Distant", $now, $now, false, null]
        ]
         :put pages { page_id => title, created_at, updated_at, is_deleted, daily_note_date }`,
        { now }
      );

      // center -> connected
      // connected -> suggested1
      // connected -> suggested2
      // suggested1 -> distant
      await db.mutate(
        `?[source_id, target_id, link_type, created_at, context_block_id] <- [
          ["center", "connected", "reference", $now, null],
          ["connected", "suggested1", "reference", $now, null],
          ["connected", "suggested2", "reference", $now, null],
          ["suggested1", "distant", "reference", $now, null]
        ]
         :put links { source_id, target_id, link_type => created_at, context_block_id }`,
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
      const now = Date.now() / 1000;

      // Create an isolated page
      await db.mutate(
        `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [["isolated", "Isolated", $now, $now, false, null]]
         :put pages { page_id => title, created_at, updated_at, is_deleted, daily_note_date }`,
        { now }
      );

      const suggestions = await service.getSuggestedLinks('isolated');

      expect(suggestions).toHaveLength(0);
    });

    it('should throw PAGE_NOT_FOUND for non-existent page', async () => {
      await expect(service.getSuggestedLinks('non-existent')).rejects.toThrow('Page not found');
    });

    it('should rank suggestions by number of shared connections', async () => {
      const now = Date.now() / 1000;

      // Create pages
      await db.mutate(
        `?[page_id, title, created_at, updated_at, is_deleted, daily_note_date] <- [
          ["source", "Source", $now, $now, false, null],
          ["neighbor1", "Neighbor 1", $now, $now, false, null],
          ["neighbor2", "Neighbor 2", $now, $now, false, null],
          ["suggested_high", "Suggested High", $now, $now, false, null],
          ["suggested_low", "Suggested Low", $now, $now, false, null]
        ]
         :put pages { page_id => title, created_at, updated_at, is_deleted, daily_note_date }`,
        { now }
      );

      // source -> neighbor1, neighbor2
      // neighbor1, neighbor2 -> suggested_high (2 shared connections)
      // neighbor1 -> suggested_low (1 shared connection)
      await db.mutate(
        `?[source_id, target_id, link_type, created_at, context_block_id] <- [
          ["source", "neighbor1", "reference", $now, null],
          ["source", "neighbor2", "reference", $now, null],
          ["neighbor1", "suggested_high", "reference", $now, null],
          ["neighbor2", "suggested_high", "reference", $now, null],
          ["neighbor1", "suggested_low", "reference", $now, null]
        ]
         :put links { source_id, target_id, link_type => created_at, context_block_id }`,
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
