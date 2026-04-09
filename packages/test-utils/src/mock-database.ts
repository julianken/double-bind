import type {
  Database,
  QueryResult,
  MutationResult,
  TransactionContext,
} from '@double-bind/types';

/**
 * Recorded query or mutation call for test inspection.
 */
export interface RecordedCall {
  script: string;
  params: Record<string, unknown>;
}

/**
 * In-memory mock implementation of the Database interface.
 *
 * MockDatabase does NOT evaluate Datalog. Instead, it uses pattern matching
 * on the query string to determine which seeded data to return.
 *
 * Use this for unit tests that verify:
 * - Correct query strings are constructed
 * - Correct params are passed
 * - Results are correctly mapped to domain types
 *
 * Use Layer 2 integration tests with real CozoDB for testing Datalog semantics.
 */
export class MockDatabase implements Database {
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
   * db.seed('pages', [
   *   ['page-1', 'My Page', 1700000000, 1700000000, false, null],
   *   ['page-2', 'Other Page', 1700000000, 1700000000, false, null],
   * ]);
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

    // Try SQL parsing first (post-SQLite migration)
    const sqlResult = this.parseSqlSelect<T>(script, params);
    if (sqlResult) return sqlResult;

    // Fall back to Datalog parsing (legacy)
    const relationMatch = script.match(/\*(\w+)\s*\{/);
    if (!relationMatch) {
      return { headers: [], rows: [] };
    }

    const relationName = relationMatch[1]!;
    const seededRows = this._relations.get(relationName);
    if (!seededRows) {
      return { headers: [], rows: [] };
    }

    const columnsMatch = script.match(/\?\s*\[\s*([^\]]+)\s*\]/);
    const requestedColumns = columnsMatch ? columnsMatch[1]!.split(',').map((c) => c.trim()) : [];

