/**
 * CozoScript/Datalog Language Definition for CodeMirror 6
 *
 * Provides syntax highlighting for CozoDB's Datalog-based query language.
 *
 * Token types:
 * - Keywords: :=, <~, ?[], or, and, not, in
 * - Relation prefixes: * (stored relations), ~ (FTS index relations)
 * - Variables: $param style parameters
 * - Operators: ==, !=, <, >, <=, >=, contains, starts_with, ends_with
 * - Comments: # line comments
 * - Strings: "double quoted" and 'single quoted'
 * - Numbers: integers and floats
 *
 * @see docs/database/cozo-datalog.md for CozoDB query syntax
 */

import { StreamLanguage, type StringStream } from '@codemirror/language';
import { tags as t, type Tag } from '@lezer/highlight';

// ============================================================================
// Token Types
// ============================================================================

/**
 * CozoScript token type names.
 * These map to standard Lezer highlight tags for theming compatibility.
 */
export type CozoTokenType =
  | 'keyword'
  | 'operator'
  | 'relation'
  | 'ftsRelation'
  | 'variable'
  | 'parameter'
  | 'string'
  | 'number'
  | 'comment'
  | 'bracket'
  | 'punctuation'
  | 'identifier'
  | 'builtin'
  | null;

// ============================================================================
// Language Patterns
// ============================================================================

/**
 * CozoDB rule definition operators
 */
const RULE_OPERATORS = [':=', '<~', '<-'];

/**
 * CozoDB logical and control keywords
 */
const KEYWORDS = new Set([
  'or',
  'and',
  'not',
  'in',
  'if',
  'then',
  'else',
  'true',
  'false',
  'null',
  'assert',
  'put',
  'rm',
  'ensure',
]);

/**
 * CozoDB comparison and string operators
 */
const OPERATOR_KEYWORDS = new Set([
  'contains',
  'starts_with',
  'ends_with',
  'like',
  'matches',
  'coalesce',
]);

/**
 * CozoDB built-in functions
 */
const BUILTINS = new Set([
  // Aggregation
  'count',
  'sum',
  'avg',
  'min',
  'max',
  'collect',
  'unique',
  'group_concat',
  // String functions
  'length',
  'concat',
  'lowercase',
  'uppercase',
  'trim',
  'split',
  'substr',
  'replace',
  'regex_matches',
  'regex_replace',
  // Math functions
  'abs',
  'ceil',
  'floor',
  'round',
  'sqrt',
  'pow',
  'exp',
  'ln',
  'log',
  'sin',
  'cos',
  'tan',
  // Graph algorithms
  'shortest_path',
  'all_paths',
  'bfs',
  'dfs',
  'dijkstra',
  'pagerank',
  // Utility
  'now',
  'rand',
  'uuid',
  'parse_json',
  'json_object',
  'to_string',
  'to_int',
  'to_float',
]);

// ============================================================================
// Parser State
// ============================================================================

/**
 * Parser state for tracking context across tokens
 */
export interface CozoParserState {
  /** Whether we're inside a string literal */
  inString: false | '"' | "'";
  /** Current bracket nesting depth */
  bracketDepth: number;
}

/**
 * Create initial parser state
 */
function startState(): CozoParserState {
  return {
    inString: false,
    bracketDepth: 0,
  };
}

/**
 * Copy parser state for backtracking
 */
function copyState(state: CozoParserState): CozoParserState {
  return {
    inString: state.inString,
    bracketDepth: state.bracketDepth,
  };
}

// ============================================================================
// Tokenizer
// ============================================================================

/**
 * Main tokenizer function for CozoScript
 *
 * @param stream - The input stream to tokenize
 * @param state - Current parser state
 * @returns Token type name or null for plain text
 */
