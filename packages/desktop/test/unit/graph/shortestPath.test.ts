/**
 * Unit tests for shortestPath.ts
 */
import { describe, it, expect } from 'vitest';
import { findShortestPath, pathToEdgeSet } from '../../../src/graph/shortestPath.js';

describe('findShortestPath', () => {
  it('returns single-element array when source equals target', () => {
    const result = findShortestPath('a', 'a', []);
    expect(result).toEqual(['a']);
  });

  it('returns direct path for adjacent nodes', () => {
    const edges = [{ source: 'a', target: 'b' }];
    const result = findShortestPath('a', 'b', edges);
    expect(result).toEqual(['a', 'b']);
  });

  it('returns empty array when no path exists', () => {
    const edges = [{ source: 'a', target: 'b' }, { source: 'c', target: 'd' }];
    const result = findShortestPath('a', 'd', edges);
    expect(result).toEqual([]);
  });

  it('finds shortest path across multiple hops', () => {
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'd' },
    ];
    const result = findShortestPath('a', 'd', edges);
    expect(result).toEqual(['a', 'b', 'c', 'd']);
  });

  it('finds shorter path when multiple paths exist', () => {
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'a', target: 'c' }, // direct shortcut
    ];
    const result = findShortestPath('a', 'c', edges);
    expect(result).toEqual(['a', 'c']); // BFS finds shortest
    expect(result.length).toBe(2);
  });

  it('traverses directed edges in reverse (undirected BFS)', () => {
    const edges = [{ source: 'b', target: 'a' }]; // only b→a direction
    const result = findShortestPath('a', 'b', edges);
    expect(result).toEqual(['a', 'b']); // undirected: a→b is also valid
  });

  it('handles disconnected graph', () => {
    const edges: Array<{ source: string; target: string }> = [];
    const result = findShortestPath('a', 'z', edges);
    expect(result).toEqual([]);
  });

  it('handles self-loops without infinite loop', () => {
    const edges = [{ source: 'a', target: 'a' }, { source: 'a', target: 'b' }];
    const result = findShortestPath('a', 'b', edges);
    expect(result).toEqual(['a', 'b']);
  });
});

describe('pathToEdgeSet', () => {
  it('returns empty set for empty path', () => {
    const result = pathToEdgeSet([]);
    expect(result.size).toBe(0);
  });

  it('returns empty set for single node path', () => {
    const result = pathToEdgeSet(['a']);
    expect(result.size).toBe(0);
  });

  it('includes both directions for each edge', () => {
    const result = pathToEdgeSet(['a', 'b', 'c']);
    expect(result.has('a->b')).toBe(true);
    expect(result.has('b->a')).toBe(true);
    expect(result.has('b->c')).toBe(true);
    expect(result.has('c->b')).toBe(true);
    expect(result.size).toBe(4);
  });
});
