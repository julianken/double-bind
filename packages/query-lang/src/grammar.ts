// @double-bind/query-lang - Grammar Definition
//
// This module defines the formal grammar for the user-friendly query DSL.
// The grammar uses PEG (Parsing Expression Grammar) syntax and supports
// progressive disclosure at three levels.
//
// Level 1 (Templates): Pre-built queries - uses template IDs, not this grammar
// Level 2 (Visual Builder): Form-based construction - generates this grammar
// Level 3 (Raw Datalog): Direct CozoScript - bypasses this grammar entirely

// ============================================================================
// PEG GRAMMAR SPECIFICATION
// ============================================================================

/**
 * PEG Grammar for the Double-Bind Query DSL
 *
 * This grammar defines a user-friendly query language that gets transpiled
 * to CozoScript (Datalog). The grammar is designed to be:
 * - Readable: Natural language-like syntax
 * - Forgiving: Case-insensitive keywords, flexible whitespace
 * - Safe: All values are parameterized to prevent injection
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * FORMAL PEG GRAMMAR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Query        <- FindQuery / CountQuery / GraphQuery
 *
 * FindQuery    <- FIND Relation WhereClause? SelectClause? OrderClause? LimitClause?
 * CountQuery   <- COUNT Relation WhereClause?
 * GraphQuery   <- GRAPH Relation WhereClause? DepthClause?
 *
 * Relation     <- PAGES / BLOCKS / LINKS / TAGS / PROPERTIES / BLOCK_REFS / DAILY_NOTES
 *
 * WhereClause  <- WHERE Condition (LogicalOp Condition)*
 * SelectClause <- SELECT ColumnList / RETURNING ColumnList
 * OrderClause  <- ORDER BY Column Direction?
 * LimitClause  <- LIMIT Number (OFFSET Number)?
 * DepthClause  <- DEPTH Number
 *
 * Condition    <- SimpleCondition / TagCondition / LinkCondition / PropertyCondition
 *
 * SimpleCondition   <- Column Operator Value
 * TagCondition      <- TAGGED StringValue
 * LinkCondition     <- LINKED (FROM / TO) StringValue
 * PropertyCondition <- HAS PROPERTY StringValue (Operator Value)?
 *
 * Operator     <- EQUALS / NOT_EQUALS / CONTAINS / STARTS_WITH / ENDS_WITH
 *              / GREATER_THAN / LESS_THAN / GTE / LTE / IS_NULL / IS_NOT_NULL
 *
 * LogicalOp    <- AND / OR
 * Direction    <- ASC / DESC
 *
 * Value        <- StringValue / NumberValue / BooleanValue / NullValue
 * StringValue  <- DQUOTE (!DQUOTE .)* DQUOTE / SQUOTE (!SQUOTE .)* SQUOTE
 * NumberValue  <- '-'? [0-9]+ ('.' [0-9]+)?
 * BooleanValue <- TRUE / FALSE
 * NullValue    <- NULL
 *
 * Column       <- [a-z_]+
 * ColumnList   <- Column (',' Column)*
 * Number       <- [0-9]+
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * KEYWORD DEFINITIONS (case-insensitive)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FIND          <- [Ff][Ii][Nn][Dd] _
 * COUNT         <- [Cc][Oo][Uu][Nn][Tt] _
 * GRAPH         <- [Gg][Rr][Aa][Pp][Hh] _
 * WHERE         <- [Ww][Hh][Ee][Rr][Ee] _
 * SELECT        <- [Ss][Ee][Ll][Ee][Cc][Tt] _
 * RETURNING     <- [Rr][Ee][Tt][Uu][Rr][Nn][Ii][Nn][Gg] _
 * ORDER         <- [Oo][Rr][Dd][Ee][Rr] _
 * BY            <- [Bb][Yy] _
 * LIMIT         <- [Ll][Ii][Mm][Ii][Tt] _
 * OFFSET        <- [Oo][Ff][Ff][Ss][Ee][Tt] _
 * DEPTH         <- [Dd][Ee][Pp][Tt][Hh] _
 * AND           <- [Aa][Nn][Dd] _
 * OR            <- [Oo][Rr] _
 * ASC           <- [Aa][Ss][Cc] _
 * DESC          <- [Dd][Ee][Ss][Cc] _
 * TAGGED        <- [Tt][Aa][Gg][Gg][Ee][Dd] _
 * LINKED        <- [Ll][Ii][Nn][Kk][Ee][Dd] _
 * FROM          <- [Ff][Rr][Oo][Mm] _
 * TO            <- [Tt][Oo] _
 * HAS           <- [Hh][Aa][Ss] _
 * PROPERTY      <- [Pp][Rr][Oo][Pp][Ee][Rr][Tt][Yy] _
 * TRUE          <- [Tt][Rr][Uu][Ee] _
 * FALSE         <- [Ff][Aa][Ll][Ss][Ee] _
 * NULL          <- [Nn][Uu][Ll][Ll] _
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * RELATION KEYWORDS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PAGES         <- [Pp][Aa][Gg][Ee][Ss]? _
 * BLOCKS        <- [Bb][Ll][Oo][Cc][Kk][Ss]? _
 * LINKS         <- [Ll][Ii][Nn][Kk][Ss]? _
 * TAGS          <- [Tt][Aa][Gg][Ss]? _
 * PROPERTIES    <- [Pp][Rr][Oo][Pp][Ee][Rr][Tt][Ii][Ee][Ss] _
 * BLOCK_REFS    <- [Bb][Ll][Oo][Cc][Kk][ _][Rr][Ee][Ff][Ss]? _
 * DAILY_NOTES   <- [Dd][Aa][Ii][Ll][Yy][ _][Nn][Oo][Tt][Ee][Ss]? _
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * OPERATOR KEYWORDS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * EQUALS        <- ('=' / '==' / [Ee][Qq][Uu][Aa][Ll][Ss] / [Ii][Ss]) _
 * NOT_EQUALS    <- ('!=' / '<>' / [Nn][Oo][Tt][ _][Ee][Qq][Uu][Aa][Ll][Ss]) _
 * CONTAINS      <- [Cc][Oo][Nn][Tt][Aa][Ii][Nn][Ss] _
 * STARTS_WITH   <- [Ss][Tt][Aa][Rr][Tt][Ss][ _]?[Ww][Ii][Tt][Hh] _
 * ENDS_WITH     <- [Ee][Nn][Dd][Ss][ _]?[Ww][Ii][Tt][Hh] _
 * GREATER_THAN  <- ('>' / [Gg][Rr][Ee][Aa][Tt][Ee][Rr][ _]?[Tt][Hh][Aa][Nn]) _
 * LESS_THAN     <- ('<' / [Ll][Ee][Ss][Ss][ _]?[Tt][Hh][Aa][Nn]) _
 * GTE           <- ('>=' / [Gg][Tt][Ee]) _
 * LTE           <- ('<=' / [Ll][Tt][Ee]) _
 * IS_NULL       <- [Ii][Ss][ _][Nn][Uu][Ll][Ll] _
 * IS_NOT_NULL   <- [Ii][Ss][ _][Nn][Oo][Tt][ _][Nn][Uu][Ll][Ll] _
 *
 * _ <- [ \t\n\r]*
 *
 */