function token(stream: StringStream, state: CozoParserState): CozoTokenType {
  // Handle string continuation
  if (state.inString) {
    const quote = state.inString;
    while (!stream.eol()) {
      const ch = stream.next();
      if (ch === quote) {
        state.inString = false;
        return 'string';
      }
      // Handle escape sequences
      if (ch === '\\') {
        stream.next();
      }
    }
    return 'string';
  }

  // Skip whitespace
  if (stream.eatSpace()) {
    return null;
  }

  // Check for comments (# to end of line)
  if (stream.match('#')) {
    stream.skipToEnd();
    return 'comment';
  }

  // Check for query output marker
  if (stream.match('?[')) {
    return 'keyword';
  }

  // Check for rule definition operators
  for (const op of RULE_OPERATORS) {
    if (stream.match(op)) {
      return 'keyword';
    }
  }

  // Check for stored relation prefix (*)
  if (stream.match(/^\*[a-zA-Z_][a-zA-Z0-9_]*/)) {
    return 'relation';
  }

  // Check for FTS index relation prefix (~)
  if (stream.match(/^~[a-zA-Z_][a-zA-Z0-9_]*/)) {
    return 'ftsRelation';
  }

  // Check for parameter variables ($name)
  if (stream.match(/^\$[a-zA-Z_][a-zA-Z0-9_]*/)) {
    return 'parameter';
  }

  // Check for comparison operators
  if (
    stream.match('==') ||
    stream.match('!=') ||
    stream.match('<=') ||
    stream.match('>=') ||
    stream.match('<') ||
    stream.match('>') ||
    stream.match('++') ||
    stream.match('~')
  ) {
    return 'operator';
  }

  // Check for arithmetic operators
  if (stream.match(/^[+\-*/%]/)) {
    return 'operator';
  }

  // Check for string literals
  const ch = stream.peek();
  if (ch === '"' || ch === "'") {
    stream.next();
    state.inString = ch;
    // Try to complete single-line string
    while (!stream.eol()) {
      const nextCh = stream.next();
      if (nextCh === ch) {
        state.inString = false;
        return 'string';
      }
      if (nextCh === '\\') {
        stream.next();
      }
    }
    return 'string';
  }

  // Check for numbers (integers and floats)
  if (stream.match(/^-?\d+\.?\d*([eE][+-]?\d+)?/)) {
    return 'number';
  }

  // Check for brackets and punctuation
  if (stream.match(/^[[\]{}()]/)) {
    return 'bracket';
  }

  if (stream.match(/^[,;:]/)) {
    return 'punctuation';
  }

  // Check for identifiers, keywords, and builtins
  if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)) {
    const word = stream.current();

    if (KEYWORDS.has(word)) {
      return 'keyword';
    }

    if (OPERATOR_KEYWORDS.has(word)) {
      return 'operator';
    }

    if (BUILTINS.has(word)) {
      return 'builtin';
    }

    return 'identifier';
  }

  // Skip unknown character
  stream.next();
  return null;
}

// ============================================================================
// Token Table (Maps token names to highlight tags)
// ============================================================================

/**
 * Maps CozoScript token types to Lezer highlight tags.
 * This enables standard CodeMirror themes to style our tokens.
 */
export const tokenTable: Record<string, Tag | readonly Tag[]> = {
  keyword: t.keyword,
  operator: t.operator,
  relation: t.className, // Stored relations styled like class names
  ftsRelation: t.special(t.className), // FTS relations get special styling
  variable: t.variableName,
  parameter: t.special(t.variableName), // Parameters are special variables
  string: t.string,
  number: t.number,
  comment: t.lineComment,
  bracket: t.bracket,
  punctuation: t.punctuation,
  identifier: t.variableName,
  builtin: t.function(t.variableName), // Built-in functions
};

// ============================================================================
// Language Definition
// ============================================================================

/**
 * CozoScript/Datalog language definition for CodeMirror 6.
 *
 * This is a StreamLanguage that provides syntax highlighting for CozoDB queries.
 *
 * @example
 * ```typescript
 * import { EditorView, basicSetup } from 'codemirror';
 * import { cozoLanguage } from './cozo-language';
 *
 * new EditorView({
 *   extensions: [basicSetup, cozoLanguage],
 *   parent: document.body,
 * });
 * ```
 */
