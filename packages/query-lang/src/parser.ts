// @double-bind/query-lang - Parser: input string -> QueryAST
//
// This module implements a hand-written recursive descent parser for the
// user-friendly query DSL. It parses queries like:
//   "find pages where title contains 'meeting'"
//   "count blocks where is_deleted equals false"
//   "graph pages where title starts with 'Project' depth 2"
//
// The parser is designed to produce helpful error messages with line/column
// information and suggestions for fixing issues.

import type {
  QueryAST,
  Filter,
  FilterOperator,
  FilterValue,
  OrderBy,
  SortDirection,
  ValidationError,
  QueryErrorCode,
} from './types.js';

import {
  isQueryableRelation,
  RELATION_COLUMNS,
  DEFAULT_PROJECTIONS,
  createError,
} from './types.js';

import {
  KEYWORDS,
  OPERATOR_SYMBOLS,
  normalizeRelation,
  type TokenType,
  type Token,
} from './grammar.js';

// ============================================================================
// PARSE ERROR
// ============================================================================

/**
 * Error thrown when parsing fails.
 * Contains detailed information about the parse failure.
 */
export class ParseError extends Error {
  public readonly errors: ValidationError[];
  public readonly line: number;
  public readonly column: number;

  constructor(message: string, errors: ValidationError[], line = 1, column = 1) {
    super(message);
    this.name = 'ParseError';
    this.errors = errors;
    this.line = line;
    this.column = column;
  }
}

// ============================================================================
// LEXER
// ============================================================================

/**
 * Lexer that tokenizes the input query string.
 * Produces a stream of tokens for the parser to consume.
 */
class Lexer {
  private readonly input: string;
  private pos = 0;
  private line = 1;
  private column = 1;
  private readonly tokens: Token[] = [];
  private currentIndex = 0;

  constructor(input: string) {
    this.input = input;
    this.tokenize();
  }

  /**
   * Tokenize the entire input
   */
  private tokenize(): void {
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      const token = this.nextToken();
      if (token) {
        this.tokens.push(token);
      }
    }

