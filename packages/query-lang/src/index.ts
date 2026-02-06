// @double-bind/query-lang - Progressive disclosure query system
// Parses user-friendly query syntax and transpiles to CozoScript
//
// This package implements CS Contribution #1: Datalog as a user-facing query language.
// It provides three progressive disclosure levels:
//   Level 1 - Templates: Pre-built parameterized queries
//   Level 2 - Visual Builder: Form-based query construction with DSL
//   Level 3 - Raw Datalog: Direct CozoScript editing

// ============================================================================
// TYPES
// ============================================================================

// Core types
export type {
  QueryType,
  FilterOperator,
  Filter,
  FilterGroup,
  FilterGroupOperator,
  FilterValue,
  QueryAST,
  CompiledQuery,
  OrderBy,
  SortDirection,
  Pagination,
} from './types.js';

// Progressive disclosure types
export type { QueryLevel, QueryMetadata, QueryableRelation } from './types.js';

// Validation types
export type {
  ValidationError,
  ValidationResult,
  QueryErrorCode,
  ErrorSeverity,
} from './types.js';

// Template types
export type {
  TemplateParamType,
  TemplateParam,
  QueryTemplate,
  TemplateCategory,
} from './types.js';

// Visual builder types
export type { FieldOption, OperatorOption, VisualBuilderConfig } from './types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

// Relation and column metadata
export {
  RELATION_COLUMNS,
  DEFAULT_PROJECTIONS,
  UNARY_OPERATORS,
  GRAPH_OPERATORS,
  ERROR_MESSAGES,
} from './types.js';

// ============================================================================
// FUNCTIONS
// ============================================================================

// Type guards and validators
export {
  isQueryType,
  isQueryableRelation,
  isFilterOperator,
  isUnaryOperator,
  isGraphOperator,
  isFilterGroup,
  isValidColumn,
  createError,
} from './types.js';

// ============================================================================
// GRAMMAR
// ============================================================================

// Grammar specification
export { GRAMMAR_PEG, GRAMMAR_EXAMPLES } from './grammar.js';

// Token types
export type { TokenType, Token } from './grammar.js';

// Grammar constants
export {
  KEYWORDS,
  OPERATOR_SYMBOLS,
  RELATION_METADATA,
  OPERATOR_METADATA,
  TRANSPILE_PATTERNS,
} from './grammar.js';

// Grammar helpers
export {
  isQueryTypeKeyword,
  isRelationKeyword,
  normalizeRelation,
  getIdColumn,
} from './grammar.js';

// ============================================================================
// PARSER
// ============================================================================

export { parseQuery, ParseError } from './parser.js';

// ============================================================================
// TRANSPILER
// ============================================================================

export {
  transpileToCozo,
  compileQuery,
  transpilePageRank,
  transpileCommunities,
  transpileShortestPath,
  transpileAggregation,
} from './transpiler.js';

export type { GraphAlgorithmOptions, AggregationOptions } from './transpiler.js';

// ============================================================================
// VALIDATOR
// ============================================================================

export { validateCozoScript } from './validator.js';

// ============================================================================
// TEMPLATES
// ============================================================================

export {
  getTemplates,
  getTemplate,
  applyTemplate,
  registerTemplate,
  unregisterTemplate,
  getTemplatesByCategory,
  searchTemplates,
  validateTemplateParams,
  getTemplateCount,
  resetTemplates,
  ALL_TEMPLATES,
  pagesModifiedInLastNDays,
  pagesLinkingTo,
  orphanPages,
  blocksWithTag,
  pagesWithTag,
  recentPages,
  pagesLinkedFrom,
  searchPagesByTitle,
  blocksContainingText,
  dailyNotesInRange,
} from './templates/index.js';
