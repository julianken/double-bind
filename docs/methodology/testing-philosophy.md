# Testing as Architectural Constraint

Double-Bind is developed by AI agents. No human runs the application to check if a feature works. This inverts the typical relationship with testing: instead of "automate what you can," the constraint is **nothing manual is acceptable**. Every verification step must be a command that exits 0 or non-zero. If a behavior cannot be tested by a command, it cannot be verified at all.

This constraint shapes the architecture. Features are designed to be testable from the start, not retrofitted with tests afterward. The full testing strategy is documented in [`docs/testing/README.md`](../testing/README.md).

## Four-Layer Strategy

| Layer | Tool | What It Tests |
|-------|------|---------------|
| Unit | Vitest + MockDatabase | Business logic in isolation -- query construction, content parsing, graph algorithms, state management |
| Integration | Vitest + better-sqlite3 | SQL queries against real SQLite -- migrations, FTS5 indexing, query plans, edge cases |
| E2E Fast | Playwright + Vite | UI flows with mock Tauri IPC -- page CRUD, block editing, navigation, search, keyboard shortcuts |
| E2E Full | Playwright + Tauri binary | Complete application stack -- Tauri IPC round-trip, database persistence across restarts, full data integrity |

Unit and integration tests run during development. E2E Fast runs before every pull request. E2E Full runs when changes touch IPC or Rust code.

## The MockDatabase Rule

The mock must reject the same invalid queries as real SQLite. A mock that silently accepts malformed SQL gives false confidence. When a query fails against real SQLite in integration tests, the mock is updated to fail the same way. This keeps the unit test layer honest without requiring a real database for every test run.

## Five Enforcement Mechanisms

**Workflow gates.** The implementer agent must run the full test suite and produce passing output before opening a PR. The spec reviewer verifies that tests cover the acceptance criteria. The quality reviewer evaluates test quality and coverage.

**Pre-commit hooks.** Automated hooks block debug artifacts (`debug-*.spec.ts`, `*.bak`) and detect `console.log` additions in staged diffs before code is committed.

**E2E summary parser.** Terminal output from Playwright can obscure failure counts. A dedicated `pnpm test:e2e:summary` command parses the JSON results file and reports the actual pass/fail count. Agents are required to run this after every E2E execution.

**CI pipeline.** Continuous integration runs the full test suite as a final check before merge.

**Triple-agent review.** Three independent agent instances -- implementer, spec reviewer, quality reviewer -- each verify that tests pass. A test failure missed by one agent is likely caught by another.

## Principles

Tests are deterministic: no flaky tests, no timing dependencies. Each test owns its data: no shared fixtures between tests. Fast feedback comes first: unit tests run on every save, full E2E only before merge. Tests assert on behavior, not implementation: outputs and side effects, not internal state.
