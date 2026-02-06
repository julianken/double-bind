# Build Tooling

## TypeScript

### Base Configuration

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": false,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "jsx": "react-jsx"
  }
}
```

Key choices:
- **`target: ES2022`** — system webviews support modern JS
- **`moduleResolution: bundler`** — matches Vite's resolution strategy
- **`strict: true`** — all strict checks enabled
- **`noUncheckedIndexedAccess: true`** — array/object index access returns `T | undefined`
- **`composite: true`** — enables project references for incremental builds

### Project References

Each package's `tsconfig.json` uses `references` to declare its dependencies:

```json
// packages/core/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "references": [
    { "path": "../types" },
    { "path": "../query-lang" },
    { "path": "../graph-algorithms" },
    { "path": "../migrations" }
  ]
}
```

This enables incremental builds — `tsc --build` only recompiles changed packages.

## Vite

The desktop package uses Vite for development and production builds.

```typescript
// packages/desktop/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'ES2022',
    outDir: 'dist',
  },
  // Resolve workspace packages
  resolve: {
    conditions: ['import', 'module', 'default'],
  },
});
```

### Why Vite (not webpack, esbuild, etc.)

- Fast HMR during development
- Good TypeScript + React support via `@vitejs/plugin-react`
- Simple configuration
- Tauri's official template uses Vite
- Handles workspace package resolution well

## ESLint

```javascript
// .eslintrc.js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
  ],
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
  rules: {
    // Enforce explicit return types on exported functions
    '@typescript-eslint/explicit-function-return-type': ['error', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
    }],
    // No floating promises
    '@typescript-eslint/no-floating-promises': 'error',
    // No unused vars (allow _prefix)
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    // Prefer const
    'prefer-const': 'error',
    // No console.log in production code (use structured logging)
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        // Relax rules for tests
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
  ],
};
```

### React-Specific Rules

For packages with React code (`ui-primitives`, `desktop`):

```javascript
// Additional extends
'plugin:react/recommended',
'plugin:react-hooks/recommended',

// Additional rules
'react/react-in-jsx-scope': 'off', // Not needed with React 17+ JSX transform
'react-hooks/exhaustive-deps': 'error',
```

## Prettier

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

## Vitest

### Workspace Configuration

```typescript
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: 'packages/types/vitest.config.ts',
    test: { name: 'types' },
  },
  {
    extends: 'packages/query-lang/vitest.config.ts',
    test: { name: 'query-lang' },
  },
  {
    extends: 'packages/graph-algorithms/vitest.config.ts',
    test: { name: 'graph-algorithms' },
  },
  {
    extends: 'packages/core/vitest.config.ts',
    test: { name: 'core-unit' },
  },
  {
    extends: 'packages/core/vitest.config.integration.ts',
    test: { name: 'core-integration' },
  },
  {
    extends: 'packages/ui-primitives/vitest.config.ts',
    test: { name: 'ui-primitives' },
  },
]);
```

### Test Environment by Package

| Package | Environment | Reason |
|---------|------------|--------|
| types | `node` | Pure types, minimal tests |
| test-utils | `node` | Node.js API |
| query-lang | `node` | Pure logic |
| graph-algorithms | `node` | Pure algorithms |
| migrations | `node` | CozoDB scripts |
| core (unit) | `node` | Business logic |
| core (integration) | `node` | cozo-node NAPI |
| ui-primitives | `jsdom` | React components |
| desktop | `jsdom` | React components |

## Runtime Validation: Zod

Zod validates data at the boundary between CozoDB and TypeScript:

```typescript
import { z } from 'zod';

const BlockRow = z.tuple([
  z.string(),  // block_id
  z.string(),  // page_id
  z.string().nullable(), // parent_id
  z.string(),  // content
  z.string(),  // content_type
  z.string(),  // order (string-based fractional indexing)
  z.boolean(), // is_collapsed
  z.boolean(), // is_deleted
  z.number(),  // created_at
  z.number(),  // updated_at
]);

function parseBlockRows(rows: unknown[][]): Block[] {
  return rows.map(row => {
    const [blockId, pageId, parentId, content, contentType, order, isCollapsed, isDeleted, createdAt, updatedAt] = BlockRow.parse(row);
    return { blockId, pageId, parentId, content, contentType, order, isCollapsed, isDeleted, createdAt, updatedAt };
  });
}
```

This catches type mismatches between CozoDB's untyped JSON output and TypeScript's expected types.

## Resolved Decisions

- **Dependency versions**: Exact patch versions are pinned at implementation time in `package.json` and `pnpm-lock.yaml`. Major version constraints: TypeScript 5.x, Vite 5.x, Vitest 2.x, ESLint 9.x (flat config), Prettier 3.x.
- **Import sorting**: `@trivago/prettier-plugin-sort-imports` — enforced via Prettier, no separate config.
- **Git hooks**: `husky` + `lint-staged` — runs `eslint --fix`, `prettier --write`, `tsc --noEmit` on staged files.
- **Bundle size budget**: Deferred — desktop app has no wire transfer concerns. Monitor via Vite's build output.
- **Biome**: Deferred. ESLint + Prettier ecosystem is mature and well-integrated with TypeScript.
