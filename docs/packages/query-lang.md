# @double-bind/query-lang

<!-- last-verified: 2026-02-16 -->

## Purpose

Implements the progressive disclosure query system. Parses user-friendly query syntax and transpiles it to executable queries. Provides the foundation for template-based and visual query interfaces.

> **Note:** This package was originally designed to transpile to CozoDB's Datalog (CozoScript). With the SQLite migration (ADR-015), the transpilation target needs to be updated to SQL. The parser and AST layers remain valid; the transpiler backend needs rewriting.

## Public API

### Parser

`parseQuery(input)` — Parses a user-friendly query string into a `QueryAST`.

### Transpiler

`compileQuery(input)` — Parse and transpile in one step. Returns `{ script, params }`.

### Template System

`getTemplates()` — Returns available query templates with parameter definitions.
`applyTemplate(templateId, values)` — Fills a template with user-provided values.

See `packages/query-lang/src/index.ts` for exports.

## Internal Structure

```
packages/query-lang/src/
├── index.ts
├── parser.ts          # Input string → QueryAST
├── transpiler.ts      # QueryAST → SQL (needs SQLite update)
├── validator.ts       # Query validation
├── templates/         # Query template definitions
└── types.ts           # QueryAST, Filter, etc.
```

## Dependencies

**Internal:** `@double-bind/types`

## Testing

Unit tests: parser (input → AST), transpiler (AST → query), validator, template parameter substitution.