export const GRAMMAR_PEG = `
Query        <- FindQuery / CountQuery / GraphQuery

FindQuery    <- FIND Relation WhereClause? SelectClause? OrderClause? LimitClause?
CountQuery   <- COUNT Relation WhereClause?
GraphQuery   <- GRAPH Relation WhereClause? DepthClause?

Relation     <- PAGES / BLOCKS / LINKS / TAGS / PROPERTIES / BLOCK_REFS / DAILY_NOTES

WhereClause  <- WHERE Condition (LogicalOp Condition)*
SelectClause <- (SELECT / RETURNING) ColumnList
OrderClause  <- ORDER BY Column Direction?
LimitClause  <- LIMIT Number (OFFSET Number)?
DepthClause  <- DEPTH Number

Condition    <- SimpleCondition / TagCondition / LinkCondition / PropertyCondition

SimpleCondition   <- Column Operator Value
TagCondition      <- TAGGED StringValue
LinkCondition     <- LINKED (FROM / TO) StringValue
PropertyCondition <- HAS PROPERTY StringValue (Operator Value)?

Operator     <- EQUALS / NOT_EQUALS / CONTAINS / STARTS_WITH / ENDS_WITH
             / GTE / LTE / GREATER_THAN / LESS_THAN / IS_NOT_NULL / IS_NULL

LogicalOp    <- AND / OR
Direction    <- ASC / DESC

Value        <- StringValue / NumberValue / BooleanValue / NullValue
StringValue  <- DQUOTE (!DQUOTE .)* DQUOTE / SQUOTE (!SQUOTE .)* SQUOTE
NumberValue  <- '-'? [0-9]+ ('.' [0-9]+)?
BooleanValue <- TRUE / FALSE
NullValue    <- NULL

Column       <- [a-z_]+
ColumnList   <- Column (',' _? Column)*
Number       <- [0-9]+

FIND         <- [Ff][Ii][Nn][Dd] _
COUNT        <- [Cc][Oo][Uu][Nn][Tt] _
GRAPH        <- [Gg][Rr][Aa][Pp][Hh] _
WHERE        <- [Ww][Hh][Ee][Rr][Ee] _
SELECT       <- [Ss][Ee][Ll][Ee][Cc][Tt] _
RETURNING    <- [Rr][Ee][Tt][Uu][Rr][Nn][Ii][Nn][Gg] _
ORDER        <- [Oo][Rr][Dd][Ee][Rr] _
BY           <- [Bb][Yy] _
LIMIT        <- [Ll][Ii][Mm][Ii][Tt] _
OFFSET       <- [Oo][Ff][Ff][Ss][Ee][Tt] _
DEPTH        <- [Dd][Ee][Pp][Tt][Hh] _
AND          <- [Aa][Nn][Dd] _
OR           <- [Oo][Rr] _
ASC          <- [Aa][Ss][Cc] _?
DESC         <- [Dd][Ee][Ss][Cc] _?
TAGGED       <- [Tt][Aa][Gg][Gg][Ee][Dd] _
LINKED       <- [Ll][Ii][Nn][Kk][Ee][Dd] _
FROM         <- [Ff][Rr][Oo][Mm] _
TO           <- [Tt][Oo] _
HAS          <- [Hh][Aa][Ss] _
PROPERTY     <- [Pp][Rr][Oo][Pp][Ee][Rr][Tt][Yy] _
TRUE         <- [Tt][Rr][Uu][Ee] _?
FALSE        <- [Ff][Aa][Ll][Ss][Ee] _?
NULL         <- [Nn][Uu][Ll][Ll] _?

PAGES        <- [Pp][Aa][Gg][Ee][Ss]? _
BLOCKS       <- [Bb][Ll][Oo][Cc][Kk][Ss]? _
LINKS        <- [Ll][Ii][Nn][Kk][Ss]? _
TAGS         <- [Tt][Aa][Gg][Ss]? _
PROPERTIES   <- [Pp][Rr][Oo][Pp][Ee][Rr][Tt][Ii][Ee][Ss] _
BLOCK_REFS   <- [Bb][Ll][Oo][Cc][Kk][ _]?[Rr][Ee][Ff][Ss]? _
DAILY_NOTES  <- [Dd][Aa][Ii][Ll][Yy][ _]?[Nn][Oo][Tt][Ee][Ss]? _

EQUALS       <- ('=' '='? / [Ee][Qq][Uu][Aa][Ll][Ss] / [Ii][Ss]) _
NOT_EQUALS   <- ('!=' / '<>' / [Nn][Oo][Tt] _ [Ee][Qq][Uu][Aa][Ll][Ss]) _
CONTAINS     <- [Cc][Oo][Nn][Tt][Aa][Ii][Nn][Ss] _
STARTS_WITH  <- [Ss][Tt][Aa][Rr][Tt][Ss] _? [Ww][Ii][Tt][Hh] _
ENDS_WITH    <- [Ee][Nn][Dd][Ss] _? [Ww][Ii][Tt][Hh] _
GREATER_THAN <- ('>' !'=' / [Gg][Rr][Ee][Aa][Tt][Ee][Rr] _? [Tt][Hh][Aa][Nn]) _
LESS_THAN    <- ('<' !'=' / [Ll][Ee][Ss][Ss] _? [Tt][Hh][Aa][Nn]) _
GTE          <- ('>=' / [Gg][Tt][Ee]) _
LTE          <- ('<=' / [Ll][Tt][Ee]) _
IS_NULL      <- [Ii][Ss] _ [Nn][Uu][Ll][Ll] _?
IS_NOT_NULL  <- [Ii][Ss] _ [Nn][Oo][Tt] _ [Nn][Uu][Ll][Ll] _?

DQUOTE       <- '"'
SQUOTE       <- "'"
_            <- [ \\t\\n\\r]*
`;

