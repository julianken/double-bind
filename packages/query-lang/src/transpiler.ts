// @double-bind/query-lang - Transpiler: QueryAST -> CozoScript
//
// This module converts the QueryAST (from the parser or visual builder)
// into valid CozoScript (Datalog) queries. It handles:
// - Secure parameterization (all values are parameterized)
// - All filter operators (equals, contains, startsWith, etc.)
// - Graph-specific operators (hasTag, linkedTo, linkedFrom)
// - Aggregations (count, sum, avg, min, max)
// - Graph algorithms (page_rank, communities, shortest_path)
// - Sorting, limiting, and offset

import type {
  QueryAST,
  CompiledQuery,
  Filter,
  FilterOperator,
  FilterValue,
  QueryableRelation,
} from './types.js';

import {
  isQueryableRelation,
  RELATION_COLUMNS,
  DEFAULT_PROJECTIONS,
  isUnaryOperator,
} from './types.js';

import { parseQuery } from './parser.js';
import { getIdColumn } from './grammar.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Internal context for building queries
 */
interface TranspileContext {
  /** Parameter counter for unique naming */
  paramCounter: number;
  /** Accumulated parameters */
  params: Record<string, unknown>;
  /** Variables bound in the query */
  boundVars: Set<string>;
}

/**
 * Options for graph algorithm transpilation
 */
export interface GraphAlgorithmOptions {
  /** Algorithm name: 'page_rank', 'communities', 'shortest_path' */
  algorithm: 'page_rank' | 'communities' | 'shortest_path';
  /** Source node for shortest_path */
  sourceId?: string;
  /** Target node for shortest_path */
  targetId?: string;
  /** Edge relation (defaults to 'links') */
  edgeRelation?: string;
  /** Source column name (defaults to 'source_id') */
  sourceColumn?: string;
  /** Target column name (defaults to 'target_id') */
  targetColumn?: string;
  /** Maximum iterations for iterative algorithms */
  maxIterations?: number;
}

/**
 * Options for aggregation transpilation
 */
export interface AggregationOptions {
  /** Aggregation function: 'count', 'sum', 'avg', 'min', 'max' */
  function: 'count' | 'sum' | 'avg' | 'min' | 'max';
  /** Column to aggregate */
  column: string;
  /** Group by columns */
  groupBy?: string[];
}

// ============================================================================
// RELATION METADATA
// ============================================================================

/**
 * Get the primary ID column for a relation
 */
function getPrimaryIdColumn(relation: string): string {
  return getIdColumn(relation);
}

// ============================================================================
// PARAMETER HELPERS
// ============================================================================

/**
 * Create a new parameter name and add to context
 */
function addParam(ctx: TranspileContext, value: unknown, prefix = 'p'): string {
  const paramName = `${prefix}_${ctx.paramCounter++}`;
  ctx.params[paramName] = value;
  return paramName;
}

/**
 * Validate that a value is safe for parameterization
 */
function validateParamValue(value: FilterValue): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    // Ensure number is finite
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return false;
    }
    return true;
  }
  if (typeof value === 'string') {
    // Strings are always valid (will be parameterized)
    return true;
  }
  return false;
}

// ============================================================================
// FILTER TRANSPILATION
// ============================================================================

/**
 * Map of operators to CozoScript expressions
 */
const OPERATOR_TEMPLATES: Record<FilterOperator, (field: string, param: string) => string> = {
  equals: (field, param) => `${field} == $${param}`,
  notEquals: (field, param) => `${field} != $${param}`,
  contains: (field, param) => `contains(${field}, $${param})`,
  startsWith: (field, param) => `starts_with(${field}, $${param})`,
  endsWith: (field, param) => `ends_with(${field}, $${param})`,
  greaterThan: (field, param) => `${field} > $${param}`,
  lessThan: (field, param) => `${field} < $${param}`,
  greaterThanOrEqual: (field, param) => `${field} >= $${param}`,
  lessThanOrEqual: (field, param) => `${field} <= $${param}`,
  isNull: (field) => `is_null(${field})`,
  isNotNull: (field) => `!is_null(${field})`,
  // Graph operators are handled specially in transpileGraphFilter
  hasTag: (_field, param) => `tag == $${param}`,
  linkedTo: (_field, param) => `target_title == $${param}`,
  linkedFrom: (_field, param) => `source_title == $${param}`,
  hasProperty: (_field, param) => `key == $${param}`,
};

/**
 * Transpile a single filter condition to CozoScript
 */
