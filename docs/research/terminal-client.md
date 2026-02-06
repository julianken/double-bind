# Contribution 4: Terminal Client for Graph-Based Knowledge Management

## Thesis

A terminal-based client for a graph-structured knowledge base — sharing the exact same core logic as the GUI — can provide a keyboard-driven, scriptable, and composable interface for knowledge management that integrates into developer workflows (shell pipelines, cron jobs, remote SSH sessions).

## Prior Art

### Terminal-Based Note-Taking Tools

| Tool | Architecture | Graph Support | Relationship to GUI |
|------|-------------|--------------|---------------------|
| Vim + vimwiki | File-based | Basic link following | No GUI counterpart |
| nb | File-based | Tags, no graph queries | No GUI counterpart |
| Taskwarrior | SQLite | No | No GUI (except third-party) |
| Joplin CLI | SQLite + sync | No graph | Shares DB with Joplin GUI |
| Dendron CLI | File-based | Hierarchy only | Shares workspace with VS Code extension |

### Key Observations

1. No terminal tool offers graph queries or algorithms
2. Most terminal note tools are standalone — not sharing a backend with a richer GUI
3. The Joplin model (CLI + GUI sharing a database) is closest to our approach, but Joplin has no graph features

## Technical Approach

### Architecture: Shared `core` Package

The terminal client (`tui` package) imports the same `core` package as the desktop app:

```
packages/tui/
├── src/
│   ├── app.tsx           # Root Ink component
│   ├── screens/
│   │   ├── PageList.tsx   # Page browser
│   │   ├── PageView.tsx   # Block viewer/editor
│   │   ├── QueryView.tsx  # Datalog query interface
│   │   ├── GraphView.tsx  # ASCII graph visualization
│   │   └── Search.tsx     # Full-text search
│   ├── components/
│   │   ├── BlockTree.tsx  # Indented block display
│   │   ├── Editor.tsx     # Inline text editing
│   │   └── StatusBar.tsx  # Bottom status line
│   └── index.ts           # Entry point
└── package.json
```

### Framework: Ink

Ink is "React for CLIs" — it uses React's component model to render to the terminal. This means:
- Shared mental model with the desktop React app
- Component composition and hooks work identically
- State management patterns transfer (Zustand + useCozoQuery, works in any JS environment)

```typescript
import React from 'react';
import { render, Box, Text, useInput } from 'ink';
import { usePageList } from '@double-bind/core';

function PageList() {
  const { data: pages } = usePageList();
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) setSelected(s => Math.max(0, s - 1));
    if (key.downArrow) setSelected(s => Math.min(pages.length - 1, s + 1));
    if (key.return) navigateTo(pages[selected].pageId);
  });

  return (
    <Box flexDirection="column">
      {pages?.map((page, i) => (
        <Text key={page.pageId} inverse={i === selected}>
          {page.title}
        </Text>
      ))}
    </Box>
  );
}
```

### Database Connection

The TUI connects to CozoDB directly via `cozo-node` (NAPI bindings), not via Tauri IPC:

```typescript
import { CozoDb } from 'cozo-node';

const db = new CozoDb('rocksdb', dbPath);

// Implement GraphDB interface
const graphDb: GraphDB = {
  async query(script, params) {
    return db.run(script, params ?? {}, true); // immutable
  },
  async mutate(script, params) {
    return db.run(script, params ?? {}, false); // mutable
  },
  // ...
};

// Same services as desktop
const blockService = new BlockService(new BlockRepository(graphDb));
```

The TUI reads and writes the same RocksDB database as the desktop app. They share the database file (not simultaneously — one at a time, or future: file locking).

### Screens

#### Page List

```
┌─ Double Bind ─────────────────────────────┐
│ Pages (42)                    [/] Search   │
│                                            │
│ ▸ Project Alpha             Mar 15, 2025  │
│   Meeting Notes             Mar 14, 2025  │
│   Research Ideas            Mar 13, 2025  │
│   Weekly Review             Mar 12, 2025  │
│   Reading List              Mar 10, 2025  │
│                                            │
│ [n]ew  [d]aily  [q]uery  [g]raph  [?]help │
└────────────────────────────────────────────┘
```

#### Page View (Block Tree)

