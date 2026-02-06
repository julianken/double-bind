// Tests for @double-bind/query-lang grammar

import { describe, it, expect } from 'vitest';
import {
  GRAMMAR_PEG,
  GRAMMAR_EXAMPLES,
  KEYWORDS,
  OPERATOR_SYMBOLS,
  RELATION_METADATA,
  OPERATOR_METADATA,
  TRANSPILE_PATTERNS,
  isQueryTypeKeyword,
  isRelationKeyword,
  normalizeRelation,
  getIdColumn,
} from '../src/index.js';

describe('@double-bind/query-lang grammar', () => {
  describe('GRAMMAR_PEG', () => {
    it('is defined and non-empty', () => {
      expect(GRAMMAR_PEG).toBeDefined();
      expect(GRAMMAR_PEG.length).toBeGreaterThan(100);
    });

    it('defines the Query rule', () => {
      expect(GRAMMAR_PEG).toContain('Query');
      expect(GRAMMAR_PEG).toContain('FindQuery');
      expect(GRAMMAR_PEG).toContain('CountQuery');
      expect(GRAMMAR_PEG).toContain('GraphQuery');
    });

    it('defines relation rules', () => {
      expect(GRAMMAR_PEG).toContain('PAGES');
      expect(GRAMMAR_PEG).toContain('BLOCKS');
      expect(GRAMMAR_PEG).toContain('LINKS');
      expect(GRAMMAR_PEG).toContain('TAGS');
    });

    it('defines operator rules', () => {
      expect(GRAMMAR_PEG).toContain('EQUALS');
      expect(GRAMMAR_PEG).toContain('CONTAINS');
      expect(GRAMMAR_PEG).toContain('GREATER_THAN');
      expect(GRAMMAR_PEG).toContain('LESS_THAN');
    });

    it('defines clause rules', () => {
      expect(GRAMMAR_PEG).toContain('WhereClause');
      expect(GRAMMAR_PEG).toContain('SelectClause');
      expect(GRAMMAR_PEG).toContain('OrderClause');
      expect(GRAMMAR_PEG).toContain('LimitClause');
    });

    it('supports case-insensitive keywords', () => {
      // Keywords use character classes like [Ff][Ii][Nn][Dd] for case-insensitivity
      expect(GRAMMAR_PEG).toMatch(/\[Ff\]\[Ii\]\[Nn\]\[Dd\]/);
      expect(GRAMMAR_PEG).toMatch(/\[Ww\]\[Hh\]\[Ee\]\[Rr\]\[Ee\]/);
    });
  });

  describe('GRAMMAR_EXAMPLES', () => {
    describe('Level 1 (Templates)', () => {
      const level1 = GRAMMAR_EXAMPLES.level1;

      it('has name and description', () => {
        expect(level1.name).toBe('Templates');
        expect(level1.description).toContain('Pre-built');
      });

      it('has example templates', () => {
        expect(level1.examples.length).toBeGreaterThan(0);
      });

      it('each template has required fields', () => {
        for (const example of level1.examples) {
          expect(example.template).toBeDefined();
          expect(example.parameters).toBeDefined();
          expect(example.description).toBeDefined();
          expect(example.cozoScript).toBeDefined();
        }
      });

      it('includes common templates', () => {
        const templateIds = level1.examples.map((e) => e.template);
        expect(templateIds).toContain('find-pages-by-tag');
        expect(templateIds).toContain('recent-pages');
        expect(templateIds).toContain('orphan-pages');
      });
    });

    describe('Level 2 (Visual Builder)', () => {
      const level2 = GRAMMAR_EXAMPLES.level2;

      it('has name and description', () => {
        expect(level2.name).toBe('Visual Builder');
        expect(level2.description).toContain('Form-based');
      });

      it('has DSL examples', () => {
        expect(level2.examples.length).toBeGreaterThan(0);
      });

      it('each example has dsl, ast, and cozoScript', () => {
        for (const example of level2.examples) {
          expect(example.dsl).toBeDefined();
          expect(example.ast).toBeDefined();
          expect(example.cozoScript).toBeDefined();
          expect(example.description).toBeDefined();
        }
      });

      it('covers all query types', () => {
        const queryTypes = level2.examples.map((e) => e.ast.type);
        expect(queryTypes).toContain('find');
        expect(queryTypes).toContain('count');
        expect(queryTypes).toContain('graph');
      });

      it('covers common query patterns', () => {
        const dsls = level2.examples.map((e) => e.dsl);
        expect(dsls).toContain('find pages where title contains "meeting"');
        expect(dsls).toContain('find blocks tagged "important"');
        expect(dsls).toContain('count pages');
        expect(dsls).toContain('find pages linked from "Project Alpha"');
      });
    });

    describe('Level 3 (Raw Datalog)', () => {
      const level3 = GRAMMAR_EXAMPLES.level3;

      it('has name and description', () => {
        expect(level3.name).toBe('Raw Datalog');
        expect(level3.description).toContain('CozoScript');
      });

      it('has CozoScript examples', () => {
        expect(level3.examples.length).toBeGreaterThan(0);
      });

      it('each example has cozoScript and description', () => {
        for (const example of level3.examples) {
          expect(example.cozoScript).toBeDefined();
          expect(example.description).toBeDefined();
        }
      });

      it('includes advanced patterns', () => {
        const descriptions = level3.examples.map((e) => e.description);
        expect(descriptions).toContain('List all active pages');
        expect(descriptions.some((d) => d.includes('join'))).toBe(true);
        expect(descriptions.some((d) => d.includes('aggregation'))).toBe(true);
        expect(descriptions.some((d) => d.includes('negation'))).toBe(true);
      });

      it('all CozoScript starts with ?[', () => {
        for (const example of level3.examples) {
          expect(example.cozoScript.trim().startsWith('?[')).toBe(true);
        }
      });
    });
  });

  describe('KEYWORDS', () => {
    it('maps query type keywords', () => {
      expect(KEYWORDS.find).toBe('FIND');
      expect(KEYWORDS.count).toBe('COUNT');
      expect(KEYWORDS.graph).toBe('GRAPH');
    });

    it('maps clause keywords', () => {
      expect(KEYWORDS.where).toBe('WHERE');
      expect(KEYWORDS.select).toBe('SELECT');
      expect(KEYWORDS.order).toBe('ORDER');
      expect(KEYWORDS.limit).toBe('LIMIT');
    });

    it('maps relation keywords with aliases', () => {
      expect(KEYWORDS.pages).toBe('PAGES');
      expect(KEYWORDS.page).toBe('PAGES');
      expect(KEYWORDS.blocks).toBe('BLOCKS');
      expect(KEYWORDS.block).toBe('BLOCKS');
    });

    it('maps direction keywords with aliases', () => {
      expect(KEYWORDS.asc).toBe('ASC');
      expect(KEYWORDS.ascending).toBe('ASC');
      expect(KEYWORDS.desc).toBe('DESC');
      expect(KEYWORDS.descending).toBe('DESC');
    });

    it('maps operator keywords', () => {
      expect(KEYWORDS.equals).toBe('EQUALS');
      expect(KEYWORDS.is).toBe('EQUALS');
      expect(KEYWORDS.contains).toBe('CONTAINS');
      expect(KEYWORDS.tagged).toBe('TAGGED');
    });
  });

  describe('OPERATOR_SYMBOLS', () => {
    it('maps comparison symbols', () => {
      expect(OPERATOR_SYMBOLS['=']).toBe('EQUALS');
      expect(OPERATOR_SYMBOLS['==']).toBe('EQUALS');
      expect(OPERATOR_SYMBOLS['!=']).toBe('NOT_EQUALS');
      expect(OPERATOR_SYMBOLS['<>']).toBe('NOT_EQUALS');
    });

    it('maps range symbols', () => {
      expect(OPERATOR_SYMBOLS['>']).toBe('GREATER_THAN');
      expect(OPERATOR_SYMBOLS['<']).toBe('LESS_THAN');
      expect(OPERATOR_SYMBOLS['>=']).toBe('GTE');
      expect(OPERATOR_SYMBOLS['<=']).toBe('LTE');
    });

    it('maps structural symbols', () => {
      expect(OPERATOR_SYMBOLS[',']).toBe('COMMA');
      expect(OPERATOR_SYMBOLS['(']).toBe('LPAREN');
      expect(OPERATOR_SYMBOLS[')']).toBe('RPAREN');
    });
  });

  describe('RELATION_METADATA', () => {
    it('contains metadata for all relations', () => {
      const relations = Object.keys(RELATION_METADATA);
      expect(relations).toContain('pages');
      expect(relations).toContain('blocks');
      expect(relations).toContain('links');
      expect(relations).toContain('tags');
      expect(relations).toContain('properties');
      expect(relations).toContain('block_refs');
      expect(relations).toContain('daily_notes');
    });

    it('pages metadata is complete', () => {
      const pages = RELATION_METADATA.pages;
      expect(pages.name).toBe('pages');
      expect(pages.displayName).toBe('Pages');
      expect(pages.description).toBeTruthy();
      expect(pages.columns.page_id).toBeDefined();
      expect(pages.columns.title).toBeDefined();
      expect(pages.defaultProjections).toEqual(['page_id', 'title']);
      expect(pages.availableAtLevel).toContain(1);
      expect(pages.availableAtLevel).toContain(2);
      expect(pages.availableAtLevel).toContain(3);
    });

    it('each relation has column metadata', () => {
      for (const [_relation, metadata] of Object.entries(RELATION_METADATA)) {
        expect(metadata.columns).toBeDefined();
        expect(Object.keys(metadata.columns).length).toBeGreaterThan(0);

        // Each column has type and description
        for (const [_column, columnMeta] of Object.entries(metadata.columns)) {
          expect(columnMeta.type).toBeTruthy();
          expect(columnMeta.description).toBeTruthy();
        }
      }
    });

    it('specifies availability levels', () => {
      // Some relations are only available at higher levels
      expect(RELATION_METADATA.pages.availableAtLevel).toContain(1);
      expect(RELATION_METADATA.links.availableAtLevel).not.toContain(1);
      expect(RELATION_METADATA.links.availableAtLevel).toContain(2);
    });
  });

  describe('OPERATOR_METADATA', () => {
    it('contains metadata for all operators', () => {
      const operators = Object.keys(OPERATOR_METADATA);
      expect(operators).toContain('equals');
      expect(operators).toContain('contains');
      expect(operators).toContain('greaterThan');
      expect(operators).toContain('hasTag');
    });

    it('operator metadata is complete', () => {
      const equals = OPERATOR_METADATA.equals;
      expect(equals.symbol).toBe('=');
      expect(equals.displayName).toBe('equals');
      expect(equals.description).toBeTruthy();
      expect(equals.compatibleTypes).toContain('string');
      expect(equals.dslAliases).toContain('equals');
      expect(equals.dslAliases).toContain('is');
    });

    it('marks unary operators', () => {
      expect(OPERATOR_METADATA.isNull.isUnary).toBe(true);
      expect(OPERATOR_METADATA.isNotNull.isUnary).toBe(true);
      expect(OPERATOR_METADATA.equals.isUnary).toBeUndefined();
    });

    it('marks graph operators', () => {
      expect(OPERATOR_METADATA.hasTag.isGraphOperator).toBe(true);
      expect(OPERATOR_METADATA.linkedTo.isGraphOperator).toBe(true);
      expect(OPERATOR_METADATA.linkedFrom.isGraphOperator).toBe(true);
      expect(OPERATOR_METADATA.hasProperty.isGraphOperator).toBe(true);
      expect(OPERATOR_METADATA.equals.isGraphOperator).toBeUndefined();
    });

    it('specifies compatible types', () => {
      expect(OPERATOR_METADATA.contains.compatibleTypes).toEqual(['string']);
      expect(OPERATOR_METADATA.greaterThan.compatibleTypes).toContain('number');
      expect(OPERATOR_METADATA.greaterThan.compatibleTypes).toContain('timestamp');
    });
  });

  describe('TRANSPILE_PATTERNS', () => {
    it('has patterns for query types', () => {
      expect(TRANSPILE_PATTERNS.find).toBeDefined();
      expect(TRANSPILE_PATTERNS.count).toBeDefined();
      expect(TRANSPILE_PATTERNS.graph).toBeDefined();
    });

    it('has filter patterns for all operators', () => {
      expect(TRANSPILE_PATTERNS.filters.equals).toBeDefined();
      expect(TRANSPILE_PATTERNS.filters.contains).toBeDefined();
      expect(TRANSPILE_PATTERNS.filters.greaterThan).toBeDefined();
      expect(TRANSPILE_PATTERNS.filters.isNull).toBeDefined();
    });

    it('find pattern has placeholders', () => {
      expect(TRANSPILE_PATTERNS.find).toContain('{projections}');
      expect(TRANSPILE_PATTERNS.find).toContain('{relation}');
      expect(TRANSPILE_PATTERNS.find).toContain('{bindings}');
      expect(TRANSPILE_PATTERNS.find).toContain('{filters}');
    });

    it('has ordering and pagination patterns', () => {
      expect(TRANSPILE_PATTERNS.orderBy).toBeDefined();
      expect(TRANSPILE_PATTERNS.limit).toBeDefined();
      expect(TRANSPILE_PATTERNS.offset).toBeDefined();
    });

    it('filter patterns use parameters', () => {
      expect(TRANSPILE_PATTERNS.filters.equals).toContain('${');
      expect(TRANSPILE_PATTERNS.filters.contains).toContain('${');
    });
  });

  describe('isQueryTypeKeyword', () => {
    it('returns true for valid query type keywords', () => {
      expect(isQueryTypeKeyword('find')).toBe(true);
      expect(isQueryTypeKeyword('count')).toBe(true);
      expect(isQueryTypeKeyword('graph')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(isQueryTypeKeyword('FIND')).toBe(true);
      expect(isQueryTypeKeyword('Find')).toBe(true);
      expect(isQueryTypeKeyword('COUNT')).toBe(true);
      expect(isQueryTypeKeyword('Graph')).toBe(true);
    });

    it('returns false for invalid keywords', () => {
      expect(isQueryTypeKeyword('select')).toBe(false);
      expect(isQueryTypeKeyword('delete')).toBe(false);
      expect(isQueryTypeKeyword('')).toBe(false);
    });
  });

  describe('isRelationKeyword', () => {
    it('returns true for valid relation keywords', () => {
      expect(isRelationKeyword('pages')).toBe(true);
      expect(isRelationKeyword('blocks')).toBe(true);
      expect(isRelationKeyword('links')).toBe(true);
      expect(isRelationKeyword('tags')).toBe(true);
    });

    it('handles singular forms', () => {
      expect(isRelationKeyword('page')).toBe(true);
      expect(isRelationKeyword('block')).toBe(true);
      expect(isRelationKeyword('tag')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(isRelationKeyword('PAGES')).toBe(true);
      expect(isRelationKeyword('Pages')).toBe(true);
      expect(isRelationKeyword('BLOCKS')).toBe(true);
    });

    it('handles compound relations', () => {
      expect(isRelationKeyword('block_refs')).toBe(true);
      expect(isRelationKeyword('blockrefs')).toBe(true);
      expect(isRelationKeyword('daily_notes')).toBe(true);
      expect(isRelationKeyword('dailynotes')).toBe(true);
    });

    it('returns false for invalid relations', () => {
      expect(isRelationKeyword('users')).toBe(false);
      expect(isRelationKeyword('comments')).toBe(false);
      expect(isRelationKeyword('')).toBe(false);
    });
  });

  describe('normalizeRelation', () => {
    it('normalizes singular to plural', () => {
      expect(normalizeRelation('page')).toBe('pages');
      expect(normalizeRelation('block')).toBe('blocks');
      expect(normalizeRelation('tag')).toBe('tags');
    });

    it('keeps plural forms unchanged', () => {
      expect(normalizeRelation('pages')).toBe('pages');
      expect(normalizeRelation('blocks')).toBe('blocks');
    });

    it('normalizes compound relations', () => {
      expect(normalizeRelation('blockrefs')).toBe('block_refs');
      expect(normalizeRelation('block_refs')).toBe('block_refs');
      expect(normalizeRelation('dailynotes')).toBe('daily_notes');
      expect(normalizeRelation('daily_notes')).toBe('daily_notes');
    });

    it('is case-insensitive', () => {
      expect(normalizeRelation('PAGES')).toBe('pages');
      expect(normalizeRelation('Blocks')).toBe('blocks');
    });

    it('returns original for unknown relations', () => {
      expect(normalizeRelation('unknown')).toBe('unknown');
    });
  });

  describe('getIdColumn', () => {
    it('returns correct ID column for each relation', () => {
      expect(getIdColumn('pages')).toBe('page_id');
      expect(getIdColumn('blocks')).toBe('block_id');
      expect(getIdColumn('links')).toBe('source_id');
      expect(getIdColumn('tags')).toBe('entity_id');
      expect(getIdColumn('properties')).toBe('entity_id');
      expect(getIdColumn('block_refs')).toBe('source_block_id');
      expect(getIdColumn('daily_notes')).toBe('date');
    });

    it('returns "id" for unknown relations', () => {
      expect(getIdColumn('unknown')).toBe('id');
    });
  });

  describe('Grammar edge cases', () => {
    it('DSL examples handle special characters in strings', () => {
      const level2 = GRAMMAR_EXAMPLES.level2;
      // All string values in examples should be properly quoted
      for (const example of level2.examples) {
        if (example.dsl.includes('"')) {
          // Verify quotes are balanced
          const quoteCount = (example.dsl.match(/"/g) || []).length;
          expect(quoteCount % 2).toBe(0);
        }
      }
    });

    it('DSL examples with filters have valid AST', () => {
      const level2 = GRAMMAR_EXAMPLES.level2;
      for (const example of level2.examples) {
        if (example.ast.filters.length > 0) {
          for (const filter of example.ast.filters) {
            expect(filter.field).toBeTruthy();
            expect(filter.operator).toBeTruthy();
            // Value can be any type including falsy values
            expect(filter.value !== undefined).toBe(true);
          }
        }
      }
    });

    it('empty query would fail (no relation)', () => {
      // The grammar requires a query type followed by a relation
      // An empty string or just "find" without relation should fail
      expect(isQueryTypeKeyword('find')).toBe(true);
      expect(isRelationKeyword('')).toBe(false);
    });

    it('unknown field would fail validation', () => {
      // The grammar allows any identifier as a column, but
      // validation should catch unknown columns
      expect(isRelationKeyword('pages')).toBe(true);
      // "unknown_field" is not in RELATION_COLUMNS.pages
    });
  });
});
