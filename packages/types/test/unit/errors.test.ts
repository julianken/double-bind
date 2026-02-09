/**
 * Unit tests for error types
 * Tests DoubleBindError class and ErrorCode enum
 */

import { DoubleBindError, ErrorCode } from '../../src/errors';

describe('Error Types', () => {
  describe('ErrorCode', () => {
    it('should have database error codes', () => {
      expect(ErrorCode.DB_CONNECTION_FAILED).toBe('DB_CONNECTION_FAILED');
      expect(ErrorCode.DB_QUERY_FAILED).toBe('DB_QUERY_FAILED');
      expect(ErrorCode.DB_MUTATION_FAILED).toBe('DB_MUTATION_FAILED');
    });

    it('should have domain error codes', () => {
      expect(ErrorCode.PAGE_NOT_FOUND).toBe('PAGE_NOT_FOUND');
      expect(ErrorCode.BLOCK_NOT_FOUND).toBe('BLOCK_NOT_FOUND');
      expect(ErrorCode.SAVED_QUERY_NOT_FOUND).toBe('SAVED_QUERY_NOT_FOUND');
      expect(ErrorCode.INVALID_CONTENT).toBe('INVALID_CONTENT');
      expect(ErrorCode.CIRCULAR_REFERENCE).toBe('CIRCULAR_REFERENCE');
    });

    it('should have import/export error codes', () => {
      expect(ErrorCode.IMPORT_PARSE_ERROR).toBe('IMPORT_PARSE_ERROR');
      expect(ErrorCode.EXPORT_WRITE_ERROR).toBe('EXPORT_WRITE_ERROR');
    });

    it('should have security error codes', () => {
      expect(ErrorCode.BLOCKED_OPERATION).toBe('BLOCKED_OPERATION');
    });

    it('should have all expected error codes', () => {
      const allCodes = Object.values(ErrorCode);
      expect(allCodes).toHaveLength(12);
      expect(allCodes).toContain('DB_CONNECTION_FAILED');
      expect(allCodes).toContain('PAGE_NOT_FOUND');
      expect(allCodes).toContain('SAVED_QUERY_NOT_FOUND');
      expect(allCodes).toContain('IMPORT_PARSE_ERROR');
      expect(allCodes).toContain('BLOCKED_OPERATION');
      expect(allCodes).toContain('DUPLICATE_PAGE_NAME');
    });
  });

  describe('DoubleBindError', () => {
    it('should create error with message and code', () => {
      const error = new DoubleBindError('Page not found', ErrorCode.PAGE_NOT_FOUND);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.message).toBe('Page not found');
      expect(error.code).toBe(ErrorCode.PAGE_NOT_FOUND);
      expect(error.name).toBe('DoubleBindError');
    });

    it('should create error with cause', () => {
      const cause = new Error('Original error');
      const error = new DoubleBindError('Database query failed', ErrorCode.DB_QUERY_FAILED, cause);

      expect(error.message).toBe('Database query failed');
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.cause).toBe(cause);
      expect(error.cause?.message).toBe('Original error');
    });

    it('should create error without cause', () => {
      const error = new DoubleBindError('Block not found', ErrorCode.BLOCK_NOT_FOUND);

      expect(error.cause).toBeUndefined();
    });

    it('should have error name set to DoubleBindError', () => {
      const error = new DoubleBindError('Test error', ErrorCode.INVALID_CONTENT);

      expect(error.name).toBe('DoubleBindError');
    });

    it('should be catchable as Error', () => {
      try {
        throw new DoubleBindError('Test error', ErrorCode.PAGE_NOT_FOUND);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DoubleBindError);
      }
    });

    it('should preserve stack trace', () => {
      const error = new DoubleBindError('Test error', ErrorCode.PAGE_NOT_FOUND);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('DoubleBindError');
    });

    it('should support all database error codes', () => {
      const dbCodes = [
        ErrorCode.DB_CONNECTION_FAILED,
        ErrorCode.DB_QUERY_FAILED,
        ErrorCode.DB_MUTATION_FAILED,
      ];

      dbCodes.forEach((code) => {
        const error = new DoubleBindError(`Database error: ${code}`, code);
        expect(error.code).toBe(code);
        expect(error.message).toContain('Database error');
      });
    });

    it('should support all domain error codes', () => {
      const domainCodes = [
        ErrorCode.PAGE_NOT_FOUND,
        ErrorCode.BLOCK_NOT_FOUND,
        ErrorCode.SAVED_QUERY_NOT_FOUND,
        ErrorCode.INVALID_CONTENT,
        ErrorCode.CIRCULAR_REFERENCE,
        ErrorCode.DUPLICATE_PAGE_NAME,
      ];

      domainCodes.forEach((code) => {
        const error = new DoubleBindError(`Domain error: ${code}`, code);
        expect(error.code).toBe(code);
        expect(error.message).toContain('Domain error');
      });
    });

    it('should support import/export error codes', () => {
      const importExportCodes = [ErrorCode.IMPORT_PARSE_ERROR, ErrorCode.EXPORT_WRITE_ERROR];

      importExportCodes.forEach((code) => {
        const error = new DoubleBindError(`Import/Export error: ${code}`, code);
        expect(error.code).toBe(code);
        expect(error.message).toContain('Import/Export error');
      });
    });

    it('should support security error codes', () => {
      const error = new DoubleBindError('Operation blocked', ErrorCode.BLOCKED_OPERATION);

      expect(error.code).toBe(ErrorCode.BLOCKED_OPERATION);
      expect(error.message).toBe('Operation blocked');
    });

    it('should handle empty message', () => {
      const error = new DoubleBindError('', ErrorCode.PAGE_NOT_FOUND);

      expect(error.message).toBe('');
      expect(error.code).toBe(ErrorCode.PAGE_NOT_FOUND);
    });

    it('should handle multiline messages', () => {
      const message = 'Error occurred:\nLine 1\nLine 2';
      const error = new DoubleBindError(message, ErrorCode.INVALID_CONTENT);

      expect(error.message).toBe(message);
      expect(error.message).toContain('\n');
    });

    it('should chain errors properly', () => {
      const rootCause = new Error('Root cause');
      const intermediateCause = new DoubleBindError(
        'Intermediate error',
        ErrorCode.DB_QUERY_FAILED,
        rootCause
      );
      const finalError = new DoubleBindError(
        'Final error',
        ErrorCode.DB_MUTATION_FAILED,
        intermediateCause
      );

      expect(finalError.cause).toBe(intermediateCause);
      expect((finalError.cause as DoubleBindError).cause).toBe(rootCause);
    });

    it('should be JSON serializable', () => {
      const error = new DoubleBindError('Test error', ErrorCode.PAGE_NOT_FOUND);
      const json = JSON.stringify({
        message: error.message,
        code: error.code,
        name: error.name,
      });

      expect(json).toContain('Test error');
      expect(json).toContain('PAGE_NOT_FOUND');
      expect(json).toContain('DoubleBindError');
    });

    it('should support instanceof checks', () => {
      const error = new DoubleBindError('Test', ErrorCode.PAGE_NOT_FOUND);

      expect(error instanceof DoubleBindError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it('should differentiate from native Error', () => {
      const nativeError = new Error('Native error');
      const doubleBindError = new DoubleBindError('Double-Bind error', ErrorCode.PAGE_NOT_FOUND);

      expect(nativeError instanceof DoubleBindError).toBe(false);
      expect(doubleBindError instanceof Error).toBe(true);
    });
  });
});
