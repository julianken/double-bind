// @double-bind/query-lang - Transpiler tests
//
// Comprehensive tests for the query transpiler covering:
// - Basic query transpilation (find, count, graph)
// - All filter operators
// - Parameterization and security
// - Graph-specific operators
// - Aggregations
// - Graph algorithms
// - Order by, limit, offset
// - Error handling

import { describe, it, expect } from 'vitest';
import {
  transpileToCozo,
  compileQuery,
  transpilePageRank,
  transpileCommunities,
  transpileShortestPath,
  transpileAggregation,
} from '../src/index.js';
import type { QueryAST, Filter } from '../src/index.js';

describe('transpileToCozo', () => {
  // ==========================================================================
  // Basic Find Queries
  // ==========================================================================

  describe('find queries', () => {
    it('transpiles basic find query', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('?[page_id, title]');
      expect(result.script).toContain('*pages{');
      expect(result.script).toContain('is_deleted: false');
      expect(result.params).toEqual({});
    });

    it('transpiles find query with contains filter', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'title', operator: 'contains', value: 'meeting' }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('contains(title, $filter_0)');
      expect(result.params).toEqual({ filter_0: 'meeting' });
    });

    it('transpiles find query with equals filter', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'is_deleted', operator: 'equals', value: false }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('is_deleted == $filter_0');
      expect(result.params).toEqual({ filter_0: false });
    });

    it('transpiles find query with notEquals filter', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'title', operator: 'notEquals', value: 'Draft' }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('title != $filter_0');
      expect(result.params).toEqual({ filter_0: 'Draft' });
    });

    it('transpiles find query with startsWith filter', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'title', operator: 'startsWith', value: 'Project' }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('starts_with(title, $filter_0)');
      expect(result.params).toEqual({ filter_0: 'Project' });
    });

    it('transpiles find query with endsWith filter', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'title', operator: 'endsWith', value: 'Notes' }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('ends_with(title, $filter_0)');
      expect(result.params).toEqual({ filter_0: 'Notes' });
    });

    it('transpiles find query with greaterThan filter', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'created_at', operator: 'greaterThan', value: 1704067200 }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('created_at > $filter_0');
      expect(result.params).toEqual({ filter_0: 1704067200 });
    });

    it('transpiles find query with lessThan filter', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'created_at', operator: 'lessThan', value: 1704067200 }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('created_at < $filter_0');
      expect(result.params).toEqual({ filter_0: 1704067200 });
    });

    it('transpiles find query with greaterThanOrEqual filter', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'created_at', operator: 'greaterThanOrEqual', value: 1704067200 }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('created_at >= $filter_0');
      expect(result.params).toEqual({ filter_0: 1704067200 });
    });

    it('transpiles find query with lessThanOrEqual filter', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'created_at', operator: 'lessThanOrEqual', value: 1704067200 }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('created_at <= $filter_0');
      expect(result.params).toEqual({ filter_0: 1704067200 });
    });

    it('transpiles find query with isNull filter', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'daily_note_date', operator: 'isNull', value: null }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('is_null(daily_note_date)');
      expect(result.params).toEqual({});
    });

    it('transpiles find query with isNotNull filter', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'daily_note_date', operator: 'isNotNull', value: null }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('!is_null(daily_note_date)');
      expect(result.params).toEqual({});
    });

    it('transpiles find query with multiple filters', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [
          { field: 'title', operator: 'contains', value: 'project' },
          { field: 'is_deleted', operator: 'equals', value: false },
        ],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('contains(title, $filter_0)');
      expect(result.script).toContain('is_deleted == $filter_1');
      expect(result.params).toEqual({ filter_0: 'project', filter_1: false });
    });

    it('transpiles find query with order by asc', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [],
        projections: ['page_id', 'title'],
        orderBy: { field: 'title', direction: 'asc' },
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain(':order title');
    });

    it('transpiles find query with order by desc', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [],
        projections: ['page_id', 'title'],
        orderBy: { field: 'created_at', direction: 'desc' },
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain(':order -created_at');
    });

    it('transpiles find query with limit', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [],
        projections: ['page_id', 'title'],
        limit: 10,
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain(':limit 10');
    });

    it('transpiles find query with limit and offset', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [],
        projections: ['page_id', 'title'],
        limit: 10,
        offset: 20,
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain(':limit 10');
      expect(result.script).toContain(':offset 20');
    });

    it('transpiles find query with custom projections', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [],
        projections: ['page_id', 'title', 'created_at', 'updated_at'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('?[page_id, title, created_at, updated_at]');
    });

    it('uses default projections when none specified', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [],
        projections: [],
      };

      const result = transpileToCozo(ast);

      // Default projections for pages are page_id, title
      expect(result.script).toContain('?[page_id, title]');
    });
  });

  // ==========================================================================
  // Graph-Specific Filters
  // ==========================================================================

  describe('graph-specific filters', () => {
    it('transpiles hasTag filter with join', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'tag', operator: 'hasTag', value: 'important' }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('*tags{ entity_id: page_id, tag }');
      expect(result.script).toContain('tag == $tag_0');
      expect(result.params).toEqual({ tag_0: 'important' });
    });

    it('transpiles linkedTo filter with join', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'source', operator: 'linkedTo', value: 'Resources' }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('*links{');
      expect(result.script).toContain('link_target_title == $target_0');
      expect(result.params).toEqual({ target_0: 'Resources' });
    });

    it('transpiles linkedFrom filter with join', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'source', operator: 'linkedFrom', value: 'Project Alpha' }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('*links{');
      expect(result.script).toContain('link_source_title == $source_0');
      expect(result.params).toEqual({ source_0: 'Project Alpha' });
    });

    it('transpiles hasProperty filter with join', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'status', operator: 'hasProperty', value: 'status' }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('*properties{ entity_id: page_id, key }');
      expect(result.script).toContain('key == $prop_key_0');
      expect(result.params).toEqual({ prop_key_0: 'status' });
    });
  });

  // ==========================================================================
  // Count Queries
  // ==========================================================================

  describe('count queries', () => {
    it('transpiles basic count query', () => {
      const ast: QueryAST = {
        type: 'count',
        relation: 'pages',
        filters: [],
        projections: [],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('?[count(page_id)]');
      expect(result.script).toContain('*pages{');
      expect(result.script).toContain('is_deleted: false');
    });

    it('transpiles count query with filter', () => {
      const ast: QueryAST = {
        type: 'count',
        relation: 'blocks',
        filters: [{ field: 'content', operator: 'contains', value: 'TODO' }],
        projections: [],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('?[count(block_id)]');
      expect(result.script).toContain('contains(content, $filter_0)');
      expect(result.params).toEqual({ filter_0: 'TODO' });
    });

    it('transpiles count query for tags relation', () => {
      const ast: QueryAST = {
        type: 'count',
        relation: 'tags',
        filters: [],
        projections: [],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('?[count(entity_id)]');
      expect(result.script).toContain('*tags{');
    });

    it('transpiles count query for links relation', () => {
      const ast: QueryAST = {
        type: 'count',
        relation: 'links',
        filters: [],
        projections: [],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('?[count(source_id)]');
      expect(result.script).toContain('*links{');
    });
  });

  // ==========================================================================
  // Graph Queries (Visualization)
  // ==========================================================================

  describe('graph queries', () => {
    it('transpiles basic graph query', () => {
      const ast: QueryAST = {
        type: 'graph',
        relation: 'pages',
        filters: [],
        projections: [],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('?[src, dst]');
      expect(result.script).toContain('*pages{');
      expect(result.script).toContain('*links{ source_id: src, target_id: dst }');
    });

    it('transpiles graph query with filter', () => {
      const ast: QueryAST = {
        type: 'graph',
        relation: 'pages',
        filters: [{ field: 'title', operator: 'startsWith', value: 'Project' }],
        projections: [],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('?[src, dst]');
      expect(result.script).toContain('starts_with(title, $filter_0)');
      expect(result.params).toEqual({ filter_0: 'Project' });
    });

    it('transpiles graph query with depth (limit)', () => {
      const ast: QueryAST = {
        type: 'graph',
        relation: 'pages',
        filters: [],
        projections: [],
        limit: 2,
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain(':limit 2');
    });
  });

  // ==========================================================================
  // Different Relations
  // ==========================================================================

  describe('different relations', () => {
    it('transpiles blocks relation', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'blocks',
        filters: [],
        projections: ['block_id', 'content'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('*blocks{');
      expect(result.script).toContain('is_deleted: false');
    });

    it('transpiles tags relation', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'tags',
        filters: [],
        projections: ['entity_id', 'tag'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('*tags{');
      // tags relation doesn't have is_deleted
      expect(result.script).not.toContain('is_deleted');
    });

    it('transpiles links relation', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'links',
        filters: [],
        projections: ['source_id', 'target_id'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('*links{');
    });

    it('transpiles properties relation', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'properties',
        filters: [],
        projections: ['entity_id', 'key', 'value'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('*properties{');
    });

    it('transpiles block_refs relation', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'block_refs',
        filters: [],
        projections: ['source_block_id', 'target_block_id'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('*block_refs{');
    });

    it('transpiles daily_notes relation', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'daily_notes',
        filters: [],
        projections: ['date', 'page_id'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).toContain('*daily_notes{');
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('error handling', () => {
    it('throws for invalid AST (null)', () => {
      expect(() => transpileToCozo(null as unknown as QueryAST)).toThrow('Invalid AST');
    });

    it('throws for invalid AST (missing type)', () => {
      expect(() =>
        transpileToCozo({ relation: 'pages', filters: [], projections: [] } as unknown as QueryAST)
      ).toThrow('Invalid AST: missing type');
    });

    it('throws for invalid AST (missing relation)', () => {
      expect(() =>
        transpileToCozo({ type: 'find', filters: [], projections: [] } as unknown as QueryAST)
      ).toThrow('Invalid AST: missing relation');
    });

    it('throws for unknown relation', () => {
      expect(() =>
        transpileToCozo({
          type: 'find',
          relation: 'unknown',
          filters: [],
          projections: [],
        } as unknown as QueryAST)
      ).toThrow('unknown relation');
    });

    it('throws for invalid filter value (NaN)', () => {
      expect(() =>
        transpileToCozo({
          type: 'find',
          relation: 'pages',
          filters: [{ field: 'created_at', operator: 'greaterThan', value: NaN }],
          projections: [],
        })
      ).toThrow('Invalid filter value');
    });

    it('throws for invalid filter value (Infinity)', () => {
      expect(() =>
        transpileToCozo({
          type: 'find',
          relation: 'pages',
          filters: [{ field: 'created_at', operator: 'greaterThan', value: Infinity }],
          projections: [],
        })
      ).toThrow('Invalid filter value');
    });
  });

  // ==========================================================================
  // Parameterization Security
  // ==========================================================================

  describe('parameterization security', () => {
    it('parameterizes string values (prevents injection)', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'title', operator: 'contains', value: 'DROP TABLE pages; --' }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      // Value should be in params, not in script
      expect(result.script).not.toContain('DROP TABLE');
      expect(result.script).toContain('$filter_0');
      expect(result.params.filter_0).toBe('DROP TABLE pages; --');
    });

    it('parameterizes CozoScript-like content', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'title', operator: 'contains', value: '?[x] := *pages{}' }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.script).not.toContain('?[x]');
      expect(result.params.filter_0).toBe('?[x] := *pages{}');
    });

    it('parameterizes special characters', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'title', operator: 'contains', value: '${}\\n\\t"\'`' }],
        projections: ['page_id', 'title'],
      };

      const result = transpileToCozo(ast);

      expect(result.params.filter_0).toBe('${}\\n\\t"\'`');
    });
  });
});

