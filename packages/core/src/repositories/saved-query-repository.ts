/**
 * SavedQueryRepository - Encapsulates all Datalog queries for SavedQuery entities.
 *
 * Each method constructs parameterized Datalog queries that are executed
 * against CozoDB. User data never enters the query string directly;
 * all values are passed as parameters.
 */

import { ulid } from 'ulid';
import type {
  GraphDB,
  SavedQuery,
  SavedQueryId,
  CreateSavedQueryInput,
  UpdateSavedQueryInput,
} from '@double-bind/types';
import { DoubleBindError, ErrorCode, SavedQueryType } from '@double-bind/types';
import { parseSavedQueryRow, type SavedQueryRow } from './saved-query-repository.schemas.js';

/**
 * Options for listing saved queries.
 */
export interface GetAllSavedQueriesOptions {
  /** Filter by query type */
  type?: SavedQueryType;
  /** Maximum number of results (default 100) */
  limit?: number;
  /** Number of results to skip (default 0) */
  offset?: number;
}

/**
 * Repository for SavedQuery entity operations.
 * All methods use parameterized Datalog queries for security.
 */
export class SavedQueryRepository {
  constructor(private readonly db: GraphDB) {}

  /**
   * Get a saved query by its ID.
   *
   * @param id - The saved query identifier (ULID)
   * @returns The saved query if found, null otherwise
   */
  async getById(id: SavedQueryId): Promise<SavedQuery | null> {
    const script = `
?[id, name, type, definition, description, created_at, updated_at] :=
    *saved_queries{ id, name, type, definition, description, created_at, updated_at },
    id == $id
`.trim();

    const result = await this.db.query(script, { id });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as SavedQueryRow;
    return parseSavedQueryRow(row);
  }

  /**
   * List all saved queries.
   *
   * @param options - Optional filtering and pagination options
   * @returns Array of saved queries sorted by updated_at descending
   */
  async getAll(options: GetAllSavedQueriesOptions = {}): Promise<SavedQuery[]> {
    const { type, limit = 100, offset = 0 } = options;

    let script: string;

    if (type) {
      script = `
?[id, name, type, definition, description, created_at, updated_at] :=
    *saved_queries{ id, name, type, definition, description, created_at, updated_at },
    type == $type
:order -updated_at
:limit $limit
:offset $offset
`.trim();

      const result = await this.db.query(script, { type, limit, offset });
      return result.rows.map((row) => parseSavedQueryRow(row as SavedQueryRow));
    } else {
      script = `
?[id, name, type, definition, description, created_at, updated_at] :=
    *saved_queries{ id, name, type, definition, description, created_at, updated_at }
:order -updated_at
:limit $limit
:offset $offset
`.trim();

      const result = await this.db.query(script, { limit, offset });
      return result.rows.map((row) => parseSavedQueryRow(row as SavedQueryRow));
    }
  }

  /**
   * Full-text search on saved query names.
   *
   * @param query - The search query string
   * @param limit - Maximum number of results (default 50)
   * @returns Array of saved queries matching the search, sorted by relevance score
   */
  async search(query: string, limit = 50): Promise<SavedQuery[]> {
    const script = `
?[id, name, type, definition, description, created_at, updated_at, score] :=
    ~saved_queries:fts{ id, name | query: $query, k: $limit, bind_score: score },
    *saved_queries{ id, name, type, definition, description, created_at, updated_at }
:order -score
`.trim();

    const result = await this.db.query(script, { query, limit });

    // Map rows to SavedQuery (excluding the score column at index 7)
    return result.rows.map((row) => {
      const queryRow = (row as unknown[]).slice(0, 7) as SavedQueryRow;
      return parseSavedQueryRow(queryRow);
    });
  }

  /**
   * Create a new saved query.
   *
   * @param input - Saved query creation input
   * @returns The ID of the newly created saved query
   */
  async create(input: CreateSavedQueryInput): Promise<SavedQueryId> {
    const id = ulid();
    const now = Date.now();
    const description = input.description ?? null;

    const script = `
?[id, name, type, definition, description, created_at, updated_at] <- [
    [$id, $name, $type, $definition, $description, $now, $now]
]
:put saved_queries { id, name, type, definition, description, created_at, updated_at }
`.trim();

    await this.db.mutate(script, {
      id,
      name: input.name,
      type: input.type,
      definition: input.definition,
      description,
      now,
    });

    return id;
  }

  /**
   * Update an existing saved query.
   *
   * This is a read-modify-write operation: it reads the current state,
   * applies the updates, and writes back the full record.
   *
   * @param id - The saved query to update
   * @param input - Partial saved query data to update
   * @throws DoubleBindError if saved query not found
   */
  async update(id: SavedQueryId, input: UpdateSavedQueryInput): Promise<void> {
    // First, read the existing saved query
    const existing = await this.getById(id);
    if (!existing) {
      throw new DoubleBindError(`Saved query not found: ${id}`, ErrorCode.SAVED_QUERY_NOT_FOUND);
    }

    const now = Date.now();
    const newName = input.name ?? existing.name;
    const newType = input.type ?? existing.type;
    const newDefinition = input.definition ?? existing.definition;
    const newDescription =
      input.description !== undefined ? input.description : existing.description;

    const script = `
?[id, name, type, definition, description, created_at, updated_at] <- [
    [$id, $name, $type, $definition, $description, $created_at, $now]
]
:put saved_queries { id, name, type, definition, description, created_at, updated_at }
`.trim();

    await this.db.mutate(script, {
      id,
      name: newName,
      type: newType,
      definition: newDefinition,
      description: newDescription,
      created_at: existing.createdAt,
      now,
    });
  }

  /**
   * Delete a saved query permanently.
   *
   * Unlike pages and blocks, saved queries are hard-deleted since they
   * are user configuration and don't need version history.
   *
   * @param id - The saved query to delete
   * @throws DoubleBindError if saved query not found
   */
  async delete(id: SavedQueryId): Promise<void> {
    // Verify the saved query exists first
    const existing = await this.getById(id);
    if (!existing) {
      throw new DoubleBindError(`Saved query not found: ${id}`, ErrorCode.SAVED_QUERY_NOT_FOUND);
    }

    const script = `
?[id] <- [[$id]]
:rm saved_queries { id }
`.trim();

    await this.db.mutate(script, { id });
  }

  /**
   * Get a saved query by its exact name.
   *
   * @param name - The saved query name to look up
   * @returns The saved query if found, null otherwise
   */
  async getByName(name: string): Promise<SavedQuery | null> {
    const script = `
?[id, name, type, definition, description, created_at, updated_at] :=
    *saved_queries{ id, name, type, definition, description, created_at, updated_at },
    name == $name
`.trim();

    const result = await this.db.query(script, { name });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as SavedQueryRow;
    return parseSavedQueryRow(row);
  }

  /**
   * Check if a saved query with the given name exists.
   *
   * @param name - The name to check
   * @returns true if a saved query with this name exists, false otherwise
   */
  async existsByName(name: string): Promise<boolean> {
    const existing = await this.getByName(name);
    return existing !== null;
  }
}
