/**
 * Tests for arrow positioning helper function.
 *
 * Tests cover:
 * - Basic arrow positioning calculation
 * - Variable node sizes (center vs normal)
 * - Edge cases (overlapping nodes, zero distance, self-references)
 * - Safety bounds (0-1 clamping)
 * - Various distance scenarios
 */

import { describe, it, expect } from 'vitest';

// Mock types for testing - simplified versions of the real types
interface TestNode {
  id: string;
  x?: number;
  y?: number;
  isCenter?: boolean;
  pageRank?: number;
}

interface TestLink {
  source: string | TestNode;
  target: string | TestNode;
}

/**
 * Helper function to calculate arrow position (extracted from MiniGraph/GraphView).
 * This is a pure function that takes a link and a radius getter.
 */
function calculateArrowPosition(
  link: TestLink,
  getNodeRadius: (node: TestNode) => number
): number {
  const targetNode = typeof link.target === 'object' ? link.target : null;
  const sourceNode = typeof link.source === 'object' ? link.source : null;

  // Fallback if nodes aren't resolved objects yet
  if (!targetNode || !sourceNode) return 1;

  const targetRadius = getNodeRadius(targetNode);

  // Calculate distance between source and target
  const dx = (targetNode.x ?? 0) - (sourceNode.x ?? 0);
  const dy = (targetNode.y ?? 0) - (sourceNode.y ?? 0);
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Avoid division by zero for overlapping nodes
  if (distance < 0.001) return 1;

  // Calculate position where arrow should stop (at edge of target node)
  // Position = 1 - (radius / distance)
  const relPos = 1 - (targetRadius / distance);

  // Clamp to valid range [0, 1]
  return Math.min(1, Math.max(0, relPos));
}

