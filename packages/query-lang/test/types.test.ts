// Tests for @double-bind/query-lang types

import { describe, it, expect } from 'vitest';
import {
  // Type guards
  isQueryType,
  isQueryableRelation,
  isFilterOperator,
  isUnaryOperator,
  isGraphOperator,
  isFilterGroup,
  isValidColumn,
  createError,
  // Constants
  RELATION_COLUMNS,
  DEFAULT_PROJECTIONS,
  UNARY_OPERATORS,
  GRAPH_OPERATORS,
  ERROR_MESSAGES,
} from '../src/index.js';
import type { Filter, FilterGroup, QueryAST, QueryErrorCode } from '../src/index.js';

describe('@double-bind/query-lang types', () => {
  describe('isQueryType', () => {
    it('returns true for valid query types', () => {
      expect(isQueryType('find')).toBe(true);
      expect(isQueryType('count')).toBe(true);
      expect(isQueryType('graph')).toBe(true);
    });

    it('returns false for invalid query types', () => {
      expect(isQueryType('select')).toBe(false);
      expect(isQueryType('delete')).toBe(false);
      expect(isQueryType('')).toBe(false);
      expect(isQueryType(null)).toBe(false);
      expect(isQueryType(undefined)).toBe(false);
      expect(isQueryType(123)).toBe(false);
    });
  });

  describe('isQueryableRelation', () => {
    it('returns true for valid relations', () => {
      expect(isQueryableRelation('pages')).toBe(true);
      expect(isQueryableRelation('blocks')).toBe(true);
      expect(isQueryableRelation('links')).toBe(true);
      expect(isQueryableRelation('tags')).toBe(true);
      expect(isQueryableRelation('properties')).toBe(true);
      expect(isQueryableRelation('block_refs')).toBe(true);
      expect(isQueryableRelation('daily_notes')).toBe(true);
    });

    it('returns false for invalid relations', () => {
      expect(isQueryableRelation('users')).toBe(false);
      expect(isQueryableRelation('comments')).toBe(false);
      expect(isQueryableRelation('')).toBe(false);
      expect(isQueryableRelation(null)).toBe(false);
      expect(isQueryableRelation(undefined)).toBe(false);
    });
  });

  describe('isFilterOperator', () => {
    it('returns true for basic comparison operators', () => {
      expect(isFilterOperator('equals')).toBe(true);
      expect(isFilterOperator('notEquals')).toBe(true);
      expect(isFilterOperator('contains')).toBe(true);
      expect(isFilterOperator('startsWith')).toBe(true);
      expect(isFilterOperator('endsWith')).toBe(true);
    });

    it('returns true for numeric comparison operators', () => {
      expect(isFilterOperator('greaterThan')).toBe(true);
      expect(isFilterOperator('lessThan')).toBe(true);
      expect(isFilterOperator('greaterThanOrEqual')).toBe(true);
      expect(isFilterOperator('lessThanOrEqual')).toBe(true);
    });

    it('returns true for existence check operators', () => {
      expect(isFilterOperator('isNull')).toBe(true);
      expect(isFilterOperator('isNotNull')).toBe(true);
    });

    it('returns true for graph-specific operators', () => {
      expect(isFilterOperator('hasTag')).toBe(true);
      expect(isFilterOperator('linkedTo')).toBe(true);
      expect(isFilterOperator('linkedFrom')).toBe(true);
      expect(isFilterOperator('hasProperty')).toBe(true);
    });

    it('returns false for invalid operators', () => {
      expect(isFilterOperator('like')).toBe(false);
      expect(isFilterOperator('between')).toBe(false);
      expect(isFilterOperator('')).toBe(false);
      expect(isFilterOperator(null)).toBe(false);
    });
  });

  describe('isUnaryOperator', () => {
    it('returns true for unary operators', () => {
      expect(isUnaryOperator('isNull')).toBe(true);
      expect(isUnaryOperator('isNotNull')).toBe(true);
    });

    it('returns false for binary operators', () => {
      expect(isUnaryOperator('equals')).toBe(false);
      expect(isUnaryOperator('contains')).toBe(false);
      expect(isUnaryOperator('greaterThan')).toBe(false);
      expect(isUnaryOperator('hasTag')).toBe(false);
    });
  });

  describe('isGraphOperator', () => {
    it('returns true for graph operators', () => {
      expect(isGraphOperator('hasTag')).toBe(true);
      expect(isGraphOperator('linkedTo')).toBe(true);
      expect(isGraphOperator('linkedFrom')).toBe(true);
      expect(isGraphOperator('hasProperty')).toBe(true);
    });

    it('returns false for non-graph operators', () => {
      expect(isGraphOperator('equals')).toBe(false);
      expect(isGraphOperator('contains')).toBe(false);
      expect(isGraphOperator('isNull')).toBe(false);
    });
  });

  describe('isFilterGroup', () => {
    it('returns true for filter groups', () => {
      const filterGroup: FilterGroup = {
        operator: 'and',
        conditions: [
          { field: 'title', operator: 'contains', value: 'test' },
        ],
      };
      expect(isFilterGroup(filterGroup)).toBe(true);
    });

    it('returns true for nested filter groups', () => {
      const nestedGroup: FilterGroup = {
        operator: 'or',
        conditions: [
          { field: 'title', operator: 'contains', value: 'test' },
          {
            operator: 'and',
            conditions: [
              { field: 'is_deleted', operator: 'equals', value: false },
            ],
          },
        ],
      };
      expect(isFilterGroup(nestedGroup)).toBe(true);
    });

    it('returns false for simple filters', () => {
      const filter: Filter = {
        field: 'title',
        operator: 'contains',
        value: 'test',
      };
      expect(isFilterGroup(filter)).toBe(false);
    });
  });

  describe('isValidColumn', () => {
    it('returns true for valid page columns', () => {
      expect(isValidColumn('pages', 'page_id')).toBe(true);
      expect(isValidColumn('pages', 'title')).toBe(true);
      expect(isValidColumn('pages', 'created_at')).toBe(true);
      expect(isValidColumn('pages', 'updated_at')).toBe(true);
      expect(isValidColumn('pages', 'is_deleted')).toBe(true);
      expect(isValidColumn('pages', 'daily_note_date')).toBe(true);
    });

    it('returns true for valid block columns', () => {
      expect(isValidColumn('blocks', 'block_id')).toBe(true);
      expect(isValidColumn('blocks', 'page_id')).toBe(true);
      expect(isValidColumn('blocks', 'content')).toBe(true);
      expect(isValidColumn('blocks', 'content_type')).toBe(true);
    });

    it('returns false for invalid columns', () => {
      expect(isValidColumn('pages', 'invalid_column')).toBe(false);
      expect(isValidColumn('blocks', 'page_title')).toBe(false);
    });

    it('validates columns for all relations', () => {
      // Test a column from each relation
      expect(isValidColumn('links', 'source_id')).toBe(true);
      expect(isValidColumn('tags', 'entity_id')).toBe(true);
      expect(isValidColumn('properties', 'key')).toBe(true);
      expect(isValidColumn('block_refs', 'source_block_id')).toBe(true);
      expect(isValidColumn('daily_notes', 'date')).toBe(true);
    });
  });

  describe('RELATION_COLUMNS', () => {
    it('contains all expected relations', () => {
      expect(Object.keys(RELATION_COLUMNS)).toEqual([
        'pages',
        'blocks',
        'links',
        'tags',
        'properties',
        'block_refs',
        'daily_notes',
      ]);
    });

    it('pages has correct columns', () => {
      expect(RELATION_COLUMNS.pages).toContain('page_id');
      expect(RELATION_COLUMNS.pages).toContain('title');
      expect(RELATION_COLUMNS.pages).toContain('created_at');
    });

    it('blocks has correct columns', () => {
      expect(RELATION_COLUMNS.blocks).toContain('block_id');
      expect(RELATION_COLUMNS.blocks).toContain('content');
      expect(RELATION_COLUMNS.blocks).toContain('content_type');
    });
  });

  describe('DEFAULT_PROJECTIONS', () => {
    it('contains default projections for all relations', () => {
      expect(DEFAULT_PROJECTIONS.pages).toEqual(['page_id', 'title']);
      expect(DEFAULT_PROJECTIONS.blocks).toEqual(['block_id', 'content']);
      expect(DEFAULT_PROJECTIONS.links).toEqual(['source_id', 'target_id']);
      expect(DEFAULT_PROJECTIONS.tags).toEqual(['entity_id', 'tag']);
    });
  });

  describe('UNARY_OPERATORS', () => {
    it('contains exactly isNull and isNotNull', () => {
      expect(UNARY_OPERATORS).toEqual(['isNull', 'isNotNull']);
    });
  });

  describe('GRAPH_OPERATORS', () => {
    it('contains all graph-specific operators', () => {
      expect(GRAPH_OPERATORS).toEqual([
        'hasTag',
        'linkedTo',
        'linkedFrom',
        'hasProperty',
      ]);
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('contains messages for all error codes', () => {
      const expectedCodes: QueryErrorCode[] = [
        'EMPTY_QUERY',
        'INVALID_QUERY_TYPE',
        'MISSING_RELATION',
        'INVALID_SYNTAX',
        'UNCLOSED_STRING',
        'UNCLOSED_PARENTHESIS',
        'UNKNOWN_RELATION',
        'UNKNOWN_COLUMN',
        'INVALID_OPERATOR',
        'TYPE_MISMATCH',
        'INVALID_FILTER_VALUE',
        'INVALID_LINK_REFERENCE',
        'CIRCULAR_REFERENCE',
        'INVALID_COZOSCRIPT_SYNTAX',
        'INJECTION_DETECTED',
        'UNSUPPORTED_OPERATION',
      ];

      for (const code of expectedCodes) {
        expect(ERROR_MESSAGES[code]).toBeDefined();
        expect(ERROR_MESSAGES[code].message).toBeTruthy();
        expect(ERROR_MESSAGES[code].suggestion).toBeTruthy();
      }
    });

    it('has helpful suggestions', () => {
      expect(ERROR_MESSAGES.EMPTY_QUERY.suggestion).toContain('find');
      expect(ERROR_MESSAGES.UNKNOWN_RELATION.suggestion).toContain('pages');
      expect(ERROR_MESSAGES.INVALID_COZOSCRIPT_SYNTAX.suggestion).toContain('?[');
    });
  });

  describe('createError', () => {
    it('creates error with default values', () => {
      const error = createError('EMPTY_QUERY');
      expect(error.message).toBe('Query cannot be empty');
      expect(error.suggestion).toBe('Start with a query type: find, count, or graph');
      expect(error.code).toBe('EMPTY_QUERY');
      expect(error.severity).toBe('error');
    });

    it('creates error with custom options', () => {
      const error = createError('UNKNOWN_COLUMN', {
        line: 5,
        column: 10,
        length: 8,
        severity: 'warning',
        customMessage: 'Column "foo" does not exist',
        customSuggestion: 'Did you mean "page_id"?',
      });

      expect(error.message).toBe('Column "foo" does not exist');
      expect(error.suggestion).toBe('Did you mean "page_id"?');
      expect(error.line).toBe(5);
      expect(error.column).toBe(10);
      expect(error.length).toBe(8);
      expect(error.severity).toBe('warning');
      expect(error.code).toBe('UNKNOWN_COLUMN');
    });

    it('uses default message when no custom message provided', () => {
      const error = createError('INVALID_OPERATOR', { line: 1 });
      expect(error.message).toBe('Invalid filter operator');
      expect(error.line).toBe(1);
    });
  });

  describe('QueryAST structure', () => {
    it('can represent a simple find query', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [],
        projections: ['page_id', 'title'],
      };

      expect(ast.type).toBe('find');
      expect(ast.relation).toBe('pages');
      expect(ast.filters).toHaveLength(0);
      expect(ast.projections).toEqual(['page_id', 'title']);
    });

    it('can represent a query with filters', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [
          { field: 'title', operator: 'contains', value: 'meeting' },
          { field: 'is_deleted', operator: 'equals', value: false },
        ],
        projections: ['page_id', 'title'],
      };

      expect(ast.filters).toHaveLength(2);
      expect(ast.filters[0].field).toBe('title');
      expect(ast.filters[0].operator).toBe('contains');
      expect(ast.filters[0].value).toBe('meeting');
    });

    it('can represent a query with ordering and limit', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [],
        projections: ['page_id', 'title', 'created_at'],
        orderBy: { field: 'created_at', direction: 'desc' },
        limit: 10,
        offset: 5,
      };

      expect(ast.orderBy).toEqual({ field: 'created_at', direction: 'desc' });
      expect(ast.limit).toBe(10);
      expect(ast.offset).toBe(5);
    });

    it('can represent a count query', () => {
      const ast: QueryAST = {
        type: 'count',
        relation: 'blocks',
        filters: [{ field: 'is_deleted', operator: 'equals', value: false }],
        projections: [],
      };

      expect(ast.type).toBe('count');
      expect(ast.projections).toHaveLength(0);
    });

    it('can represent a graph query', () => {
      const ast: QueryAST = {
        type: 'graph',
        relation: 'pages',
        filters: [{ field: 'title', operator: 'startsWith', value: 'Project' }],
        projections: ['page_id', 'title'],
        limit: 2, // depth
      };

      expect(ast.type).toBe('graph');
    });

    it('can include metadata', () => {
      const ast: QueryAST = {
        type: 'find',
        relation: 'pages',
        filters: [],
        projections: ['page_id', 'title'],
        metadata: {
          level: 2,
          originalInput: 'find pages',
          createdAt: Date.now(),
        },
      };

      expect(ast.metadata?.level).toBe(2);
      expect(ast.metadata?.originalInput).toBe('find pages');
    });
  });

  describe('Filter structure', () => {
    it('supports negated filters', () => {
      const filter: Filter = {
        field: 'title',
        operator: 'contains',
        value: 'draft',
        negated: true,
      };

      expect(filter.negated).toBe(true);
    });

    it('supports null values for unary operators', () => {
      const filter: Filter = {
        field: 'daily_note_date',
        operator: 'isNull',
        value: null,
      };

      expect(filter.value).toBeNull();
    });

    it('supports numeric values', () => {
      const filter: Filter = {
        field: 'created_at',
        operator: 'greaterThan',
        value: 1704067200000,
      };

      expect(typeof filter.value).toBe('number');
    });

    it('supports boolean values', () => {
      const filter: Filter = {
        field: 'is_deleted',
        operator: 'equals',
        value: false,
      };

      expect(filter.value).toBe(false);
    });
  });

  describe('FilterGroup structure', () => {
    it('supports AND groups', () => {
      const group: FilterGroup = {
        operator: 'and',
        conditions: [
          { field: 'title', operator: 'contains', value: 'meeting' },
          { field: 'is_deleted', operator: 'equals', value: false },
        ],
      };

      expect(group.operator).toBe('and');
      expect(group.conditions).toHaveLength(2);
    });

    it('supports OR groups', () => {
      const group: FilterGroup = {
        operator: 'or',
        conditions: [
          { field: 'title', operator: 'contains', value: 'meeting' },
          { field: 'title', operator: 'contains', value: 'agenda' },
        ],
      };

      expect(group.operator).toBe('or');
    });

    it('supports nested groups', () => {
      const group: FilterGroup = {
        operator: 'and',
        conditions: [
          { field: 'is_deleted', operator: 'equals', value: false },
          {
            operator: 'or',
            conditions: [
              { field: 'title', operator: 'contains', value: 'meeting' },
              { field: 'title', operator: 'contains', value: 'agenda' },
            ],
          },
        ],
      };

      expect(group.conditions).toHaveLength(2);
      const nested = group.conditions[1] as FilterGroup;
      expect(nested.operator).toBe('or');
      expect(nested.conditions).toHaveLength(2);
    });
  });
});
