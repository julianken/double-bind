# Testing Strategy

## Philosophy

This project is developed exclusively by AI agents. Testing must be fully automated — no manual verification steps. Every phase of implementation must be verifiable by running a command that exits 0 or non-zero.

## Four Layers

| Layer | Tool | Speed | What It Tests |
|-------|------|-------|---------------|
| [Unit](unit-tests.md) | Vitest + MockGraphDB | Fast (<30s) | Business logic in isolation |
| [Integration](integration-tests.md) | Vitest + cozo-node | Moderate (<2min) | TypeScript against real CozoDB |
| [E2E Fast](e2e-fast.md) | Playwright + Vite | Moderate (<5min) | UI flows with mock Tauri IPC |
| [E2E Full](e2e-full.md) | Playwright + Tauri binary | Slow (<15min) | Complete application stack |

## Commands

```bash
pnpm test              # Layer 1: Unit tests across workspace
pnpm test:integration  # Layer 2: Integration tests (real CozoDB)
pnpm test:e2e          # Layer 3: Fast E2E (Playwright + Vite)
pnpm test:e2e:full     # Layer 4: Full E2E (Playwright + Tauri binary)
pnpm test:all          # All layers sequentially
```

## Coverage by Layer

```
Layer 1 (Unit)
├── Repository query construction
├── Service orchestration logic
├── Content parser (links, refs, tags)
├── Graph algorithm correctness
├── Query language parser/transpiler
├── React component rendering
└── State management logic

Layer 2 (Integration)
├── Datalog queries execute correctly against CozoDB
├── Schema migrations apply successfully
├── Index consistency (blocks_by_page, blocks_by_parent)
├── FTS indexing and search
├── Graph algorithm queries (PageRank, community detection)
└── Edge cases (concurrent writes, large datasets)

Layer 3 (E2E Fast)
├── Page CRUD flows
├── Block editor interactions
├── Navigation (sidebar, page links, backlinks)
├── Search UI
├── Graph visualization rendering
└── Keyboard shortcuts

Layer 4 (E2E Full)
├── Application launches without crashing
├── Tauri IPC serialization round-trip
├── ScriptMutability enforcement (Rust shim)
├── Database persistence across restarts
├── Backup command writes to filesystem
└── Security: mutate blocklist enforcement
```

## CI Pipeline

See [CI Pipeline](ci-pipeline.md) for the full continuous integration configuration.

## Principles

1. **Every test is deterministic** — no flaky tests, no timing dependencies
2. **Tests own their data** — each test creates its own state, no shared fixtures between tests
3. **Fast feedback first** — unit tests run on every save, full E2E only on merge
4. **Test behavior, not implementation** — assert on outputs and side effects, not internal state
5. **MockGraphDB mirrors real CozoDB** — mock must reject the same invalid queries

<!-- TODO: Define test naming conventions -->
<!-- TODO: Define test file organization per package -->
<!-- TODO: Define snapshot testing policy (avoid or use sparingly) -->
