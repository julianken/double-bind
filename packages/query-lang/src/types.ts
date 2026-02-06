// @double-bind/query-lang - Type definitions for the query language
//
// This module defines the complete type system for the progressive disclosure
// query system (CS Contribution #1). The types support three levels:
//   Level 1 - Templates: Pre-built parameterized queries
//   Level 2 - Visual Builder: Form-based query construction
//   Level 3 - Raw Datalog: Direct CozoScript editing

// ============================================================================
// PROGRESSIVE DISCLOSURE LEVELS
// ============================================================================

/**
 * The three progressive disclosure levels for query complexity.
 *
 * Level 1 (Templates): Pre-built queries with form fields for parameters.
 * Level 2 (Visual Builder): Pick relations, filters, projections via forms.
 * Level 3 (Raw Datalog): Direct CozoScript editing with syntax highlighting.
 */
export type QueryLevel = 1 | 2 | 3;

/**
 * Metadata about which disclosure level a query originates from
 */
export interface QueryMetadata {
  /** The disclosure level this query was created at */
  level: QueryLevel;
  /** Original input (Level 2 DSL string or template ID for Level 1) */
  originalInput?: string;
  /** Timestamp when the query was created */
  createdAt?: number;
}

// ============================================================================
// QUERY AST CORE TYPES
// ============================================================================

/**
 * Query types supported by the parser.
 *
 * - 'find': Returns matching entities (SELECT equivalent)
 * - 'count': Returns count of matching entities
 * - 'graph': Returns graph structure (for visualization)
 */
export type QueryType = 'find' | 'count' | 'graph';

/**
 * Supported relations (tables) that can be queried.
 * Maps to CozoDB relations defined in the schema.
 */
export type QueryableRelation =
  | 'pages'
  | 'blocks'
  | 'links'
  | 'tags'
  | 'properties'
  | 'block_refs'
  | 'daily_notes';

/**
 * Column names available for each relation.
 * Used for validation and autocomplete.
 */
export const RELATION_COLUMNS: Record<QueryableRelation, readonly string[]> = {
  pages: ['page_id', 'title', 'created_at', 'updated_at', 'is_deleted', 'daily_note_date'],
  blocks: [
    'block_id',
    'page_id',
    'parent_id',
    'content',
    'content_type',
    'order',
    'is_collapsed',
    'is_deleted',
    'created_at',
    'updated_at',
  ],
  links: ['source_id', 'target_id', 'link_type', 'created_at', 'context_block_id'],
  tags: ['entity_id', 'tag', 'created_at'],
  properties: ['entity_id', 'key', 'value', 'value_type', 'updated_at'],
  block_refs: ['source_block_id', 'target_block_id', 'created_at'],
  daily_notes: ['date', 'page_id'],
} as const;

/**
 * Default projections for each relation when none specified.
 */
export const DEFAULT_PROJECTIONS: Record<QueryableRelation, readonly string[]> = {
  pages: ['page_id', 'title'],
  blocks: ['block_id', 'content'],
  links: ['source_id', 'target_id'],
  tags: ['entity_id', 'tag'],
  properties: ['entity_id', 'key', 'value'],
  block_refs: ['source_block_id', 'target_block_id'],
  daily_notes: ['date', 'page_id'],
} as const;

// ============================================================================
// FILTER TYPES
// ============================================================================

/**
 * Filter operators for query conditions.
 *
 * Basic comparisons:
 * - equals: Exact match (=)
 * - notEquals: Not equal (!=)
 * - contains: Substring match (contains/like)
 * - startsWith: Prefix match
 * - endsWith: Suffix match
 *
 * Numeric comparisons:
 * - greaterThan: Greater than (>)
 * - lessThan: Less than (<)
 * - greaterThanOrEqual: Greater than or equal (>=)
 * - lessThanOrEqual: Less than or equal (<=)
 *
 * Existence checks:
 * - isNull: Value is null
 * - isNotNull: Value is not null
 *
 * Graph-specific:
 * - hasTag: Entity has a specific tag
 * - linkedTo: Page links to another page
 * - linkedFrom: Page is linked from another page
 * - hasProperty: Entity has a property with given key
 */
export type FilterOperator =
  // Basic comparisons
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  // Numeric comparisons
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  // Existence checks
  | 'isNull'
  | 'isNotNull'
  // Graph-specific
  | 'hasTag'
  | 'linkedTo'
  | 'linkedFrom'
  | 'hasProperty';

/**
 * Operators that don't require a value (unary operators)
 */
export const UNARY_OPERATORS: readonly FilterOperator[] = ['isNull', 'isNotNull'] as const;

