# Testing Strategy

## Philosophy

This project is developed exclusively by AI agents. Testing must be fully automated — no manual verification steps. Every phase of implementation must be verifiable by running a command that exits 0 or non-zero.

## Four Layers

| Layer                   | Tool                      | Speed    | What It Tests                   |
| ----------------------- | ------------------------- | -------- | ------------------------------- |
| Unit                    | Vitest + MockDatabase     | Fast     | Business logic in isolation     |
| Integration             | Vitest + better-sqlite3   | Fast     | SQL queries against real SQLite |
| [E2E Fast](e2e-fast.md) | Playwright + Vite         | Moderate | UI flows with mock Tauri IPC    |
| [E2E Full](e2e-full.md) | Playwright + Tauri binary | Slow     | Complete application stack      |

## Commands

```bash
pnpm test              # Unit tests across workspace
pnpm test:integration  # Integration tests (real SQLite via better-sqlite3)
pnpm test:e2e          # Fast E2E (Playwright + Vite)
pnpm test:e2e:full     # Full E2E (Playwright + Tauri binary)
pnpm test:e2e:summary  # REQUIRED after E2E — parse JSON results
```

## Coverage by Layer

```
Unit
├── Repository SQL query construction
├── Service orchestration logic
├── Content parser (links, refs, tags)
├── Graph algorithm correctness
├── React component rendering
└── State management logic

Integration
├── SQL queries execute correctly against real SQLite
├── Schema migrations apply successfully
├── Index usage and query plans
├── FTS5 indexing and search
├── Graph service queries (neighborhood, backlinks)
└── Edge cases (concurrent writes, large datasets)

E2E Fast
├── Page CRUD flows
├── Block editor interactions
├── Navigation (sidebar, page links, backlinks)
├── Search UI
├── Graph visualization rendering
└── Keyboard shortcuts

E2E Full
├── Application launches without crashing
├── Tauri IPC serialization round-trip
├── Database persistence across restarts
├── Backup command writes to filesystem
└── Full stack data integrity
```

## CI Pipeline

See [CI Pipeline](ci-pipeline.md) for the full continuous integration configuration.

## Principles

1. **Every test is deterministic** — no flaky tests, no timing dependencies
2. **Tests own their data** — each test creates its own state, no shared fixtures between tests
3. **Fast feedback first** — unit tests run on every save, full E2E only on merge
4. **Test behavior, not implementation** — assert on outputs and side effects, not internal state
5. **MockDatabase mirrors real SQLite** — mock must reject the same invalid queries
