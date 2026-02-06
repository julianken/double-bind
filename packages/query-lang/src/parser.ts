// @double-bind/query-lang - Parser: input string -> QueryAST

import type { QueryAST } from './types.js';

/**
 * Parse a user-friendly query string into an AST
 *
 * Example inputs:
 * - "find pages where title contains 'meeting'"
 * - "count blocks"
 * - "find pages linked from 'Project Alpha'"
 *
 * @param input - The user-friendly query string
 * @returns The parsed QueryAST
 * @throws Error if the query cannot be parsed
 */
export function parseQuery(input: string): QueryAST {
  // TODO: Implement parser (DBB-218)
  // This is a stub that validates input exists
  if (!input || typeof input !== 'string') {
    throw new Error('Query input must be a non-empty string');
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error('Query input must be a non-empty string');
  }

  // Stub: return a minimal valid AST
  // Real implementation will parse the input grammar
  return {
    type: 'find',
    relation: 'pages',
    filters: [],
    projections: ['page_id', 'title'],
  };
}
