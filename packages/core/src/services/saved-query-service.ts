/**
 * SavedQueryService - CRUD for saved queries with input validation.
 */

import type {
  SavedQuery,
  SavedQueryId,
  CreateSavedQueryInput,
  UpdateSavedQueryInput,
} from '@double-bind/types';
import { DoubleBindError, ErrorCode, SavedQueryType } from '@double-bind/types';
import type {
  SavedQueryRepository,
  GetAllSavedQueriesOptions,
} from '../repositories/saved-query-repository.js';

export interface ListSavedQueriesOptions {
  type?: SavedQueryType;
  limit?: number;
  offset?: number;
}

export class SavedQueryService {
  constructor(private readonly savedQueryRepo: SavedQueryRepository) {}

  async create(input: CreateSavedQueryInput): Promise<SavedQuery> {
    try {
      if (!input.name || input.name.trim().length === 0) {
        throw new DoubleBindError('Saved query name cannot be empty', ErrorCode.INVALID_CONTENT);
      }

      if (!input.definition || input.definition.trim().length === 0) {
        throw new DoubleBindError(
          'Saved query definition cannot be empty',
          ErrorCode.INVALID_CONTENT
        );
      }

      const id = await this.savedQueryRepo.create(input);
      const savedQuery = await this.savedQueryRepo.getById(id);

      if (!savedQuery) {
        throw new DoubleBindError(
          `Failed to retrieve created saved query: ${id}`,
          ErrorCode.DB_QUERY_FAILED
        );
      }

      return savedQuery;
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to create saved query "${input.name}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_MUTATION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getById(id: SavedQueryId): Promise<SavedQuery> {
    try {
      const savedQuery = await this.savedQueryRepo.getById(id);

      if (!savedQuery) {
        throw new DoubleBindError(`Saved query not found: ${id}`, ErrorCode.SAVED_QUERY_NOT_FOUND);
      }

      return savedQuery;
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to get saved query "${id}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  async list(options: ListSavedQueriesOptions = {}): Promise<SavedQuery[]> {
    try {
      const repoOptions: GetAllSavedQueriesOptions = {
        type: options.type,
        limit: options.limit,
        offset: options.offset,
      };

      return await this.savedQueryRepo.getAll(repoOptions);
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to list saved queries: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  async search(query: string, limit = 50): Promise<SavedQuery[]> {
    try {
      return await this.savedQueryRepo.search(query, limit);
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to search saved queries with query "${query}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  async update(id: SavedQueryId, input: UpdateSavedQueryInput): Promise<SavedQuery> {
    try {
      if (input.name !== undefined && input.name.trim().length === 0) {
        throw new DoubleBindError('Saved query name cannot be empty', ErrorCode.INVALID_CONTENT);
      }

      if (input.definition !== undefined && input.definition.trim().length === 0) {
        throw new DoubleBindError(
          'Saved query definition cannot be empty',
          ErrorCode.INVALID_CONTENT
        );
      }

      await this.savedQueryRepo.update(id, input);

      const savedQuery = await this.savedQueryRepo.getById(id);
      if (!savedQuery) {
        throw new DoubleBindError(
          `Failed to retrieve updated saved query: ${id}`,
          ErrorCode.DB_QUERY_FAILED
        );
      }

      return savedQuery;
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to update saved query "${id}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_MUTATION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  async delete(id: SavedQueryId): Promise<void> {
    try {
      await this.savedQueryRepo.delete(id);
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to delete saved query "${id}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_MUTATION_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  async getByName(name: string): Promise<SavedQuery | null> {
    try {
      return await this.savedQueryRepo.getByName(name);
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to get saved query by name "${name}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }

  async nameExists(name: string): Promise<boolean> {
    try {
      return await this.savedQueryRepo.existsByName(name);
    } catch (error) {
      if (error instanceof DoubleBindError) {
        throw error;
      }
      throw new DoubleBindError(
        `Failed to check if saved query name exists "${name}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.DB_QUERY_FAILED,
        error instanceof Error ? error : undefined
      );
    }
  }
}