// ============================================================================
// EXAMPLE QUERIES BY DISCLOSURE LEVEL
// ============================================================================

/**
 * Example queries demonstrating each progressive disclosure level.
 * These examples are used for documentation and testing.
 */
export const GRAMMAR_EXAMPLES = {
  /**
   * Level 1: Templates
   *
   * Users select from pre-built queries and fill in parameters.
   * No direct query writing required.
   */
  level1: {
    name: 'Templates',
    description: 'Pre-built parameterized queries. Users fill in form fields.',
    examples: [
      {
        template: 'find-pages-by-tag',
        parameters: { tag: 'meeting' },
        description: 'Find all pages with the "meeting" tag',
        cozoScript: `?[page_id, title] := *tags{ entity_id: page_id, tag: $tag }, *pages{ page_id, title, is_deleted: false }`,
      },
      {
        template: 'count-blocks-per-page',
        parameters: { pageTitle: 'Project Alpha' },
        description: 'Count blocks in a specific page',
        cozoScript: `?[count(block_id)] := *pages{ page_id, title: $title }, *blocks{ block_id, page_id, is_deleted: false }`,
      },
      {
        template: 'recent-pages',
        parameters: { days: 7 },
        description: 'Find pages created in the last 7 days',
        cozoScript: `?[page_id, title, created_at] := *pages{ page_id, title, created_at, is_deleted: false }, created_at > $cutoff`,
      },
      {
        template: 'orphan-pages',
        parameters: {},
        description: 'Find pages with no incoming links',
        cozoScript: `?[page_id, title] := *pages{ page_id, title, is_deleted: false }, not *links{ target_id: page_id }`,
      },
    ],
  },

  /**
   * Level 2: Visual Builder / DSL
   *
   * Users construct queries using the user-friendly DSL syntax.
   * This is parsed by the grammar defined above.
   */
  level2: {
    name: 'Visual Builder',
    description: 'Form-based query construction. Generates DSL syntax.',
    examples: [
      {
        dsl: 'find pages where title contains "meeting"',
        description: 'Find pages with "meeting" in the title',
        ast: {
          type: 'find' as const,
          relation: 'pages',
          filters: [{ field: 'title', operator: 'contains' as const, value: 'meeting' }],
          projections: ['page_id', 'title'],
        },
        cozoScript: `?[page_id, title] := *pages{ page_id, title, is_deleted: false }, contains(title, $filter_0)`,
      },
      {
        dsl: 'find blocks tagged "important"',
        description: 'Find blocks with the "important" tag',
        ast: {
          type: 'find' as const,
          relation: 'blocks',
          filters: [{ field: 'tag', operator: 'hasTag' as const, value: 'important' }],
          projections: ['block_id', 'content'],
        },
        cozoScript: `?[block_id, content] := *tags{ entity_id: block_id, tag: $tag }, *blocks{ block_id, content, is_deleted: false }`,
      },
      {
        dsl: 'count pages',
        description: 'Count total pages',
        ast: {
          type: 'count' as const,
          relation: 'pages',
          filters: [],
          projections: [],
        },
        cozoScript: `?[count(page_id)] := *pages{ page_id, is_deleted: false }`,
      },
      {
        dsl: 'find pages linked from "Project Alpha"',
        description: 'Find pages that Project Alpha links to',
        ast: {
          type: 'find' as const,
          relation: 'pages',
          filters: [{ field: 'source', operator: 'linkedFrom' as const, value: 'Project Alpha' }],
          projections: ['page_id', 'title'],
        },
        cozoScript: `?[page_id, title] := *pages{ page_id: source_id, title: $source_title }, *links{ source_id, target_id: page_id }, *pages{ page_id, title }`,
      },
      {
        dsl: 'find pages where created_at > 1704067200 order by created_at desc limit 10',
        description: 'Find recent pages with ordering and limit',
        ast: {
          type: 'find' as const,
          relation: 'pages',
          filters: [
            { field: 'created_at', operator: 'greaterThan' as const, value: 1704067200 },
          ],
          projections: ['page_id', 'title'],
          orderBy: { field: 'created_at', direction: 'desc' as const },
          limit: 10,
        },
        cozoScript: `?[page_id, title, created_at] := *pages{ page_id, title, created_at, is_deleted: false }, created_at > $filter_0 :order -created_at :limit 10`,
      },
      {
        dsl: 'find blocks where content contains "TODO" and is_deleted equals false',
        description: 'Find non-deleted TODO blocks',
        ast: {
          type: 'find' as const,
          relation: 'blocks',
          filters: [
            { field: 'content', operator: 'contains' as const, value: 'TODO' },
            { field: 'is_deleted', operator: 'equals' as const, value: false },
          ],
          projections: ['block_id', 'content'],
        },
        cozoScript: `?[block_id, content] := *blocks{ block_id, content, is_deleted: false }, contains(content, $filter_0)`,
      },
      {
        dsl: 'graph pages where title starts with "Project" depth 2',
        description: 'Graph pages starting with "Project" to depth 2',
        ast: {
          type: 'graph' as const,
          relation: 'pages',
          filters: [{ field: 'title', operator: 'startsWith' as const, value: 'Project' }],
          projections: ['page_id', 'title'],
          limit: 2, // depth represented as limit in graph queries
        },
        cozoScript: `?[src, dst] := *pages{ page_id: src, title, is_deleted: false }, starts_with(title, $filter_0), *links{ source_id: src, target_id: dst } :limit 2`,
      },
    ],
  },

  /**
   * Level 3: Raw Datalog
   *
   * Users write CozoScript directly with full control.
   * Bypasses the DSL grammar entirely.
   */
  level3: {
    name: 'Raw Datalog',
    description: 'Direct CozoScript editing with syntax highlighting.',
    examples: [
      {
        cozoScript: `?[page_id, title] := *pages{ page_id, title, is_deleted: false }`,
        description: 'List all active pages',
      },
      {
        cozoScript: `?[page_id, title, tag] := *pages{ page_id, title, is_deleted: false }, *tags{ entity_id: page_id, tag }`,
        description: 'List pages with their tags (join)',
      },
      {
        cozoScript: `?[page_id, in_degree] := *pages{ page_id, is_deleted: false }, in_degree = count(src): *links{ source_id: src, target_id: page_id }`,
        description: 'Count incoming links per page (aggregation)',
      },
      {
        cozoScript: `?[page_id, title] := *pages{ page_id, title, is_deleted: false }, not *links{ target_id: page_id }`,
        description: 'Find orphan pages (negation)',
      },
      {
        cozoScript: `?[src, dst, dist] <~ ShortestPathDijkstra(*links[], src, dst)
:where src = $source_page`,
        description: 'Shortest path from a page (graph algorithm)',
      },
      {
        cozoScript: `?[page_id, rank] <~ PageRank(*links[source_id, target_id])`,
        description: 'PageRank over all pages',
      },
    ],
  },
} as const;

