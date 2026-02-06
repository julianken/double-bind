# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Instructions

**Workflow:** Use `Skill(subagent-workflow)` for ALL multi-step work. Skip only for single-line fixes, pure research, or reading files. Full details: `.claude/skills/subagent-workflow/SKILL.md`

**Development Model:** This project is developed exclusively with AI agents. Never include time estimates, effort estimates, team size assumptions, or timeline projections. Focus on dependencies, complexity, scope, and completion status.

**Testing:** All code must pass tests locally before committing. Run the project's test suite and verify no failures before creating PRs.

**E2E Testing:** After running E2E tests, ALWAYS run `pnpm test:e2e:summary` to verify results. Terminal output may not show failure counts (TTY issues, background runs). The JSON reporter writes complete results; the summary script parses and displays them clearly. **NEVER claim "no failures" without checking the summary.** See [docs/testing/e2e-fast.md](docs/testing/e2e-fast.md).

**PRs:** All pull requests MUST use the template at `.github/PULL_REQUEST_TEMPLATE.md` if one exists.

**Pre-Commit Hooks:** Pre-commit hooks run linting, type checking, and tests on changed files. Bypass with `--no-verify` when needed.

**Debug Artifacts:** Never commit `debug-*.spec.ts`, `*.bak`, or `console.log` statements. The pre-commit hooks in `.claude/hooks/` will block these.

---

## Project Context

**Double-Bind** — Local-first note-taking app (Roam Research-like) with graph-native architecture. Four CS contribution goals: (1) Datalog as user-facing query language, (2) graph algorithms for PKM, (3) local-first graph-native architecture, (4) terminal client.

### Tech Stack

- **Runtime:** Tauri v2 (desktop shell) + TypeScript (all business logic)
- **Frontend:** React + ProseMirror (block editor) + Zustand (state)
- **Database:** CozoDB (embedded graph DB with Datalog) via cozo-node/Rust
- **Package Manager:** pnpm 9.x (monorepo with workspaces)
- **Testing:** Vitest (unit/integration) + Playwright (E2E)

---

## Reference

### Commands

```bash
pnpm install              # Install dependencies
pnpm dev                  # Run Vite dev server (desktop frontend)
pnpm dev:desktop          # Run full Tauri desktop app
pnpm build                # Build all packages (except desktop)
pnpm build:desktop        # Build Tauri binary
pnpm test                 # Run all unit tests
pnpm test:e2e             # Run Layer 3 E2E tests (Playwright + mock Tauri)
pnpm test:e2e:full        # Run Layer 4 E2E tests (real Tauri binary)
pnpm test:e2e:summary     # REQUIRED after E2E - parse JSON results
pnpm lint                 # Lint all packages
pnpm typecheck            # Type check all packages
```

### Environment Variables

No environment variables required for development. CozoDB uses an in-memory database for testing and RocksDB storage in `~/.local/share/double-bind/` for production.

### AI Assistant Configuration

**Context7 MCP:** Automatically use Context7 for up-to-date documentation. Key libraries:

- **CozoDB** (v0.7) — Datalog query language, graph algorithms
- **Tauri** (v2) — IPC, window management, capabilities
- **ProseMirror** — Editor schema, plugins, transactions
- **React** (v19) — Hooks, context, error boundaries
- **Zustand** (v5) — Store creation, subscriptions

---

## Docs & Module-Specific Context

- [docs/architecture/](docs/architecture/) — System overview, dependency graph
- [docs/database/](docs/database/) — Schema, query patterns, migrations
- [docs/frontend/](docs/frontend/) — React architecture, state management
- [docs/packages/](docs/packages/) — Per-package documentation
- [docs/testing/](docs/testing/) — Testing strategy (4 layers)
- [docs/infrastructure/](docs/infrastructure/) — Monorepo, Rust shim, security
