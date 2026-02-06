# Package Dependency Graph

## 10-Package Monorepo

```
types (zero dependencies — leaf node)
├── test-utils
├── query-lang
├── graph-algorithms
├── migrations
│
└── core (depends: types, query-lang, graph-algorithms, migrations)
    ├── ui-primitives (depends: types, core)
    ├── cli (depends: core)
    ├── desktop (depends: core, ui-primitives)
    └── tui (depends: core)
```

## Package Roles

| Package | Role | Dependencies |
|---------|------|-------------|
| `types` | Shared TypeScript interfaces, domain types, error types | None |
| `test-utils` | MockGraphDB, test fixtures, custom matchers | types |
| `query-lang` | Datalog parser, AST, validator, transpiler to CozoScript | types |
| `graph-algorithms` | PageRank, community detection, link prediction, centrality | types |
| `migrations` | CozoDB schema creation and migration scripts | types |
| `core` | Repositories, services, business logic orchestration | types, query-lang, graph-algorithms, migrations |
| `ui-primitives` | Shared React components, design tokens, hooks | types, core |
| `cli` | Command-line tool (`double-bind init/import/export/query`) | core |
| `desktop` | Tauri v2 + React desktop application | core, ui-primitives |
| `tui` | Ink terminal client | core |

## Dependency Rules

1. **`types` imports nothing.** It is the leaf of the dependency tree.
2. **`core` never imports from `desktop`, `tui`, `cli`, or `ui-primitives`.** Flow is always downward.
3. **`core` never imports CozoDB directly.** It depends on the `GraphDB` interface from `types`.
4. **`desktop` is the only package that knows about Tauri.** Tauri APIs do not leak into core.
5. **`ui-primitives` is framework-coupled (React)** but client-agnostic (no Tauri, no Ink specifics).

## Build Order

TypeScript project references enforce this build order:

```
1. types
2. test-utils, query-lang, graph-algorithms, migrations  (parallel)
3. core
4. ui-primitives, cli, tui  (parallel)
5. desktop
```

<!-- TODO: Add mermaid diagram of dependency graph -->
<!-- TODO: Document which packages are publishable to npm -->