// ============================================================================
// DSL KEYWORD TOKENS
// ============================================================================

/**
 * Token types for the DSL lexer
 */
export type TokenType =
  // Query types
  | 'FIND'
  | 'COUNT'
  | 'GRAPH'
  // Clauses
  | 'WHERE'
  | 'SELECT'
  | 'RETURNING'
  | 'ORDER'
  | 'BY'
  | 'LIMIT'
  | 'OFFSET'
  | 'DEPTH'
  // Logical
  | 'AND'
  | 'OR'
  | 'NOT'
  // Direction
  | 'ASC'
  | 'DESC'
  // Relations
  | 'PAGES'
  | 'BLOCKS'
  | 'LINKS'
  | 'TAGS'
  | 'PROPERTIES'
  | 'BLOCK_REFS'
  | 'DAILY_NOTES'
  // Operators
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'GTE'
  | 'LTE'
  | 'IS_NULL'
  | 'IS_NOT_NULL'
  // Special
  | 'TAGGED'
  | 'LINKED'
  | 'FROM'
  | 'TO'
  | 'HAS'
  | 'PROPERTY'
  // Values
  | 'STRING'
  | 'NUMBER'
  | 'TRUE'
  | 'FALSE'
  | 'NULL'
  // Other
  | 'IDENTIFIER'
  | 'COMMA'
  | 'LPAREN'
  | 'RPAREN'
  | 'EOF';

