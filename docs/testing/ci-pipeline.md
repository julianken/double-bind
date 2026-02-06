# CI Pipeline

## Trigger Rules

| Trigger | Layers Run | Expected Duration |
|---------|-----------|-------------------|
| Every commit (push) | Lint + Typecheck + Unit | Fast |
| Every PR | + Integration + E2E Fast | Moderate |
| Merge to main | + E2E Full | Full |
| Nightly | Full + performance benchmarks | Extended |

## Pipeline Stages

### Stage 1: Static Analysis (every commit)

```bash
pnpm lint          # ESLint across all packages
pnpm typecheck     # tsc --noEmit across all packages
```

**Fail fast**: If static analysis fails, skip all subsequent stages.

### Stage 2: Unit Tests (every commit)

```bash
pnpm test          # Vitest across workspace
```

Runs against MockGraphDB. No native dependencies needed.

### Stage 3: Integration Tests (every PR)

```bash
pnpm test:integration
```

Requires `cozo-node` native bindings. Uses in-memory CozoDB instances.

### Stage 4: E2E Fast (every PR)

```bash
pnpm test:e2e
```

Starts Vite dev server, runs Playwright against it. Requires `cozo-node` for the test shim.

### Stage 5: E2E Full (merge to main)

```bash
pnpm tauri build --debug
pnpm test:e2e:full
```

Builds the Tauri binary, launches it, runs Playwright against the real app. Requires Rust toolchain and system webview dependencies.

## GitHub Actions Configuration

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, 'feature/**']
  pull_request:
    branches: [main]

jobs:
  static:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  unit:
    needs: static
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  integration:
    needs: unit
    if: github.event_name == 'pull_request' || github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:integration

  e2e-fast:
    needs: integration
    if: github.event_name == 'pull_request' || github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: npx playwright install --with-deps chromium webkit
      - run: pnpm test:e2e

  e2e-full:
    needs: e2e-fast
    if: github.ref == 'refs/heads/main'
    strategy:
      matrix:
        os: [macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - uses: dtolnay/rust-toolchain@stable
      - name: Install system dependencies (Linux)
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev
      - run: pnpm install --frozen-lockfile
      - run: pnpm tauri build --debug
      - run: npx playwright install --with-deps
      - run: pnpm test:e2e:full
```

## Agent Verification Protocol

After implementing any phase, agents run this exact sequence:

```bash
# 1. Static checks
pnpm lint && pnpm typecheck

# 2. Unit tests
pnpm test

# 3. Integration tests
pnpm test:integration

# 4. Fast E2E (if UI was changed)
pnpm test:e2e

# 5. Full E2E (if Rust/IPC was changed)
pnpm test:e2e:full
```

All commands must exit 0. No manual verification needed. If any command fails, the agent must fix the issue and re-run from the failing step.

### Determining Which Layers to Run

| Changed Files | Minimum Layers |
|--------------|---------------|
| `packages/types/` | 1, 2 |
| `packages/core/` | 1, 2, 3 |
| `packages/ui-primitives/` | 1, 3 |
| `packages/desktop/src/` | 1, 3 |
| `packages/desktop/src-tauri/` | 1, 2, 3, 4 |
| `packages/query-lang/` | 1 |
| `packages/graph-algorithms/` | 1 |
| `packages/migrations/` | 1, 2 |

## Caching Strategy

| Artifact | Cache Key | Saved Between |
|----------|----------|---------------|
| pnpm store | `pnpm-lock.yaml` hash | All jobs |
| Rust target | `Cargo.lock` hash | E2E Full jobs |
| Playwright browsers | Playwright version | E2E jobs |
| Tauri binary | Rust source hash | E2E Full (same PR) |

## Notifications

- **PR check fails**: Comment on PR with failure summary and log link
- **Main branch fails**: Alert in project channel
- **Nightly benchmark regression**: Create issue automatically

<!-- TODO: Define exact GitHub Actions workflow file -->
<!-- TODO: Define Rust caching strategy (sccache vs cargo-cache) -->
<!-- TODO: Define performance benchmark baselines -->
<!-- TODO: Define flaky test detection and quarantine policy -->
<!-- TODO: Define artifact retention policy -->
<!-- TODO: Investigate Windows CI (WebView2 availability in GitHub Actions) -->