// ==========================================================================
// compileQuery (end-to-end)
// ==========================================================================

describe('compileQuery', () => {
  it('compiles find query from DSL string', () => {
    const result = compileQuery("find pages where title contains 'meeting'");

    expect(result.script).toContain('?[page_id, title]');
    expect(result.script).toContain('contains(title, $filter_0)');
    expect(result.params.filter_0).toBe('meeting');
  });

  it('compiles count query from DSL string', () => {
    const result = compileQuery('count pages');

    expect(result.script).toContain('?[count(page_id)]');
  });

  it('compiles graph query from DSL string', () => {
    const result = compileQuery('graph pages depth 2');

    expect(result.script).toContain('?[src, dst]');
    expect(result.script).toContain(':limit 2');
  });

  it('compiles query with order by and limit', () => {
    const result = compileQuery('find pages order by created_at desc limit 10');

    expect(result.script).toContain(':order -created_at');
    expect(result.script).toContain(':limit 10');
  });

  it('compiles query with tagged condition', () => {
    const result = compileQuery("find blocks where tagged 'important'");

    expect(result.script).toContain('*tags{');
    expect(result.params.tag_0).toBe('important');
  });

  it('compiles query with linked from condition', () => {
    const result = compileQuery("find pages where linked from 'Project Alpha'");

    expect(result.script).toContain('*links{');
    expect(result.params.source_0).toBe('Project Alpha');
  });
});

