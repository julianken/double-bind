// @double-bind/query-lang - Validator: CozoScript validation

import type { ValidationResult } from './types.js';

/**
 * Validate a raw CozoScript string (Level 3 queries)
 *
 * Checks for:
 * - Basic syntax validity
 * - Injection attempts
 * - Unknown relation names
 * - Unknown column names
 *
 * @param script - The CozoScript query string
 * @returns Validation result with any errors
 */
export function validateCozoScript(script: string): ValidationResult {
  // TODO: Implement validator (DBB-220)
  // This is a stub that performs basic validation

  if (!script || typeof script !== 'string') {
    return {
      valid: false,
      errors: [{ message: 'Script must be a non-empty string' }],
    };
  }

  const trimmed = script.trim();
  if (trimmed.length === 0) {
    return {
      valid: false,
      errors: [{ message: 'Script must be a non-empty string' }],
    };
  }

  // Basic check: must start with query syntax
  if (!trimmed.startsWith('?[')) {
    return {
      valid: false,
      errors: [
        {
          message: 'CozoScript query must start with ?[',
          line: 1,
          suggestion: 'Queries should begin with ?[column1, column2] := ...',
        },
      ],
    };
  }

  // Stub: assume valid for now
  // Real implementation will do full syntax validation
  return {
    valid: true,
    errors: [],
  };
}