function transpileFilter(
  filter: Filter,
  ctx: TranspileContext
): string {
  const { field, operator, value } = filter;

  // Validate the value
  if (!validateParamValue(value)) {
    throw new Error(`Invalid filter value for field "${field}": ${value}`);
  }

  // Unary operators don't need a parameter
  if (isUnaryOperator(operator)) {
    const template = OPERATOR_TEMPLATES[operator];
    return template(field, '');
  }

  // Create parameter for the value
  const paramName = addParam(ctx, value, 'filter');

  const template = OPERATOR_TEMPLATES[operator];
  if (!template) {
    throw new Error(`Unknown operator: ${operator}`);
  }

  return template(field, paramName);
}

/**
 * Transpile graph-specific filter (hasTag, linkedTo, linkedFrom, hasProperty)
 * These require additional joins
 */
function transpileGraphFilter(
  filter: Filter,
  relation: string,
  ctx: TranspileContext
): { joinClause: string; filterClause: string } | null {
  const { operator, value } = filter;
  const idColumn = getPrimaryIdColumn(relation);

  switch (operator) {
    case 'hasTag': {
      const paramName = addParam(ctx, value, 'tag');
      return {
        joinClause: `*tags{ entity_id: ${idColumn}, tag }`,
        filterClause: `tag == $${paramName}`,
      };
    }

    case 'linkedTo': {
      // Find pages that link TO the specified page
      const paramName = addParam(ctx, value, 'target');
      return {
        joinClause: `*pages{ page_id: link_target_id, title: link_target_title, is_deleted: false }, *links{ source_id: ${idColumn}, target_id: link_target_id }`,
        filterClause: `link_target_title == $${paramName}`,
      };
    }

    case 'linkedFrom': {
      // Find pages that are linked FROM the specified page
      const paramName = addParam(ctx, value, 'source');
      return {
        joinClause: `*pages{ page_id: link_source_id, title: link_source_title, is_deleted: false }, *links{ source_id: link_source_id, target_id: ${idColumn} }`,
        filterClause: `link_source_title == $${paramName}`,
      };
    }

    case 'hasProperty': {
      const paramName = addParam(ctx, value, 'prop_key');
      return {
        joinClause: `*properties{ entity_id: ${idColumn}, key }`,
        filterClause: `key == $${paramName}`,
      };
    }

    default:
      return null;
  }
}

// ============================================================================
// QUERY TRANSPILATION
// ============================================================================

/**
 * Transpile a find query
 */
function transpileFindQuery(ast: QueryAST, ctx: TranspileContext): string {
  const { relation, filters, projections, orderBy, limit, offset } = ast;

  // Separate graph filters from regular filters
  const graphFilters: Filter[] = [];
  const regularFilters: Filter[] = [];

  for (const filter of filters) {
    if (['hasTag', 'linkedTo', 'linkedFrom', 'hasProperty'].includes(filter.operator)) {
      graphFilters.push(filter);
    } else {
      regularFilters.push(filter);
    }
  }

  // Build projections
  const effectiveProjections =
    projections.length > 0
      ? projections
      : (DEFAULT_PROJECTIONS[relation as QueryableRelation] as readonly string[]) ?? [];
  const projectionList = [...effectiveProjections].join(', ');

  // Build relation binding
  const bindingsSet = new Set(effectiveProjections);

  // Add fields used in filters to bindings
  for (const filter of regularFilters) {
    bindingsSet.add(filter.field);
  }

  // Add order by field if not in projections
  if (orderBy && !bindingsSet.has(orderBy.field)) {
    bindingsSet.add(orderBy.field);
  }

  // Get relation columns and filter to valid ones
  const relationCols = RELATION_COLUMNS[relation as QueryableRelation] ?? [];
  const validBindings = [...bindingsSet].filter((b) => relationCols.includes(b));

  // Check if relation has is_deleted and add it
  if (relationCols.includes('is_deleted')) {
    validBindings.push('is_deleted: false');
  }

  // Build the main clause
  let script = `?[${projectionList}] := *${relation}{ ${validBindings.join(', ')} }`;

  // Add graph filter joins
  for (const filter of graphFilters) {
    const graphClause = transpileGraphFilter(filter, relation, ctx);
    if (graphClause) {
      script += `, ${graphClause.joinClause}, ${graphClause.filterClause}`;
    }
  }

  // Add regular filter conditions
  for (const filter of regularFilters) {
    const filterExpr = transpileFilter(filter, ctx);
    script += `, ${filterExpr}`;
  }

  // Add modifiers
  if (orderBy) {
    const direction = orderBy.direction === 'desc' ? '-' : '';
    script += ` :order ${direction}${orderBy.field}`;
  }

  if (limit !== undefined) {
    script += ` :limit ${limit}`;
  }

  if (offset !== undefined) {
    script += ` :offset ${offset}`;
  }

  return script;
}

/**
 * Transpile a count query
 */
