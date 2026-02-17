# SQL Injection Prevention

<!-- last-verified: 2026-02-16 -->

## Parameterized Queries: The Primary Defense

All database queries use parameterized SQL. User-supplied values are bound as parameters, never interpolated into SQL strings:

```typescript
// In BlockRepository — the SQL template is a compile-time constant
const QUERY = 'SELECT block_id, content FROM blocks WHERE block_id = $id AND is_deleted = 0';

async getById(id: string): Promise<Block | null> {
  return this.db.query(QUERY, { id });
}
```

The `$param` syntax ensures values are bound as data, never parsed as SQL structure.

## What Parameters Cannot Protect

Parameters can only appear where data values are expected. These structural elements cannot be parameterized:

| Element        | Example                 |     Parameterizable?     |
| -------------- | ----------------------- | :----------------------: |
| Data values    | `WHERE age > $min_age`  |           Yes            |
| Table names    | `FROM blocks`           |          **No**          |
| Column names   | `SELECT title, content` |          **No**          |
| SQL keywords   | `ORDER BY`, `GROUP BY`  |          **No**          |
| FTS5 operators | `MATCH $query`          | Values yes, operators no |

## The Rule

**All SQL strings are hardcoded templates in the repository layer.** No structural element of a query is ever derived from user input. Table names, column names, and operators are literals in the TypeScript source code.

The only dynamic parts are parameter values (`$id`, `$title`, `$query`).

## Edge Case: Dynamic Table Selection

If the app ever needs to query different tables based on user input (e.g., a plugin system), use a whitelist:

```typescript
const ALLOWED_TABLES = new Set(['pages', 'blocks', 'tags', 'links']);

function queryTable(table: string, params: Record<string, unknown>) {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Unknown table: ${table}`);
  }
  // Safe to interpolate because it's from a known-good set
  return db.query(`SELECT * FROM ${table} WHERE id = $id`, params);
}
```

This is a last resort. Prefer hardcoded query templates.

## FTS5-Specific Considerations

FTS5 MATCH queries accept a query string that supports operators (`AND`, `OR`, `NOT`, `*`, `"phrase"`). The `SearchService` sanitizes FTS query input to prevent malformed queries. See `packages/core/src/services/search-service.ts` for the sanitization logic.