// ==========================================================================
// Graph Algorithms
// ==========================================================================

describe('graph algorithms', () => {
  describe('transpilePageRank', () => {
    it('generates PageRank query with default options', () => {
      const result = transpilePageRank();

      expect(result.script).toContain('PageRank');
      expect(result.script).toContain('*links[source_id, target_id]');
      expect(result.script).toContain('rank[page_id, score]');
      expect(result.script).toContain(':order -score');
      expect(result.params).toEqual({});
    });

    it('generates PageRank query with custom edge relation', () => {
      const result = transpilePageRank({
        edgeRelation: 'custom_links',
        sourceColumn: 'from_id',
        targetColumn: 'to_id',
      });

      expect(result.script).toContain('*custom_links[from_id, to_id]');
    });
  });

  describe('transpileCommunities', () => {
    it('generates community detection query with default options', () => {
      const result = transpileCommunities();

      expect(result.script).toContain('CommunityDetectionLouvain');
      expect(result.script).toContain('*links[source_id, target_id]');
      expect(result.script).toContain('community[page_id, community]');
      expect(result.params).toEqual({});
    });

    it('generates community detection query with custom edge relation', () => {
      const result = transpileCommunities({
        edgeRelation: 'block_refs',
        sourceColumn: 'source_block_id',
        targetColumn: 'target_block_id',
      });

      expect(result.script).toContain('*block_refs[source_block_id, target_block_id]');
    });
  });

  describe('transpileShortestPath', () => {
    it('generates shortest path query with source only', () => {
      const result = transpileShortestPath('page_123');

      expect(result.script).toContain('ShortestPathDijkstra');
      expect(result.script).toContain('$source_id');
      expect(result.params).toEqual({ source_id: 'page_123' });
    });

    it('generates shortest path query with source and target', () => {
      const result = transpileShortestPath('page_123', 'page_456');

      expect(result.script).toContain('ShortestPathDijkstra');
      expect(result.script).toContain('$source_id');
      expect(result.script).toContain('$target_id');
      expect(result.params).toEqual({ source_id: 'page_123', target_id: 'page_456' });
    });

    it('generates shortest path query with custom edge relation', () => {
      const result = transpileShortestPath('page_123', undefined, {
        edgeRelation: 'custom_links',
        sourceColumn: 'from_id',
        targetColumn: 'to_id',
      });

      expect(result.script).toContain('*custom_links[from_id, to_id]');
    });
  });
});