    // Add EOF token
    this.tokens.push({
      type: 'EOF',
      value: '',
      line: this.line,
      column: this.column,
      length: 0,
    });
  }

  /**
   * Skip whitespace and track line/column
   */
  private skipWhitespace(): void {
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];
      if (char === ' ' || char === '\t') {
        this.pos++;
        this.column++;
      } else if (char === '\n') {
        this.pos++;
        this.line++;
        this.column = 1;
      } else if (char === '\r') {
        this.pos++;
        if (this.pos < this.input.length && this.input[this.pos] === '\n') {
          this.pos++;
        }
        this.line++;
        this.column = 1;
      } else {
        break;
      }
    }
  }

  /**
   * Get the next token
   */
  private nextToken(): Token | null {
    const startLine = this.line;
    const startColumn = this.column;
    const char = this.input[this.pos] as string | undefined;

    if (char === undefined) {
      return null;
    }

    // String literal (double quotes)
    if (char === '"') {
      return this.readString('"', startLine, startColumn);
    }

    // String literal (single quotes)
    if (char === "'") {
      return this.readString("'", startLine, startColumn);
    }

    // Number
    if (char === '-' || (char >= '0' && char <= '9')) {
      return this.readNumber(startLine, startColumn);
    }

    // Operator symbols (multi-character first)
    const twoChar = this.input.substring(this.pos, this.pos + 2);
    const twoCharOp = OPERATOR_SYMBOLS[twoChar];
    if (twoCharOp) {
      this.pos += 2;
      this.column += 2;
      return {
        type: twoCharOp,
        value: twoChar,
        line: startLine,
        column: startColumn,
        length: 2,
      };
    }

    // Single character operators
    const singleCharOp = OPERATOR_SYMBOLS[char];
    if (singleCharOp) {
      this.pos++;
      this.column++;
      return {
        type: singleCharOp,
        value: char,
        line: startLine,
        column: startColumn,
        length: 1,
      };
    }

    // Identifier or keyword
    if (this.isIdentifierStart(char)) {
      return this.readIdentifier(startLine, startColumn);
    }

    // Unknown character - skip it
    this.pos++;
    this.column++;
    return null;
  }

  /**
   * Check if character can start an identifier
   */
  private isIdentifierStart(char: string | undefined): char is string {
    if (char === undefined) return false;
    return (char >= 'a' && char <= 'z') ||
           (char >= 'A' && char <= 'Z') ||
           char === '_';
  }

  /**
   * Check if character can continue an identifier
   */
  private isIdentifierPart(char: string | undefined): char is string {
    if (char === undefined) return false;
    // Need to cast char since isIdentifierStart narrows it in an OR
    const c = char as string;
    return (c >= 'a' && c <= 'z') ||
           (c >= 'A' && c <= 'Z') ||
           c === '_' ||
           (c >= '0' && c <= '9');
  }

  /**
   * Read a string literal
   */
  private readString(quote: string, startLine: number, startColumn: number): Token {
    this.pos++; // Skip opening quote
    this.column++;

    let value = '';
    while (this.pos < this.input.length) {
      const char = this.input[this.pos];

      if (char === quote) {
        this.pos++; // Skip closing quote
        this.column++;
        return {
          type: 'STRING',
          value,
          line: startLine,
          column: startColumn,
          length: value.length + 2, // Include quotes
        };
      }

      if (char === '\\' && this.pos + 1 < this.input.length) {
        // Escape sequence
        this.pos++;
        this.column++;
        const escaped = this.input[this.pos];
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          case "'": value += "'"; break;
          default: value += escaped;
        }
      } else if (char === '\n' || char === '\r') {
        // Unclosed string - return what we have
        throw new ParseError(
          'Unclosed string literal',
          [createError('UNCLOSED_STRING', { line: startLine, column: startColumn })],
          startLine,
          startColumn
        );
      } else {
        value += char;
      }

      this.pos++;
      this.column++;
    }

    // Reached end of input without closing quote
    throw new ParseError(
      'Unclosed string literal',
      [createError('UNCLOSED_STRING', { line: startLine, column: startColumn })],
      startLine,
      startColumn
    );
  }

  /**
   * Read a number literal
   */
  private readNumber(startLine: number, startColumn: number): Token {
    let value = '';

    // Handle negative sign
    const firstChar = this.input[this.pos];
    if (firstChar === '-') {
      value += '-';
      this.pos++;
      this.column++;
    }

    // Read integer part
    while (this.pos < this.input.length) {
      const char = this.input[this.pos] as string;
      if (char >= '0' && char <= '9') {
        value += char;
        this.pos++;
        this.column++;
      } else {
        break;
      }
    }

    // Read decimal part
    const dotChar = this.input[this.pos];
    if (this.pos < this.input.length && dotChar === '.') {
      value += '.';
      this.pos++;
      this.column++;

      while (this.pos < this.input.length) {
        const char = this.input[this.pos] as string;
        if (char >= '0' && char <= '9') {
          value += char;
          this.pos++;
          this.column++;
        } else {
          break;
        }
      }
    }

    return {
      type: 'NUMBER',
      value,
      line: startLine,
      column: startColumn,
      length: value.length,
    };
  }

  /**
   * Read an identifier or keyword
   */
  private readIdentifier(startLine: number, startColumn: number): Token {
    let value = '';

    while (this.pos < this.input.length && this.isIdentifierPart(this.input[this.pos])) {
      value += this.input[this.pos];
      this.pos++;
      this.column++;
    }

    // Check for multi-word keywords like "starts with", "is null", "is not null"
    const savedPos = this.pos;
    const savedColumn = this.column;
    const savedLine = this.line;

    this.skipWhitespace();

    if (this.pos < this.input.length && this.isIdentifierStart(this.input[this.pos])) {
      let nextWord = '';
      while (this.pos < this.input.length && this.isIdentifierPart(this.input[this.pos])) {
        nextWord += this.input[this.pos];
        this.pos++;
        this.column++;
      }

      const twoWordKey = `${value.toLowerCase()} ${nextWord.toLowerCase()}`;

      // Check for three-word keyword like "is not null"
      const savedPos2 = this.pos;
      const savedColumn2 = this.column;
      const savedLine2 = this.line;

      this.skipWhitespace();

      if (this.pos < this.input.length && this.isIdentifierStart(this.input[this.pos])) {
        let thirdWord = '';
        while (this.pos < this.input.length && this.isIdentifierPart(this.input[this.pos])) {
          thirdWord += this.input[this.pos];
          this.pos++;
          this.column++;
        }

        const threeWordKey = `${twoWordKey} ${thirdWord.toLowerCase()}`;
        if (KEYWORDS[threeWordKey]) {
          return {
            type: KEYWORDS[threeWordKey],
            value: `${value} ${nextWord} ${thirdWord}`,
            line: startLine,
            column: startColumn,
            length: value.length + 1 + nextWord.length + 1 + thirdWord.length,
          };
        }

        // Not a three-word keyword, restore to after second word
        this.pos = savedPos2;
        this.column = savedColumn2;
        this.line = savedLine2;
      } else {
        // Restore position if we only found whitespace after second word
        this.pos = savedPos2;
        this.column = savedColumn2;
        this.line = savedLine2;
      }

      // Check if it's a two-word keyword
      if (KEYWORDS[twoWordKey]) {
        return {
          type: KEYWORDS[twoWordKey],
          value: `${value} ${nextWord}`,
          line: startLine,
          column: startColumn,
          length: value.length + 1 + nextWord.length,
        };
      }

      // Not a two-word keyword, restore position
      this.pos = savedPos;
      this.column = savedColumn;
      this.line = savedLine;
    } else {
      // Restore position if we only found whitespace
      this.pos = savedPos;
      this.column = savedColumn;
      this.line = savedLine;
    }

    // Check if it's a keyword
    const lowerValue = value.toLowerCase();
    if (KEYWORDS[lowerValue]) {
      return {
        type: KEYWORDS[lowerValue],
        value,
        line: startLine,
        column: startColumn,
        length: value.length,
      };
    }

    // It's an identifier
    return {
      type: 'IDENTIFIER',
      value,
      line: startLine,
      column: startColumn,
      length: value.length,
    };
  }

  /**
   * Peek at the current token without consuming it
   */
  peek(): Token {
    // We always have at least EOF token, so this is safe
    return this.tokens[this.currentIndex]!;
  }

  /**
   * Peek at a future token
   */
  peekAhead(offset: number): Token {
    const index = this.currentIndex + offset;
    if (index >= this.tokens.length) {
      // We always have at least EOF token
      return this.tokens[this.tokens.length - 1]!;
    }
    return this.tokens[index]!;
  }

  /**
   * Consume and return the current token
   */
  consume(): Token {
    // We always have at least EOF token, so this is safe
    const token = this.tokens[this.currentIndex]!;
    if (this.currentIndex < this.tokens.length - 1) {
      this.currentIndex++;
    }
    return token;
  }

  /**
   * Check if the current token matches a type
   */
  check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  /**
   * Check if the current token matches any of the given types
   */
  checkAny(...types: TokenType[]): boolean {
    const currentType = this.peek().type;
    return types.some((t) => t === currentType);
  }

  /**
   * Consume token if it matches, return true; otherwise return false
   */
  match(type: TokenType): boolean {
    if (this.check(type)) {
      this.consume();
      return true;
    }
    return false;
  }

  /**
   * Expect a token of a given type, throw if not found
   */
  expect(type: TokenType, errorCode: QueryErrorCode, customMessage?: string): Token {
    if (this.check(type)) {
      return this.consume();
    }

    const current = this.peek();
    throw new ParseError(
      customMessage ?? `Expected ${type} but found ${current.type}`,
      [createError(errorCode, { line: current.line, column: current.column })],
      current.line,
      current.column
    );
  }

  /**
   * Check if at end of input
   */
  isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }
}

