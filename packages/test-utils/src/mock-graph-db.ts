import type { GraphDB, QueryResult, MutationResult } from '@double-bind/types';

/**
 * Recorded query or mutation call for test inspection.
 */
export interface RecordedCall {
  script: string;
  params: Record<string, unknown>;
}

/**
 * In-memory mock implementation of the GraphDB interface.
 *
 * MockGraphDB does NOT evaluate Datalog. Instead, it uses pattern matching
 * on the query string to determine which seeded data to return.
 *
 * Use this for unit tests that verify:
 * - Correct query strings are constructed
 * - Correct params are passed
 * - Results are correctly mapped to domain types
 *
 * Use Layer 2 integration tests with real CozoDB for testing Datalog semantics.
 */
export class MockGraphDB implements GraphDB {
  /**
   * In-memory storage for seeded relations.
   * Key is relation name, value is array of rows.
   */
  private _relations: Map<string, unknown[][]> = new Map();

  /**
   * Headers for each seeded relation.
   * Extracted from the first query that references the relation.
   */
  private _headers: Map<string, string[]> = new Map();

  /**
   * History of all query calls.
   */
  private _queries: RecordedCall[] = [];

  /**
   * History of all mutation calls.
   */
  private _mutations: RecordedCall[] = [];

  /**
   * Seed data into a mock relation.
   *
   * @param relation - The relation name (e.g., 'pages', 'blocks')
   * @param rows - Array of row arrays
   *
   * @example
   * ```typescript
   * db.seed('pages', [
   *   ['page-1', 'My Page', 1700000000, 1700000000, false, null],
   *   ['page-2', 'Other Page', 1700000000, 1700000000, false, null],
   * ]);
   * ```
   */
  seed(relation: string, rows: unknown[][]): void {
    this._relations.set(relation, rows);
  }

  /**
   * Execute a read-only query.
   *
   * Pattern matching rules:
   * 1. Scan for `*relation_name{` to identify the target relation
   * 2. Extract column names from `?[col1, col2, ...]`
   * 3. Filter rows based on `column: $param` bindings
   *
   * @param script - Datalog query script
   * @param params - Optional named parameters
   * @returns Query results with headers and rows
   */
  async query<T = unknown>(
    script: string,
    params: Record<string, unknown> = {}
  ): Promise<QueryResult<T>> {
    this._queries.push({ script, params });

    // Extract relation name from *relation_name{ pattern
    const relationMatch = script.match(/\*(\w+)\s*\{/);
    if (!relationMatch) {
      return { headers: [], rows: [] };
    }

    const relationName = relationMatch[1]!;
    const seededRows = this._relations.get(relationName);
    if (!seededRows) {
      return { headers: [], rows: [] };
    }

    // Extract requested columns from ?[col1, col2, ...] pattern
    const columnsMatch = script.match(/\?\s*\[\s*([^\]]+)\s*\]/);
    const requestedColumns = columnsMatch ? columnsMatch[1]!.split(',').map((c) => c.trim()) : [];

    // Extract column bindings from the relation body
    // e.g., *pages{ page_id, title, created_at } or *pages{ page_id: $id }
    const bodyMatch = script.match(/\*\w+\s*\{\s*([^}]+)\s*\}/);
    const relationColumns = bodyMatch ? this.parseRelationColumns(bodyMatch[1]!) : [];

    // Store headers for this relation if we have column info
    if (relationColumns.length > 0 && !this._headers.has(relationName)) {
      this._headers.set(
        relationName,
        relationColumns.map((c) => c.name)
      );
    }

    // Filter rows based on parameter bindings in the relation body
    let filteredRows = [...seededRows];
    for (const col of relationColumns) {
      if (col.param && col.param in params) {
        const paramValue = params[col.param];
        const colIndex = relationColumns.findIndex((c) => c.name === col.name);
        if (colIndex !== -1) {
          filteredRows = filteredRows.filter((row) => row[colIndex] === paramValue);
        }
      }
    }

    // Also filter based on equality conditions in the where clause: column_name == $param
    const equalityConditions = this.parseEqualityConditions(script, params);
    for (const cond of equalityConditions) {
      const colIndex = relationColumns.findIndex((c) => c.name === cond.column);
      if (colIndex !== -1) {
        filteredRows = filteredRows.filter((row) => row[colIndex] === cond.value);
      }
    }

    // Project to requested columns if specified
    let resultRows: unknown[][] = filteredRows;
    if (requestedColumns.length > 0 && relationColumns.length > 0) {
      const columnIndices = requestedColumns.map((reqCol) =>
        relationColumns.findIndex((c) => c.name === reqCol)
      );

      resultRows = filteredRows.map((row) =>
        columnIndices.map((idx) => (idx !== -1 ? row[idx] : undefined))
      );
    }

