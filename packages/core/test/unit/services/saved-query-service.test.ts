/**
 * Unit tests for SavedQueryService
 *
 * These tests verify that the service correctly orchestrates the repository
 * and handles validation, error wrapping, and business logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockGraphDB } from '@double-bind/test-utils';
import { DoubleBindError, ErrorCode, SavedQueryType } from '@double-bind/types';
import type { SavedQuery } from '@double-bind/types';
import { SavedQueryRepository } from '../../../src/repositories/saved-query-repository.js';
import { SavedQueryService } from '../../../src/services/saved-query-service.js';

describe('SavedQueryService', () => {
  let db: MockGraphDB;
  let repo: SavedQueryRepository;
  let service: SavedQueryService;

  const now = Date.now();

  const mockQuery: SavedQuery = {
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    name: 'Test Query',
    type: SavedQueryType.TEMPLATE,
    definition: '?[x] := *blocks{x}',
    description: 'A test query',
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    db = new MockGraphDB();
    repo = new SavedQueryRepository(db);
    service = new SavedQueryService(repo);
  });

  describe('create', () => {
    it('should create and return the new saved query', async () => {
      const createSpy = vi.spyOn(repo, 'create');
      const getByIdSpy = vi.spyOn(repo, 'getById');

      createSpy.mockResolvedValueOnce(mockQuery.id);
      getByIdSpy.mockResolvedValueOnce(mockQuery);

      const result = await service.create({
        name: 'Test Query',
        type: SavedQueryType.TEMPLATE,
        definition: '?[x] := *blocks{x}',
        description: 'A test query',
      });

      expect(result).toEqual(mockQuery);
      expect(createSpy).toHaveBeenCalledWith({
        name: 'Test Query',
        type: SavedQueryType.TEMPLATE,
        definition: '?[x] := *blocks{x}',
        description: 'A test query',
      });
    });

    it('should throw INVALID_CONTENT if name is empty', async () => {
      await expect(
        service.create({
          name: '',
          type: SavedQueryType.RAW,
          definition: '?[x] := 1',
        })
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_CONTENT,
        message: 'Saved query name cannot be empty',
      });
    });

    it('should throw INVALID_CONTENT if name is only whitespace', async () => {
      await expect(
        service.create({
          name: '   ',
          type: SavedQueryType.RAW,
          definition: '?[x] := 1',
        })
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_CONTENT,
      });
    });

    it('should throw INVALID_CONTENT if definition is empty', async () => {
      await expect(
        service.create({
          name: 'Valid Name',
          type: SavedQueryType.RAW,
          definition: '',
        })
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_CONTENT,
        message: 'Saved query definition cannot be empty',
      });
    });

    it('should throw INVALID_CONTENT if definition is only whitespace', async () => {
      await expect(
        service.create({
          name: 'Valid Name',
          type: SavedQueryType.RAW,
          definition: '   ',
        })
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_CONTENT,
      });
    });

    it('should wrap unexpected errors with context', async () => {
      const createSpy = vi.spyOn(repo, 'create');
      createSpy.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(
        service.create({
          name: 'Query',
          type: SavedQueryType.RAW,
          definition: '?[x] := 1',
        })
      ).rejects.toMatchObject({
        code: ErrorCode.DB_MUTATION_FAILED,
      });
    });
  });

  describe('getById', () => {
    it('should return the saved query when found', async () => {
      const getByIdSpy = vi.spyOn(repo, 'getById');
      getByIdSpy.mockResolvedValueOnce(mockQuery);

      const result = await service.getById(mockQuery.id);

      expect(result).toEqual(mockQuery);
    });

    it('should throw SAVED_QUERY_NOT_FOUND when not found', async () => {
      const getByIdSpy = vi.spyOn(repo, 'getById');
      getByIdSpy.mockResolvedValueOnce(null);

      await expect(service.getById('nonexistent')).rejects.toMatchObject({
        code: ErrorCode.SAVED_QUERY_NOT_FOUND,
      });
    });

    it('should wrap unexpected errors with context', async () => {
      const getByIdSpy = vi.spyOn(repo, 'getById');
      getByIdSpy.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.getById('some-id')).rejects.toMatchObject({
        code: ErrorCode.DB_QUERY_FAILED,
      });
    });
  });

  describe('list', () => {
    it('should return all saved queries', async () => {
      const queries = [mockQuery, { ...mockQuery, id: 'query-2', name: 'Second Query' }];
      const getAllSpy = vi.spyOn(repo, 'getAll');
      getAllSpy.mockResolvedValueOnce(queries);

      const result = await service.list();

      expect(result).toEqual(queries);
    });

    it('should pass options to repository', async () => {
      const getAllSpy = vi.spyOn(repo, 'getAll');
      getAllSpy.mockResolvedValueOnce([]);

      await service.list({
        type: SavedQueryType.TEMPLATE,
        limit: 50,
        offset: 10,
      });

      expect(getAllSpy).toHaveBeenCalledWith({
        type: SavedQueryType.TEMPLATE,
        limit: 50,
        offset: 10,
      });
    });

    it('should wrap unexpected errors with context', async () => {
      const getAllSpy = vi.spyOn(repo, 'getAll');
      getAllSpy.mockRejectedValueOnce(new Error('Query failed'));

      await expect(service.list()).rejects.toMatchObject({
        code: ErrorCode.DB_QUERY_FAILED,
      });
    });
  });

  describe('search', () => {
    it('should return matching saved queries', async () => {
      const searchSpy = vi.spyOn(repo, 'search');
      searchSpy.mockResolvedValueOnce([mockQuery]);

      const result = await service.search('test');

      expect(result).toEqual([mockQuery]);
      expect(searchSpy).toHaveBeenCalledWith('test', 50);
    });

    it('should accept custom limit', async () => {
      const searchSpy = vi.spyOn(repo, 'search');
      searchSpy.mockResolvedValueOnce([]);

      await service.search('test', 25);

      expect(searchSpy).toHaveBeenCalledWith('test', 25);
    });

    it('should wrap unexpected errors with context', async () => {
      const searchSpy = vi.spyOn(repo, 'search');
      searchSpy.mockRejectedValueOnce(new Error('FTS failed'));

      await expect(service.search('test')).rejects.toMatchObject({
        code: ErrorCode.DB_QUERY_FAILED,
      });
    });
  });

  describe('update', () => {
    it('should update and return the saved query', async () => {
      const updateSpy = vi.spyOn(repo, 'update');
      const getByIdSpy = vi.spyOn(repo, 'getById');

      const updatedQuery = { ...mockQuery, name: 'Updated Name' };
      updateSpy.mockResolvedValueOnce(undefined);
      getByIdSpy.mockResolvedValueOnce(updatedQuery);

      const result = await service.update(mockQuery.id, { name: 'Updated Name' });

      expect(result).toEqual(updatedQuery);
      expect(updateSpy).toHaveBeenCalledWith(mockQuery.id, { name: 'Updated Name' });
    });

    it('should throw INVALID_CONTENT if name is set to empty', async () => {
      await expect(service.update('some-id', { name: '' })).rejects.toMatchObject({
        code: ErrorCode.INVALID_CONTENT,
        message: 'Saved query name cannot be empty',
      });
    });

    it('should throw INVALID_CONTENT if name is set to whitespace', async () => {
      await expect(service.update('some-id', { name: '   ' })).rejects.toMatchObject({
        code: ErrorCode.INVALID_CONTENT,
      });
    });

    it('should throw INVALID_CONTENT if definition is set to empty', async () => {
      await expect(service.update('some-id', { definition: '' })).rejects.toMatchObject({
        code: ErrorCode.INVALID_CONTENT,
        message: 'Saved query definition cannot be empty',
      });
    });

    it('should allow updating with undefined values (no change)', async () => {
      const updateSpy = vi.spyOn(repo, 'update');
      const getByIdSpy = vi.spyOn(repo, 'getById');

      updateSpy.mockResolvedValueOnce(undefined);
      getByIdSpy.mockResolvedValueOnce(mockQuery);

      await service.update(mockQuery.id, {});

      expect(updateSpy).toHaveBeenCalledWith(mockQuery.id, {});
    });

    it('should re-throw SAVED_QUERY_NOT_FOUND from repository', async () => {
      const updateSpy = vi.spyOn(repo, 'update');
      updateSpy.mockRejectedValueOnce(
        new DoubleBindError('Saved query not found', ErrorCode.SAVED_QUERY_NOT_FOUND)
      );

      await expect(service.update('nonexistent', { name: 'New' })).rejects.toMatchObject({
        code: ErrorCode.SAVED_QUERY_NOT_FOUND,
      });
    });

    it('should wrap unexpected errors with context', async () => {
      const updateSpy = vi.spyOn(repo, 'update');
      updateSpy.mockRejectedValueOnce(new Error('Unexpected'));

      await expect(service.update('some-id', { name: 'New' })).rejects.toMatchObject({
        code: ErrorCode.DB_MUTATION_FAILED,
      });
    });
  });

  describe('delete', () => {
    it('should delete the saved query', async () => {
      const deleteSpy = vi.spyOn(repo, 'delete');
      deleteSpy.mockResolvedValueOnce(undefined);

      await service.delete(mockQuery.id);

      expect(deleteSpy).toHaveBeenCalledWith(mockQuery.id);
    });

    it('should re-throw SAVED_QUERY_NOT_FOUND from repository', async () => {
      const deleteSpy = vi.spyOn(repo, 'delete');
      deleteSpy.mockRejectedValueOnce(
        new DoubleBindError('Saved query not found', ErrorCode.SAVED_QUERY_NOT_FOUND)
      );

      await expect(service.delete('nonexistent')).rejects.toMatchObject({
        code: ErrorCode.SAVED_QUERY_NOT_FOUND,
      });
    });

    it('should wrap unexpected errors with context', async () => {
      const deleteSpy = vi.spyOn(repo, 'delete');
      deleteSpy.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(service.delete('some-id')).rejects.toMatchObject({
        code: ErrorCode.DB_MUTATION_FAILED,
      });
    });
  });

  describe('getByName', () => {
    it('should return the saved query when found', async () => {
      const getByNameSpy = vi.spyOn(repo, 'getByName');
      getByNameSpy.mockResolvedValueOnce(mockQuery);

      const result = await service.getByName('Test Query');

      expect(result).toEqual(mockQuery);
    });

    it('should return null when not found', async () => {
      const getByNameSpy = vi.spyOn(repo, 'getByName');
      getByNameSpy.mockResolvedValueOnce(null);

      const result = await service.getByName('Nonexistent');

      expect(result).toBeNull();
    });

    it('should wrap unexpected errors with context', async () => {
      const getByNameSpy = vi.spyOn(repo, 'getByName');
      getByNameSpy.mockRejectedValueOnce(new Error('Query failed'));

      await expect(service.getByName('Test')).rejects.toMatchObject({
        code: ErrorCode.DB_QUERY_FAILED,
      });
    });
  });

  describe('nameExists', () => {
    it('should return true when name exists', async () => {
      const existsSpy = vi.spyOn(repo, 'existsByName');
      existsSpy.mockResolvedValueOnce(true);

      const result = await service.nameExists('Existing');

      expect(result).toBe(true);
    });

    it('should return false when name does not exist', async () => {
      const existsSpy = vi.spyOn(repo, 'existsByName');
      existsSpy.mockResolvedValueOnce(false);

      const result = await service.nameExists('New');

      expect(result).toBe(false);
    });

    it('should wrap unexpected errors with context', async () => {
      const existsSpy = vi.spyOn(repo, 'existsByName');
      existsSpy.mockRejectedValueOnce(new Error('Check failed'));

      await expect(service.nameExists('Test')).rejects.toMatchObject({
        code: ErrorCode.DB_QUERY_FAILED,
      });
    });
  });
});