// ============================================================================
// PARSER
// ============================================================================

/**
 * Recursive descent parser for the query DSL.
 */
class Parser {
  private readonly lexer: Lexer;

  constructor(input: string) {
    this.lexer = new Lexer(input);
  }

  /**
   * Parse the input and return the QueryAST
   */
  parse(): QueryAST {
    const ast = this.parseQuery();

    // Ensure we consumed all input
    if (!this.lexer.isAtEnd()) {
      const token = this.lexer.peek();
      throw new ParseError(
        `Unexpected token: ${token.value}`,
        [createError('INVALID_SYNTAX', {
          line: token.line,
          column: token.column,
          customMessage: `Unexpected token: "${token.value}"`,
        })],
        token.line,
        token.column
      );
    }

    return ast;
  }

  /**
   * Query <- FindQuery / CountQuery / GraphQuery
   */
  private parseQuery(): QueryAST {
    if (this.lexer.check('FIND')) {
      return this.parseFindQuery();
    }

    if (this.lexer.check('COUNT')) {
      return this.parseCountQuery();
    }

    if (this.lexer.check('GRAPH')) {
      return this.parseGraphQuery();
    }

    const token = this.lexer.peek();
    throw new ParseError(
      'Invalid query type',
      [createError('INVALID_QUERY_TYPE', {
        line: token.line,
        column: token.column,
        customMessage: `Expected "find", "count", or "graph" but found "${token.value}"`,
      })],
      token.line,
      token.column
    );
  }

