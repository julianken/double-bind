# Layer 3: E2E Fast (Playwright + Vite)

<!-- last-verified: 2026-02-16 -->

## Purpose

Test UI flows in a real browser against the Vite dev server. Tauri's `invoke()` calls are intercepted by a test shim that routes to an HTTP bridge server backed by better-sqlite3. No Rust binary needed.

This is the primary E2E layer. It runs on every PR and catches most UI bugs.

## How It Works

```
Playwright browser
       │
       ▼
Vite dev server (localhost:5173)
       │
       ▼
React app renders normally
       │
       ▼
invoke('query', ...) called
       │
       ▼
Vite mock intercepts invoke()     ◄── NOT real Tauri IPC
       │
       ▼
HTTP bridge (better-sqlite3)      ◄── Real SQLite, no Rust
       │
       ▼
Result returned to React
```

## Mock Strategy: HTTP Bridge

better-sqlite3 is a native module that runs in Node.js, not the browser. The E2E setup uses an HTTP bridge: a Node.js server wraps better-sqlite3 and listens on a local port. Vite's module aliasing intercepts Tauri IPC calls and forwards them as HTTP requests to the bridge.

See these files for the implementation:

- Bridge server: `packages/desktop/test/e2e/setup/run-bridge.ts`
- Global setup: `packages/desktop/test/e2e/setup/global-setup.ts`
- Tauri mock module: `packages/desktop/test/e2e/setup/tauri-mock-module.ts`

### Known Divergences from Real IPC

| Aspect        | Real Tauri                    | HTTP Bridge Mock         |
| ------------- | ----------------------------- | ------------------------ |
| Serialization | Binary IPC (serde)            | HTTP + JSON              |
| Async model   | Rust thread pool              | Node.js event loop       |
| Error format  | Serialized Rust error strings | JavaScript Error objects |
| Concurrency   | Multi-threaded Rust           | Single-threaded Node.js  |

These divergences are tested at Layer 4 (full stack E2E).

## Running Tests

```bash
# Run Layer 3 E2E tests
pnpm test:e2e

# REQUIRED: View results summary
pnpm test:e2e:summary

# NEVER claim "no failures" without checking the summary
```

**Why the summary is necessary:** Terminal output may not show failure counts (background runs, TTY issues). The JSON reporter writes complete results to disk; the summary command parses them.

## What This Layer Covers

- Page CRUD flows (create, view, edit, delete)
- Block editor interactions (typing, indentation, splitting, merging)
- Navigation (sidebar page list, wiki link clicks, backlinks)
- Search UI
- Graph visualization rendering
- Keyboard shortcuts

## What This Layer Does NOT Cover

- Tauri IPC binary serialization (tested at Layer 4)
- Rust shim behavior (tested at Layer 4)
- Real file system operations (backup writes to disk)
- Application startup and initialization
- WebKit-specific rendering on actual Tauri webview

These gaps are covered by Layer 4 (E2E Full). See [e2e-full.md](e2e-full.md).

## Configuration

See `packages/desktop/test/e2e/playwright.config.ts` for the Playwright configuration.

Key settings:

- JSON reporter outputs to `test-results/results.json` for reliable parsing
- Runs against Chromium and WebKit (Tauri uses WebKit on macOS)
- Workers set to 1 (sequential execution to avoid resource exhaustion)