```
┌─ Project Alpha ───────────────────────────┐
│                                            │
│ • Overview of the project                  │
│   • Started in January                     │
│   • Team: Alice, Bob, Carol                │
│ • Key decisions                            │
│   • Use CozoDB for storage ([[CozoDB]])    │
│   • TypeScript for business logic          │
│   ▸ • Performance requirements (3 hidden)  │
│ • Open questions                           │
│   • How to handle migrations?              │
│                                            │
│ ── Backlinks (3) ──                        │
│ Meeting Notes > "discussed [[Project...]]" │
│ Weekly Review > "progress on [[Project.."  │
│                                            │
│ [e]dit  [b]acklinks  [←]back  [?]help      │
└────────────────────────────────────────────┘
```

#### Query View

```
┌─ Query ───────────────────────────────────┐
│ > ?[title, score] :=                       │
│     rank[page_id, score] <~ PageRank(      │
│       *links[source_id, target_id]         │
│     ),                                     │
│     *pages{ page_id, title }               │
│                                            │
│ Results (42 rows):                         │
│ ┌──────────────────────┬─────────┐         │
│ │ title                │ score   │         │
│ ├──────────────────────┼─────────┤         │
│ │ Project Alpha        │ 0.0832  │         │
│ │ CozoDB               │ 0.0654  │         │
│ │ Meeting Notes        │ 0.0521  │         │
│ └──────────────────────┴─────────┘         │
│                                            │
│ [Ctrl+Enter] run  [↑] history  [?]help     │
└────────────────────────────────────────────┘
```

#### Graph View (ASCII)

```
┌─ Graph: Project Alpha (2 hops) ───────────┐
│                                            │
│         Meeting Notes                      │
│              │                             │
│  Design ─── Project Alpha ─── Research     │
│   Doc        │           \                 │
│          Task List     Related Ideas       │
│                            │               │
│                        Prior Art            │
│                                            │
│ [+/-] zoom  [←→↑↓] pan  [Enter] open      │
└────────────────────────────────────────────┘
```

### CLI Package (Separate from TUI)

The `cli` package provides non-interactive commands for scripting:

```bash
# Create a page
double-bind new "Meeting Notes 2025-03-15"

# Add a block
double-bind add "Project Alpha" "New task: review architecture"

# Search
double-bind search "CozoDB performance"

# Run a Datalog query
double-bind query '?[title] := *pages{ page_id, title, is_deleted: false }'

# Import/export
double-bind import roam export.json
double-bind export markdown ./output/

# Graph stats
double-bind stats

# Daily note
double-bind daily
```

These commands can be composed with Unix pipes:

```bash
# Find orphan pages and output as JSON
double-bind query '?[title] := *pages{ page_id, title }, not *links{ target_id: page_id, source_id: _ }' --json

# Pipe search results to fzf for selection
double-bind search "project" --titles-only | fzf | xargs double-bind open
```

## Evaluation Criteria

1. **Code sharing**: What percentage of business logic is shared between TUI and desktop?
   - Target: >90% of `core` package used by both
   - Measure: lines of code in `core` vs `tui`-specific code

2. **Feature parity**: Which desktop features work in the terminal?
   - Full parity: page CRUD, block CRUD, search, backlinks, queries
   - Partial: graph visualization (ASCII vs Canvas)
   - Not applicable: ProseMirror (different editor approach)

3. **Composability**: Can CLI commands integrate into shell workflows?
   - Unix pipe support (stdin/stdout)
   - JSON output mode
   - Exit codes for scripting

4. **Usability**: Is the TUI a practical tool for daily use?
   - Keyboard-only navigation speed
   - SSH-friendly (works over remote connections)
   - Low resource usage (suitable for older machines)

## Open Questions

## Resolved Decisions

- **Database locking**: RocksDB handles file-level locking. Only one process (desktop or TUI) can open the DB at a time. Error message displayed if DB is locked.
- **State management in Ink**: Zustand + useCozoQuery (same as desktop). React Query rejected — Zustand works in any JS environment. See [ADR-011](../decisions/011-state-management.md).
- **ASCII graph**: Custom implementation using box-drawing characters.
- **Block editing**: Inline for short content, `$EDITOR` for long blocks.
- **Color scheme**: 256-color default, `--truecolor` opt-in.
- **CLI output formats**: Defined in [cli.md](../packages/cli.md) — plain text (default), JSON (`--json`), TSV (`--tsv`).
- **Shell completion**: Generated by commander. See [cli.md](../packages/cli.md).