  /**
   * FindQuery <- FIND Relation WhereClause? SelectClause? OrderClause? LimitClause?
   */
  private parseFindQuery(): QueryAST {
    this.lexer.consume(); // FIND

    const relation = this.parseRelation();
    const filters = this.lexer.check('WHERE') ? this.parseWhereClause() : [];
    const projections = this.parseSelectClause(relation);
    const orderBy = this.parseOrderClause();
    const { limit, offset } = this.parseLimitClause();

    return {
      type: 'find',
      relation,
      filters,
      projections,
      ...(orderBy && { orderBy }),
      ...(limit !== undefined && { limit }),
      ...(offset !== undefined && { offset }),
    };
  }

  /**
   * CountQuery <- COUNT Relation WhereClause?
   */
  private parseCountQuery(): QueryAST {
    this.lexer.consume(); // COUNT

    const relation = this.parseRelation();
    const filters = this.lexer.check('WHERE') ? this.parseWhereClause() : [];

    return {
      type: 'count',
      relation,
      filters,
      projections: [],
    };
  }

  /**
   * GraphQuery <- GRAPH Relation WhereClause? DepthClause?
   */
  private parseGraphQuery(): QueryAST {
    this.lexer.consume(); // GRAPH

    const relation = this.parseRelation();
    const filters = this.lexer.check('WHERE') ? this.parseWhereClause() : [];
    const depth = this.parseDepthClause();

    return {
      type: 'graph',
      relation,
      filters,
      projections: [],
      ...(depth !== undefined && { limit: depth }), // depth as limit for graph queries
    };
  }

  /**
   * Relation <- PAGES / BLOCKS / LINKS / TAGS / PROPERTIES / BLOCK_REFS / DAILY_NOTES
   */
  private parseRelation(): string {
    const token = this.lexer.peek();

    if (this.lexer.checkAny('PAGES', 'BLOCKS', 'LINKS', 'TAGS', 'PROPERTIES', 'BLOCK_REFS', 'DAILY_NOTES')) {
      this.lexer.consume();
      const relation = normalizeRelation(token.value);

      if (!isQueryableRelation(relation)) {
        throw new ParseError(
          `Unknown relation: ${token.value}`,
          [createError('UNKNOWN_RELATION', {
            line: token.line,
            column: token.column,
            customMessage: `Unknown relation: "${token.value}"`,
          })],
          token.line,
          token.column
        );
      }

      return relation;
    }

    throw new ParseError(
      'Missing relation name',
      [createError('MISSING_RELATION', {
        line: token.line,
        column: token.column,
        customMessage: `Expected relation name (pages, blocks, links, tags, properties) but found "${token.value}"`,
      })],
      token.line,
      token.column
    );
  }

