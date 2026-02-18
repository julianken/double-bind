/**
 * Unit tests for radialLayout.ts
 */
import { describe, it, expect } from 'vitest';
import { computeRadialLayout } from '../../../src/graph/radialLayout.js';

const TOLERANCE = 0.001;

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < TOLERANCE;
}

describe('computeRadialLayout', () => {
  it('returns empty map for empty nodes', () => {
    const result = computeRadialLayout('center', [], [], 100);
    expect(result.size).toBe(0);
  });

  it('places center node at origin (0, 0)', () => {
    const nodes = [{ id: 'center' }, { id: 'a' }];
    const edges = [{ source: 'center', target: 'a' }];
    const result = computeRadialLayout('center', nodes, edges, 100);

    const centerPos = result.get('center')!;
    expect(approxEqual(centerPos.x, 0)).toBe(true);
    expect(approxEqual(centerPos.y, 0)).toBe(true);
  });

  it('places single center node at origin with no others', () => {
    const nodes = [{ id: 'solo' }];
    const result = computeRadialLayout('solo', nodes, [], 100);
    const pos = result.get('solo')!;
    expect(approxEqual(pos.x, 0)).toBe(true);
    expect(approxEqual(pos.y, 0)).toBe(true);
  });

  it('places direct neighbor in first ring', () => {
    const nodes = [{ id: 'center' }, { id: 'a' }];
    const edges = [{ source: 'center', target: 'a' }];
    const radius = 100;
    const result = computeRadialLayout('center', nodes, edges, radius);

    const aPos = result.get('a')!;
    const distance = Math.sqrt(aPos.x * aPos.x + aPos.y * aPos.y);
    // Ring 1 is at radius * 0.45
    expect(approxEqual(distance, radius * 0.45)).toBe(true);
  });

  it('places 2-hop nodes further than 1-hop nodes', () => {
    const nodes = [{ id: 'center' }, { id: 'a' }, { id: 'b' }];
    const edges = [
      { source: 'center', target: 'a' },
      { source: 'a', target: 'b' },
    ];
    const radius = 100;
    const result = computeRadialLayout('center', nodes, edges, radius);

    const aPos = result.get('a')!;
    const bPos = result.get('b')!;
    const aDist = Math.sqrt(aPos.x * aPos.x + aPos.y * aPos.y);
    const bDist = Math.sqrt(bPos.x * bPos.x + bPos.y * bPos.y);

    expect(bDist).toBeGreaterThan(aDist);
  });

  it('distributes multiple ring-1 nodes evenly around the circle', () => {
    const nodes = [
      { id: 'center' },
      { id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' },
    ];
    const edges = [
      { source: 'center', target: 'a' },
      { source: 'center', target: 'b' },
      { source: 'center', target: 'c' },
      { source: 'center', target: 'd' },
    ];
    const radius = 100;
    const result = computeRadialLayout('center', nodes, edges, radius);

    // All 4 neighbors should be at ring-1 radius
    const ringRadius = radius * 0.45;
    for (const id of ['a', 'b', 'c', 'd']) {
      const pos = result.get(id)!;
      const dist = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      expect(Math.abs(dist - ringRadius)).toBeLessThan(1);
    }

    // All positions should be unique (distinct angles)
    const positions = ['a', 'b', 'c', 'd'].map((id) => result.get(id)!);
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i]!.x - positions[j]!.x;
        const dy = positions[i]!.y - positions[j]!.y;
        const separation = Math.sqrt(dx * dx + dy * dy);
        expect(separation).toBeGreaterThan(1);
      }
    }
  });

  it('assigns all nodes positions even if unreachable from center', () => {
    const nodes = [{ id: 'center' }, { id: 'isolated' }];
    const result = computeRadialLayout('center', nodes, [], 100);

    // Both nodes should have positions
    expect(result.has('center')).toBe(true);
    expect(result.has('isolated')).toBe(true);
  });
});