    const bodyMatch = script.match(/\*\w+\s*\{\s*([^}]+)\s*\}/);
    const relationColumns = bodyMatch ? this.parseRelationColumns(bodyMatch[1]!) : [];

    if (relationColumns.length > 0 && !this._headers.has(relationName)) {
      this._headers.set(
        relationName,
        relationColumns.map((c) => c.name)
      );
    }

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

    const equalityConditions = this.parseEqualityConditions(script, params);
    for (const cond of equalityConditions) {
      const colIndex = relationColumns.findIndex((c) => c.name === cond.column);
      if (colIndex !== -1) {
        filteredRows = filteredRows.filter((row) => row[colIndex] === cond.value);
      }
    }

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
   * Handles basic :put operations by extracting column names and values from
   * the mutation script and storing them in the in-memory relations.
   *
   * @param script - Datalog mutation script
   * @param params - Optional named parameters
   * @returns Mutation result (empty for mocks)
   */
  async mutate(script: string, params: Record<string, unknown> = {}): Promise<MutationResult> {
    this._mutations.push({ script, params });

    // Try SQL mutation first (post-SQLite migration)
    if (this.parseSqlMutation(script, params)) {
      return { headers: [], rows: [] };
    }

    // Split script by transaction blocks or find individual statements
    // Each block or statement may have ?[...] <- [[...]] and :put
    const statements = this.extractStatements(script);

    for (const statement of statements) {
      // Extract :put operation - format: :put relation_name { col1, col2, ... }
      const putMatch = statement.match(/:put\s+(\w+)\s*\{\s*([^}]+)\s*\}/);
      if (!putMatch) continue;

      const relationName = putMatch[1]!;
      const columns = putMatch[2]!
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      // Extract the data row from ?[...] <- [[...]] pattern in this statement
      const dataMatch = statement.match(/\?\s*\[[^\]]+\]\s*<-\s*\[\s*\[([\s\S]*?)\]\s*\]/);
      if (!dataMatch) continue;

      // Parse the values - format: $param1, $param2, ...
      const valueExpressions = dataMatch[1]!
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);

      // Resolve values from parameters
      const row: unknown[] = [];
      for (const expr of valueExpressions) {
        if (expr.startsWith('$')) {
          const paramName = expr.slice(1);
          row.push(params[paramName] ?? null);
        } else if (expr === 'false' || expr === 'true') {
          row.push(expr === 'true');
        } else if (expr === 'null') {
          row.push(null);
        } else if (!isNaN(Number(expr))) {
          row.push(Number(expr));
        } else {
          // Try to parse as string (remove quotes if present)
          const strMatch = expr.match(/^["'](.*)["']$/);
          row.push(strMatch ? strMatch[1] : expr);
        }
      }

      // Get or create the relation
      const existingRows = this._relations.get(relationName) ?? [];

      // For :put operations, we need to handle upsert logic
      // Check if this is an update (first column matches existing row)
      if (row.length > 0 && existingRows.length > 0) {
        const primaryKey = row[0];
        const existingIndex = existingRows.findIndex((r) => r[0] === primaryKey);
        if (existingIndex !== -1) {
          // Update existing row
          existingRows[existingIndex] = row;
          this._relations.set(relationName, existingRows);
        } else {
          // Insert new row
          this._relations.set(relationName, [...existingRows, row]);
        }
      } else {
        // Insert new row
        this._relations.set(relationName, [...existingRows, row]);
      }

      // Store headers for this relation
      if (!this._headers.has(relationName)) {
        this._headers.set(relationName, columns);
      }
    }

    return { headers: [], rows: [] };
  }

  /**
   * Execute multiple operations within a transaction.
   * For mock implementation, transactions perform immediately without isolation.
   *
   * @param fn - Function that receives a transaction context
   * @returns The result returned by the transaction function
   */
  async transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    // Mock transactions perform immediately without isolation
    const mockTx: TransactionContext = {
      query: async <TResult = unknown>(script: string, params?: Record<string, unknown>) => {
        const result = await this.query<TResult>(script, params);
        // TransactionContext.query returns T[] (flat array of objects).
        // MockDatabase.query returns QueryResult with rows: T[][] (array of arrays).
        // Flatten: each inner array becomes one element in the output.
        return result.rows.flat() as TResult[];
      },
      execute: async (script: string, params?: Record<string, unknown>) => {
        // Delegate to mutate so mock state is actually modified
        const result = await this.mutate(script, params);
        return { affectedRows: result.rows.length };
      },
    };
    return fn(mockTx);
  }

  /**
   * Extract individual statements from a mutation script.
   * Handles transaction blocks { } and standalone statements.
   */
  private extractStatements(script: string): string[] {
    const statements: string[] = [];
    let depth = 0;
    let currentStatement = '';

    for (let i = 0; i < script.length; i++) {
      const char = script[i]!;

      if (char === '{') {
        depth++;
        if (depth === 1) {
          // Start of a new transaction block
          currentStatement = '';
          continue;
        }
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          // End of transaction block
          if (currentStatement.trim()) {
            statements.push(currentStatement.trim());
          }
          currentStatement = '';
          continue;
        }
      }

      currentStatement += char;
    }

    // Handle scripts without transaction blocks
    if (statements.length === 0 && currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    return statements;
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
   * Restore from a backup (no-op for mock).
   *
   * @param _path - File path (ignored)
   */
  async restore(_path: string): Promise<void> {
    // No-op for mock - restores are not simulated
  }

  /**
   * Import relations from a backup (no-op for mock).
   *
   * @param _path - File path (ignored)
   * @param _relations - Relation names (ignored)
   */
  async importRelationsFromBackup(_path: string, _relations: string[]): Promise<void> {
    // No-op for mock - backup imports are not simulated
  }

  /**
   * Track if the mock has been closed.
   */
  private _closed = false;

  /**
   * Close the database (no-op for mock).
   * After calling, all methods will throw.
   */
  async close(): Promise<void> {
    this._closed = true;
  }

  /**
   * Check if the mock has been closed.
   */
  get isClosed(): boolean {
    return this._closed;
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
   * Parse a SQL SELECT statement and return matching seeded data.
   * Returns null if the script is not a SQL SELECT.
   */
  private parseSqlSelect<T>(
    script: string,
    params: Record<string, unknown>
  ): QueryResult<T> | null {
    const fromMatch = script.match(/FROM\s+(\w+)/i);
    if (!fromMatch) return null;

    const tableName = fromMatch[1]!;
    const seededRows = this._relations.get(tableName);
    if (!seededRows) {
      return { headers: [], rows: [] };
    }

    // Extract SELECT columns (handles quoted columns like "order")
    const selectMatch = script.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
    const columns = selectMatch
      ? selectMatch[1]!
          .split(',')
          .map((c) => c.trim().replace(/^"|"$/g, ''))
          .filter((c) => c.length > 0)
      : [];

    // Store column mapping for this table
    if (columns.length > 0) {
      this._headers.set(tableName, columns);
    }

    // Parse WHERE conditions
    let filteredRows = [...seededRows];
    const whereMatch = script.match(/WHERE\s+([\s\S]+?)(?:ORDER|LIMIT|GROUP|$)/i);
    if (whereMatch) {
      const whereClauses = whereMatch[1]!.split(/\s+AND\s+/i);
      for (const clause of whereClauses) {
        const trimmed = clause.trim();

        // column IS NULL
        const isNullMatch = trimmed.match(/^"?(\w+)"?\s+IS\s+NULL$/i);
        if (isNullMatch) {
          const colIdx = columns.indexOf(isNullMatch[1]!);
          if (colIdx !== -1) {
            filteredRows = filteredRows.filter((row) => row[colIdx] === null || row[colIdx] === undefined);
          }
          continue;
        }

        // column IS NOT NULL
        const isNotNullMatch = trimmed.match(/^"?(\w+)"?\s+IS\s+NOT\s+NULL$/i);
        if (isNotNullMatch) {
          const colIdx = columns.indexOf(isNotNullMatch[1]!);
          if (colIdx !== -1) {
            filteredRows = filteredRows.filter((row) => row[colIdx] !== null && row[colIdx] !== undefined);
          }
          continue;
        }

        // column = $param
        const paramMatch = trimmed.match(/^"?(\w+)"?\s*=\s*\$(\w+)$/);
        if (paramMatch) {
          const colName = paramMatch[1]!;
          const paramName = paramMatch[2]!;
          if (paramName in params) {
            const colIdx = columns.indexOf(colName);
            if (colIdx !== -1) {
              filteredRows = filteredRows.filter((row) => row[colIdx] === params[paramName]);
            }
          }
          continue;
        }

        // column = literal (number)
        const literalMatch = trimmed.match(/^"?(\w+)"?\s*=\s*(\d+)$/);
        if (literalMatch) {
          const colName = literalMatch[1]!;
          const literalValue = Number(literalMatch[2]);
          const colIdx = columns.indexOf(colName);
          if (colIdx !== -1) {
            filteredRows = filteredRows.filter((row) => {
              // Handle boolean/integer comparison (SQLite stores booleans as 0/1)
              if (typeof row[colIdx] === 'boolean') {
                return row[colIdx] === (literalValue !== 0);
              }
              return row[colIdx] === literalValue;
            });
          }
          continue;
        }

        // LOWER(column) = LOWER($param) — case-insensitive match
        const lowerMatch = trimmed.match(/^LOWER\("?(\w+)"?\)\s*=\s*LOWER\(\$(\w+)\)$/i);
        if (lowerMatch) {
          const colName = lowerMatch[1]!;
          const paramName = lowerMatch[2]!;
          if (paramName in params) {
            const colIdx = columns.indexOf(colName);
            if (colIdx !== -1) {
              const paramValue = String(params[paramName]).toLowerCase();
              filteredRows = filteredRows.filter(
                (row) => String(row[colIdx]).toLowerCase() === paramValue
              );
            }
          }
          continue;
        }
      }
    }

    return {
      headers: columns,
      rows: filteredRows as T[][],
    };
  }

  /**
   * Parse a SQL mutation (INSERT/UPDATE/DELETE) and update seeded data.
   * Returns true if handled, false if not a recognized SQL mutation.
   */
  private parseSqlMutation(script: string, params: Record<string, unknown>): boolean {
    // INSERT INTO table (cols) VALUES ($params)
    const insertMatch = script.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (insertMatch) {
      const tableName = insertMatch[1]!;
      const columns = insertMatch[2]!.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const valuePlaceholders = insertMatch[3]!.split(',').map((v) => v.trim());

      const row: unknown[] = valuePlaceholders.map((v) => {
        if (v.startsWith('$')) {
          return params[v.slice(1)] ?? null;
        }
        if (v === 'NULL' || v === 'null') return null;
        if (!isNaN(Number(v))) return Number(v);
        return v.replace(/^'|'$/g, '');
      });

      const existing = this._relations.get(tableName) ?? [];
      // Upsert: check if primary key (first column) matches
      const existingIdx = existing.findIndex((r) => r[0] === row[0]);
      if (existingIdx !== -1) {
        existing[existingIdx] = row;
      } else {
        existing.push(row);
      }
      this._relations.set(tableName, existing);

      if (!this._headers.has(tableName)) {
        this._headers.set(tableName, columns);
      }
      return true;
    }

    // UPDATE table SET col = $param WHERE ...
    const updateMatch = script.match(/UPDATE\s+(\w+)\s+SET\s+([\s\S]+?)\s+WHERE\s+([\s\S]+?)$/i);
    if (updateMatch) {
      const tableName = updateMatch[1]!;
      const headers = this._headers.get(tableName) ?? [];
      const setClauses = updateMatch[2]!.split(',').map((s) => s.trim());
      const whereClause = updateMatch[3]!.trim();

      // Parse WHERE to find matching rows
      const whereParamMatch = whereClause.match(/"?(\w+)"?\s*=\s*\$(\w+)/);
      const existing = this._relations.get(tableName) ?? [];

      if (whereParamMatch && whereParamMatch[2]! in params) {
        const whereCol = whereParamMatch[1]!;
        const whereIdx = headers.indexOf(whereCol);
        const whereVal = params[whereParamMatch[2]!];

        for (const row of existing) {
          if (whereIdx !== -1 && row[whereIdx] === whereVal) {
            for (const clause of setClauses) {
              const setMatch = clause.match(/^"?(\w+)"?\s*=\s*\$(\w+)$/);
              if (setMatch && setMatch[2]! in params) {
                const setIdx = headers.indexOf(setMatch[1]!);
                if (setIdx !== -1) {
                  row[setIdx] = params[setMatch[2]!];
                }
              }
            }
          }
        }
      }
      return true;
    }

    // DELETE FROM table WHERE ...
    const deleteMatch = script.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+([\s\S]+?)$/i);
    if (deleteMatch) {
      const tableName = deleteMatch[1]!;
      const headers = this._headers.get(tableName) ?? [];
      const whereClause = deleteMatch[2]!.trim();

      const whereParamMatch = whereClause.match(/"?(\w+)"?\s*=\s*\$(\w+)/);
      if (whereParamMatch && whereParamMatch[2]! in params) {
        const whereCol = whereParamMatch[1]!;
        const whereIdx = headers.indexOf(whereCol);
        const whereVal = params[whereParamMatch[2]!];

        const existing = this._relations.get(tableName) ?? [];
        this._relations.set(
          tableName,
          existing.filter((row) => !(whereIdx !== -1 && row[whereIdx] === whereVal))
        );
      }
      return true;
    }

    return false;
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

