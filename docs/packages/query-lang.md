# @double-bind/query-lang

## Purpose

Implements the progressive disclosure query system (CS Contribution #1). Parses user-friendly query syntax and transpiles it to CozoScript. Provides the foundation for Level 1 (templates) and Level 2 (visual builder) query interfaces.

## Public API

### Parser

```typescript
// Parse a user-friendly query string into an AST
function parseQuery(input: string): QueryAST;

interface QueryAST {
  type: 'find' | 'count' | 'graph';
  relation: string;       // 'pages', 'blocks', etc.
  filters: Filter[];
  projections: string[];  // column names to return
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
}

interface Filter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'greaterThan' | 'lessThan' | 'hasTag' | 'linkedTo';
  value: string | number | boolean;
}
```

### Transpiler

```typescript
// Convert AST to parameterized CozoScript
function transpileToCozo(ast: QueryAST): { script: string; params: Record<string, unknown> };

// Direct: parse + transpile in one step
function compileQuery(input: string): { script: string; params: Record<string, unknown> };
```

### Validator

```typescript
// Validate a raw CozoScript string (Level 3 queries)
function validateCozoScript(script: string): ValidationResult;

interface ValidationResult {
  valid: boolean;
  errors: Array<{
    message: string;
    line?: number;
    suggestion?: string;
  }>;
}
```

### Template System

```typescript
// Get available query templates
function getTemplates(): QueryTemplate[];

// Fill in a template with user-provided values
function applyTemplate(templateId: string, values: Record<string, unknown>): {
  script: string;
  params: Record<string, unknown>;
};

interface QueryTemplate {
  id: string;
  name: string;              // "Find pages by tag"
  description: string;       // "Find all pages with a specific tag"
  parameters: TemplateParam[];
  preview: string;           // Example output
}

interface TemplateParam {
  name: string;
  label: string;             // "Tag name"
  type: 'string' | 'number' | 'date' | 'relation';
  placeholder?: string;
}
```

## Example Transpilations

| User Query | CozoScript |
|-----------|------------|
| `find pages where title contains "meeting"` | `?[page_id, title] := *pages{ page_id, title, is_deleted: false }, contains(title, $filter_0)` |
| `find blocks tagged "important"` | `?[block_id, content] := *tags{ entity_id: block_id, tag: $tag }, *blocks{ block_id, content }` |
| `count pages` | `?[count(page_id)] := *pages{ page_id, is_deleted: false }` |
| `find pages linked from "Project Alpha"` | `?[page_id, title] := *links{ source_id: $source, target_id: page_id }, *pages{ page_id, title }` |

## Internal Structure

```
packages/query-lang/src/
├── index.ts           # Barrel export
├── parser.ts          # Input string → QueryAST
├── transpiler.ts      # QueryAST → CozoScript
├── validator.ts       # CozoScript validation
├── templates/
│   ├── index.ts       # Template registry
│   ├── page-queries.ts
│   ├── block-queries.ts
│   ├── graph-queries.ts
│   └── tag-queries.ts
└── types.ts           # QueryAST, Filter, etc.
```

## Dependencies

- `@double-bind/types` (for relation names, column names)

## Testing

Unit tests cover:
- Parser: various input formats → correct AST
- Transpiler: AST → valid CozoScript with correct params
- Validator: valid/invalid CozoScript → correct validation results
- Templates: parameter substitution, all templates produce valid CozoScript
- Edge cases: empty queries, unknown fields, SQL injection attempts

<!-- TODO: Define the user-friendly query syntax grammar (BNF/PEG) -->
<!-- TODO: Define the full template library -->
<!-- TODO: Define error recovery in the parser (partial queries) -->
<!-- TODO: Define autocomplete integration (provide completions from partial input) -->
<!-- TODO: Define CozoScript syntax highlighting token types -->
<!-- TODO: Evaluate whether to support natural language queries (via LLM, future) -->
