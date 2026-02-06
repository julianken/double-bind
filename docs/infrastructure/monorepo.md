# Monorepo Structure

## Package Manager

pnpm with workspaces. Chosen for:
- Strict dependency isolation (no phantom dependencies)
- Efficient disk usage (content-addressable store)
- Fast install times
- Good monorepo support via `pnpm-workspace.yaml`

## Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
```

## Package Dependency Graph

```
types (zero deps)
  │
  ├── test-utils
  ├── query-lang
  ├── graph-algorithms
  ├── migrations
  │
  └── core (deps: types, query-lang, graph-algorithms, migrations)
      │
      ├── ui-primitives (deps: types, core)
      │
      ├── desktop (deps: core, ui-primitives)
      ├── tui (deps: core)
      └── cli (deps: core)
```

See [Dependency Graph](../architecture/dependency-graph.md) for detailed analysis.

## Package Inventory

| Package | Path | Purpose | Dependencies |
|---------|------|---------|-------------|
| `@double-bind/types` | `packages/types` | Shared interfaces, domain types, error types | None |
| `@double-bind/test-utils` | `packages/test-utils` | MockGraphDB, fixtures, test factories | types |
| `@double-bind/query-lang` | `packages/query-lang` | Datalog parser, validator, transpiler | types |
| `@double-bind/graph-algorithms` | `packages/graph-algorithms` | Network science algorithms | types |
| `@double-bind/migrations` | `packages/migrations` | CozoDB schema creation/migration | types |
| `@double-bind/core` | `packages/core` | Business logic (repos, services, client) | types, query-lang, graph-algorithms, migrations |
| `@double-bind/ui-primitives` | `packages/ui-primitives` | Shared React components | types, core |
| `@double-bind/desktop` | `packages/desktop` | Tauri + React desktop app | core, ui-primitives |
| `@double-bind/cli` | `packages/cli` | Command-line tool | core |
| `@double-bind/tui` | `packages/tui` | Terminal UI (Ink) | core |

## Dependency Rules

1. **`types` has zero dependencies** — it defines interfaces only
2. **`core` never imports CozoDB directly** — it depends on the `GraphDB` interface from `types`
3. **UI packages never import CozoDB** — they go through `core` services
4. **`desktop` is the only package that knows about Tauri** — Tauri `invoke()` calls live in the desktop package's `GraphDB` implementation
5. **`test-utils` depends only on `types`** — it provides mocks of the `GraphDB` interface
6. **No circular dependencies** — enforced by build order

## Build Order

Packages are built in topological order:

```
1. types
2. test-utils, query-lang, graph-algorithms, migrations  (parallel)
3. core
4. ui-primitives
5. desktop, cli, tui  (parallel)
```

## Package Template

Each package follows the same structure:

```
packages/{name}/
├── package.json
├── tsconfig.json
├── vitest.config.ts (if testable)
├── src/
│   ├── index.ts        # Public API (barrel export)
│   └── ...
└── test/
    ├── unit/
    │   └── ...
    └── integration/    (core package only)
        └── ...
```

### package.json Template

```json
{
  "name": "@double-bind/{name}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc --build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@double-bind/types": "workspace:*"
  },
  "devDependencies": {
    "@double-bind/test-utils": "workspace:*",
    "vitest": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

### tsconfig.json Template

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "references": [
    { "path": "../types" }
  ]
}
```

## Root Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Workspace root, shared scripts, shared devDependencies |
| `pnpm-workspace.yaml` | Workspace package locations |
| `tsconfig.base.json` | Shared TypeScript compiler options |
| `vitest.workspace.ts` | Vitest workspace configuration |
| `.eslintrc.js` | Shared ESLint configuration |
| `.prettierrc` | Shared Prettier configuration |
| `CLAUDE.md` | AI agent instructions |

## Scripts (Root)

```json
{
  "scripts": {
    "build": "pnpm -r --sort build",
    "test": "vitest run --workspace",
    "test:watch": "vitest --workspace",
    "test:integration": "vitest run --workspace --project core-integration",
    "test:e2e": "pnpm --filter @double-bind/desktop run test:e2e",
    "test:e2e:full": "pnpm --filter @double-bind/desktop run test:e2e:full",
    "test:all": "pnpm test && pnpm test:integration && pnpm test:e2e",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "dev": "pnpm --filter @double-bind/desktop dev",
    "clean": "pnpm -r exec rm -rf dist node_modules"
  }
}
```

## Development Environment Requirements

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20.x LTS | Required for `cozo-node` NAPI compatibility |
| pnpm | 9.x | Managed via corepack (`packageManager` field in root `package.json`) |
| Rust | stable (latest) | No MSRV policy — always use latest stable |
| Cargo | (bundled with Rust) | `Cargo.lock` committed for reproducible builds |

### Corepack Configuration

```json
// root package.json
{
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.0.0"
  }
}
```

Developers run `corepack enable` once. pnpm version is then locked to the exact version in `packageManager`.

### Rust Toolchain

No `rust-toolchain.toml` — use whatever stable Rust is installed. CozoDB 0.7 compiles on any recent stable Rust. Pin the exact CozoDB patch version in `Cargo.lock` (committed to git).

### Package Versioning

All packages are `"private": true` and start at `"version": "0.1.0"`. No npm publishing. No changelogs. Version bumps are coordinated manually (lockstep) since all packages ship together in the desktop binary.

### ESLint Configuration

Shared flat config at root (`eslint.config.js`). Rules:
- `@typescript-eslint/recommended` preset
- `no-console: warn` (use structured logging in services)
- `@typescript-eslint/no-explicit-any: error`
- `import/no-cycle: error` (prevent circular dependencies)
