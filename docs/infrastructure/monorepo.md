# Monorepo Structure

<!-- last-verified: 2026-02-16 -->

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
  ├── migrations
  ├── mobile, mobile-primitives
  │
  └── core (deps: types, migrations)
      │
      ├── ui-primitives (deps: types)
      │
      ├── desktop (deps: core, ui-primitives, migrations, query-lang, types)
      └── mobile-app (deps: mobile, mobile-primitives, core, types)
```

## Package Inventory

| Package                          | Path                         | Purpose                                      | Internal Dependencies                              |
| -------------------------------- | ---------------------------- | -------------------------------------------- | -------------------------------------------------- |
| `@double-bind/types`             | `packages/types`             | Shared interfaces, domain types, error types | None                                               |
| `@double-bind/test-utils`        | `packages/test-utils`        | MockDatabase, fixtures, test factories       | types                                              |
| `@double-bind/query-lang`        | `packages/query-lang`        | Query parser and transpiler                  | types                                              |
| `@double-bind/migrations`        | `packages/migrations`        | SQLite schema and migration runner           | types                                              |
| `@double-bind/core`              | `packages/core`              | Business logic (repos, services, adapters)   | types, migrations                                  |
| `@double-bind/ui-primitives`     | `packages/ui-primitives`     | Shared React components                      | types                                              |
| `@double-bind/desktop`           | `packages/desktop`           | Tauri + React desktop app                    | core, ui-primitives, migrations, query-lang, types |
| `@double-bind/mobile`            | `packages/mobile`            | Mobile database adapter (op-sqlite)          | types                                              |
| `@double-bind/mobile-primitives` | `packages/mobile-primitives` | Mobile UI primitives (React Native)          | types                                              |
| `@double-bind/mobile-app`        | `packages/mobile-app`        | Expo React Native app                        | mobile, mobile-primitives, core, types             |

## Dependency Rules

1. **`types` has zero dependencies** — it defines interfaces only
2. **`core` never imports SQLite directly** — it depends on the `Database` interface from `types`
3. **UI packages never import database libraries** — they go through `core` services
4. **`desktop` is the only package that knows about Tauri** — Tauri `invoke()` calls live in the desktop package's `DatabaseProvider` implementation
5. **`test-utils` depends only on `types`** — it provides mocks of the `Database` interface
6. **No circular dependencies** — enforced by build order

## Build Order

Packages are built in topological order:

```
1. types
2. test-utils, query-lang, migrations, mobile, mobile-primitives  (parallel)
3. core
4. ui-primitives
5. desktop, mobile-app  (parallel)
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

## Root Configuration Files

| File                  | Purpose                                                |
| --------------------- | ------------------------------------------------------ |
| `package.json`        | Workspace root, shared scripts, shared devDependencies |
| `pnpm-workspace.yaml` | Workspace package locations                            |
| `tsconfig.base.json`  | Shared TypeScript compiler options                     |
| `vitest.workspace.ts` | Vitest workspace configuration                         |
| `.eslintrc.js`        | Shared ESLint configuration                            |
| `.prettierrc`         | Shared Prettier configuration                          |
| `CLAUDE.md`           | AI agent instructions                                  |

## Development Environment Requirements

| Tool    | Version             | Notes                                          |
| ------- | ------------------- | ---------------------------------------------- |
| Node.js | >=20.0.0            | LTS recommended                                |
| pnpm    | 9.x                 | Managed via corepack                           |
| Rust    | stable (latest)     | No MSRV policy — always use latest stable      |
| Cargo   | (bundled with Rust) | `Cargo.lock` committed for reproducible builds |

### Package Versioning

All packages are `"private": true` and start at `"version": "0.1.0"`. No npm publishing. No changelogs. Version bumps are coordinated manually (lockstep) since all packages ship together in the desktop binary.