describe('calculateArrowPosition', () => {
  describe('Basic Positioning', () => {
    it('calculates correct position for normal-sized nodes', () => {
      const link: TestLink = {
        source: { id: 'src', x: 0, y: 0, isCenter: false },
        target: { id: 'tgt', x: 100, y: 0, isCenter: false },
      };

      const getRadius = (node: TestNode) => (node.isCenter ? 8 : 5);
      const result = calculateArrowPosition(link, getRadius);

      // Distance = 100, target radius = 5
      // Expected: 1 - (5/100) = 0.95
      expect(result).toBeCloseTo(0.95, 5);
    });

    it('calculates correct position for center node (larger)', () => {
      const link: TestLink = {
        source: { id: 'src', x: 0, y: 0, isCenter: false },
        target: { id: 'tgt', x: 100, y: 0, isCenter: true },
      };

      const getRadius = (node: TestNode) => (node.isCenter ? 8 : 5);
      const result = calculateArrowPosition(link, getRadius);

      // Distance = 100, target radius = 8
      // Expected: 1 - (8/100) = 0.92
      expect(result).toBeCloseTo(0.92, 5);
    });

    it('works with diagonal links', () => {
      const link: TestLink = {
        source: { id: 'src', x: 0, y: 0, isCenter: false },
        target: { id: 'tgt', x: 30, y: 40, isCenter: false }, // Distance = 50
      };

      const getRadius = (_node: TestNode) => 5;
      const result = calculateArrowPosition(link, getRadius);

      // Distance = sqrt(30^2 + 40^2) = 50
      // Expected: 1 - (5/50) = 0.9
      expect(result).toBeCloseTo(0.9, 5);
    });
  });

  describe('Variable Node Sizes', () => {
    it('adjusts for PageRank-based sizing (small node)', () => {
      const link: TestLink = {
        source: { id: 'src', x: 0, y: 0, pageRank: 0.05 },
        target: { id: 'tgt', x: 100, y: 0, pageRank: 0.05 },
      };

      // Min radius for low PageRank
      const getRadius = (_node: TestNode) => 3;
      const result = calculateArrowPosition(link, getRadius);

      // Distance = 100, radius = 3
      // Expected: 1 - (3/100) = 0.97
      expect(result).toBeCloseTo(0.97, 5);
    });

    it('adjusts for PageRank-based sizing (large node)', () => {
      const link: TestLink = {
        source: { id: 'src', x: 0, y: 0, pageRank: 0.05 },
        target: { id: 'tgt', x: 100, y: 0, pageRank: 0.5 },
      };

      // Max radius for high PageRank
      const getRadius = (_node: TestNode) => 15;
      const result = calculateArrowPosition(link, getRadius);

      // Distance = 100, radius = 15
      // Expected: 1 - (15/100) = 0.85
      expect(result).toBeCloseTo(0.85, 5);
    });

    it('adjusts for highlighted node (1.5x multiplier)', () => {
      const link: TestLink = {
        source: { id: 'src', x: 0, y: 0 },
        target: { id: 'tgt', x: 100, y: 0 },
      };

      // Highlighted node radius: 5 * 1.5 = 7.5
      const getRadius = (_node: TestNode) => 7.5;
      const result = calculateArrowPosition(link, getRadius);

      // Distance = 100, radius = 7.5
      // Expected: 1 - (7.5/100) = 0.925
      expect(result).toBeCloseTo(0.925, 5);
    });
  });

  describe('Edge Cases', () => {
    it('returns 1 when nodes are unresolved (string IDs)', () => {
      const link: TestLink = {
        source: 'src-id',
        target: 'tgt-id',
      };

      const getRadius = (_node: TestNode) => 5;
      const result = calculateArrowPosition(link, getRadius);

      // Should return fallback value
      expect(result).toBe(1);
    });

    it('returns 1 when source is unresolved', () => {
      const link: TestLink = {
        source: 'src-id',
        target: { id: 'tgt', x: 100, y: 0 },
      };

      const getRadius = (_node: TestNode) => 5;
      const result = calculateArrowPosition(link, getRadius);

      expect(result).toBe(1);
    });

    it('returns 1 when target is unresolved', () => {
      const link: TestLink = {
        source: { id: 'src', x: 0, y: 0 },
        target: 'tgt-id',
      };

      const getRadius = (_node: TestNode) => 5;
      const result = calculateArrowPosition(link, getRadius);

      expect(result).toBe(1);
    });

    it('handles overlapping nodes (distance < 0.001)', () => {
      const link: TestLink = {
        source: { id: 'src', x: 0, y: 0 },
        target: { id: 'tgt', x: 0.0005, y: 0.0005 },
      };

      const getRadius = (_node: TestNode) => 5;
      const result = calculateArrowPosition(link, getRadius);

      // Distance is effectively zero, should return fallback
      expect(result).toBe(1);
    });

    it('handles self-referencing links (same coordinates)', () => {
      const link: TestLink = {
        source: { id: 'node', x: 50, y: 50 },
        target: { id: 'node', x: 50, y: 50 },
      };

      const getRadius = (_node: TestNode) => 5;
      const result = calculateArrowPosition(link, getRadius);

      // Distance = 0, should return fallback
      expect(result).toBe(1);
    });

    it('handles missing coordinates (defaults to 0)', () => {
      const link: TestLink = {
        source: { id: 'src' }, // x and y undefined
        target: { id: 'tgt' }, // x and y undefined
      };

      const getRadius = (_node: TestNode) => 5;
      const result = calculateArrowPosition(link, getRadius);

      // Both default to (0, 0), distance = 0
      expect(result).toBe(1);
    });
  });

  describe('Safety Bounds', () => {
    it('clamps result to maximum of 1', () => {
      const link: TestLink = {
        source: { id: 'src', x: 0, y: 0 },
        target: { id: 'tgt', x: 5, y: 0 }, // Very close
      };

      // Radius larger than distance
      const getRadius = (_node: TestNode) => 10;
      const result = calculateArrowPosition(link, getRadius);

      // 1 - (10/5) = -1, but should be clamped to 0
      // However, since distance > 0.001, calculation proceeds
      // Result should be clamped to valid range [0, 1]
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('clamps result to minimum of 0', () => {
      const link: TestLink = {
        source: { id: 'src', x: 0, y: 0 },
        target: { id: 'tgt', x: 3, y: 4 }, // Distance = 5
      };

      // Radius much larger than distance
      const getRadius = (_node: TestNode) => 20;
      const result = calculateArrowPosition(link, getRadius);

      // 1 - (20/5) = -3, should be clamped to 0
      expect(result).toBe(0);
    });

    it('returns values in valid range [0, 1]', () => {
      const testCases = [
        { distance: 10, radius: 1 },
        { distance: 50, radius: 5 },
        { distance: 100, radius: 15 },
        { distance: 200, radius: 8 },
      ];

      for (const { distance, radius } of testCases) {
        const link: TestLink = {
          source: { id: 'src', x: 0, y: 0 },
          target: { id: 'tgt', x: distance, y: 0 },
        };

        const result = calculateArrowPosition(link, () => radius);

        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Real-World Scenarios', () => {
    it('handles typical MiniGraph scenario (100px apart, 8px center node)', () => {
      const link: TestLink = {
        source: { id: 'src', x: 0, y: 0, isCenter: false },
        target: { id: 'tgt', x: 100, y: 0, isCenter: true },
      };

      const getRadius = (node: TestNode) => (node.isCenter ? 8 : 5);
      const result = calculateArrowPosition(link, getRadius);

      // Should stop 8px before target center
      expect(result).toBeCloseTo(0.92, 5);
    });

    it('handles bidirectional links (curved paths)', () => {
      // Bidirectional links have curvature but same arrow positioning logic
      const link: TestLink = {
        source: { id: 'src', x: 0, y: 0 },
        target: { id: 'tgt', x: 80, y: 60 }, // Distance = 100
      };

      const getRadius = (_node: TestNode) => 5;
      const result = calculateArrowPosition(link, getRadius);

      // Should work regardless of link curvature
      expect(result).toBeCloseTo(0.95, 5);
    });

    it('handles very short links (nodes close together)', () => {
      const link: TestLink = {
        source: { id: 'src', x: 0, y: 0 },
        target: { id: 'tgt', x: 15, y: 0 },
      };

      const getRadius = (_node: TestNode) => 5;
      const result = calculateArrowPosition(link, getRadius);

      // Distance = 15, radius = 5
      // Expected: 1 - (5/15) = 0.667
      expect(result).toBeCloseTo(0.667, 3);
    });

    it('handles very long links (nodes far apart)', () => {
      const link: TestLink = {
        source: { id: 'src', x: 0, y: 0 },
        target: { id: 'tgt', x: 1000, y: 0 },
      };

      const getRadius = (_node: TestNode) => 5;
      const result = calculateArrowPosition(link, getRadius);

      // Distance = 1000, radius = 5
      // Expected: 1 - (5/1000) = 0.995
      expect(result).toBeCloseTo(0.995, 5);
    });
  });

  describe('Negative Coordinates', () => {
    it('handles negative coordinates correctly', () => {
      const link: TestLink = {
        source: { id: 'src', x: -50, y: -50 },
        target: { id: 'tgt', x: 50, y: 50 },
      };

      const getRadius = (_node: TestNode) => 5;
      const result = calculateArrowPosition(link, getRadius);

      // Distance = sqrt((50-(-50))^2 + (50-(-50))^2) = sqrt(20000) ≈ 141.42
      // Expected: 1 - (5/141.42) ≈ 0.9646
      expect(result).toBeCloseTo(0.9646, 3);
    });

    it('handles mixed positive/negative coordinates', () => {
      const link: TestLink = {
        source: { id: 'src', x: 100, y: -50 },
        target: { id: 'tgt', x: -100, y: 50 },
      };

      const getRadius = (_node: TestNode) => 8;
      const result = calculateArrowPosition(link, getRadius);

      // Distance = sqrt((200)^2 + (100)^2) = sqrt(50000) ≈ 223.61
      // Expected: 1 - (8/223.61) ≈ 0.9642
      expect(result).toBeCloseTo(0.9642, 3);
    });
  });
});