// ==========================================================================
// Aggregations
// ==========================================================================

describe('transpileAggregation', () => {
  it('generates count aggregation', () => {
    const result = transpileAggregation('pages', {
      function: 'count',
      column: 'page_id',
    });

    expect(result.script).toContain('?[count(page_id)]');
    expect(result.script).toContain('*pages{');
  });

  it('generates sum aggregation', () => {
    const result = transpileAggregation('blocks', {
      function: 'sum',
      column: 'order',
    });

    expect(result.script).toContain('?[sum(order)]');
    expect(result.script).toContain('*blocks{');
  });

  it('generates avg aggregation', () => {
    const result = transpileAggregation('blocks', {
      function: 'avg',
      column: 'order',
    });

    expect(result.script).toContain('?[avg(order)]');
  });

  it('generates min aggregation', () => {
    const result = transpileAggregation('pages', {
      function: 'min',
      column: 'created_at',
    });

    expect(result.script).toContain('?[min(created_at)]');
  });

  it('generates max aggregation', () => {
    const result = transpileAggregation('pages', {
      function: 'max',
      column: 'created_at',
    });

    expect(result.script).toContain('?[max(created_at)]');
  });

  it('generates aggregation with group by', () => {
    const result = transpileAggregation('blocks', {
      function: 'count',
      column: 'block_id',
      groupBy: ['page_id'],
    });

    expect(result.script).toContain('?[page_id, count(block_id)]');
  });

  it('generates aggregation with filters', () => {
    const filters: Filter[] = [{ field: 'content', operator: 'contains', value: 'TODO' }];

    const result = transpileAggregation(
      'blocks',
      { function: 'count', column: 'block_id' },
      filters
    );

    expect(result.script).toContain('contains(content, $filter_0)');
    expect(result.params.filter_0).toBe('TODO');
  });

  it('throws for unknown relation', () => {
    expect(() =>
      transpileAggregation('unknown', { function: 'count', column: 'id' })
    ).toThrow('Unknown relation');
  });
});