/**
 * A token produced by the lexer
 */
export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  length: number;
}

/**
 * Keyword mappings for case-insensitive matching.
 * Each keyword can have multiple aliases for user convenience.
 */
export const KEYWORDS: Record<string, TokenType> = {
  // Query types
  find: 'FIND',
  count: 'COUNT',
  graph: 'GRAPH',

  // Clauses
  where: 'WHERE',
  select: 'SELECT',
  returning: 'RETURNING',
  order: 'ORDER',
  by: 'BY',
  limit: 'LIMIT',
  offset: 'OFFSET',
  depth: 'DEPTH',

  // Logical
  and: 'AND',
  or: 'OR',
  not: 'NOT',

  // Direction
  asc: 'ASC',
  ascending: 'ASC',
  desc: 'DESC',
  descending: 'DESC',

  // Relations (with singular aliases)
  pages: 'PAGES',
  page: 'PAGES',
  blocks: 'BLOCKS',
  block: 'BLOCKS',
  links: 'LINKS',
  link: 'LINKS',
  tags: 'TAGS',
  tag: 'TAGS',
  properties: 'PROPERTIES',
  // Note: 'property' is used for 'has property' keyword, see below
  block_refs: 'BLOCK_REFS',
  blockrefs: 'BLOCK_REFS',
  daily_notes: 'DAILY_NOTES',
  dailynotes: 'DAILY_NOTES',

  // Operators
  equals: 'EQUALS',
  is: 'EQUALS',
  contains: 'CONTAINS',
  startswith: 'STARTS_WITH',
  'starts with': 'STARTS_WITH',
  endswith: 'ENDS_WITH',
  'ends with': 'ENDS_WITH',
  greaterthan: 'GREATER_THAN',
  'greater than': 'GREATER_THAN',
  lessthan: 'LESS_THAN',
  'less than': 'LESS_THAN',
  gte: 'GTE',
  lte: 'LTE',
  'is null': 'IS_NULL',
  'is not null': 'IS_NOT_NULL',

  // Special
  tagged: 'TAGGED',
  linked: 'LINKED',
  from: 'FROM',
  to: 'TO',
  has: 'HAS',
  property: 'PROPERTY',

  // Boolean
  true: 'TRUE',
  false: 'FALSE',
  null: 'NULL',
};

