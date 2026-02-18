/**
 * Unit tests for graphHash.ts
 */
import { describe, it, expect } from 'vitest';
import { assignCommunities } from '../../../src/graph/graphHash.js';

describe('assignCommunities', () => {
  it('returns empty map for empty input', () => {
    const result = assignCommunities([], []);
    expect(result.size).toBe(0);
  });

  it('assigns same community to connected nodes', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }];
    const result = assignCommunities(nodes, edges);

    // All connected → same community
    expect(result.get('a')).toBe(result.get('b'));
    expect(result.get('b')).toBe(result.get('c'));
  });

  it('assigns different communities to disconnected components', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const edges = [
      { source: 'a', target: 'b' }, // component 1
      { source: 'c', target: 'd' }, // component 2
    ];
    const result = assignCommunities(nodes, edges);

    expect(result.get('a')).toBe(result.get('b'));
    expect(result.get('c')).toBe(result.get('d'));
    expect(result.get('a')).not.toBe(result.get('c'));
  });

  it('assigns community to isolated node (no edges)', () => {
    const nodes = [{ id: 'solo' }];
    const result = assignCommunities(nodes, []);
    expect(result.has('solo')).toBe(true);
    expect(typeof result.get('solo')).toBe('number');
  });

  it('returns non-negative community ids', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [{ source: 'a', target: 'b' }];
    const result = assignCommunities(nodes, edges);

    for (const id of result.values()) {
      expect(id).toBeGreaterThanOrEqual(0);
    }
  });

  it('all nodes get assigned a community', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [{ source: 'a', target: 'b' }];
    const result = assignCommunities(nodes, edges);

    for (const node of nodes) {
      expect(result.has(node.id)).toBe(true);
    }
  });

  it('handles dense graph by falling back to degree quintile', () => {
    // Create a 10-node fully connected graph
    const nodes = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}` }));
    const edges: Array<{ source: string; target: string }> = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        edges.push({ source: `n${i}`, target: `n${j}` });
      }
    }
    const result = assignCommunities(nodes, edges);

    // All nodes should be assigned
    expect(result.size).toBe(nodes.length);
    // Should have multiple communities due to degree-quintile fallback
    const uniqueCommunities = new Set(result.values());
    expect(uniqueCommunities.size).toBeGreaterThan(1);
  });
});
