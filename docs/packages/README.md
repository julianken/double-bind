# Package Specifications

## Overview

Each package in the monorepo has a specification document that defines its public API, internal structure, dependencies, and testing approach.

## Package Map

| Package | Spec | Category | Description |
|---------|------|----------|-------------|
| `@double-bind/types` | [types.md](types.md) | Foundation | Shared interfaces, domain types |
| `@double-bind/test-utils` | [test-utils.md](test-utils.md) | Foundation | MockGraphDB, test factories |
| `@double-bind/query-lang` | [query-lang.md](query-lang.md) | Feature | Datalog parser & transpiler |
| `@double-bind/graph-algorithms` | [graph-algorithms.md](graph-algorithms.md) | Feature | Network science algorithms |
| `@double-bind/migrations` | [migrations.md](migrations.md) | Infrastructure | CozoDB schema management |
| `@double-bind/core` | [core.md](core.md) | Business Logic | Repositories, services, client |
| `@double-bind/ui-primitives` | [ui-primitives.md](ui-primitives.md) | UI | Shared React components |
| `@double-bind/desktop` | [desktop.md](desktop.md) | Application | Tauri + React desktop app |
| `@double-bind/cli` | [cli.md](cli.md) | Application | Command-line tool |
| `@double-bind/tui` | [tui.md](tui.md) | Application | Terminal UI (Ink) |

## Dependency Layers

```
Layer 0: types (zero dependencies)
Layer 1: test-utils, query-lang, graph-algorithms, migrations
Layer 2: core
Layer 3: ui-primitives
Layer 4: desktop, cli, tui
```

Higher layers depend on lower layers. Never the reverse.

## Specification Format

Each spec covers:
1. **Purpose** — what the package does
2. **Public API** — exported interfaces, functions, classes
3. **Internal Structure** — file organization
4. **Dependencies** — what it imports
5. **Testing** — what and how to test
6. **Open Questions** — decisions still needed