  /**
   * WhereClause <- WHERE Condition (LogicalOp Condition)*
   */
  private parseWhereClause(): Filter[] {
    this.lexer.consume(); // WHERE

    const filters: Filter[] = [];
    let condition = this.parseCondition();
    if (condition) {
      filters.push(condition);
    }

    while (this.lexer.checkAny('AND', 'OR')) {
      this.lexer.consume(); // For now, treat AND/OR the same (implicit AND)
      condition = this.parseCondition();
      if (condition) {
        filters.push(condition);
      }
    }

    return filters;
  }

  /**
   * Condition <- TagCondition / LinkCondition / PropertyCondition / SimpleCondition
   */
  private parseCondition(): Filter | null {
    // TagCondition <- TAGGED StringValue
    if (this.lexer.check('TAGGED')) {
      return this.parseTagCondition();
    }

    // LinkCondition <- LINKED (FROM / TO) StringValue
    if (this.lexer.check('LINKED')) {
      return this.parseLinkCondition();
    }

    // PropertyCondition <- HAS PROPERTY StringValue (Operator Value)?
    if (this.lexer.check('HAS')) {
      return this.parsePropertyCondition();
    }

    // SimpleCondition <- Column Operator Value
    return this.parseSimpleCondition();
  }

  /**
   * TagCondition <- TAGGED StringValue
   */
  private parseTagCondition(): Filter {
    this.lexer.consume(); // TAGGED
    const value = this.parseValue();

    if (typeof value !== 'string') {
      const token = this.lexer.peek();
      throw new ParseError(
        'Tag value must be a string',
        [createError('TYPE_MISMATCH', {
          line: token.line,
          column: token.column,
          customMessage: 'Tag value must be a string',
        })],
        token.line,
        token.column
      );
    }

    return {
      field: 'tag',
      operator: 'hasTag',
      value,
    };
  }

  /**
   * LinkCondition <- LINKED (FROM / TO) StringValue
   */
  private parseLinkCondition(): Filter {
    this.lexer.consume(); // LINKED

    let operator: FilterOperator = 'linkedTo';
    if (this.lexer.check('FROM')) {
      this.lexer.consume();
      operator = 'linkedFrom';
    } else if (this.lexer.check('TO')) {
      this.lexer.consume();
      operator = 'linkedTo';
    }

    const value = this.parseValue();

    if (typeof value !== 'string') {
      const token = this.lexer.peek();
      throw new ParseError(
        'Link target must be a string',
        [createError('TYPE_MISMATCH', {
          line: token.line,
          column: token.column,
          customMessage: 'Link target must be a string (page title or ID)',
        })],
        token.line,
        token.column
      );
    }

    return {
      field: 'source',
      operator,
      value,
    };
  }

  /**
   * PropertyCondition <- HAS PROPERTY StringValue (Operator Value)?
   */
  private parsePropertyCondition(): Filter {
    this.lexer.consume(); // HAS
    this.lexer.expect('PROPERTY', 'INVALID_SYNTAX', 'Expected "property" after "has"');

    const propertyKey = this.parseValue();

    if (typeof propertyKey !== 'string') {
      const token = this.lexer.peek();
      throw new ParseError(
        'Property key must be a string',
        [createError('TYPE_MISMATCH', {
          line: token.line,
          column: token.column,
          customMessage: 'Property key must be a string',
        })],
        token.line,
        token.column
      );
    }

    // Check if there's an optional operator and value
    if (this.isOperator()) {
      const operator = this.parseOperator();
      const value = this.parseValue();
      return {
        field: propertyKey,
        operator,
        value,
      };
    }

    return {
      field: propertyKey,
      operator: 'hasProperty',
      value: propertyKey,
    };
  }

