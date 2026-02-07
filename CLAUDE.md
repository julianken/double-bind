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

**CS Contributions:** (1) Datalog as user-facing query language, (2) graph algorithms for PKM, (3) local-first graph-native architecture, (4) terminal client. See [docs/research/](docs/research/).

**Architecture Principle:** All business logic is TypeScript. The Rust shim is ~40 lines (IPC only). CozoDB's Rust engine handles heavy computation (graph traversal, FTS, recursive queries). TypeScript orchestration adds ~0.2ms — imperceptible. See [ADR-002](docs/decisions/002-language-typescript.md).

---

## Tech Stack

| Layer           | Technology                    | Version  |
| --------------- | ----------------------------- | -------- |
| Runtime         | Node.js                       | ≥20.0.0  |
| Package Manager | pnpm                          | 9.15.0   |
| Desktop Shell   | Tauri                         | v2       |
| Language        | TypeScript                    | 5.7+     |
| Frontend        | React + ProseMirror + Zustand | React 19 |
| Database        | CozoDB (RocksDB backend)      | 0.7      |
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
| 1. Unit        | Vitest + MockGraphDB      | Business logic, isolated            | Fast   |
| 2. Integration | Vitest + cozo-node        | Datalog queries against real CozoDB | Fast   |
| 3. E2E Fast    | Playwright + Vite         | UI flows with mock Tauri IPC        | Medium |
| 4. E2E Full    | Playwright + Tauri binary | Full stack including Rust shim      | Slow   |

Use Layer 1-2 during development. Run Layer 3 before PRs. Run Layer 4 for IPC/Rust changes.

---

## AI Assistant Configuration

**Context7 MCP:** Use Context7 for up-to-date library documentation:

- **CozoDB** (v0.7) — Datalog queries, graph algorithms
- **Tauri** (v2) — IPC, capabilities, window management
- **ProseMirror** — Editor schema, plugins, transactions
- **React** (v19) — Hooks, Server Components, Suspense
- **Zustand** (v5) — Store creation, subscriptions, middleware

---

## Documentation Map

| Area           | Path                                         | Contents                                            |
| -------------- | -------------------------------------------- | --------------------------------------------------- |
| Architecture   | [docs/architecture/](docs/architecture/)     | System overview, tech stack, data flow, WASM option |
| Decisions      | [docs/decisions/](docs/decisions/)           | ADRs 001-013 (database, language, editor, etc.)     |
| Database       | [docs/database/](docs/database/)             | Schema, queries, migrations, FTS                    |
| Frontend       | [docs/frontend/](docs/frontend/)             | React, ProseMirror, state, graph viz                |
| Testing        | [docs/testing/](docs/testing/)               | 4-layer strategy, E2E guides                        |
| Security       | [docs/security/](docs/security/)             | Threat model, injection prevention                  |
| Packages       | [docs/packages/](docs/packages/)             | Per-package specs (10 packages)                     |
| Infrastructure | [docs/infrastructure/](docs/infrastructure/) | Monorepo, Rust shim, Tauri config                   |
