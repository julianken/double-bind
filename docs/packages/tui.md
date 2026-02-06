# @double-bind/tui

## Purpose

Interactive terminal UI for graph-based knowledge management (CS Contribution #4). Built with Ink (React for CLIs), sharing the same `core` package as the desktop app.

## Screens

### Page List (Home)

Navigate and manage pages from the terminal.

```
┌─ Double Bind ─────────────────────────┐
│ Pages (42)                [/] Search  │
│                                       │
│ ▸ Project Alpha          Mar 15      │
│   Meeting Notes          Mar 14      │
│   Research Ideas         Mar 13      │
│   Weekly Review          Mar 12      │
│   Reading List           Mar 10      │
│                                       │
│ [n]ew [d]aily [q]uery [g]raph [?]help│
└───────────────────────────────────────┘
```

### Page View

Display and edit blocks in an outline tree.

### Query View

Write and execute Datalog queries with result tables.

### Search

Full-text search with result navigation.

### Graph View

ASCII representation of the knowledge graph neighborhood.

See [Terminal Client](../research/terminal-client.md) for detailed screen mockups.

## Architecture

```typescript
// src/app.tsx
import React from 'react';
import { render } from 'ink';
import { ServiceProvider } from './providers/service-provider';
import { createServices } from '@double-bind/core';
import { Router } from './router';

const dbPath = process.env.DOUBLE_BIND_DB_PATH || getDefaultDbPath();
const graphDb = createCozoNodeGraphDB(dbPath);
const services = createServices(graphDb);

render(
  <ServiceProvider services={services}>
    <Router />
  </ServiceProvider>
);
```

### Database Connection

Direct `cozo-node` connection (same as CLI):

```typescript
import { CozoDb } from 'cozo-node';

function createCozoNodeGraphDB(path: string): GraphDB {
  const db = new CozoDb('rocksdb', path);
  return {
    async query(script, params = {}) {
      return db.run(script, params, true);
    },
    async mutate(script, params = {}) {
      return db.run(script, params, false);
    },
    async importRelations(data) {
      return db.importRelations(data);
    },
    async exportRelations(relations) {
      return db.exportRelations(relations);
    },
    async backup(path) {
      return db.backup(path);
    },
  };
}
```

## Internal Structure

```
packages/tui/src/
├── index.ts              # Entry point
├── app.tsx               # Root Ink component
├── router.tsx            # Screen navigation
├── screens/
│   ├── PageListScreen.tsx
│   ├── PageViewScreen.tsx
│   ├── QueryScreen.tsx
│   ├── SearchScreen.tsx
│   └── GraphScreen.tsx
├── components/
│   ├── BlockTree.tsx      # Indented block display
│   ├── Editor.tsx         # Inline text editing
│   ├── Table.tsx          # Tabular data display
│   ├── StatusBar.tsx      # Bottom status line
│   ├── Input.tsx          # Text input with cursor
│   └── Menu.tsx           # Keyboard menu
├── hooks/
│   ├── useNavigation.ts   # Screen navigation
│   ├── useKeymap.ts       # Keyboard shortcut manager
│   └── useServices.ts     # Access core services
├── providers/
│   └── service-provider.tsx
└── db.ts                  # cozo-node GraphDB adapter
```

## Dependencies

- `@double-bind/core` — business logic (shared with desktop)
- `@double-bind/types` — domain types
- `ink` — React for CLIs
- `ink-text-input` — text input component
- `cozo-node` — direct CozoDB access

## Key Differences from Desktop

| Aspect | Desktop | TUI |
|--------|---------|-----|
| Rendering | DOM + ProseMirror | Terminal (Ink) |
| Editor | ProseMirror | Simple line editor or `$EDITOR` |
| Graph visualization | Canvas (react-force-graph-2d) | ASCII art |
| State management | Zustand + useCozoQuery | Ink state + hooks |
| DB connection | Tauri invoke → Rust shim | cozo-node direct |

## Code Sharing Analysis

| Component | Shared? | Notes |
|-----------|:---:|-------|
| `core` repositories | Yes | Identical |
| `core` services | Yes | Identical |
| `core` parsers | Yes | Identical |
| Domain types | Yes | From `types` package |
| useCozoQuery hooks | Partial | Data fetching logic reused, cache config differs |
| UI components | No | Terminal rendering is fundamentally different |
| Editor | No | ProseMirror is DOM-only |
| Graph visualization | No | Canvas vs ASCII |

Estimated shared code: >80% of business logic via the `core` package.

## Testing

- Component tests using ink-testing-library
- Integration tests for TUI-specific features (navigation, keyboard input)
- Verify same core operations produce same results as desktop

## Resolved Decisions

- **State management**: Zustand + useCozoQuery (same pattern as desktop, without React Query). Zustand works in any JS environment including Ink.
- **ASCII graph rendering**: Custom implementation using box-drawing characters. No library dependency — the graph is small enough for a simple force-directed layout approximation in text.
- **Block editing**: Inline editing for short content. For longer blocks, shell out to `$EDITOR` (respects user's preferred editor). Configurable per-block via a keybinding.
- **Terminal size**: `process.stdout.columns` and `process.stdout.rows`, re-read on `SIGWINCH`. Ink handles responsive layout natively.
- **Color scheme**: 256-color mode by default (widest terminal support). True color opt-in via `--truecolor` flag. Colors follow the user's terminal theme where possible.
- **Clipboard**: Platform-detected: `pbcopy`/`pbpaste` on macOS, `xclip`/`xsel` on Linux, `clip.exe` on Windows/WSL. Falls back gracefully if none available.