// ==========================================================================
// Grammar Examples (from documentation)
// ==========================================================================

describe('grammar examples', () => {
  it('transpiles: find pages where title contains "meeting"', () => {
    const result = compileQuery('find pages where title contains "meeting"');

    expect(result.script).toContain('?[page_id, title]');
    expect(result.script).toContain('*pages{');
    expect(result.script).toContain('contains(title, $filter_0)');
    expect(result.params.filter_0).toBe('meeting');
  });

  it('transpiles: find blocks tagged "important"', () => {
    const result = compileQuery('find blocks where tagged "important"');

    expect(result.script).toContain('?[block_id, content]');
    expect(result.script).toContain('*blocks{');
    expect(result.script).toContain('*tags{');
    expect(result.params.tag_0).toBe('important');
  });

  it('transpiles: count pages', () => {
    const result = compileQuery('count pages');

    expect(result.script).toContain('?[count(page_id)]');
    expect(result.script).toContain('*pages{');
    expect(result.params).toEqual({});
  });

  it('transpiles: find pages linked from "Project Alpha"', () => {
    const result = compileQuery('find pages where linked from "Project Alpha"');

    expect(result.script).toContain('?[page_id, title]');
    expect(result.script).toContain('*links{');
    expect(result.params.source_0).toBe('Project Alpha');
  });

  it('transpiles: find pages where created_at > 1704067200 order by created_at desc limit 10', () => {
    const result = compileQuery(
      'find pages where created_at > 1704067200 order by created_at desc limit 10'
    );

    expect(result.script).toContain('?[page_id, title]');
    expect(result.script).toContain('created_at > $filter_0');
    expect(result.script).toContain(':order -created_at');
    expect(result.script).toContain(':limit 10');
    expect(result.params.filter_0).toBe(1704067200);
  });

  it('transpiles: find blocks where content contains "TODO" and is_deleted equals false', () => {
    const result = compileQuery(
      'find blocks where content contains "TODO" and is_deleted equals false'
    );

    expect(result.script).toContain('contains(content, $filter_0)');
    expect(result.script).toContain('is_deleted == $filter_1');
    expect(result.params.filter_0).toBe('TODO');
    expect(result.params.filter_1).toBe(false);
  });

  it('transpiles: graph pages where title starts with "Project" depth 2', () => {
    const result = compileQuery('graph pages where title starts with "Project" depth 2');

    expect(result.script).toContain('?[src, dst]');
    expect(result.script).toContain('starts_with(title, $filter_0)');
    expect(result.script).toContain(':limit 2');
    expect(result.params.filter_0).toBe('Project');
  });
});