/**
 * Operator symbols
 */
export const OPERATOR_SYMBOLS: Record<string, TokenType> = {
  '=': 'EQUALS',
  '==': 'EQUALS',
  '!=': 'NOT_EQUALS',
  '<>': 'NOT_EQUALS',
  '>': 'GREATER_THAN',
  '<': 'LESS_THAN',
  '>=': 'GTE',
  '<=': 'LTE',
  ',': 'COMMA',
  '(': 'LPAREN',
  ')': 'RPAREN',
};

// ============================================================================
// QUERYABLE RELATIONS METADATA
// ============================================================================

/**
 * Detailed metadata about each queryable relation.
 * Used for documentation, validation, and autocomplete.
 */
export const RELATION_METADATA = {
  pages: {
    name: 'pages',
    displayName: 'Pages',
    description: 'Top-level note containers',
    columns: {
      page_id: { type: 'string', description: 'Unique page identifier (ULID)' },
      title: { type: 'string', description: 'Page title' },
      created_at: { type: 'timestamp', description: 'Creation timestamp' },
      updated_at: { type: 'timestamp', description: 'Last update timestamp' },
      is_deleted: { type: 'boolean', description: 'Soft delete flag' },
      daily_note_date: { type: 'string', description: 'Date for daily notes (YYYY-MM-DD)' },
    },
    defaultProjections: ['page_id', 'title'],
    availableAtLevel: [1, 2, 3] as const,
  },
  blocks: {
    name: 'blocks',
    displayName: 'Blocks',
    description: 'Content blocks within pages',
    columns: {
      block_id: { type: 'string', description: 'Unique block identifier (ULID)' },
      page_id: { type: 'string', description: 'Parent page ID' },
      parent_id: { type: 'string', description: 'Parent block ID (null for root)' },
      content: { type: 'string', description: 'Block content text' },
      content_type: { type: 'string', description: 'Type: text, heading, code, todo, query' },
      order: { type: 'string', description: 'Fractional index for ordering' },
      is_collapsed: { type: 'boolean', description: 'Collapsed state' },
      is_deleted: { type: 'boolean', description: 'Soft delete flag' },
      created_at: { type: 'timestamp', description: 'Creation timestamp' },
      updated_at: { type: 'timestamp', description: 'Last update timestamp' },
    },
    defaultProjections: ['block_id', 'content'],
    availableAtLevel: [1, 2, 3] as const,
  },
  links: {
    name: 'links',
    displayName: 'Links',
    description: 'Page-to-page connections',
    columns: {
      source_id: { type: 'string', description: 'Source page ID' },
      target_id: { type: 'string', description: 'Target page ID' },
      link_type: { type: 'string', description: 'Type: reference, embed, tag' },
      created_at: { type: 'timestamp', description: 'Creation timestamp' },
      context_block_id: { type: 'string', description: 'Block containing this link' },
    },
    defaultProjections: ['source_id', 'target_id'],
    availableAtLevel: [2, 3] as const,
  },
  tags: {
    name: 'tags',
    displayName: 'Tags',
    description: 'Tags on pages and blocks',
    columns: {
      entity_id: { type: 'string', description: 'Tagged entity ID (page or block)' },
      tag: { type: 'string', description: 'Tag name' },
      created_at: { type: 'timestamp', description: 'Creation timestamp' },
    },
    defaultProjections: ['entity_id', 'tag'],
    availableAtLevel: [1, 2, 3] as const,
  },
  properties: {
    name: 'properties',
    displayName: 'Properties',
    description: 'Key-value metadata on entities',
    columns: {
      entity_id: { type: 'string', description: 'Entity ID (page or block)' },
      key: { type: 'string', description: 'Property key' },
      value: { type: 'string', description: 'Property value' },
      value_type: { type: 'string', description: 'Type: string, number, boolean, date' },
      updated_at: { type: 'timestamp', description: 'Last update timestamp' },
    },
    defaultProjections: ['entity_id', 'key', 'value'],
    availableAtLevel: [2, 3] as const,
  },
  block_refs: {
    name: 'block_refs',
    displayName: 'Block References',
    description: 'Block-to-block references',
    columns: {
      source_block_id: { type: 'string', description: 'Referencing block ID' },
      target_block_id: { type: 'string', description: 'Referenced block ID' },
      created_at: { type: 'timestamp', description: 'Creation timestamp' },
    },
    defaultProjections: ['source_block_id', 'target_block_id'],
    availableAtLevel: [2, 3] as const,
  },
  daily_notes: {
    name: 'daily_notes',
    displayName: 'Daily Notes',
    description: 'Date to page mapping for daily notes',
    columns: {
      date: { type: 'string', description: 'Date string (YYYY-MM-DD)' },
      page_id: { type: 'string', description: 'Associated page ID' },
    },
    defaultProjections: ['date', 'page_id'],
    availableAtLevel: [1, 2, 3] as const,
  },
} as const;

