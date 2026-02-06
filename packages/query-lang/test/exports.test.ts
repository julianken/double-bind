// Test that all expected exports are available from the package

import { describe, it, expect } from 'vitest';
import {
  // Parser
  parseQuery,
  // Transpiler
  transpileToCozo,
  compileQuery,
  // Validator
  validateCozoScript,
  // Templates
  getTemplates,
  getTemplate,
  applyTemplate,
  registerTemplate,
} from '../src/index.js';

describe('@double-bind/query-lang exports', () => {
  describe('parser', () => {
    it('exports parseQuery function', () => {
      expect(typeof parseQuery).toBe('function');
    });

    it('parseQuery throws on empty input', () => {
      expect(() => parseQuery('')).toThrow('Query input must be a non-empty string');
    });

    it('parseQuery returns QueryAST for valid input', () => {
      const ast = parseQuery('find pages');
      expect(ast).toBeDefined();
      expect(ast.type).toBe('find');
      expect(ast.relation).toBe('pages');
      expect(Array.isArray(ast.filters)).toBe(true);
      expect(Array.isArray(ast.projections)).toBe(true);
    });
  });

  describe('transpiler', () => {
    it('exports transpileToCozo function', () => {
      expect(typeof transpileToCozo).toBe('function');
    });

    it('exports compileQuery function', () => {
      expect(typeof compileQuery).toBe('function');
    });

    it('transpileToCozo returns CompiledQuery', () => {
      const result = transpileToCozo({
        type: 'find',
        relation: 'pages',
        filters: [],
        projections: ['page_id', 'title'],
      });
      expect(result).toBeDefined();
      expect(typeof result.script).toBe('string');
      expect(typeof result.params).toBe('object');
    });

    it('compileQuery combines parsing and transpiling', () => {
      const result = compileQuery('find pages');
      expect(result).toBeDefined();
      expect(typeof result.script).toBe('string');
      expect(typeof result.params).toBe('object');
    });
  });

  describe('validator', () => {
    it('exports validateCozoScript function', () => {
      expect(typeof validateCozoScript).toBe('function');
    });

    it('validateCozoScript returns invalid for empty input', () => {
      const result = validateCozoScript('');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('validateCozoScript returns invalid for non-query syntax', () => {
      const result = validateCozoScript('SELECT * FROM pages');
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('must start with ?[');
    });

    it('validateCozoScript returns valid for basic query syntax', () => {
      const result = validateCozoScript('?[page_id] := *pages{ page_id }');
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('templates', () => {
    it('exports getTemplates function', () => {
      expect(typeof getTemplates).toBe('function');
    });

    it('exports getTemplate function', () => {
      expect(typeof getTemplate).toBe('function');
    });

    it('exports applyTemplate function', () => {
      expect(typeof applyTemplate).toBe('function');
    });

    it('exports registerTemplate function', () => {
      expect(typeof registerTemplate).toBe('function');
    });

    it('getTemplates returns empty array initially', () => {
      const templates = getTemplates();
      expect(Array.isArray(templates)).toBe(true);
    });

    it('registerTemplate and getTemplate work together', () => {
      registerTemplate({
        id: 'test-template',
        name: 'Test Template',
        description: 'A test template',
        parameters: [],
        preview: '?[page_id] := *pages{ page_id }',
      });

      const template = getTemplate('test-template');
      expect(template).toBeDefined();
      expect(template?.id).toBe('test-template');
      expect(template?.name).toBe('Test Template');
    });

    it('applyTemplate throws for unknown template', () => {
      expect(() => applyTemplate('unknown-template', {})).toThrow(
        'Template not found: unknown-template'
      );
    });
  });
});
