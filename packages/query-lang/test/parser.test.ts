// @double-bind/query-lang - Parser tests
//
// Comprehensive tests for the query DSL parser covering:
// - Basic query types (find, count, graph)
// - All relations (pages, blocks, links, tags, properties, block_refs, daily_notes)
// - All filter operators
// - Order by and limit/offset clauses
// - Error handling with line/column information
// - Edge cases

import { describe, it, expect } from 'vitest';
import { parseQuery, ParseError } from '../src/index.js';

describe('parseQuery', () => {
  // ==========================================================================
  // Basic Query Types
  // ==========================================================================

  describe('find queries', () => {
    it('parses basic find query', () => {
      const ast = parseQuery('find pages');
      expect(ast).toMatchObject({
        type: 'find',
        relation: 'pages',
        filters: [],
        projections: ['page_id', 'title'],
      });
    });

    it('parses find query with where clause', () => {
      const ast = parseQuery("find pages where title contains 'meeting'");
      expect(ast).toMatchObject({
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'title', operator: 'contains', value: 'meeting' }],
        projections: ['page_id', 'title'],
      });
    });

    it('parses find with double-quoted strings', () => {
      const ast = parseQuery('find pages where title contains "meeting notes"');
      expect(ast.filters[0].value).toBe('meeting notes');
    });

    it('parses find with single-quoted strings', () => {
      const ast = parseQuery("find blocks where content contains 'TODO'");
      expect(ast.filters[0].value).toBe('TODO');
    });

    it('parses find with multiple filters using AND', () => {
      const ast = parseQuery(
        "find blocks where content contains 'TODO' and is_deleted equals false"
      );
      expect(ast.filters).toHaveLength(2);
      expect(ast.filters[0]).toMatchObject({ field: 'content', operator: 'contains', value: 'TODO' });
      expect(ast.filters[1]).toMatchObject({ field: 'is_deleted', operator: 'equals', value: false });
    });

    it('parses find with OR filters', () => {
      const ast = parseQuery(
        "find pages where title contains 'project' or title contains 'meeting'"
      );
      expect(ast.filters).toHaveLength(2);
    });

    it('parses find with order by clause', () => {
      const ast = parseQuery('find pages order by created_at desc');
      expect(ast.orderBy).toEqual({ field: 'created_at', direction: 'desc' });
    });

    it('parses find with order by asc (default)', () => {
      const ast = parseQuery('find pages order by title');
      expect(ast.orderBy).toEqual({ field: 'title', direction: 'asc' });
    });

    it('parses find with limit clause', () => {
      const ast = parseQuery('find pages limit 10');
      expect(ast.limit).toBe(10);
    });

    it('parses find with limit and offset', () => {
      const ast = parseQuery('find pages limit 10 offset 20');
      expect(ast.limit).toBe(10);
      expect(ast.offset).toBe(20);
    });

    it('parses find with where, order by, and limit', () => {
      const ast = parseQuery(
        "find pages where title contains 'project' order by created_at desc limit 5"
      );
      expect(ast).toMatchObject({
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'title', operator: 'contains', value: 'project' }],
        orderBy: { field: 'created_at', direction: 'desc' },
        limit: 5,
      });
    });

    it('parses find with select clause', () => {
      const ast = parseQuery('find pages select page_id, title, created_at');
      expect(ast.projections).toEqual(['page_id', 'title', 'created_at']);
    });

    it('parses find with returning clause (alias for select)', () => {
      const ast = parseQuery('find blocks returning block_id, content');
      expect(ast.projections).toEqual(['block_id', 'content']);
    });
  });

  describe('count queries', () => {
    it('parses basic count query', () => {
      const ast = parseQuery('count pages');
      expect(ast).toMatchObject({
        type: 'count',
        relation: 'pages',
        filters: [],
        projections: [],
      });
    });

    it('parses count with where clause', () => {
      const ast = parseQuery('count blocks where is_deleted equals false');
      expect(ast).toMatchObject({
        type: 'count',
        relation: 'blocks',
        filters: [{ field: 'is_deleted', operator: 'equals', value: false }],
      });
    });
  });

  describe('graph queries', () => {
    it('parses basic graph query', () => {
      const ast = parseQuery('graph pages');
      expect(ast).toMatchObject({
        type: 'graph',
        relation: 'pages',
        filters: [],
        projections: [],
      });
    });

    it('parses graph with where clause', () => {
      const ast = parseQuery("graph pages where title starts with 'Project'");
      expect(ast).toMatchObject({
        type: 'graph',
        relation: 'pages',
        filters: [{ field: 'title', operator: 'startsWith', value: 'Project' }],
      });
    });

    it('parses graph with depth clause', () => {
      const ast = parseQuery('graph pages depth 3');
      expect(ast.limit).toBe(3); // depth stored as limit for graph queries
    });

    it('parses graph with where and depth', () => {
      const ast = parseQuery("graph pages where title contains 'main' depth 2");
      expect(ast.filters).toHaveLength(1);
      expect(ast.limit).toBe(2);
    });
  });

  // ==========================================================================
  // Relations
  // ==========================================================================

  describe('relations', () => {
    it('parses pages relation', () => {
      const ast = parseQuery('find pages');
      expect(ast.relation).toBe('pages');
      expect(ast.projections).toEqual(['page_id', 'title']);
    });

    it('parses singular page as pages', () => {
      const ast = parseQuery('find page');
      expect(ast.relation).toBe('pages');
    });

    it('parses blocks relation', () => {
      const ast = parseQuery('find blocks');
      expect(ast.relation).toBe('blocks');
      expect(ast.projections).toEqual(['block_id', 'content']);
    });

    it('parses singular block as blocks', () => {
      const ast = parseQuery('find block');
      expect(ast.relation).toBe('blocks');
    });

    it('parses links relation', () => {
      const ast = parseQuery('find links');
      expect(ast.relation).toBe('links');
      expect(ast.projections).toEqual(['source_id', 'target_id']);
    });

    it('parses tags relation', () => {
      const ast = parseQuery('find tags');
      expect(ast.relation).toBe('tags');
      expect(ast.projections).toEqual(['entity_id', 'tag']);
    });

    it('parses properties relation', () => {
      const ast = parseQuery('find properties');
      expect(ast.relation).toBe('properties');
      expect(ast.projections).toEqual(['entity_id', 'key', 'value']);
    });

    it('parses block_refs relation', () => {
      const ast = parseQuery('find block_refs');
      expect(ast.relation).toBe('block_refs');
    });

    it('parses blockrefs as block_refs', () => {
      const ast = parseQuery('find blockrefs');
      expect(ast.relation).toBe('block_refs');
    });

    it('parses daily_notes relation', () => {
      const ast = parseQuery('find daily_notes');
      expect(ast.relation).toBe('daily_notes');
    });

    it('parses dailynotes as daily_notes', () => {
      const ast = parseQuery('find dailynotes');
      expect(ast.relation).toBe('daily_notes');
    });
  });

  // ==========================================================================
  // Filter Operators
  // ==========================================================================

  describe('filter operators', () => {
    describe('equals operator', () => {
      it('parses equals keyword', () => {
        const ast = parseQuery("find pages where title equals 'Test'");
        expect(ast.filters[0].operator).toBe('equals');
      });

      it('parses is keyword as equals', () => {
        const ast = parseQuery("find pages where title is 'Test'");
        expect(ast.filters[0].operator).toBe('equals');
      });

      it('parses = symbol', () => {
        const ast = parseQuery("find pages where title = 'Test'");
        expect(ast.filters[0].operator).toBe('equals');
      });

      it('parses == symbol', () => {
        const ast = parseQuery("find pages where title == 'Test'");
        expect(ast.filters[0].operator).toBe('equals');
      });
    });

    describe('notEquals operator', () => {
      it('parses != symbol', () => {
        const ast = parseQuery("find pages where title != 'Draft'");
        expect(ast.filters[0].operator).toBe('notEquals');
      });

      it('parses <> symbol', () => {
        const ast = parseQuery("find pages where title <> 'Draft'");
        expect(ast.filters[0].operator).toBe('notEquals');
      });
    });

    describe('contains operator', () => {
      it('parses contains keyword', () => {
        const ast = parseQuery("find pages where title contains 'project'");
        expect(ast.filters[0].operator).toBe('contains');
      });
    });

    describe('startsWith operator', () => {
      it('parses startswith keyword', () => {
        const ast = parseQuery("find pages where title startswith 'Project'");
        expect(ast.filters[0].operator).toBe('startsWith');
      });

      it('parses starts with keyword', () => {
        const ast = parseQuery("find pages where title starts with 'Project'");
        expect(ast.filters[0].operator).toBe('startsWith');
      });
    });

    describe('endsWith operator', () => {
      it('parses endswith keyword', () => {
        const ast = parseQuery("find pages where title endswith 'Notes'");
        expect(ast.filters[0].operator).toBe('endsWith');
      });

      it('parses ends with keyword', () => {
        const ast = parseQuery("find pages where title ends with 'Notes'");
        expect(ast.filters[0].operator).toBe('endsWith');
      });
    });

    describe('comparison operators', () => {
      it('parses > operator', () => {
        const ast = parseQuery('find pages where created_at > 1704067200');
        expect(ast.filters[0]).toMatchObject({
          operator: 'greaterThan',
          value: 1704067200,
        });
      });

      it('parses greater than keyword', () => {
        const ast = parseQuery('find pages where created_at greater than 1704067200');
        expect(ast.filters[0].operator).toBe('greaterThan');
      });

      it('parses < operator', () => {
        const ast = parseQuery('find pages where created_at < 1704067200');
        expect(ast.filters[0].operator).toBe('lessThan');
      });

      it('parses less than keyword', () => {
        const ast = parseQuery('find pages where created_at less than 1704067200');
        expect(ast.filters[0].operator).toBe('lessThan');
      });

      it('parses >= operator', () => {
        const ast = parseQuery('find pages where created_at >= 1704067200');
        expect(ast.filters[0].operator).toBe('greaterThanOrEqual');
      });

      it('parses gte keyword', () => {
        const ast = parseQuery('find pages where created_at gte 1704067200');
        expect(ast.filters[0].operator).toBe('greaterThanOrEqual');
      });

      it('parses <= operator', () => {
        const ast = parseQuery('find pages where created_at <= 1704067200');
        expect(ast.filters[0].operator).toBe('lessThanOrEqual');
      });

      it('parses lte keyword', () => {
        const ast = parseQuery('find pages where created_at lte 1704067200');
        expect(ast.filters[0].operator).toBe('lessThanOrEqual');
      });
    });

    describe('null operators', () => {
      it('parses is null operator', () => {
        const ast = parseQuery('find pages where daily_note_date is null');
        expect(ast.filters[0]).toMatchObject({
          field: 'daily_note_date',
          operator: 'isNull',
          value: null,
        });
      });

      it('parses is not null operator', () => {
        const ast = parseQuery('find pages where daily_note_date is not null');
        expect(ast.filters[0]).toMatchObject({
          field: 'daily_note_date',
          operator: 'isNotNull',
          value: null,
        });
      });
    });
  });

  // ==========================================================================
  // Special Conditions
  // ==========================================================================

  describe('special conditions', () => {
    describe('tagged condition', () => {
      it('parses tagged condition', () => {
        const ast = parseQuery("find blocks where tagged 'important'");
        expect(ast.filters[0]).toMatchObject({
          field: 'tag',
          operator: 'hasTag',
          value: 'important',
        });
      });

      it('parses tagged with double quotes', () => {
        const ast = parseQuery('find pages where tagged "project"');
        expect(ast.filters[0].value).toBe('project');
      });
    });

    describe('linked condition', () => {
      it('parses linked from condition', () => {
        const ast = parseQuery("find pages where linked from 'Project Alpha'");
        expect(ast.filters[0]).toMatchObject({
          field: 'source',
          operator: 'linkedFrom',
          value: 'Project Alpha',
        });
      });

      it('parses linked to condition', () => {
        const ast = parseQuery("find pages where linked to 'Resources'");
        expect(ast.filters[0]).toMatchObject({
          field: 'source',
          operator: 'linkedTo',
          value: 'Resources',
        });
      });

      it('parses linked without direction (defaults to linkedTo)', () => {
        const ast = parseQuery("find pages where linked 'Resources'");
        expect(ast.filters[0].operator).toBe('linkedTo');
      });
    });

    describe('property condition', () => {
      it('parses has property condition', () => {
        const ast = parseQuery("find pages where has property 'status'");
        expect(ast.filters[0]).toMatchObject({
          field: 'status',
          operator: 'hasProperty',
          value: 'status',
        });
      });

      it('parses has property with value check', () => {
        const ast = parseQuery("find pages where has property 'status' equals 'done'");
        expect(ast.filters[0]).toMatchObject({
          field: 'status',
          operator: 'equals',
          value: 'done',
        });
      });
    });
  });

  // ==========================================================================
  // Value Types
  // ==========================================================================

  describe('value types', () => {
    it('parses string values with double quotes', () => {
      const ast = parseQuery('find pages where title equals "test value"');
      expect(ast.filters[0].value).toBe('test value');
    });

    it('parses string values with single quotes', () => {
      const ast = parseQuery("find pages where title equals 'test value'");
      expect(ast.filters[0].value).toBe('test value');
    });

    it('parses integer values', () => {
      const ast = parseQuery('find pages where created_at > 1704067200');
      expect(ast.filters[0].value).toBe(1704067200);
    });

    it('parses negative integer values', () => {
      const ast = parseQuery('find pages where created_at > -10');
      expect(ast.filters[0].value).toBe(-10);
    });

    it('parses decimal values', () => {
      const ast = parseQuery('find pages where created_at > 1.5');
      expect(ast.filters[0].value).toBe(1.5);
    });

    it('parses boolean true', () => {
      const ast = parseQuery('find pages where is_deleted equals true');
      expect(ast.filters[0].value).toBe(true);
    });

    it('parses boolean false', () => {
      const ast = parseQuery('find pages where is_deleted equals false');
      expect(ast.filters[0].value).toBe(false);
    });

    it('parses null value', () => {
      const ast = parseQuery('find pages where daily_note_date equals null');
      expect(ast.filters[0].value).toBe(null);
    });
  });

  // ==========================================================================
  // Case Insensitivity
  // ==========================================================================

  describe('case insensitivity', () => {
    it('parses uppercase FIND', () => {
      const ast = parseQuery('FIND pages');
      expect(ast.type).toBe('find');
    });

    it('parses mixed case Find', () => {
      const ast = parseQuery('Find Pages');
      expect(ast.type).toBe('find');
      expect(ast.relation).toBe('pages');
    });

    it('parses uppercase WHERE', () => {
      const ast = parseQuery("find pages WHERE title equals 'test'");
      expect(ast.filters).toHaveLength(1);
    });

    it('parses uppercase operators', () => {
      const ast = parseQuery("find pages where title CONTAINS 'test'");
      expect(ast.filters[0].operator).toBe('contains');
    });

    it('parses TRUE/FALSE in any case', () => {
      const ast1 = parseQuery('find pages where is_deleted equals TRUE');
      expect(ast1.filters[0].value).toBe(true);

      const ast2 = parseQuery('find pages where is_deleted equals False');
      expect(ast2.filters[0].value).toBe(false);
    });
  });

  // ==========================================================================
  // Escape Sequences
  // ==========================================================================

  describe('escape sequences', () => {
    it('handles escaped quotes in strings', () => {
      const ast = parseQuery('find pages where title contains "say \\"hello\\""');
      expect(ast.filters[0].value).toBe('say "hello"');
    });

    it('handles escaped single quotes', () => {
      const ast = parseQuery("find pages where title contains 'it\\'s good'");
      expect(ast.filters[0].value).toBe("it's good");
    });

    it('handles escaped backslashes', () => {
      const ast = parseQuery('find pages where content contains "path\\\\file"');
      expect(ast.filters[0].value).toBe('path\\file');
    });

    it('handles newline escapes', () => {
      const ast = parseQuery('find blocks where content contains "line1\\nline2"');
      expect(ast.filters[0].value).toBe('line1\nline2');
    });

    it('handles tab escapes', () => {
      const ast = parseQuery('find blocks where content contains "col1\\tcol2"');
      expect(ast.filters[0].value).toBe('col1\tcol2');
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('error handling', () => {
    it('throws ParseError for empty input', () => {
      expect(() => parseQuery('')).toThrow(ParseError);
      expect(() => parseQuery('   ')).toThrow(ParseError);
    });

    it('throws ParseError for null/undefined input', () => {
      expect(() => parseQuery(null as unknown as string)).toThrow(ParseError);
      expect(() => parseQuery(undefined as unknown as string)).toThrow(ParseError);
    });

    it('throws ParseError for invalid query type', () => {
      try {
        parseQuery('select pages');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        const error = e as ParseError;
        expect(error.errors[0].code).toBe('INVALID_QUERY_TYPE');
      }
    });

    it('throws ParseError for missing relation', () => {
      try {
        parseQuery('find where title = "test"');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        const error = e as ParseError;
        expect(error.errors[0].code).toBe('MISSING_RELATION');
      }
    });

    it('throws ParseError for unknown relation', () => {
      try {
        parseQuery('find users');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        const error = e as ParseError;
        expect(error.errors[0].code).toBe('MISSING_RELATION');
      }
    });

    it('throws ParseError for unclosed string', () => {
      try {
        parseQuery('find pages where title = "unclosed');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        const error = e as ParseError;
        expect(error.errors[0].code).toBe('UNCLOSED_STRING');
      }
    });

    it('throws ParseError for invalid operator', () => {
      try {
        parseQuery("find pages where title like 'test'");
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        const error = e as ParseError;
        expect(error.errors[0].code).toBe('INVALID_OPERATOR');
      }
    });

    it('throws ParseError for unknown column in select', () => {
      try {
        parseQuery('find pages select unknown_column');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        const error = e as ParseError;
        expect(error.errors[0].code).toBe('UNKNOWN_COLUMN');
        expect(error.errors[0].suggestion).toContain('page_id');
      }
    });

    it('provides line and column information', () => {
      try {
        parseQuery('find pages where title = "unclosed');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        const error = e as ParseError;
        expect(error.line).toBe(1);
        expect(error.column).toBeGreaterThan(20);
      }
    });

    it('provides helpful suggestion in errors', () => {
      try {
        parseQuery('find');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        const error = e as ParseError;
        expect(error.errors[0].suggestion).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('handles extra whitespace', () => {
      const ast = parseQuery('  find   pages   where   title   contains   "test"  ');
      expect(ast.type).toBe('find');
      expect(ast.relation).toBe('pages');
      expect(ast.filters[0].value).toBe('test');
    });

    it('handles newlines', () => {
      const ast = parseQuery(`find pages
        where title contains "test"
        order by created_at desc
        limit 10`);
      expect(ast.type).toBe('find');
      expect(ast.filters).toHaveLength(1);
      expect(ast.orderBy).toBeDefined();
      expect(ast.limit).toBe(10);
    });

    it('handles tabs', () => {
      const ast = parseQuery("find\tpages\twhere\ttitle\tequals\t'test'");
      expect(ast.type).toBe('find');
      expect(ast.relation).toBe('pages');
    });

    it('handles empty string value', () => {
      const ast = parseQuery('find pages where title equals ""');
      expect(ast.filters[0].value).toBe('');
    });

    it('handles string with spaces', () => {
      const ast = parseQuery('find pages where title contains "  multiple  spaces  "');
      expect(ast.filters[0].value).toBe('  multiple  spaces  ');
    });

    it('handles very long input', () => {
      const longValue = 'a'.repeat(1000);
      const ast = parseQuery(`find pages where title contains "${longValue}"`);
      expect(ast.filters[0].value).toBe(longValue);
    });

    it('handles zero as limit', () => {
      const ast = parseQuery('find pages limit 0');
      expect(ast.limit).toBe(0);
    });

    it('handles large limit', () => {
      const ast = parseQuery('find pages limit 999999');
      expect(ast.limit).toBe(999999);
    });

    it('handles multiple conditions of different types', () => {
      const ast = parseQuery(
        "find pages where title contains 'project' and tagged 'important' and is_deleted equals false"
      );
      expect(ast.filters).toHaveLength(3);
      expect(ast.filters[0].operator).toBe('contains');
      expect(ast.filters[1].operator).toBe('hasTag');
      expect(ast.filters[2].operator).toBe('equals');
    });
  });

  // ==========================================================================
  // Grammar Examples from grammar.ts
  // ==========================================================================

  describe('grammar examples (from documentation)', () => {
    it('parses example: find pages where title contains "meeting"', () => {
      const ast = parseQuery('find pages where title contains "meeting"');
      expect(ast).toMatchObject({
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'title', operator: 'contains', value: 'meeting' }],
      });
    });

    it('parses example: find blocks tagged "important"', () => {
      const ast = parseQuery('find blocks where tagged "important"');
      expect(ast).toMatchObject({
        type: 'find',
        relation: 'blocks',
        filters: [{ field: 'tag', operator: 'hasTag', value: 'important' }],
      });
    });

    it('parses example: count pages', () => {
      const ast = parseQuery('count pages');
      expect(ast).toMatchObject({
        type: 'count',
        relation: 'pages',
        filters: [],
      });
    });

    it('parses example: find pages linked from "Project Alpha"', () => {
      const ast = parseQuery('find pages where linked from "Project Alpha"');
      expect(ast).toMatchObject({
        type: 'find',
        relation: 'pages',
        filters: [{ operator: 'linkedFrom', value: 'Project Alpha' }],
      });
    });

    it('parses example: find pages where created_at > 1704067200 order by created_at desc limit 10', () => {
      const ast = parseQuery('find pages where created_at > 1704067200 order by created_at desc limit 10');
      expect(ast).toMatchObject({
        type: 'find',
        relation: 'pages',
        filters: [{ field: 'created_at', operator: 'greaterThan', value: 1704067200 }],
        orderBy: { field: 'created_at', direction: 'desc' },
        limit: 10,
      });
    });

    it('parses example: find blocks where content contains "TODO" and is_deleted equals false', () => {
      const ast = parseQuery('find blocks where content contains "TODO" and is_deleted equals false');
      expect(ast.filters).toHaveLength(2);
      expect(ast.filters[0]).toMatchObject({ field: 'content', operator: 'contains', value: 'TODO' });
      expect(ast.filters[1]).toMatchObject({ field: 'is_deleted', operator: 'equals', value: false });
    });

    it('parses example: graph pages where title starts with "Project" depth 2', () => {
      const ast = parseQuery('graph pages where title starts with "Project" depth 2');
      expect(ast).toMatchObject({
        type: 'graph',
        relation: 'pages',
        filters: [{ field: 'title', operator: 'startsWith', value: 'Project' }],
        limit: 2, // depth stored as limit
      });
    });
  });

  // ==========================================================================
  // SQL Injection Prevention (validation)
  // ==========================================================================

  describe('security: injection prevention', () => {
    it('treats SQL-like keywords as literals in strings', () => {
      const ast = parseQuery('find pages where title contains "DROP TABLE pages; --"');
      expect(ast.filters[0].value).toBe('DROP TABLE pages; --');
    });

    it('treats CozoScript-like content as literals in strings', () => {
      const ast = parseQuery('find pages where title contains "?[x] := *pages{}"');
      expect(ast.filters[0].value).toBe('?[x] := *pages{}');
    });

    it('does not interpret semicolons specially', () => {
      const ast = parseQuery('find pages where title contains "a; b; c"');
      expect(ast.filters[0].value).toBe('a; b; c');
    });
  });
});