  /**
   * SimpleCondition <- Column Operator Value
   */
  private parseSimpleCondition(): Filter {
    const fieldToken = this.lexer.peek();

    if (!this.lexer.check('IDENTIFIER')) {
      throw new ParseError(
        'Expected field name',
        [createError('INVALID_SYNTAX', {
          line: fieldToken.line,
          column: fieldToken.column,
          customMessage: `Expected field name but found "${fieldToken.value}"`,
        })],
        fieldToken.line,
        fieldToken.column
      );
    }

    const field = this.lexer.consume().value;
    const operator = this.parseOperator();

    // Unary operators don't need a value
    if (operator === 'isNull' || operator === 'isNotNull') {
      return {
        field,
        operator,
        value: null,
      };
    }

    const value = this.parseValue();

    return {
      field,
      operator,
      value,
    };
  }

  /**
   * Check if current token is an operator
   */
  private isOperator(): boolean {
    return this.lexer.checkAny(
      'EQUALS', 'NOT_EQUALS', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH',
      'GREATER_THAN', 'LESS_THAN', 'GTE', 'LTE', 'IS_NULL', 'IS_NOT_NULL'
    );
  }

  /**
   * Operator <- EQUALS / NOT_EQUALS / CONTAINS / STARTS_WITH / ENDS_WITH
   *           / GREATER_THAN / LESS_THAN / GTE / LTE / IS_NULL / IS_NOT_NULL
   */
  private parseOperator(): FilterOperator {
    const token = this.lexer.peek();

    const operatorMap: Record<string, FilterOperator> = {
      'EQUALS': 'equals',
      'NOT_EQUALS': 'notEquals',
      'CONTAINS': 'contains',
      'STARTS_WITH': 'startsWith',
      'ENDS_WITH': 'endsWith',
      'GREATER_THAN': 'greaterThan',
      'LESS_THAN': 'lessThan',
      'GTE': 'greaterThanOrEqual',
      'LTE': 'lessThanOrEqual',
      'IS_NULL': 'isNull',
      'IS_NOT_NULL': 'isNotNull',
    };

    const operator = operatorMap[token.type];
    if (operator) {
      this.lexer.consume();
      return operator;
    }

    throw new ParseError(
      'Invalid operator',
      [createError('INVALID_OPERATOR', {
        line: token.line,
        column: token.column,
        customMessage: `Invalid operator: "${token.value}"`,
      })],
      token.line,
      token.column
    );
  }

  /**
   * Value <- StringValue / NumberValue / BooleanValue / NullValue
   */
  private parseValue(): FilterValue {
    const token = this.lexer.peek();

    if (this.lexer.check('STRING')) {
      return this.lexer.consume().value;
    }

    if (this.lexer.check('NUMBER')) {
      const numberToken = this.lexer.consume();
      const parsed = parseFloat(numberToken.value);
      if (!Number.isFinite(parsed)) {
        throw new ParseError(
          'Invalid number value',
          [createError('INVALID_FILTER_VALUE', {
            line: numberToken.line,
            column: numberToken.column,
            customMessage: `Invalid number "${numberToken.value}" (NaN or Infinity not allowed)`,
          })],
          numberToken.line,
          numberToken.column
        );
      }
      return parsed;
    }

    if (this.lexer.check('TRUE')) {
      this.lexer.consume();
      return true;
    }

    if (this.lexer.check('FALSE')) {
      this.lexer.consume();
      return false;
    }

    if (this.lexer.check('NULL')) {
      this.lexer.consume();
      return null;
    }

    throw new ParseError(
      'Invalid filter value',
      [createError('INVALID_FILTER_VALUE', {
        line: token.line,
        column: token.column,
        customMessage: `Expected string, number, boolean, or null but found "${token.value}"`,
      })],
      token.line,
      token.column
    );
  }

  /**
   * SelectClause <- (SELECT / RETURNING) ColumnList
   * If not present, return default projections for the relation
   */
  private parseSelectClause(relation: string): string[] {
    if (!this.lexer.checkAny('SELECT', 'RETURNING')) {
      // Return default projections
      const normalizedRelation = relation as keyof typeof DEFAULT_PROJECTIONS;
      if (DEFAULT_PROJECTIONS[normalizedRelation]) {
        return [...DEFAULT_PROJECTIONS[normalizedRelation]];
      }
      return [];
    }

    this.lexer.consume(); // SELECT or RETURNING
    return this.parseColumnList(relation);
  }