    return {
      headers: requestedColumns.length > 0 ? requestedColumns : [],
      rows: resultRows as T[][],
    };
  }

  /**
   * Execute a mutation operation.
   *
   * Records the mutation in history. Does NOT actually modify seeded data.
   * Use `seed()` to set up data, and `mutations` to verify mutation calls.
   *
   * @param script - Datalog mutation script
   * @param params - Optional named parameters
   * @returns Mutation result (empty for mocks)
   */
  async mutate(script: string, params: Record<string, unknown> = {}): Promise<MutationResult> {
    this._mutations.push({ script, params });
    return { headers: [], rows: [] };
  }

  /**
   * Import data into multiple relations at once.
   *
   * @param data - Map of relation names to row arrays
   */
  async importRelations(data: Record<string, unknown[][]>): Promise<void> {
    for (const [relation, rows] of Object.entries(data)) {
      this._relations.set(relation, rows);
    }
  }

  /**
   * Export data from specified relations.
   *
   * @param relations - Names of relations to export
   * @returns Map of relation names to row arrays
   */
  async exportRelations(relations: string[]): Promise<Record<string, unknown[][]>> {
    const result: Record<string, unknown[][]> = {};
    for (const relation of relations) {
      const rows = this._relations.get(relation);
      if (rows) {
        result[relation] = rows;
      }
    }
    return result;
  }

  /**
   * Create a backup (no-op for mock).
   *
   * @param _path - File path (ignored)
   */
  async backup(_path: string): Promise<void> {
    // No-op for mock - backups are not simulated
  }

  /**
   * History of all query calls made to this mock.
   */
  get queries(): RecordedCall[] {
    return [...this._queries];
  }

  /**
   * History of all mutation calls made to this mock.
   */
  get mutations(): RecordedCall[] {
    return [...this._mutations];
  }

  /**
   * The most recent query call.
   *
   * @throws Error if no queries have been made
   */
  get lastQuery(): RecordedCall {
    if (this._queries.length === 0) {
      throw new Error('No queries have been made');
    }
    return this._queries[this._queries.length - 1]!;
  }

  /**
   * The most recent mutation call.
   *
   * @throws Error if no mutations have been made
   */
  get lastMutation(): RecordedCall {
    if (this._mutations.length === 0) {
      throw new Error('No mutations have been made');
    }
    return this._mutations[this._mutations.length - 1]!;
  }

  /**
   * Reset all state: seeded data, headers, and call history.
   */
  reset(): void {
    this._relations.clear();
    this._headers.clear();
    this._queries = [];
    this._mutations = [];
  }

  /**
   * Parse relation columns from a relation body string.
   *
   * Handles formats like:
   * - `page_id, title, created_at` (simple columns)
   * - `page_id: $id, title` (parameter binding)
   * - `page_id: $id, title: $title` (multiple bindings)
   *
   * @param body - The content inside `*relation{ ... }`
   * @returns Array of column definitions
   */
  private parseRelationColumns(body: string): Array<{ name: string; param?: string }> {
    const columns: Array<{ name: string; param?: string }> = [];
    const parts = body.split(',').map((p) => p.trim());

    for (const part of parts) {
      // Check for parameter binding: `column_name: $param`
      const bindingMatch = part.match(/^(\w+)\s*:\s*\$(\w+)$/);
      if (bindingMatch) {
        columns.push({ name: bindingMatch[1]!, param: bindingMatch[2] });
      } else {
        // Simple column name
        const nameMatch = part.match(/^(\w+)$/);
        if (nameMatch) {
          columns.push({ name: nameMatch[1]! });
        }
      }
    }

    return columns;
  }

  /**
   * Parse equality conditions from the where clause.
   *
   * Handles formats like:
   * - `column_name == $param`
   * - `entity_id == $entity_id`
   *
   * @param script - The full Datalog query script
   * @param params - Query parameters
   * @returns Array of column and value pairs
   */
  private parseEqualityConditions(
    script: string,
    params: Record<string, unknown>
  ): Array<{ column: string; value: unknown }> {
    const conditions: Array<{ column: string; value: unknown }> = [];

    // Match patterns like: column_name == $param
    const pattern = /(\w+)\s*==\s*\$(\w+)/g;
    let match = pattern.exec(script);

    while (match !== null) {
      const columnName = match[1]!;
      const paramName = match[2]!;
      if (paramName in params) {
        conditions.push({
          column: columnName,
          value: params[paramName],
        });
      }
      match = pattern.exec(script);
    }

    return conditions;
  }
}
