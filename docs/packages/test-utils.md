# @double-bind/test-utils

<!-- last-verified: 2026-02-16 -->

## Purpose

Provides `MockDatabase` and test data factories for unit testing across all packages. Any package that tests code using the `Database` interface depends on this package.

## Public API

### MockDatabase

`MockDatabase` implements the `Database` interface for unit testing. It records all queries and mutations for assertion, and returns seeded data based on SQL pattern matching.

See `src/mock-database.ts` for the implementation.

**Key behavior:**

- `seed(tableName, rows)` — pre-load data that will be returned for queries matching that table
- `queries` / `mutations` — arrays of all calls made, for assertion
- `lastQuery` / `lastMutation` — most recent call
- `reset()` — clear all state

**What it does:** Returns seeded data when a query mentions a known table. Records all calls for inspection.

**What it does NOT do:** Evaluate SQL. It cannot join tables, filter rows, or execute WHERE clauses. Use integration tests with real SQLite for that.

### Test Factories

Factory functions for creating domain objects with sensible defaults:

- `createPage(overrides?)` — creates a `Page` with defaults
- `createBlock(overrides?)` — creates a `Block` with defaults
- `createLink(overrides?)`, `createBlockRef(overrides?)`, etc.

See `src/factories.ts`.

## Internal Structure

```
packages/test-utils/src/
├── index.ts           # Barrel export
├── mock-database.ts   # MockDatabase implementation
├── factories.ts       # createPage, createBlock, etc.
└── fixtures.ts        # Pre-built test scenarios
```

## Dependencies

**Internal:** `@double-bind/types`

## Testing

MockDatabase itself has tests verifying seeded data returns, call recording, and reset behavior.