  /**
   * ColumnList <- Column (',' Column)*
   */
  private parseColumnList(relation: string): string[] {
    const columns: string[] = [];
    const normalizedRelation = relation as keyof typeof RELATION_COLUMNS;

    // First column
    const firstToken = this.lexer.peek();
    if (!this.lexer.check('IDENTIFIER')) {
      throw new ParseError(
        'Expected column name',
        [createError('INVALID_SYNTAX', {
          line: firstToken.line,
          column: firstToken.column,
          customMessage: `Expected column name but found "${firstToken.value}"`,
        })],
        firstToken.line,
        firstToken.column
      );
    }

    const firstColumn = this.lexer.consume().value;
    if (RELATION_COLUMNS[normalizedRelation] && !RELATION_COLUMNS[normalizedRelation].includes(firstColumn)) {
      throw new ParseError(
        `Unknown column: ${firstColumn}`,
        [createError('UNKNOWN_COLUMN', {
          line: firstToken.line,
          column: firstToken.column,
          customMessage: `Unknown column "${firstColumn}" for relation "${relation}"`,
          customSuggestion: `Valid columns: ${RELATION_COLUMNS[normalizedRelation].join(', ')}`,
        })],
        firstToken.line,
        firstToken.column
      );
    }
    columns.push(firstColumn);

    // Additional columns
    while (this.lexer.check('COMMA')) {
      this.lexer.consume(); // COMMA
      const token = this.lexer.peek();

      if (!this.lexer.check('IDENTIFIER')) {
        throw new ParseError(
          'Expected column name after comma',
          [createError('INVALID_SYNTAX', {
            line: token.line,
            column: token.column,
            customMessage: `Expected column name after comma but found "${token.value}"`,
          })],
          token.line,
          token.column
        );
      }

      const column = this.lexer.consume().value;
      if (RELATION_COLUMNS[normalizedRelation] && !RELATION_COLUMNS[normalizedRelation].includes(column)) {
        throw new ParseError(
          `Unknown column: ${column}`,
          [createError('UNKNOWN_COLUMN', {
            line: token.line,
            column: token.column,
            customMessage: `Unknown column "${column}" for relation "${relation}"`,
            customSuggestion: `Valid columns: ${RELATION_COLUMNS[normalizedRelation].join(', ')}`,
          })],
          token.line,
          token.column
        );
      }
      columns.push(column);
    }

    return columns;
  }

  /**
   * OrderClause <- ORDER BY Column Direction?
   */
  private parseOrderClause(): OrderBy | undefined {
    if (!this.lexer.check('ORDER')) {
      return undefined;
    }

    this.lexer.consume(); // ORDER
    this.lexer.expect('BY', 'INVALID_SYNTAX', 'Expected "by" after "order"');

    const fieldToken = this.lexer.peek();
    if (!this.lexer.check('IDENTIFIER')) {
      throw new ParseError(
        'Expected field name for order by',
        [createError('INVALID_SYNTAX', {
          line: fieldToken.line,
          column: fieldToken.column,
          customMessage: `Expected field name but found "${fieldToken.value}"`,
        })],
        fieldToken.line,
        fieldToken.column
      );
    }

    const field = this.lexer.consume().value;

    let direction: SortDirection = 'asc';
    if (this.lexer.check('ASC')) {
      this.lexer.consume();
      direction = 'asc';
    } else if (this.lexer.check('DESC')) {
      this.lexer.consume();
      direction = 'desc';
    }

    return { field, direction };
  }

