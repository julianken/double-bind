/**
 * Unit tests for TauriGraphDB client
 *
 * These tests mock the Tauri invoke function to verify:
 * - Correct command names are called
 * - Parameters are passed correctly
 * - Results are returned properly
 * - Errors are mapped to DoubleBindError with correct error codes
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { DoubleBindError, ErrorCode } from '@double-bind/types';

// Mock @tauri-apps/api/core before importing tauriGraphDB
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Import after mocking
import { invoke } from '@tauri-apps/api/core';
import { tauriGraphDB } from '../../../src/client/tauri-graph-db.js';

describe('TauriGraphDB', () => {
  const mockInvoke = invoke as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('query', () => {
    it('should call invoke with "query" command and correct params', async () => {
      const expectedResult = { headers: ['id', 'name'], rows: [['1', 'Test']] };
      mockInvoke.mockResolvedValueOnce(expectedResult);

      const script = '?[id, name] := *pages{page_id: id, title: name}';
      const params = { limit: 10 };

      const result = await tauriGraphDB.query(script, params);

      expect(mockInvoke).toHaveBeenCalledOnce();
      expect(mockInvoke).toHaveBeenCalledWith('query', { script, params });
      expect(result).toEqual(expectedResult);
    });

    it('should use empty object for params when not provided', async () => {
      mockInvoke.mockResolvedValueOnce({ headers: [], rows: [] });

      await tauriGraphDB.query('?[x] := x = 1');

      expect(mockInvoke).toHaveBeenCalledWith('query', {
        script: '?[x] := x = 1',
        params: {},
      });
    });

    it('should map blocked operation errors correctly', async () => {
      mockInvoke.mockRejectedValue('Blocked operation: mutation not allowed in query');

      const error = await tauriGraphDB.query('some script').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.BLOCKED_OPERATION);
      expect(error.message).toBe('Blocked operation: mutation not allowed in query');
    });

    it('should map other errors to DB_QUERY_FAILED', async () => {
      mockInvoke.mockRejectedValue('Invalid Datalog syntax');

      const error = await tauriGraphDB.query('bad syntax').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toBe('Invalid Datalog syntax');
    });

    it('should handle Error objects from invoke', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      const error = await tauriGraphDB.query('some script').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toBe('Network error');
    });
  });

  describe('mutate', () => {
    it('should call invoke with "mutate" command and correct params', async () => {
      const expectedResult = { headers: ['affected'], rows: [[1]] };
      mockInvoke.mockResolvedValueOnce(expectedResult);

      const script = ':put pages {page_id, title}';
      const params = { id: '123', title: 'New Page' };

      const result = await tauriGraphDB.mutate(script, params);

      expect(mockInvoke).toHaveBeenCalledOnce();
      expect(mockInvoke).toHaveBeenCalledWith('mutate', { script, params });
      expect(result).toEqual(expectedResult);
    });

    it('should use empty object for params when not provided', async () => {
      mockInvoke.mockResolvedValueOnce({ headers: [], rows: [] });

      await tauriGraphDB.mutate(':delete pages {page_id: "123"}');

      expect(mockInvoke).toHaveBeenCalledWith('mutate', {
        script: ':delete pages {page_id: "123"}',
        params: {},
      });
    });

    it('should map blocked operation errors correctly', async () => {
      mockInvoke.mockRejectedValue('Blocked operation: cannot modify system table');

      const error = await tauriGraphDB.mutate('bad mutation').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.BLOCKED_OPERATION);
    });

    it('should map other errors to DB_QUERY_FAILED', async () => {
      mockInvoke.mockRejectedValue('Constraint violation');

      const error = await tauriGraphDB.mutate('bad mutation').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
    });
  });

  describe('importRelations', () => {
    it('should call invoke with "import_relations" command', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const data = {
        pages: [['page-1', 'Title 1', 1700000000, 1700000000, false, null]],
        blocks: [['block-1', 'page-1', null, 'Content', 'a', 1700000000, 1700000000, false, false]],
      };

      await tauriGraphDB.importRelations(data);

      expect(mockInvoke).toHaveBeenCalledOnce();
      expect(mockInvoke).toHaveBeenCalledWith('import_relations', { data });
    });

    it('should handle empty data', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await tauriGraphDB.importRelations({});

      expect(mockInvoke).toHaveBeenCalledWith('import_relations', { data: {} });
    });

    it('should map errors correctly', async () => {
      mockInvoke.mockRejectedValue('Import failed: invalid schema');

      const error = await tauriGraphDB.importRelations({}).catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
    });
  });

  describe('exportRelations', () => {
    it('should call invoke with "export_relations" command', async () => {
      const expectedResult = {
        pages: [['page-1', 'Title', 1700000000, 1700000000, false, null]],
      };
      mockInvoke.mockResolvedValueOnce(expectedResult);

      const relations = ['pages', 'blocks'];

      const result = await tauriGraphDB.exportRelations(relations);

      expect(mockInvoke).toHaveBeenCalledOnce();
      expect(mockInvoke).toHaveBeenCalledWith('export_relations', { relations });
      expect(result).toEqual(expectedResult);
    });

    it('should handle empty relations array', async () => {
      mockInvoke.mockResolvedValueOnce({});

      const result = await tauriGraphDB.exportRelations([]);

      expect(mockInvoke).toHaveBeenCalledWith('export_relations', { relations: [] });
      expect(result).toEqual({});
    });

    it('should map errors correctly', async () => {
      mockInvoke.mockRejectedValue('Blocked operation: export not permitted');

      const error = await tauriGraphDB.exportRelations(['pages']).catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.BLOCKED_OPERATION);
    });
  });

  describe('backup', () => {
    it('should call invoke with "backup" command and path', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const path = '/backup/database-2025-01-15.db';

      await tauriGraphDB.backup(path);

      expect(mockInvoke).toHaveBeenCalledOnce();
      expect(mockInvoke).toHaveBeenCalledWith('backup', { path });
    });

    it('should map errors correctly', async () => {
      mockInvoke.mockRejectedValue('Permission denied');

      const error = await tauriGraphDB.backup('/invalid/path').catch((e) => e);

      expect(error).toBeInstanceOf(DoubleBindError);
      expect(error.code).toBe(ErrorCode.DB_QUERY_FAILED);
      expect(error.message).toBe('Permission denied');
    });
  });

  describe('error mapping edge cases', () => {
    it('should handle "Blocked operation:" at start of message exactly', async () => {
      // Exact match at the beginning
      mockInvoke.mockRejectedValueOnce('Blocked operation: reason here');
      await expect(tauriGraphDB.query('')).rejects.toMatchObject({
        code: ErrorCode.BLOCKED_OPERATION,
      });
    });

    it('should NOT match "Blocked operation" without colon', async () => {
      mockInvoke.mockRejectedValueOnce('Blocked operation without colon');
      await expect(tauriGraphDB.query('')).rejects.toMatchObject({
        code: ErrorCode.DB_QUERY_FAILED,
      });
    });

    it('should NOT match "blocked operation:" (lowercase)', async () => {
      mockInvoke.mockRejectedValueOnce('blocked operation: something');
      await expect(tauriGraphDB.query('')).rejects.toMatchObject({
        code: ErrorCode.DB_QUERY_FAILED,
      });
    });

    it('should NOT match if "Blocked operation:" is in the middle', async () => {
      mockInvoke.mockRejectedValueOnce('Error: Blocked operation: something');
      await expect(tauriGraphDB.query('')).rejects.toMatchObject({
        code: ErrorCode.DB_QUERY_FAILED,
      });
    });
  });
});
