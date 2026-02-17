# Package Specifications

## Overview

Each package in the monorepo has a specification document that defines its public API, internal structure, dependencies, and testing approach.

## Package Map

| Package                          | Spec                                 | Layer | Description                                 |
| -------------------------------- | ------------------------------------ | ----- | ------------------------------------------- |
| `@double-bind/types`             | [types.md](types.md)                 | 0     | Shared interfaces, domain types             |
| `@double-bind/test-utils`        | [test-utils.md](test-utils.md)       | 1     | MockDatabase, test factories                |
| `@double-bind/query-lang`        | [query-lang.md](query-lang.md)       | 1     | Query parser and transpiler                 |
| `@double-bind/migrations`        | [migrations.md](migrations.md)       | 1     | SQLite schema management                    |
| `@double-bind/core`              | [core.md](core.md)                   | 2     | Repositories, services, adapters, providers |
| `@double-bind/ui-primitives`     | [ui-primitives.md](ui-primitives.md) | 3     | Shared React components                     |
| `@double-bind/desktop`           | [desktop.md](desktop.md)             | 4     | Tauri + React desktop app                   |
| `@double-bind/mobile`            | —                                    | 1     | Mobile database adapter (op-sqlite)         |
| `@double-bind/mobile-primitives` | —                                    | 1     | Mobile UI primitives (React Native)         |
| `@double-bind/mobile-app`        | —                                    | 4     | Expo React Native app                       |

## Dependency Layers

```
Layer 0: types (zero dependencies)
Layer 1: test-utils, query-lang, migrations, mobile, mobile-primitives
Layer 2: core
Layer 3: ui-primitives
Layer 4: desktop, mobile-app
```

Higher layers depend on lower layers. Never the reverse.

## Specification Format

Each spec covers:

1. **Purpose** — what the package does
2. **Public API** — exported interfaces, functions, classes
3. **Internal Structure** — file organization
4. **Dependencies** — what it imports
5. **Testing** — what and how to test