/**
 * Operators that work with graph relationships
 */
export const GRAPH_OPERATORS: readonly FilterOperator[] = [
  'hasTag',
  'linkedTo',
  'linkedFrom',
  'hasProperty',
] as const;

/**
 * Filter value types
 */
export type FilterValue = string | number | boolean | null;

/**
 * A single filter condition in a query.
 *
 * @example
 * // title contains "meeting"
 * { field: 'title', operator: 'contains', value: 'meeting' }
 *
 * @example
 * // created after 2024-01-01
 * { field: 'created_at', operator: 'greaterThan', value: 1704067200000 }
 *
 * @example
 * // has tag "important"
 * { field: 'tag', operator: 'hasTag', value: 'important' }
 */
export interface Filter {
  /** The field/column to filter on */
  field: string;
  /** The comparison operator */
  operator: FilterOperator;
  /** The value to compare against (null for unary operators) */
  value: FilterValue;
  /** Whether this filter is negated (NOT) */
  negated?: boolean;
}

/**
 * Logical grouping of filters (AND/OR)
 */
export type FilterGroupOperator = 'and' | 'or';

/**
 * A group of filters combined with a logical operator.
 * Supports nested groups for complex conditions.
 */
export interface FilterGroup {
  operator: FilterGroupOperator;
  conditions: (Filter | FilterGroup)[];
}

// ============================================================================
// ORDER BY AND PAGINATION
// ============================================================================

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Order by clause for query results
 */
export interface OrderBy {
  field: string;
  direction: SortDirection;
}

/**
 * Pagination options
 */
export interface Pagination {
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip (for offset pagination) */
  offset?: number;
}

// ============================================================================
// QUERY AST
// ============================================================================

/**
 * Abstract Syntax Tree for parsed queries.
 *
 * This is the intermediate representation used between the user-facing DSL
 * (Level 2) and the CozoScript output. It can also be constructed directly
 * by the Visual Builder UI.
 *
 * @example
 * // "find pages where title contains 'meeting'"
 * {
 *   type: 'find',
 *   relation: 'pages',
 *   filters: [{ field: 'title', operator: 'contains', value: 'meeting' }],
 *   projections: ['page_id', 'title'],
 * }
 *
 * @example
 * // "count blocks"
 * {
 *   type: 'count',
 *   relation: 'blocks',
 *   filters: [],
 *   projections: [],
 * }
 */
export interface QueryAST {
  /** The query type (find, count, graph) */
  type: QueryType;
  /** The relation being queried (pages, blocks, etc.) */
  relation: string;
  /** Filter conditions */
  filters: Filter[];
  /** Advanced filter groups (optional, for complex AND/OR logic) */
  filterGroups?: FilterGroup[];
  /** Column names to return */
  projections: string[];
  /** Optional ordering */
  orderBy?: OrderBy;
  /** Optional result limit */
  limit?: number;
  /** Optional result offset (for pagination) */
  offset?: number;
  /** Metadata about the query origin */
  metadata?: QueryMetadata;
}

// ============================================================================
// COMPILED QUERY OUTPUT
// ============================================================================

/**
 * Result of compiling a query to CozoScript.
 * Uses parameterized queries to prevent injection attacks.
 */