  /**
   * LimitClause <- LIMIT Number (OFFSET Number)?
   */
  private parseLimitClause(): { limit?: number; offset?: number } {
    if (!this.lexer.check('LIMIT')) {
      return {};
    }

    this.lexer.consume(); // LIMIT

    const limitToken = this.lexer.peek();
    if (!this.lexer.check('NUMBER')) {
      throw new ParseError(
        'Expected number after limit',
        [createError('INVALID_SYNTAX', {
          line: limitToken.line,
          column: limitToken.column,
          customMessage: `Expected number after "limit" but found "${limitToken.value}"`,
        })],
        limitToken.line,
        limitToken.column
      );
    }

    const limitValueToken = this.lexer.consume();
    const limit = parseInt(limitValueToken.value, 10);
    if (!Number.isFinite(limit)) {
      throw new ParseError(
        'Invalid limit value',
        [createError('INVALID_SYNTAX', {
          line: limitValueToken.line,
          column: limitValueToken.column,
          customMessage: `Invalid limit "${limitValueToken.value}" (NaN or Infinity not allowed)`,
        })],
        limitValueToken.line,
        limitValueToken.column
      );
    }

    let offset: number | undefined;
    if (this.lexer.check('OFFSET')) {
      this.lexer.consume(); // OFFSET

      const offsetToken = this.lexer.peek();
      if (!this.lexer.check('NUMBER')) {
        throw new ParseError(
          'Expected number after offset',
          [createError('INVALID_SYNTAX', {
            line: offsetToken.line,
            column: offsetToken.column,
            customMessage: `Expected number after "offset" but found "${offsetToken.value}"`,
          })],
          offsetToken.line,
          offsetToken.column
        );
      }

      const offsetValueToken = this.lexer.consume();
      offset = parseInt(offsetValueToken.value, 10);
      if (!Number.isFinite(offset)) {
        throw new ParseError(
          'Invalid offset value',
          [createError('INVALID_SYNTAX', {
            line: offsetValueToken.line,
            column: offsetValueToken.column,
            customMessage: `Invalid offset "${offsetValueToken.value}" (NaN or Infinity not allowed)`,
          })],
          offsetValueToken.line,
          offsetValueToken.column
        );
      }
    }

    return { limit, offset };
  }

  /**
   * DepthClause <- DEPTH Number
   */
  private parseDepthClause(): number | undefined {
    if (!this.lexer.check('DEPTH')) {
      return undefined;
    }

    this.lexer.consume(); // DEPTH

    const depthToken = this.lexer.peek();
    if (!this.lexer.check('NUMBER')) {
      throw new ParseError(
        'Expected number after depth',
        [createError('INVALID_SYNTAX', {
          line: depthToken.line,
          column: depthToken.column,
          customMessage: `Expected number after "depth" but found "${depthToken.value}"`,
        })],
        depthToken.line,
        depthToken.column
      );
    }

    const depthValueToken = this.lexer.consume();
    const depth = parseInt(depthValueToken.value, 10);
    if (!Number.isFinite(depth)) {
      throw new ParseError(
        'Invalid depth value',
        [createError('INVALID_SYNTAX', {
          line: depthValueToken.line,
          column: depthValueToken.column,
          customMessage: `Invalid depth "${depthValueToken.value}" (NaN or Infinity not allowed)`,
        })],
        depthValueToken.line,
        depthValueToken.column
      );
    }
    return depth;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Parse a user-friendly query string into an AST.
 *
 * Example inputs:
 * - "find pages where title contains 'meeting'"
 * - "count blocks"
 * - "find pages linked from 'Project Alpha'"
 * - "find blocks where content contains 'TODO' order by created_at desc limit 10"
 *
 * @param input - The user-friendly query string
 * @returns The parsed QueryAST
 * @throws ParseError if the query cannot be parsed
 *
 * @example
 * ```typescript
 * const ast = parseQuery("find pages where title contains 'meeting'");
 * // {
 * //   type: 'find',
 * //   relation: 'pages',
 * //   filters: [{ field: 'title', operator: 'contains', value: 'meeting' }],
 * //   projections: ['page_id', 'title']
 * // }
 * ```
 */
export function parseQuery(input: string): QueryAST {
  // Validate input
  if (!input || typeof input !== 'string') {
    throw new ParseError(
      'Query input must be a non-empty string',
      [createError('EMPTY_QUERY', { line: 1, column: 1 })],
      1,
      1
    );
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new ParseError(
      'Query input must be a non-empty string',
      [createError('EMPTY_QUERY', { line: 1, column: 1 })],
      1,
      1
    );
  }

  const parser = new Parser(trimmed);
  return parser.parse();
}
