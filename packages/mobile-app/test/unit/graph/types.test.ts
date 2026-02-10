/**
 * Tests for graph type definitions and constants.
 *
 * Verifies that graph constants are properly defined.
 */

import { describe, it, expect } from 'vitest';
import { GRAPH_CONSTANTS, GRAPH_COLORS } from '../../../src/components/graph/types';

describe('GRAPH_CONSTANTS', () => {
  it('should have valid node radius values', () => {
    expect(GRAPH_CONSTANTS.NODE_RADIUS).toBeGreaterThan(0);
    expect(GRAPH_CONSTANTS.CENTER_NODE_RADIUS).toBeGreaterThan(0);
    expect(GRAPH_CONSTANTS.CENTER_NODE_RADIUS).toBeGreaterThanOrEqual(GRAPH_CONSTANTS.NODE_RADIUS);
  });

  it('should have valid edge width', () => {
    expect(GRAPH_CONSTANTS.EDGE_WIDTH).toBeGreaterThan(0);
  });

  it('should have valid scale limits', () => {
    expect(GRAPH_CONSTANTS.MIN_SCALE).toBeGreaterThan(0);
    expect(GRAPH_CONSTANTS.MAX_SCALE).toBeGreaterThan(GRAPH_CONSTANTS.MIN_SCALE);
  });

  it('should have valid font size', () => {
    expect(GRAPH_CONSTANTS.LABEL_FONT_SIZE).toBeGreaterThan(0);
  });

  it('should have valid max label length', () => {
    expect(GRAPH_CONSTANTS.MAX_LABEL_LENGTH).toBeGreaterThan(0);
  });

  it('should have valid default max nodes', () => {
    expect(GRAPH_CONSTANTS.DEFAULT_MAX_NODES).toBeGreaterThan(0);
  });
});

describe('GRAPH_COLORS', () => {
  it('should have valid color strings', () => {
    // All colors should be non-empty strings
    Object.values(GRAPH_COLORS).forEach((color) => {
      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
    });
  });

  it('should have distinct center and normal node colors', () => {
    expect(GRAPH_COLORS.centerNode).not.toBe(GRAPH_COLORS.normalNode);
  });

  it('should have a background color', () => {
    expect(GRAPH_COLORS.background).toBeDefined();
  });
});