function transpileCountQuery(ast: QueryAST, ctx: TranspileContext): string {
  const { relation, filters } = ast;
  const idColumn = getPrimaryIdColumn(relation);

  // Separate graph filters from regular filters
  const graphFilters: Filter[] = [];
  const regularFilters: Filter[] = [];

  for (const filter of filters) {
    if (['hasTag', 'linkedTo', 'linkedFrom', 'hasProperty'].includes(filter.operator)) {
      graphFilters.push(filter);
    } else {
      regularFilters.push(filter);
    }
  }

  // Build bindings - need at least the ID column
  const bindingsSet = new Set([idColumn]);

  // Add fields used in filters
  for (const filter of regularFilters) {
    bindingsSet.add(filter.field);
  }

  // Get relation columns and filter to valid ones
  const relationCols = RELATION_COLUMNS[relation as QueryableRelation] ?? [];
  const validBindings = [...bindingsSet].filter((b) => relationCols.includes(b));

  // Check if relation has is_deleted
  if (relationCols.includes('is_deleted')) {
    validBindings.push('is_deleted: false');
  }

  // Build the main clause with count aggregation
  let script = `?[count(${idColumn})] := *${relation}{ ${validBindings.join(', ')} }`;

  // Add graph filter joins
  for (const filter of graphFilters) {
    const graphClause = transpileGraphFilter(filter, relation, ctx);
    if (graphClause) {
      script += `, ${graphClause.joinClause}, ${graphClause.filterClause}`;
    }
  }

  // Add regular filter conditions
  for (const filter of regularFilters) {
    const filterExpr = transpileFilter(filter, ctx);
    script += `, ${filterExpr}`;
  }

  return script;
}

/**
 * Transpile a graph query (for visualization)
 */
function transpileGraphQuery(ast: QueryAST, ctx: TranspileContext): string {
  const { relation, filters, limit } = ast;

  // Graph queries return src/dst pairs for visualization
  // Separate graph filters from regular filters
  const graphFilters: Filter[] = [];
  const regularFilters: Filter[] = [];

  for (const filter of filters) {
    if (['hasTag', 'linkedTo', 'linkedFrom', 'hasProperty'].includes(filter.operator)) {
      graphFilters.push(filter);
    } else {
      regularFilters.push(filter);
    }
  }

  // Build bindings for the pages relation
  const bindingsSet = new Set(['page_id', 'title']);

  // Add fields used in filters
  for (const filter of regularFilters) {
    bindingsSet.add(filter.field);
  }

  // Get relation columns and filter to valid ones
  const relationCols = RELATION_COLUMNS[relation as QueryableRelation] ?? [];
  const validBindings = [...bindingsSet].filter((b) => relationCols.includes(b));

  // Check if relation has is_deleted
  if (relationCols.includes('is_deleted')) {
    validBindings.push('is_deleted: false');
  }

  // Build graph query with edges
  let script = `?[src, dst] := *${relation}{ ${validBindings.join(', ').replace('page_id', 'page_id: src')} }`;

  // Add link join for graph visualization
  script += `, *links{ source_id: src, target_id: dst }`;

  // Add graph filter joins
  for (const filter of graphFilters) {
    const graphClause = transpileGraphFilter(filter, relation, ctx);
    if (graphClause) {
      script += `, ${graphClause.joinClause.replace(/page_id/g, 'src')}, ${graphClause.filterClause}`;
    }
  }

  // Add regular filter conditions
  for (const filter of regularFilters) {
    const filterExpr = transpileFilter(filter, ctx);
    script += `, ${filterExpr}`;
  }

  // Depth is represented as limit
  if (limit !== undefined) {
    script += ` :limit ${limit}`;
  }

  return script;
}

// ============================================================================
// GRAPH ALGORITHMS
// ============================================================================

/**
 * Transpile a PageRank query
 */
export function transpilePageRank(options: Partial<GraphAlgorithmOptions> = {}): CompiledQuery {
  const {
    edgeRelation = 'links',
    sourceColumn = 'source_id',
    targetColumn = 'target_id',
  } = options;

  const script = `rank[node, score] <~ PageRank(*${edgeRelation}[${sourceColumn}, ${targetColumn}])
?[page_id, title, score] :=
    rank[page_id, score],
    *pages{ page_id, title, is_deleted: false }
:order -score`;

  return { script, params: {} };
}

/**
 * Transpile a community detection query (Louvain algorithm)
 */
export function transpileCommunities(options: Partial<GraphAlgorithmOptions> = {}): CompiledQuery {
  const {
    edgeRelation = 'links',
    sourceColumn = 'source_id',
    targetColumn = 'target_id',
  } = options;

  const script = `community[node, group] <~ CommunityDetectionLouvain(*${edgeRelation}[${sourceColumn}, ${targetColumn}])
?[page_id, title, community] :=
    community[page_id, community],
    *pages{ page_id, title, is_deleted: false }`;

  return { script, params: {} };
}

