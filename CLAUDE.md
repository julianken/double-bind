# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

---

## Instructions

**Workflow:** Use `Skill(subagent-workflow)` for ALL multi-step work. Skip only for single-line fixes, pure research, or reading files. Full details: `.claude/skills/subagent-workflow/SKILL.md`

**Development Model:** This project is developed exclusively with AI agents. Never include time estimates or effort projections. Focus on dependencies, complexity, and completion status.

**Testing:** All code must pass tests locally before committing. Run the test suite and verify no failures before PRs. Vitest is configured to run sequentially (single fork) by default — do not override this. Parallel test execution causes severe system resource exhaustion.

**E2E Testing:** After running E2E tests, ALWAYS run `pnpm test:e2e:summary` to verify results. Terminal output may not show failure counts. **NEVER claim "no failures" without checking the summary.** See [docs/testing/e2e-fast.md](docs/testing/e2e-fast.md). **NEVER run E2E tests in parallel** — always use `--workers=1`. Parallel E2E execution causes severe system resource exhaustion.

**PRs:** All pull requests MUST use the template at `.github/PULL_REQUEST_TEMPLATE.md` if one exists.

**Pre-Commit Hooks:** Hooks run linting, type checking, and tests on changed files. Bypass with `--no-verify` when needed.

**Debug Artifacts:** Never commit `debug-*.spec.ts`, `*.bak`, or `console.log` statements. Hooks in `.claude/hooks/` block these.

---

## Project Context

**Double-Bind** — Local-first note-taking app with graph-native architecture (Roam Research-like).

**CS Contributions:** (1) Graph algorithms for PKM, (2) local-first graph-native architecture, (3) terminal client. See [docs/research/](docs/research/).

**Architecture Principle:** All business logic is TypeScript. The Rust shim is ~40 lines (IPC only, wrapping rusqlite). SQLite handles data persistence; graph algorithms run in TypeScript (recursive CTEs for traversal, heuristic scoring for PageRank). See [ADR-002](docs/decisions/002-language-typescript.md), [ADR-015](docs/decisions/015-sqlite-migration.md).

---

## Tech Stack

| Layer           | Technology                    | Version  |
| --------------- | ----------------------------- | -------- |
| Runtime         | Node.js                       | ≥20.0.0  |
| Package Manager | pnpm                          | 9.15.0   |
| Desktop Shell   | Tauri                         | v2       |
| Language        | TypeScript                    | 5.7+     |
| Frontend        | React + ProseMirror + Zustand | React 19 |
| Database        | SQLite (via rusqlite/better-sqlite3) | 3.x |
| Testing         | Vitest + Playwright           | —        |

---

## Monorepo Structure

```
Layer 0: types (zero deps)
Layer 1: test-utils, query-lang, graph-algorithms, migrations
Layer 2: core
Layer 3: ui-primitives
Layer 4: desktop, cli, tui
```

Higher layers import from lower layers. Never the reverse. See [docs/packages/](docs/packages/).

---

## Commands

```bash
pnpm install              # Install dependencies
pnpm dev                  # Vite dev server (frontend only)
pnpm dev:desktop          # Full Tauri app with hot reload
pnpm build                # Build all packages
pnpm build:desktop        # Build Tauri binary
pnpm test                 # Run all unit tests
pnpm test:unit            # Run unit tests only
pnpm test:e2e             # Layer 3: Playwright + mock Tauri
pnpm test:e2e:full        # Layer 4: Real Tauri binary
pnpm test:e2e:summary     # REQUIRED after E2E - parse JSON results
pnpm lint                 # Lint all packages
pnpm typecheck            # Type check all packages
pnpm clean                # Clean build artifacts
```

---

## Testing Layers

| Layer          | Tool                      | What It Tests                       | Speed  |
| -------------- | ------------------------- | ----------------------------------- | ------ |
| 1. Unit        | Vitest + MockDatabase     | Business logic, isolated            | Fast   |
| 2. Integration | Vitest + better-sqlite3   | SQL queries against real SQLite     | Fast   |
| 3. E2E Fast    | Playwright + Vite         | UI flows with mock Tauri IPC        | Medium |
| 4. E2E Full    | Playwright + Tauri binary | Full stack including Rust shim      | Slow   |

Use Layer 1-2 during development. Run Layer 3 before PRs. Run Layer 4 for IPC/Rust changes.

---

## AI Assistant Configuration

**Subagent Selection (MANDATORY):** When using the Task tool to spawn subagents, NEVER use generic agent types like `Explore`, `Plan`, `Bash`, or `general-purpose`. ALWAYS select specialized plugin agents that match the task domain:

| Task Domain | Preferred Agent Types |
|-------------|----------------------|
| Code exploration/tracing | `feature-dev:code-explorer` |
| Architecture design | `feature-dev:code-architect` |
| Code review | `feature-dev:code-reviewer`, `code-refactoring:code-reviewer` |
| React Native/Mobile | `multi-platform-apps:mobile-developer`, `multi-platform-apps:flutter-expert` |
| React/Frontend | `frontend-excellence:react-specialist`, `frontend-excellence:state-manager` |
| Database/Data layer | `database-design:database-architect`, `database-design:sql-pro` |
| Backend/API | `backend-development:backend-architect`, `backend-development:graphql-architect` |
| TypeScript | `javascript-typescript:typescript-pro` |
| Testing | `backend-development:tdd-orchestrator` |
| UI/Design | `ui-design:ui-designer`, `ui-design:accessibility-expert` |

Use `sonnet` model for specialized agents (not `haiku`) to ensure quality analysis.

**Context7 MCP:** Use Context7 for up-to-date library documentation:

- **SQLite** — SQL queries, FTS5, recursive CTEs
- **Tauri** (v2) — IPC, capabilities, window management
- **ProseMirror** — Editor schema, plugins, transactions
- **React** (v19) — Hooks, Server Components, Suspense
- **Zustand** (v5) — Store creation, subscriptions, middleware

---

## Documentation Map

| Area           | Path                                         | Contents                                            |
| -------------- | -------------------------------------------- | --------------------------------------------------- |
| Architecture   | [docs/architecture/](docs/architecture/)     | System overview, tech stack, data flow, WASM option |
| Decisions      | [docs/decisions/](docs/decisions/)           | ADRs 001-015 (database, language, editor, etc.)     |
| Database       | [docs/database/](docs/database/)             | Schema, queries, migrations, FTS                    |
| Frontend       | [docs/frontend/](docs/frontend/)             | React, ProseMirror, state, graph viz                |
| Testing        | [docs/testing/](docs/testing/)               | 4-layer strategy, E2E guides                        |
| Security       | [docs/security/](docs/security/)             | Threat model, injection prevention                  |
| Packages       | [docs/packages/](docs/packages/)             | Per-package specs (10 packages)                     |
| Infrastructure | [docs/infrastructure/](docs/infrastructure/) | Monorepo, Rust shim, Tauri config                   |
