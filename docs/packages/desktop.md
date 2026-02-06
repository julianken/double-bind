# @double-bind/desktop

## Purpose

The Tauri + React desktop application. This is the primary user-facing package. It wires together `core` services, `ui-primitives` components, and the ProseMirror editor into a complete application.

## Responsibilities

1. **Tauri integration** — implements `GraphDB` via `invoke()` calls to the Rust shim
2. **Application shell** — routing, layout, window management
3. **ProseMirror editor** — block-level editor instances
4. **State management** — Zustand + useCozoQuery reactive hooks
5. **Keyboard shortcuts** — global and editor-level bindings

## Key Files

### Tauri GraphDB Client

```typescript
// src/client/tauri-graph-db.ts
import { invoke } from '@tauri-apps/api/core';
import type { GraphDB } from '@double-bind/types';

export const tauriGraphDB: GraphDB = {
  async query(script, params = {}) {
    return invoke('query', { script, params });
  },
  async mutate(script, params = {}) {
    return invoke('mutate', { script, params });
  },
  async importRelations(data) {
    return invoke('import_relations', { data });
  },
  async exportRelations(relations) {
    return invoke('export_relations', { relations });
  },
  async backup(path) {
    return invoke('backup', { path });
  },
};
```

### Application Entry Point

```typescript
// src/main.tsx
import { tauriGraphDB } from './client/tauri-graph-db';
import { createServices } from '@double-bind/core';
import { App } from './App';

const services = createServices(tauriGraphDB);

render(
  <ServiceProvider services={services}>
    <App />
  </ServiceProvider>,
  document.getElementById('root'),
);
```

## Internal Structure

```
packages/desktop/
├── src/
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Root component
│   ├── client/
│   │   └── tauri-graph-db.ts       # GraphDB implementation via Tauri
│   ├── editor/
│   │   ├── schema.ts               # ProseMirror schema
│   │   ├── plugins/
│   │   │   ├── outliner.ts         # Indent, outdent, split, merge
│   │   │   ├── autocomplete.ts     # [[, ((, # triggers
│   │   │   ├── persistence.ts      # Debounced save
│   │   │   ├── input-rules.ts      # Markdown shortcuts
│   │   │   └── keymap.ts           # Key bindings
│   │   ├── serialization.ts        # Text ↔ ProseMirror
│   │   └── BlockEditor.tsx         # React wrapper for ProseMirror
│   ├── screens/
│   │   ├── PageView.tsx
│   │   ├── DailyNotesView.tsx
│   │   ├── GraphView.tsx
│   │   ├── QueryView.tsx
│   │   └── SearchResultsView.tsx
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   └── RightPanel.tsx
│   ├── hooks/
│   │   ├── usePageBlocks.ts        # useCozoQuery hooks
│   │   ├── useUpdateBlock.ts
│   │   ├── useCozoQuery.ts         # Reactive CozoDB query hook
│   │   ├── useBacklinks.ts
│   │   ├── useSearch.ts
│   │   └── useUIStore.ts           # Zustand hooks
│   ├── stores/
│   │   └── ui-store.ts             # Zustand store definition
│   └── styles/
│       └── ...
├── src-tauri/                      # Rust shim
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   └── src/
│       └── main.rs
├── e2e/                            # Layer 3 E2E tests
│   ├── playwright.config.ts
│   ├── setup/
│   └── tests/
├── e2e-full/                       # Layer 4 E2E tests
│   ├── playwright.config.ts
│   ├── setup/
│   └── tests/
├── index.html
├── vite.config.ts
└── package.json
```

## Dependencies

- `@double-bind/core` — business logic
- `@double-bind/ui-primitives` — shared components
- `@tauri-apps/api` — Tauri frontend API
- `react`, `react-dom` — React
- `zustand` — application state (UI + cached DB data)
- `prosemirror-*` — block editor
- `react-force-graph-2d` — graph visualization
- `@tanstack/react-virtual` — virtual scrolling

## Testing

- **Unit tests**: React hooks, Zustand store, ProseMirror plugins
- **Layer 3 E2E**: Full UI flows against mock Tauri
- **Layer 4 E2E**: Full stack against real Tauri binary

## Resolved Decisions

### Router: Custom Zustand-based (~30 lines)

No URL routing needed for a desktop app — there's no address bar. Navigation is simple: current page, history stack, forward/back. This is already modeled in the `AppStore` Zustand store (`currentPageId`, `pageHistory`, `navigateToPage`, `goBack`, `goForward`).

A `<Router>` component reads `currentPageId` from Zustand and renders the appropriate screen:

```typescript
function Router() {
  const currentPageId = useAppStore((s) => s.currentPageId);
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen);

  if (commandPaletteOpen) return <CommandPalette />;
  if (!currentPageId) return <DailyNotesView />;
  return <PageView pageId={currentPageId} />;
}
```

TanStack Router was rejected — its value is URL management, SSR, and data loading, none of which apply to an embedded desktop app.

### ServiceProvider: Factory with React Context

Services are created once at app startup and provided via React Context:

```typescript
const ServiceContext = createContext<Services | null>(null);

function ServiceProvider({ children }: { children: React.ReactNode }) {
  const services = useMemo(() => createServices(tauriGraphDB), []);
  return (
    <ServiceContext.Provider value={services}>
      {children}
    </ServiceContext.Provider>
  );
}

function useServices(): Services {
  const ctx = useContext(ServiceContext);
  if (!ctx) throw new Error('useServices must be used within ServiceProvider');
  return ctx;
}
```

### Tauri v2 Configuration

#### tauri.conf.json

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-utils/schema.json",
  "productName": "Double Bind",
  "identifier": "com.double-bind.app",
  "version": "0.1.0",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "pnpm build",
    "beforeDevCommand": "pnpm dev"
  },
  "app": {
    "windows": [
      {
        "title": "Double Bind",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600
      }
    ],
    "security": {
      "csp": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

#### Capabilities

Tauri v2 uses capability files to control which IPC commands the webview can invoke:

```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "description": "Default capabilities for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:default",
    {
      "identifier": "core:window:allow-set-title",
      "allow": [{ "label": "main" }]
    }
  ]
}
```

The 5 IPC commands (`query`, `mutate`, `import_relations`, `export_relations`, `backup`) are custom Tauri commands — they are automatically available to any window that has `core:default` permission. No additional capability configuration is needed for custom commands in Tauri v2.

### Styling: Deferred to Phase 2

No CSS framework decision needed for Phase 1. Initial UI uses plain CSS modules. CSS-in-JS or Tailwind can be evaluated once the component library stabilizes. The `unsafe-inline` CSP for styles (documented in `content-rendering.md`) supports either approach.

### ProseMirror Plugin Testing

ProseMirror plugins are tested via Layer 3 E2E tests (Playwright against Vite dev server with mock Tauri). Direct unit testing of ProseMirror plugins is fragile — the plugin API is tightly coupled to EditorState construction. E2E tests exercise the actual editing experience.

### Window Management & Menu Bar

Deferred to post-MVP. Single-window app initially. Tauri's menu API and multi-window support will be added when the core editing experience is solid.