/**
 * Transpile a shortest path query
 */
export function transpileShortestPath(
  sourceId: string,
  targetId?: string,
  options: Partial<GraphAlgorithmOptions> = {}
): CompiledQuery {
  const {
    edgeRelation = 'links',
    sourceColumn = 'source_id',
    targetColumn = 'target_id',
  } = options;

  const params: Record<string, unknown> = { source_id: sourceId };

  let script: string;
  if (targetId) {
    params.target_id = targetId;
    script = `?[src, dst, dist] <~ ShortestPathDijkstra(*${edgeRelation}[${sourceColumn}, ${targetColumn}], $source_id, $target_id)`;
  } else {
    script = `?[src, dst, dist] <~ ShortestPathDijkstra(*${edgeRelation}[${sourceColumn}, ${targetColumn}], $source_id)`;
  }

  return { script, params };
}

// ============================================================================
// AGGREGATIONS
// ============================================================================

/**
 * Transpile an aggregation query
 */
export function transpileAggregation(
  relation: string,
  aggregation: AggregationOptions,
  filters: Filter[] = []
): CompiledQuery {
  if (!isQueryableRelation(relation)) {
    throw new Error(`Unknown relation: ${relation}`);
  }

  const ctx: TranspileContext = {
    paramCounter: 0,
    params: {},
    boundVars: new Set(),
  };

  const { function: aggFunc, column, groupBy = [] } = aggregation;

  // Build the output columns
  const outputCols = [...groupBy];
  const aggExpr = `${aggFunc}(${column})`;
  outputCols.push(aggExpr);

  // Build bindings
  const bindingsSet = new Set([column, ...groupBy]);

  // Add fields used in filters
  for (const filter of filters) {
    bindingsSet.add(filter.field);
  }

  // Get relation columns and filter to valid ones
  const relationCols = RELATION_COLUMNS[relation as QueryableRelation] ?? [];
  const validBindings = [...bindingsSet].filter((b) => relationCols.includes(b));

  // Check if relation has is_deleted
  if (relationCols.includes('is_deleted')) {
    validBindings.push('is_deleted: false');
  }

  // Build the query
  let script = `?[${outputCols.join(', ')}] := *${relation}{ ${validBindings.join(', ')} }`;

  // Add filter conditions
  for (const filter of filters) {
    const filterExpr = transpileFilter(filter, ctx);
    script += `, ${filterExpr}`;
  }

  return { script, params: ctx.params };
}

// ============================================================================
// MAIN TRANSPILER
// ============================================================================

/**
 * Convert a QueryAST to parameterized CozoScript
 *
 * @param ast - The parsed QueryAST
 * @returns The CozoScript and parameter bindings
 *
 * @example
 * ```typescript
 * const ast = parseQuery("find pages where title contains 'meeting'");
 * const compiled = transpileToCozo(ast);
 * // compiled.script: "?[page_id, title] := *pages{ page_id, title, is_deleted: false }, contains(title, $filter_0)"
 * // compiled.params: { filter_0: "meeting" }
 * ```
 */
export function transpileToCozo(ast: QueryAST): CompiledQuery {
  // Validate AST structure
  if (!ast || typeof ast !== 'object') {
    throw new Error('Invalid AST: must be an object');
  }

  if (!ast.type) {
    throw new Error('Invalid AST: missing type field');
  }

  if (!ast.relation) {
    throw new Error('Invalid AST: missing relation field');
  }

  if (!isQueryableRelation(ast.relation)) {
    throw new Error(`Invalid AST: unknown relation "${ast.relation}"`);
  }

  // Create transpilation context
  const ctx: TranspileContext = {
    paramCounter: 0,
    params: {},
    boundVars: new Set(),
  };

  // Transpile based on query type
  let script: string;

  switch (ast.type) {
    case 'find':
      script = transpileFindQuery(ast, ctx);
      break;

    case 'count':
      script = transpileCountQuery(ast, ctx);
      break;

    case 'graph':
      script = transpileGraphQuery(ast, ctx);
      break;

    default:
      throw new Error(`Unknown query type: ${ast.type}`);
  }

  return {
    script,
    params: ctx.params,
  };
}

/**
 * Parse and compile a user-friendly query string directly to CozoScript
 *
 * @param input - The user-friendly query string
 * @returns The CozoScript and parameter bindings
 *
 * @example
 * ```typescript
 * const compiled = compileQuery("find pages where title contains 'meeting' limit 10");
 * // compiled.script: "?[page_id, title] := *pages{ page_id, title, is_deleted: false }, contains(title, $filter_0) :limit 10"
 * // compiled.params: { filter_0: "meeting" }
 * ```
 */
export function compileQuery(input: string): CompiledQuery {
  const ast = parseQuery(input);
  return transpileToCozo(ast);
}
