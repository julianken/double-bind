/**
 * SavedQueryService - Orchestrates saved query operations with cross-cutting concerns.
 *
 * This service layer sits above the repository and handles:
 * - Input validation
 * - Error wrapping with context
 * - Business logic for query management
 *
 * All errors are wrapped with context before re-throwing to provide
 * better debugging information at higher layers.
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

/**
 * Options for listing saved queries.
 */
export interface ListSavedQueriesOptions {
  /** Filter by query type */
  type?: SavedQueryType;
  /** Maximum number of results */
  limit?: number;
  /** Number of results to skip */
  offset?: number;
}

/**
 * Service for high-level saved query operations.
 *
 * Provides a clean API for saved query CRUD operations with proper
 * error handling and validation.
 */
export class SavedQueryService {
  constructor(private readonly savedQueryRepo: SavedQueryRepository) {}

  /**
   * Create a new saved query.
   *
   * @param input - The saved query data
   * @returns The newly created saved query
   * @throws DoubleBindError with context on repository failure
   */
  async create(input: CreateSavedQueryInput): Promise<SavedQuery> {
    try {
      // Validate name is not empty
      if (!input.name || input.name.trim().length === 0) {
        throw new DoubleBindError('Saved query name cannot be empty', ErrorCode.INVALID_CONTENT);
      }

      // Validate definition is not empty
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

  /**
   * Get a saved query by ID.
   *
   * @param id - The saved query identifier
   * @returns The saved query
   * @throws DoubleBindError with SAVED_QUERY_NOT_FOUND if not found
   * @throws DoubleBindError with context on repository failure
   */
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

  /**
   * List all saved queries with optional filtering.
   *
   * @param options - Optional filtering and pagination options
   * @returns Array of saved queries sorted by updated_at descending
   * @throws DoubleBindError with context on repository failure
   */
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

  /**
   * Search saved queries by name.
   *
   * @param query - The search query string
   * @param limit - Maximum number of results (default 50)
   * @returns Array of saved queries matching the search
   * @throws DoubleBindError with context on repository failure
   */
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

  /**
   * Update an existing saved query.
   *
   * @param id - The saved query identifier
   * @param input - The fields to update
   * @returns The updated saved query
   * @throws DoubleBindError with SAVED_QUERY_NOT_FOUND if not found
   * @throws DoubleBindError with context on repository failure
   */
  async update(id: SavedQueryId, input: UpdateSavedQueryInput): Promise<SavedQuery> {
    try {
      // Validate name if provided
      if (input.name !== undefined && input.name.trim().length === 0) {
        throw new DoubleBindError('Saved query name cannot be empty', ErrorCode.INVALID_CONTENT);
      }

      // Validate definition if provided
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

  /**
   * Delete a saved query.
   *
   * @param id - The saved query identifier
   * @throws DoubleBindError with SAVED_QUERY_NOT_FOUND if not found
   * @throws DoubleBindError with context on repository failure
   */
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

  /**
   * Get a saved query by its name.
   *
   * @param name - The saved query name
   * @returns The saved query if found, null otherwise
   * @throws DoubleBindError with context on repository failure
   */
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

  /**
   * Check if a saved query with the given name already exists.
   *
   * Useful for validating uniqueness before creating/renaming.
   *
   * @param name - The name to check
   * @returns true if name is already in use
   * @throws DoubleBindError with context on repository failure
   */
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
