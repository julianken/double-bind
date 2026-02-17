# @double-bind/desktop

<!-- last-verified: 2026-02-16 -->

## Purpose

The Tauri + React desktop application. This is the primary user-facing package. It wires together `core` services, `ui-primitives` components, and the ProseMirror editor into a complete application.

## Responsibilities

1. **Tauri integration** — implements `Database` via `invoke()` calls to the Rust shim (rusqlite)
2. **Application shell** — routing, layout, window management
3. **ProseMirror editor** — block-level editor instances
4. **State management** — Zustand stores + query hooks
5. **Keyboard shortcuts** — global and editor-level bindings
6. **Bridge server** — Express HTTP server for dev/test (wraps better-sqlite3)

## Key Architecture

### Database Providers

Two `Database` implementations:

- **`TauriDatabaseProvider`** — production: calls `invoke()` over Tauri IPC to rusqlite. See `src/providers/TauriDatabaseProvider.ts`.
- **`HttpDatabaseProvider`** — dev/test: HTTP calls to the bridge server. See `src/providers/HttpDatabaseProvider.ts`.

### Bridge Server

An Express HTTP server at `scripts/bridge-server.ts` that wraps `better-sqlite3` and exposes both raw SQL execution and service-layer operations (`service:createPage`, `service:createBlock`, `service:updateContent`). Used for:

- `pnpm dev` (Vite dev server without Tauri)
- Layer 3 E2E tests (Playwright against Vite)
- Import scripts

### Service Provider

Services are created once at startup and injected via React Context. See `src/providers/ServiceProvider.tsx`.

## Internal Structure

```
packages/desktop/
├── src/
│   ├── main.tsx                     # Entry point (dual-mode: Tauri or browser)
│   ├── App.tsx                      # Root component
│   ├── providers/
│   │   ├── TauriDatabaseProvider.ts # Database via Tauri IPC
│   │   ├── HttpDatabaseProvider.ts  # Database via HTTP bridge
│   │   └── ServiceProvider.tsx      # React Context for services
│   ├── editor/                      # ProseMirror integration
│   ├── screens/                     # PageViewScreen, DailyNotesView, etc.
│   ├── layout/                      # AppShell, Sidebar
│   ├── hooks/                       # useBacklinks, useNeighborhood, etc.
│   ├── stores/                      # Zustand stores (ui-store, search-store)
│   ├── components/                  # App-specific components
│   └── styles/
├── scripts/
│   └── bridge-server.ts             # Dev/test HTTP bridge
├── src-tauri/                       # Rust shim (rusqlite)
├── test/
│   ├── unit/                        # Component and hook tests
│   └── e2e/                         # Layer 3 Playwright tests
└── vite.config.ts
```

## Dependencies

**Internal:** `@double-bind/core`, `@double-bind/ui-primitives`, `@double-bind/migrations`, `@double-bind/types`
**Key external:** `@tauri-apps/api`, `react`, `zustand`, `prosemirror-*`, `react-force-graph-2d`

## Testing

- **Unit tests:** React hooks, Zustand stores, ProseMirror plugins (serialization, input rules)
- **Layer 3 E2E:** Playwright against Vite dev server with mock Tauri IPC. See [E2E Fast](../testing/e2e-fast.md).
- **Layer 4 E2E:** Playwright against real Tauri binary.
