// @double-bind/query-lang - Transpiler: QueryAST -> CozoScript

import type { QueryAST, CompiledQuery } from './types.js';
import { parseQuery } from './parser.js';

/**
 * Convert a QueryAST to parameterized CozoScript
 *
 * @param ast - The parsed QueryAST
 * @returns The CozoScript and parameter bindings
 */
export function transpileToCozo(ast: QueryAST): CompiledQuery {
  // TODO: Implement transpiler (DBB-219)
  // This is a stub that returns a minimal valid query

  // Validate AST structure
  if (!ast || !ast.type || !ast.relation) {
    throw new Error('Invalid AST: missing required fields');
  }

  // Stub: return a minimal valid CozoScript
  // Real implementation will generate proper queries
  return {
    script: `?[page_id, title] := *pages{ page_id, title, is_deleted: false }`,
    params: {},
  };
}

/**
 * Parse and compile a user-friendly query string directly to CozoScript
 *
 * @param input - The user-friendly query string
 * @returns The CozoScript and parameter bindings
 */
export function compileQuery(input: string): CompiledQuery {
  const ast = parseQuery(input);
  return transpileToCozo(ast);
}
