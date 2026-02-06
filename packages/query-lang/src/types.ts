// @double-bind/query-lang - Type definitions for the query language

/**
 * Query types supported by the parser
 */
export type QueryType = 'find' | 'count' | 'graph';

/**
 * Filter operators for query conditions
 */
export type FilterOperator =
  | 'equals'
  | 'contains'
  | 'startsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'hasTag'
  | 'linkedTo';

/**
 * A single filter condition in a query
 */
export interface Filter {
  field: string;
  operator: FilterOperator;
  value: string | number | boolean;
}

/**
 * Abstract Syntax Tree for parsed queries
 */
export interface QueryAST {
  type: QueryType;
  relation: string; // 'pages', 'blocks', etc.
  filters: Filter[];
  projections: string[]; // column names to return
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
}

/**
 * Result of compiling a query to CozoScript
 */
export interface CompiledQuery {
  script: string;
  params: Record<string, unknown>;
}

/**
 * A single validation error
 */
export interface ValidationError {
  message: string;
  line?: number;
  suggestion?: string;
}

/**
 * Result of validating a CozoScript query
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Parameter types for query templates
 */
export type TemplateParamType = 'string' | 'number' | 'date' | 'relation';

/**
 * A parameter definition for a query template
 */
export interface TemplateParam {
  name: string;
  label: string; // "Tag name"
  type: TemplateParamType;
  placeholder?: string;
}

/**
 * A predefined query template
 */
export interface QueryTemplate {
  id: string;
  name: string; // "Find pages by tag"
  description: string; // "Find all pages with a specific tag"
  parameters: TemplateParam[];
  preview: string; // Example output
}
