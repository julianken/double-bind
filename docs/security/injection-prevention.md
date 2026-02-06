# Datalog Injection Prevention

## Parameterized Queries: Strong but Partial Protection

CozoDB's `$param` syntax prevents value-level injection:

```datalog
-- Safe: $id is bound as a data value, never parsed as query structure
?[title] := *pages{ page_id: $id, title }
```

An attacker cannot break out of the value context to inject operators.

## What Parameters CANNOT Protect

Parameters can only appear where expressions (data values) are expected. These structural elements cannot be parameterized:

| Element | Example | Parameterizable? |
|---------|---------|:---:|
| Data values | `age > $min_age` | Yes |
| Relation names | `*my_relation{...}` | **No** |
| Column names | `name, age` | **No** |
| System commands | `::remove`, `::create` | **No** |
| Mutation operators | `:put`, `:rm` | **No** |
| Algorithm names | `<~ PageRank(...)` | **No** |

## The Rule

**All CozoScript strings are hardcoded templates in the repository layer.** No structural element of a query is ever derived from user input. Relation names, column names, and operators are literals in the TypeScript source code.

The only dynamic parts are parameter values:
```typescript
// In BlockRepository — the template is a compile-time constant
const QUERY = '?[block_id, content] := *blocks{ block_id: $id, content, is_deleted: false }';

async getById(id: string): Promise<Block | null> {
  return this.db.query(QUERY, { id });
}
```

## Edge Case: Dynamic Relation Selection

If the app ever needs to query different relations based on user input (e.g., a plugin system), use a whitelist:

```typescript
const ALLOWED_RELATIONS = new Set(['pages', 'blocks', 'tags', 'links']);

function queryRelation(relation: string, params: Record<string, unknown>) {
  if (!ALLOWED_RELATIONS.has(relation)) {
    throw new Error(`Unknown relation: ${relation}`);
  }
  // Now safe to interpolate because it's from a known-good set
  return db.query(`?[...] := *${relation}{...}`, params);
}
```

This is a last resort. Prefer hardcoded query templates.

## CozoDB's Dangerous Surface

If an attacker could inject arbitrary CozoScript:

| Operation | Danger Level |
|-----------|:---:|
| `::remove pages` | Drops the entire relation |
| `::set_triggers pages on put { ... }` | Installs persistent malicious code |
| `:replace pages { ... }` | Drops and recreates relation |
| `%loop ... :rm pages { ... } %end` | Iterative deletion |
| `::rename pages -> pwned` | Renames relation |

`ScriptMutability::Immutable` on the `query` command blocks all of these at the engine level.