export const cozoLanguage = StreamLanguage.define<CozoParserState>({
  name: 'cozoscript',
  startState,
  token,
  copyState,
  tokenTable,
  languageData: {
    commentTokens: { line: '#' },
    closeBrackets: { brackets: ['(', '[', '{', '"', "'"] },
  },
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Test utility: Tokenize a string and return token types.
 * Useful for testing the tokenizer.
 *
 * @param input - The CozoScript code to tokenize
 * @returns Array of token objects with type and text
 */
export function tokenize(input: string): Array<{ type: CozoTokenType; text: string }> {
  const tokens: Array<{ type: CozoTokenType; text: string }> = [];
  const state = startState();

  for (const line of input.split('\n')) {
    // Create a minimal StringStream implementation for testing
    const stream = createTestStream(line);

    while (!stream.eol()) {
      stream.start = stream.pos;
      const tokenType = token(stream, state);
      const text = stream.current();
      if (text) {
        tokens.push({ type: tokenType, text });
      }
    }
  }

  return tokens;
}

/**
 * Create a minimal StringStream for testing purposes.
 * This mimics CodeMirror's StringStream interface.
 */
function createTestStream(line: string): StringStream & { pos: number; start: number } {
  const stream = {
    string: line,
    pos: 0,
    start: 0,
    indentUnit: 2,

    eol(): boolean {
      return stream.pos >= line.length;
    },

    sol(): boolean {
      return stream.pos === 0;
    },

    peek(): string | undefined {
      return line[stream.pos];
    },

    next(): string | undefined {
      if (stream.pos >= line.length) return undefined;
      return line[stream.pos++];
    },

    eat(match: string | RegExp | ((ch: string) => boolean)): string | undefined {
      const ch = line[stream.pos];
      if (!ch) return undefined;

      let ok = false;
      if (typeof match === 'string') {
        ok = ch === match;
      } else if (match instanceof RegExp) {
        ok = match.test(ch);
      } else {
        ok = match(ch);
      }

      if (ok) {
        stream.pos++;
        return ch;
      }
      return undefined;
    },

    eatWhile(match: string | RegExp | ((ch: string) => boolean)): boolean {
      const startPos = stream.pos;
      while (stream.eat(match)) {
        // continue eating until no match
      }
      return stream.pos > startPos;
    },

    eatSpace(): boolean {
      const startPos = stream.pos;
      while (stream.pos < line.length) {
        const ch = line[stream.pos];
        if (ch === undefined || !/\s/.test(ch)) break;
        stream.pos++;
      }
      return stream.pos > startPos;
    },

    skipToEnd(): void {
      stream.pos = line.length;
    },

    skipTo(ch: string): boolean | undefined {
      const idx = line.indexOf(ch, stream.pos);
      if (idx > -1) {
        stream.pos = idx;
        return true;
      }
      return undefined;
    },

    backUp(n: number): void {
      stream.pos -= n;
    },

    column(): number {
      return stream.pos;
    },

    indentation(): number {
      const m = line.match(/^\s*/);
      return m ? m[0].length : 0;
    },

    match(
      pattern: string | RegExp,
      consume = true,
      _caseInsensitive = false
    ): boolean | RegExpMatchArray | null {
      if (typeof pattern === 'string') {
        const substr = line.slice(stream.pos, stream.pos + pattern.length);
        if (substr === pattern) {
          if (consume) stream.pos += pattern.length;
          return true;
        }
        return false;
      }

      // Ensure pattern starts at current position
      const regex = pattern.source.startsWith('^')
        ? pattern
        : new RegExp('^' + pattern.source, pattern.flags);

      const remaining = line.slice(stream.pos);
      const m = remaining.match(regex);

      if (m) {
        if (consume) stream.pos += m[0].length;
        return m;
      }
      return null;
    },

    current(): string {
      return line.slice(stream.start, stream.pos);
    },
  };

  return stream as StringStream & { pos: number; start: number };
}

// ============================================================================
// Exports
// ============================================================================

export { KEYWORDS, OPERATOR_KEYWORDS, BUILTINS, RULE_OPERATORS, startState, copyState, token };
