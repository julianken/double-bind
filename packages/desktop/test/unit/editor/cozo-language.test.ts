/**
 * Unit tests for CozoScript/Datalog language definition.
 *
 * Tests cover:
 * - Tokenization of all token types
 * - Keywords (:=, <~, ?[], or, and, not, in)
 * - Relation prefixes (* and ~)
 * - Variables ($param style)
 * - Operators (==, !=, <, >, <=, >=, contains, etc.)
 * - Comments (# line comments)
 * - Strings ("double" and 'single' quoted)
 * - Numbers (integers and floats)
 * - Built-in functions
 */

import { describe, it, expect } from 'vitest';
import {
  tokenize,
  cozoLanguage,
  KEYWORDS,
  OPERATOR_KEYWORDS,
  BUILTINS,
  RULE_OPERATORS,
  type CozoTokenType,
} from '../../../src/editor/cozo-language';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Filter tokens to only those with content (non-whitespace)
 */
function filterNonNull(
  tokens: Array<{ type: CozoTokenType; text: string }>
): Array<{ type: CozoTokenType; text: string }> {
  return tokens.filter((t) => t.type !== null && t.text.trim() !== '');
}

/**
 * Get token types for a given input
 */
function getTokenTypes(input: string): CozoTokenType[] {
  return filterNonNull(tokenize(input)).map((t) => t.type);
}

/**
 * Get token texts for a given input
 */
function getTokenTexts(input: string): string[] {
  return filterNonNull(tokenize(input)).map((t) => t.text);
}

// ============================================================================
// Tests
// ============================================================================

