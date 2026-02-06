// @double-bind/query-lang - Progressive disclosure query system
// Parses user-friendly query syntax and transpiles to CozoScript

// Types
export type {
  QueryType,
  FilterOperator,
  Filter,
  QueryAST,
  CompiledQuery,
  ValidationError,
  ValidationResult,
  TemplateParamType,
  TemplateParam,
  QueryTemplate,
} from './types.js';

// Parser
export { parseQuery } from './parser.js';

// Transpiler
export { transpileToCozo, compileQuery } from './transpiler.js';

// Validator
export { validateCozoScript } from './validator.js';

// Templates
export { getTemplates, getTemplate, applyTemplate, registerTemplate } from './templates/index.js';