// ============================================================================
// OPERATOR METADATA
// ============================================================================

/**
 * Detailed metadata about each filter operator.
 * Used for documentation, validation, and UI display.
 */
export const OPERATOR_METADATA = {
  equals: {
    symbol: '=',
    displayName: 'equals',
    description: 'Exact match',
    compatibleTypes: ['string', 'number', 'boolean'],
    dslAliases: ['equals', 'is', '=', '=='],
  },
  notEquals: {
    symbol: '!=',
    displayName: 'not equals',
    description: 'Not equal to',
    compatibleTypes: ['string', 'number', 'boolean'],
    dslAliases: ['not equals', '!=', '<>'],
  },
  contains: {
    symbol: 'contains',
    displayName: 'contains',
    description: 'Substring match',
    compatibleTypes: ['string'],
    dslAliases: ['contains'],
  },
  startsWith: {
    symbol: 'starts with',
    displayName: 'starts with',
    description: 'Prefix match',
    compatibleTypes: ['string'],
    dslAliases: ['starts with', 'startswith'],
  },
  endsWith: {
    symbol: 'ends with',
    displayName: 'ends with',
    description: 'Suffix match',
    compatibleTypes: ['string'],
    dslAliases: ['ends with', 'endswith'],
  },
  greaterThan: {
    symbol: '>',
    displayName: 'greater than',
    description: 'Greater than',
    compatibleTypes: ['number', 'timestamp'],
    dslAliases: ['greater than', 'greaterthan', '>'],
  },
  lessThan: {
    symbol: '<',
    displayName: 'less than',
    description: 'Less than',
    compatibleTypes: ['number', 'timestamp'],
    dslAliases: ['less than', 'lessthan', '<'],
  },
  greaterThanOrEqual: {
    symbol: '>=',
    displayName: 'greater than or equal',
    description: 'Greater than or equal to',
    compatibleTypes: ['number', 'timestamp'],
    dslAliases: ['gte', '>='],
  },
  lessThanOrEqual: {
    symbol: '<=',
    displayName: 'less than or equal',
    description: 'Less than or equal to',
    compatibleTypes: ['number', 'timestamp'],
    dslAliases: ['lte', '<='],
  },
  isNull: {
    symbol: 'is null',
    displayName: 'is null',
    description: 'Value is null',
    compatibleTypes: ['string', 'number', 'boolean', 'timestamp'],
    dslAliases: ['is null'],
    isUnary: true,
  },
  isNotNull: {
    symbol: 'is not null',
    displayName: 'is not null',
    description: 'Value is not null',
    compatibleTypes: ['string', 'number', 'boolean', 'timestamp'],
    dslAliases: ['is not null'],
    isUnary: true,
  },
  hasTag: {
    symbol: 'tagged',
    displayName: 'tagged',
    description: 'Has a specific tag',
    compatibleTypes: ['string'],
    dslAliases: ['tagged'],
    isGraphOperator: true,
  },
  linkedTo: {
    symbol: 'linked to',
    displayName: 'linked to',
    description: 'Links to another page',
    compatibleTypes: ['string'],
    dslAliases: ['linked to'],
    isGraphOperator: true,
  },
  linkedFrom: {
    symbol: 'linked from',
    displayName: 'linked from',
    description: 'Linked from another page',
    compatibleTypes: ['string'],
    dslAliases: ['linked from'],
    isGraphOperator: true,
  },
  hasProperty: {
    symbol: 'has property',
    displayName: 'has property',
    description: 'Has a property with given key',
    compatibleTypes: ['string'],
    dslAliases: ['has property'],
    isGraphOperator: true,
  },
} as const;