export interface CompiledQuery {
  /** The parameterized CozoScript query string */
  script: string;
  /** Parameter values keyed by placeholder name */
  params: Record<string, unknown>;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Error severity levels
 */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * A single validation error with helpful context.
 * Designed to provide actionable feedback to users.
 */
export interface ValidationError {
  /** Human-readable error message */
  message: string;
  /** Line number where the error occurred (1-indexed) */
  line?: number;
  /** Column number where the error starts (1-indexed) */
  column?: number;
  /** Length of the error span for highlighting */
  length?: number;
  /** Suggested fix or next step */
  suggestion?: string;
  /** Error code for programmatic handling */
  code?: QueryErrorCode;
  /** Error severity */
  severity?: ErrorSeverity;
}

/**
 * Result of validating a CozoScript query.
 */
export interface ValidationResult {
  /** Whether the query is valid */
  valid: boolean;
  /** List of validation errors (empty if valid) */
  errors: ValidationError[];
  /** Warnings that don't prevent execution */
  warnings?: ValidationError[];
}

// ============================================================================
// ERROR CODES AND MESSAGES
// ============================================================================

/**
 * Error codes for query validation failures.
 * Each code maps to a specific error condition with a helpful message.
 */
export type QueryErrorCode =
  // Syntax errors
  | 'EMPTY_QUERY'
  | 'INVALID_QUERY_TYPE'
  | 'MISSING_RELATION'
  | 'INVALID_SYNTAX'
  | 'UNCLOSED_STRING'
  | 'UNCLOSED_PARENTHESIS'
  // Semantic errors
  | 'UNKNOWN_RELATION'
  | 'UNKNOWN_COLUMN'
  | 'INVALID_OPERATOR'
  | 'TYPE_MISMATCH'
  | 'INVALID_FILTER_VALUE'
  // Graph-specific errors
  | 'INVALID_LINK_REFERENCE'
  | 'CIRCULAR_REFERENCE'
  // CozoScript errors
  | 'INVALID_COZOSCRIPT_SYNTAX'
  | 'INJECTION_DETECTED'
  | 'UNSUPPORTED_OPERATION';

/**
 * Detailed error messages with suggestions for each error code.
 * Used to provide consistent, helpful feedback across all error types.
 */
export const ERROR_MESSAGES: Record<
  QueryErrorCode,
  { message: string; suggestion: string }
> = {
  // Syntax errors
  EMPTY_QUERY: {
    message: 'Query cannot be empty',
    suggestion: 'Start with a query type: find, count, or graph',
  },
  INVALID_QUERY_TYPE: {
    message: 'Invalid query type',
    suggestion: 'Query must start with "find", "count", or "graph"',
  },
  MISSING_RELATION: {
    message: 'Missing relation name',
    suggestion: 'Specify what to query: pages, blocks, links, tags, or properties',
  },
  INVALID_SYNTAX: {
    message: 'Invalid query syntax',
    suggestion: 'Check the query format: "find <relation> [where <condition>]"',
  },
  UNCLOSED_STRING: {
    message: 'Unclosed string literal',
    suggestion: 'Add a closing quote to complete the string',
  },
  UNCLOSED_PARENTHESIS: {
    message: 'Unclosed parenthesis',
    suggestion: 'Add a closing parenthesis to complete the expression',
  },

  // Semantic errors
  UNKNOWN_RELATION: {
    message: 'Unknown relation',
    suggestion: 'Valid relations are: pages, blocks, links, tags, properties, block_refs, daily_notes',
  },
  UNKNOWN_COLUMN: {
    message: 'Unknown column',
    suggestion: 'Check the available columns for this relation',
  },
  INVALID_OPERATOR: {
    message: 'Invalid filter operator',
    suggestion:
      'Valid operators: equals, contains, startsWith, endsWith, greaterThan, lessThan, hasTag, linkedTo',
  },
  TYPE_MISMATCH: {
    message: 'Type mismatch in filter',
    suggestion: 'Ensure the value type matches the column type',
  },
  INVALID_FILTER_VALUE: {
    message: 'Invalid filter value',
    suggestion: 'Provide a valid value for the filter condition',
  },

  // Graph-specific errors
  INVALID_LINK_REFERENCE: {
    message: 'Invalid link reference',
    suggestion: 'Provide a valid page title or ID for the link reference',
  },
  CIRCULAR_REFERENCE: {
    message: 'Circular reference detected',
    suggestion: 'Avoid self-referential queries that could cause infinite loops',
  },

  // CozoScript errors
  INVALID_COZOSCRIPT_SYNTAX: {
    message: 'Invalid CozoScript syntax',
    suggestion: 'CozoScript queries must start with ?[columns] := ...',
  },
  INJECTION_DETECTED: {
    message: 'Potential injection attempt detected',
    suggestion: 'Use parameterized values instead of inline strings',
  },
  UNSUPPORTED_OPERATION: {
    message: 'Unsupported operation',
    suggestion: 'This operation is not supported at your current query level',
  },
} as const;

/**
 * Create a ValidationError from an error code
 */
export function createError(
  code: QueryErrorCode,
  options?: {
    line?: number;
    column?: number;
    length?: number;
    severity?: ErrorSeverity;
    customMessage?: string;
    customSuggestion?: string;
  }
): ValidationError {
  const { message, suggestion } = ERROR_MESSAGES[code];
  return {
    message: options?.customMessage ?? message,
    suggestion: options?.customSuggestion ?? suggestion,
    code,
    line: options?.line,
    column: options?.column,
    length: options?.length,
    severity: options?.severity ?? 'error',
  };
}

// ============================================================================
// TEMPLATE TYPES (Level 1)
// ============================================================================

/**
 * Parameter types for query templates.
 *
 * - 'string': Free-form text input
 * - 'number': Numeric input
 * - 'date': Date picker (ISO format)
 * - 'relation': Dropdown to select a relation
 * - 'page': Page selector (autocomplete)
 * - 'tag': Tag selector (autocomplete)
 * - 'boolean': Checkbox/toggle
 */
export type TemplateParamType =
  | 'string'
  | 'number'
  | 'date'
  | 'relation'
  | 'page'
  | 'tag'
  | 'boolean';

/**
 * A parameter definition for a query template.
 * Defines what values the user needs to provide.
 */
export interface TemplateParam {
  /** Parameter identifier (used in template substitution) */
  name: string;
  /** Human-readable label shown in the UI */
  label: string;
  /** The type of input control to show */
  type: TemplateParamType;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Default value if not provided */
  defaultValue?: FilterValue;
  /** Whether this parameter is required */
  required?: boolean;
  /** Validation pattern (regex) for string inputs */
  pattern?: string;
  /** Help text shown below the input */
  helpText?: string;
}

/**
 * Template categories for organization
 */
export type TemplateCategory = 'pages' | 'blocks' | 'graph' | 'tags' | 'search' | 'analytics';

/**
 * A predefined query template (Level 1).
 *
 * Templates provide pre-built queries for common operations.
 * Users fill in parameter values via form fields.
 */
export interface QueryTemplate {
  /** Unique template identifier */
  id: string;
  /** Human-readable name (e.g., "Find pages by tag") */
  name: string;
  /** Detailed description of what the template does */
  description: string;
  /** Category for grouping templates */
  category?: TemplateCategory;
  /** Parameter definitions */
  parameters: TemplateParam[];
  /** Example output (preview for users) */
  preview: string;
  /** The CozoScript template with parameter placeholders */
  script?: string;
  /** Icon identifier for UI display */
  icon?: string;
  /** Tags for search/filtering */
  tags?: string[];
}

// ============================================================================
// VISUAL BUILDER TYPES (Level 2)
// ============================================================================

/**
 * A field option for the visual builder dropdown.
 */
export interface FieldOption {
  /** The field/column name */
  value: string;
  /** Human-readable label */
  label: string;
  /** The data type of this field */
  type: 'string' | 'number' | 'boolean' | 'timestamp';
  /** Description for tooltip */
  description?: string;
}

/**
 * An operator option for the visual builder dropdown.
 */
export interface OperatorOption {
  /** The operator value */
  value: FilterOperator;
  /** Human-readable label */
  label: string;
  /** Operators this is compatible with */
  compatibleTypes: ('string' | 'number' | 'boolean' | 'timestamp')[];
}

/**
 * Configuration for the visual query builder (Level 2).
 * Defines what options are available in the UI.
 */
export interface VisualBuilderConfig {
  /** Available relations */
  relations: {
    value: QueryableRelation;
    label: string;
    fields: FieldOption[];
  }[];
  /** Available operators */
  operators: OperatorOption[];
  /** Default limit value */
  defaultLimit: number;
  /** Maximum allowed limit */
  maxLimit: number;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a value is a valid QueryType
 */
export function isQueryType(value: unknown): value is QueryType {
  return value === 'find' || value === 'count' || value === 'graph';
}

/**
 * Type guard to check if a value is a valid QueryableRelation
 */
export function isQueryableRelation(value: unknown): value is QueryableRelation {
  return (
    value === 'pages' ||
    value === 'blocks' ||
    value === 'links' ||
    value === 'tags' ||
    value === 'properties' ||
    value === 'block_refs' ||
    value === 'daily_notes'
  );
}

/**
 * Type guard to check if a value is a valid FilterOperator
 */
export function isFilterOperator(value: unknown): value is FilterOperator {
  const validOperators: FilterOperator[] = [
    'equals',
    'notEquals',
    'contains',
    'startsWith',
    'endsWith',
    'greaterThan',
    'lessThan',
    'greaterThanOrEqual',
    'lessThanOrEqual',
    'isNull',
    'isNotNull',
    'hasTag',
    'linkedTo',
    'linkedFrom',
    'hasProperty',
  ];
  return validOperators.includes(value as FilterOperator);
}

/**
 * Type guard to check if an operator is unary (no value required)
 */
export function isUnaryOperator(operator: FilterOperator): boolean {
  return UNARY_OPERATORS.includes(operator);
}

/**
 * Type guard to check if an operator is graph-specific
 */
export function isGraphOperator(operator: FilterOperator): boolean {
  return GRAPH_OPERATORS.includes(operator);
}

/**
 * Type guard to check if a Filter has a FilterGroup structure
 */
export function isFilterGroup(condition: Filter | FilterGroup): condition is FilterGroup {
  return 'operator' in condition && 'conditions' in condition;
}

/**
 * Validate that a column exists in a relation
 */
export function isValidColumn(relation: QueryableRelation, column: string): boolean {
  return RELATION_COLUMNS[relation].includes(column);
}