describe('CozoScript Language Definition', () => {
  describe('Language Export', () => {
    it('should export a valid StreamLanguage', () => {
      expect(cozoLanguage).toBeDefined();
      expect(cozoLanguage.name).toBe('cozoscript');
    });

    it('should export constants for testing', () => {
      expect(KEYWORDS).toBeDefined();
      expect(KEYWORDS.size).toBeGreaterThan(0);
      expect(OPERATOR_KEYWORDS).toBeDefined();
      expect(BUILTINS).toBeDefined();
      expect(RULE_OPERATORS).toHaveLength(3);
    });
  });

  describe('Rule Definition Operators', () => {
    it('should tokenize := as keyword', () => {
      const tokens = tokenize('rule := body');
      const filtered = filterNonNull(tokens);

      expect(filtered).toContainEqual({ type: 'keyword', text: ':=' });
    });

    it('should tokenize <~ as keyword', () => {
      const tokens = tokenize('result <~ algo()');
      const filtered = filterNonNull(tokens);

      expect(filtered).toContainEqual({ type: 'keyword', text: '<~' });
    });

    it('should tokenize <- as keyword', () => {
      const tokens = tokenize('data <- input');
      const filtered = filterNonNull(tokens);

      expect(filtered).toContainEqual({ type: 'keyword', text: '<-' });
    });
  });

  describe('Query Output Marker', () => {
    it('should tokenize ?[ as keyword', () => {
      const tokens = tokenize('?[name] := *page{name}');
      const filtered = filterNonNull(tokens);

      expect(filtered[0]).toEqual({ type: 'keyword', text: '?[' });
    });

    it('should handle complex query outputs', () => {
      const types = getTokenTypes('?[id, name, created]');

      expect(types[0]).toBe('keyword'); // ?[
    });
  });

  describe('Logical Keywords', () => {
    it('should tokenize "and" as keyword', () => {
      const types = getTokenTypes('a and b');
      expect(types).toContain('keyword');
    });

    it('should tokenize "or" as keyword', () => {
      const types = getTokenTypes('a or b');
      expect(types).toContain('keyword');
    });

    it('should tokenize "not" as keyword', () => {
      const types = getTokenTypes('not a');
      expect(types[0]).toBe('keyword');
    });

    it('should tokenize "in" as keyword', () => {
      const types = getTokenTypes('x in list');
      expect(types).toContain('keyword');
    });

    it('should tokenize boolean literals as keywords', () => {
      expect(getTokenTypes('true')).toContain('keyword');
      expect(getTokenTypes('false')).toContain('keyword');
    });

    it('should tokenize null as keyword', () => {
      expect(getTokenTypes('null')).toContain('keyword');
    });

    it('should tokenize control flow keywords', () => {
      expect(getTokenTypes('if')).toContain('keyword');
      expect(getTokenTypes('then')).toContain('keyword');
      expect(getTokenTypes('else')).toContain('keyword');
    });

    it('should tokenize mutation keywords', () => {
      expect(getTokenTypes('assert')).toContain('keyword');
      expect(getTokenTypes('put')).toContain('keyword');
      expect(getTokenTypes('rm')).toContain('keyword');
      expect(getTokenTypes('ensure')).toContain('keyword');
    });
  });

  describe('Stored Relations (* prefix)', () => {
    it('should tokenize *relation as relation', () => {
      const tokens = tokenize('*page{id, name}');
      const filtered = filterNonNull(tokens);

      expect(filtered[0]).toEqual({ type: 'relation', text: '*page' });
    });

    it('should handle multiple stored relations', () => {
      const texts = getTokenTexts('*block{id}, *page{id}');

      expect(texts).toContain('*block');
      expect(texts).toContain('*page');
    });

    it('should handle underscore in relation names', () => {
      const tokens = tokenize('*user_profile{id}');
      const filtered = filterNonNull(tokens);

      expect(filtered[0]).toEqual({ type: 'relation', text: '*user_profile' });
    });

    it('should handle relation names with numbers', () => {
      const tokens = tokenize('*table2{id}');
      const filtered = filterNonNull(tokens);

      expect(filtered[0]).toEqual({ type: 'relation', text: '*table2' });
    });
  });

  describe('FTS Index Relations (~ prefix)', () => {
    it('should tokenize ~relation as ftsRelation', () => {
      const tokens = tokenize('~page:fts{query}');
      const filtered = filterNonNull(tokens);

      expect(filtered[0].type).toBe('ftsRelation');
      expect(filtered[0].text.startsWith('~')).toBe(true);
    });

    it('should distinguish ~ prefix from ~ operator', () => {
      const tokens = tokenize('~fts_index{term}');
      const filtered = filterNonNull(tokens);

      expect(filtered[0].type).toBe('ftsRelation');
    });
  });

  describe('Parameter Variables ($param)', () => {
    it('should tokenize $param as parameter', () => {
      const tokens = tokenize('$name');
      const filtered = filterNonNull(tokens);

      expect(filtered[0]).toEqual({ type: 'parameter', text: '$name' });
    });

    it('should handle multiple parameters', () => {
      const tokens = tokenize('$id, $name, $value');
      const filtered = filterNonNull(tokens);

      expect(filtered.filter((t) => t.type === 'parameter')).toHaveLength(3);
    });

    it('should handle parameters with underscores', () => {
      const tokens = tokenize('$user_id');
      const filtered = filterNonNull(tokens);

      expect(filtered[0]).toEqual({ type: 'parameter', text: '$user_id' });
    });

    it('should handle parameters with numbers', () => {
      const tokens = tokenize('$param1');
      const filtered = filterNonNull(tokens);

      expect(filtered[0]).toEqual({ type: 'parameter', text: '$param1' });
    });
  });

  describe('Comparison Operators', () => {
    it('should tokenize == as operator', () => {
      const types = getTokenTypes('a == b');
      expect(types).toContain('operator');
    });

    it('should tokenize != as operator', () => {
      const types = getTokenTypes('a != b');
      expect(types).toContain('operator');
    });

    it('should tokenize < as operator', () => {
      const types = getTokenTypes('a < b');
      expect(types).toContain('operator');
    });

    it('should tokenize > as operator', () => {
      const types = getTokenTypes('a > b');
      expect(types).toContain('operator');
    });

    it('should tokenize <= as operator', () => {
      const types = getTokenTypes('a <= b');
      expect(types).toContain('operator');
    });

    it('should tokenize >= as operator', () => {
      const types = getTokenTypes('a >= b');
      expect(types).toContain('operator');
    });
  });

  describe('Arithmetic Operators', () => {
    it('should tokenize + as operator', () => {
      const types = getTokenTypes('a + b');
      expect(types).toContain('operator');
    });

    it('should tokenize - as operator', () => {
      const types = getTokenTypes('a - b');
      expect(types).toContain('operator');
    });

    it('should tokenize * as operator (not followed by identifier)', () => {
      // Note: *identifier is a relation, but standalone * is operator
      const types = getTokenTypes('a * b');
      expect(types).toContain('operator');
    });

    it('should tokenize / as operator', () => {
      const types = getTokenTypes('a / b');
      expect(types).toContain('operator');
    });

    it('should tokenize % as operator', () => {
      const types = getTokenTypes('a % b');
      expect(types).toContain('operator');
    });
  });

  describe('String Operator Keywords', () => {
    it('should tokenize "contains" as operator', () => {
      const types = getTokenTypes('str contains "sub"');
      expect(types).toContain('operator');
    });

    it('should tokenize "starts_with" as operator', () => {
      const types = getTokenTypes('str starts_with "pre"');
      expect(types).toContain('operator');
    });

    it('should tokenize "ends_with" as operator', () => {
      const types = getTokenTypes('str ends_with "suf"');
      expect(types).toContain('operator');
    });

    it('should tokenize "like" as operator', () => {
      const types = getTokenTypes('str like "%pattern%"');
      expect(types).toContain('operator');
    });

    it('should tokenize "matches" as operator', () => {
      const types = getTokenTypes('str matches "regex"');
      expect(types).toContain('operator');
    });

    it('should tokenize "coalesce" as operator', () => {
      const types = getTokenTypes('coalesce(a, b)');
      expect(types[0]).toBe('operator');
    });
  });

  describe('Comments', () => {
    it('should tokenize # comments to end of line', () => {
      const tokens = tokenize('# This is a comment');
      const filtered = filterNonNull(tokens);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('comment');
    });

    it('should handle inline comments', () => {
      const tokens = tokenize('value # inline comment');
      const filtered = filterNonNull(tokens);

      expect(filtered).toHaveLength(2);
      expect(filtered[1].type).toBe('comment');
    });

    it('should handle empty comments', () => {
      const tokens = tokenize('#');
      const filtered = filterNonNull(tokens);

      expect(filtered[0].type).toBe('comment');
    });
  });

  describe('String Literals', () => {
    it('should tokenize double-quoted strings', () => {
      const tokens = tokenize('"hello world"');
      const filtered = filterNonNull(tokens);

      expect(filtered[0].type).toBe('string');
      expect(filtered[0].text).toBe('"hello world"');
    });

    it('should tokenize single-quoted strings', () => {
      const tokens = tokenize("'hello world'");
      const filtered = filterNonNull(tokens);

      expect(filtered[0].type).toBe('string');
      expect(filtered[0].text).toBe("'hello world'");
    });

    it('should handle escape sequences in strings', () => {
      const tokens = tokenize('"hello\\"world"');
      const filtered = filterNonNull(tokens);

      expect(filtered[0].type).toBe('string');
    });

    it('should handle empty strings', () => {
      const tokens = tokenize('""');
      const filtered = filterNonNull(tokens);

      expect(filtered[0].type).toBe('string');
      expect(filtered[0].text).toBe('""');
    });

    it('should handle strings with special characters', () => {
      const tokens = tokenize('"line1\\nline2"');
      const filtered = filterNonNull(tokens);

      expect(filtered[0].type).toBe('string');
    });
  });

  describe('Number Literals', () => {
    it('should tokenize integers', () => {
      const tokens = tokenize('42');
      const filtered = filterNonNull(tokens);

      expect(filtered[0]).toEqual({ type: 'number', text: '42' });
    });

    it('should tokenize negative integers', () => {
      // Note: When - appears before a number without context,
      // it's tokenized as an operator followed by a number.
      // This is correct behavior for an expression like "a - 42" vs "-42"
      const tokens = tokenize('-42');
      const filtered = filterNonNull(tokens);

      // The minus is tokenized as operator, 42 as number
      expect(filtered[0]).toEqual({ type: 'operator', text: '-' });
      expect(filtered[1]).toEqual({ type: 'number', text: '42' });
    });

    it('should tokenize floating point numbers', () => {
      const tokens = tokenize('3.14');
      const filtered = filterNonNull(tokens);

      expect(filtered[0]).toEqual({ type: 'number', text: '3.14' });
    });

    it('should tokenize scientific notation', () => {
      const tokens = tokenize('1.5e10');
      const filtered = filterNonNull(tokens);

      expect(filtered[0].type).toBe('number');
    });

    it('should tokenize negative scientific notation', () => {
      const tokens = tokenize('1.5e-10');
      const filtered = filterNonNull(tokens);

      expect(filtered[0].type).toBe('number');
    });

    it('should tokenize zero', () => {
      const tokens = tokenize('0');
      const filtered = filterNonNull(tokens);

      expect(filtered[0]).toEqual({ type: 'number', text: '0' });
    });
  });

  describe('Brackets', () => {
    it('should tokenize square brackets', () => {
      const tokens = tokenize('[a, b]');
      const filtered = filterNonNull(tokens);

      expect(filtered.some((t) => t.type === 'bracket' && t.text === '[')).toBe(true);
      expect(filtered.some((t) => t.type === 'bracket' && t.text === ']')).toBe(true);
    });

    it('should tokenize curly braces', () => {
      const tokens = tokenize('{a, b}');
      const filtered = filterNonNull(tokens);

      expect(filtered.some((t) => t.type === 'bracket' && t.text === '{')).toBe(true);
      expect(filtered.some((t) => t.type === 'bracket' && t.text === '}')).toBe(true);
    });

    it('should tokenize parentheses', () => {
      const tokens = tokenize('(a, b)');
      const filtered = filterNonNull(tokens);

      expect(filtered.some((t) => t.type === 'bracket' && t.text === '(')).toBe(true);
      expect(filtered.some((t) => t.type === 'bracket' && t.text === ')')).toBe(true);
    });
  });

  describe('Punctuation', () => {
    it('should tokenize commas', () => {
      const tokens = tokenize('a, b, c');
      const filtered = filterNonNull(tokens);

      expect(filtered.filter((t) => t.type === 'punctuation' && t.text === ',')).toHaveLength(2);
    });

    it('should tokenize semicolons', () => {
      const tokens = tokenize('a; b');
      const filtered = filterNonNull(tokens);

      expect(filtered.some((t) => t.type === 'punctuation' && t.text === ';')).toBe(true);
    });

    it('should tokenize colons', () => {
      const tokens = tokenize('a: b');
      const filtered = filterNonNull(tokens);

      expect(filtered.some((t) => t.type === 'punctuation' && t.text === ':')).toBe(true);
    });
  });

  describe('Built-in Functions', () => {
    it('should tokenize aggregation functions as builtin', () => {
      expect(getTokenTypes('count(x)')).toContain('builtin');
      expect(getTokenTypes('sum(x)')).toContain('builtin');
      expect(getTokenTypes('avg(x)')).toContain('builtin');
      expect(getTokenTypes('min(x)')).toContain('builtin');
      expect(getTokenTypes('max(x)')).toContain('builtin');
    });

    it('should tokenize string functions as builtin', () => {
      expect(getTokenTypes('length(s)')).toContain('builtin');
      expect(getTokenTypes('concat(a, b)')).toContain('builtin');
      expect(getTokenTypes('lowercase(s)')).toContain('builtin');
      expect(getTokenTypes('uppercase(s)')).toContain('builtin');
    });

    it('should tokenize math functions as builtin', () => {
      expect(getTokenTypes('abs(x)')).toContain('builtin');
      expect(getTokenTypes('sqrt(x)')).toContain('builtin');
      expect(getTokenTypes('round(x)')).toContain('builtin');
    });

    it('should tokenize graph algorithm functions as builtin', () => {
      expect(getTokenTypes('shortest_path(a, b)')).toContain('builtin');
      expect(getTokenTypes('pagerank()')).toContain('builtin');
    });

    it('should tokenize utility functions as builtin', () => {
      expect(getTokenTypes('now()')).toContain('builtin');
      expect(getTokenTypes('uuid()')).toContain('builtin');
    });
  });

  describe('Identifiers', () => {
    it('should tokenize plain identifiers', () => {
      const tokens = tokenize('variable_name');
      const filtered = filterNonNull(tokens);

      expect(filtered[0]).toEqual({ type: 'identifier', text: 'variable_name' });
    });

    it('should tokenize identifiers starting with underscore', () => {
      const tokens = tokenize('_private');
      const filtered = filterNonNull(tokens);

      expect(filtered[0]).toEqual({ type: 'identifier', text: '_private' });
    });

    it('should tokenize identifiers with numbers', () => {
      const tokens = tokenize('var123');
      const filtered = filterNonNull(tokens);

      expect(filtered[0]).toEqual({ type: 'identifier', text: 'var123' });
    });
  });

  describe('Complex Queries', () => {
    it('should correctly tokenize a basic query', () => {
      const query = '?[name] := *page{name}';
      const tokens = filterNonNull(tokenize(query));

      expect(tokens[0].type).toBe('keyword'); // ?[
      expect(tokens[1].type).toBe('identifier'); // name
      expect(tokens[2].type).toBe('bracket'); // ]
      expect(tokens[3].type).toBe('keyword'); // :=
      expect(tokens[4].type).toBe('relation'); // *page
    });

    it('should correctly tokenize a parameterized query', () => {
      const query = '?[id] := *page{id, name}, name == $search';
      const tokens = filterNonNull(tokenize(query));

      expect(tokens.some((t) => t.type === 'parameter' && t.text === '$search')).toBe(true);
      expect(tokens.some((t) => t.type === 'operator' && t.text === '==')).toBe(true);
    });

    it('should correctly tokenize a query with aggregation', () => {
      const query = '?[total] := total = count(id), *page{id}';
      const tokens = filterNonNull(tokenize(query));

      expect(tokens.some((t) => t.type === 'builtin' && t.text === 'count')).toBe(true);
    });

    it('should correctly tokenize a query with FTS', () => {
      const query = '?[id, score] := ~page:fts{id, score | query: $term}';
      const tokens = filterNonNull(tokenize(query));

      expect(tokens.some((t) => t.type === 'ftsRelation')).toBe(true);
      expect(tokens.some((t) => t.type === 'parameter' && t.text === '$term')).toBe(true);
    });

    it('should correctly tokenize a multi-line query', () => {
      const query = `?[id, title] :=
        *page{id, title},
        title contains $search`;
      const tokens = filterNonNull(tokenize(query));

      expect(tokens.some((t) => t.type === 'keyword' && t.text === '?[')).toBe(true);
      expect(tokens.some((t) => t.type === 'keyword' && t.text === ':=')).toBe(true);
      expect(tokens.some((t) => t.type === 'relation' && t.text === '*page')).toBe(true);
      expect(tokens.some((t) => t.type === 'operator' && t.text === 'contains')).toBe(true);
    });

    it('should correctly tokenize a query with comments', () => {
      const query = `# Find pages by title
?[id] := *page{id, title}, title == "Home"`;
      const tokens = filterNonNull(tokenize(query));

      expect(tokens[0].type).toBe('comment');
      expect(tokens.some((t) => t.type === 'string' && t.text === '"Home"')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const tokens = tokenize('');
      expect(tokens).toEqual([]);
    });

    it('should handle whitespace-only input', () => {
      const tokens = filterNonNull(tokenize('   \t  '));
      expect(tokens).toEqual([]);
    });

    it('should handle consecutive operators', () => {
      const tokens = tokenize('a == b != c');
      const operators = filterNonNull(tokens).filter((t) => t.type === 'operator');
      expect(operators).toHaveLength(2);
    });

    it('should not confuse * multiplication with *relation', () => {
      // *page is a relation (starts with *)
      const relTokens = filterNonNull(tokenize('*page'));
      expect(relTokens[0].type).toBe('relation');

      // a * b is multiplication (space before *)
      const multTokens = filterNonNull(tokenize('a * b'));
      expect(multTokens.some((t) => t.type === 'operator' && t.text === '*')).toBe(true);
    });
  });
});