// ============================================================================
// COZOSCRIPT TRANSPILATION PATTERNS
// ============================================================================

/**
 * Templates for transpiling QueryAST to CozoScript.
 * These patterns use placeholders that get replaced during transpilation.
 */
export const TRANSPILE_PATTERNS = {
  /**
   * Basic find query pattern
   * {projections} - comma-separated column list
   * {relation} - relation name
   * {bindings} - column bindings in the relation
   * {filters} - filter conditions
   */
  find: `?[{projections}] := *{relation}{ {bindings} }{filters}`,

  /**
   * Count query pattern
   * {countColumn} - column to count
   * {relation} - relation name
   * {bindings} - column bindings
   * {filters} - filter conditions
   */
  count: `?[count({countColumn})] := *{relation}{ {bindings} }{filters}`,

  /**
   * Graph query pattern (for visualization)
   * {filters} - filter conditions
   */
  graph: `?[src, dst] := *pages{ page_id: src, title, is_deleted: false }{filters}, *links{ source_id: src, target_id: dst }`,

  /**
   * Filter patterns by operator
   */
  filters: {
    equals: '{field} == ${param}',
    notEquals: '{field} != ${param}',
    contains: 'contains({field}, ${param})',
    startsWith: 'starts_with({field}, ${param})',
    endsWith: 'ends_with({field}, ${param})',
    greaterThan: '{field} > ${param}',
    lessThan: '{field} < ${param}',
    greaterThanOrEqual: '{field} >= ${param}',
    lessThanOrEqual: '{field} <= ${param}',
    isNull: 'is_null({field})',
    isNotNull: '!is_null({field})',
  },

  /**
   * Order by pattern
   * {direction} - empty for asc, '-' for desc
   * {field} - column name
   */
  orderBy: `:order {direction}{field}`,

  /**
   * Limit pattern
   */
  limit: `:limit {limit}`,

  /**
   * Offset pattern
   */
  offset: `:offset {offset}`,
} as const;

// ============================================================================
// GRAMMAR VALIDATION HELPERS
// ============================================================================

/**
 * Check if a string is a valid query type keyword
 */
export function isQueryTypeKeyword(word: string): boolean {
  const normalized = word.toLowerCase();
  return normalized === 'find' || normalized === 'count' || normalized === 'graph';
}

/**
 * Check if a string is a valid relation keyword
 */
export function isRelationKeyword(word: string): boolean {
  const normalized = word.toLowerCase().replace(/[_\s]/g, '');
  const validRelations = [
    'pages',
    'page',
    'blocks',
    'block',
    'links',
    'link',
    'tags',
    'tag',
    'properties',
    'property',
    'blockrefs',
    'dailynotes',
  ];
  return validRelations.includes(normalized);
}

/**
 * Normalize a relation keyword to its canonical form
 */
export function normalizeRelation(word: string): string {
  const normalized = word.toLowerCase().replace(/[_\s]/g, '');
  const mapping: Record<string, string> = {
    pages: 'pages',
    page: 'pages',
    blocks: 'blocks',
    block: 'blocks',
    links: 'links',
    link: 'links',
    tags: 'tags',
    tag: 'tags',
    properties: 'properties',
    property: 'properties',
    blockrefs: 'block_refs',
    dailynotes: 'daily_notes',
  };
  return mapping[normalized] ?? word;
}

/**
 * Get the canonical column name for a relation
 */
export function getIdColumn(relation: string): string {
  const idColumns: Record<string, string> = {
    pages: 'page_id',
    blocks: 'block_id',
    links: 'source_id',
    tags: 'entity_id',
    properties: 'entity_id',
    block_refs: 'source_block_id',
    daily_notes: 'date',
  };
  return idColumns[relation] ?? 'id';
}
