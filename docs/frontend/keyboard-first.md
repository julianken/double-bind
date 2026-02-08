# Keyboard-First Design

## Philosophy

Every action in double-bind should be reachable without touching the mouse. Power users of tools like Roam, Logseq, and Obsidian navigate entirely by keyboard. The mouse is optional, not required.

## Command Palette

The central keyboard interface. `Ctrl+P` (or `Cmd+P`) opens it from anywhere.

```
┌─────────────────────────────────────┐
│ > search or type a command...       │
├─────────────────────────────────────┤
│ ▸ New Page                   Ctrl+N │
│ ▸ Today's Daily Note         Ctrl+D │
│ ▸ Search All Pages          Ctrl+/ │
│ ▸ Open Graph View           Ctrl+G │
│ ▸ Run Datalog Query         Ctrl+Q │
│ ▸ Toggle Sidebar            Ctrl+\ │
│ ▸ Toggle Backlinks Panel    Ctrl+B │
│ ▸ Export Current Page              │
│ ▸ Import Notes...                  │
└─────────────────────────────────────┘
```

Features:
- Fuzzy search over command names
- Fuzzy search over page titles (type a page name to navigate)
- Recently used commands bubble to top
- Plugin commands appear here automatically

## Global Shortcuts

Available from anywhere in the app:

| Shortcut | Action |
|----------|--------|
| `Ctrl+P` | Open command palette |
| `Ctrl+K` | Focus search bar |
| `Ctrl+N` | New page |
| `Ctrl+D` | Today's daily note |
| `Ctrl+G` | Open graph view |
| `Ctrl+Q` | Open query editor |
| `Ctrl+\` | Toggle sidebar |
| `Ctrl+B` | Toggle backlinks panel |
| `Ctrl+[` | Navigate back |
| `Ctrl+]` | Navigate forward |
| `Ctrl+,` | Open settings |
| `Escape` | Close palette / panel / deselect |

## Editor Shortcuts

Active when a block editor is focused:

| Shortcut | Action |
|----------|--------|
| `Enter` | Split block at cursor |
| `Shift+Enter` | New line within block |
| `Backspace` (at start) | Merge with previous block |
| `Delete` (at end) | Merge with next block |
| `Tab` | Indent block |
| `Shift+Tab` | Outdent block |
| `Alt+Up` | Move block up |
| `Alt+Down` | Move block down |
| `Ctrl+Shift+Up` | Collapse block |
| `Ctrl+Shift+Down` | Expand block |
| `Ctrl+Enter` | Toggle TODO state |
| `Ctrl+Shift+Enter` | Zoom into block (focus mode) |

## Text Formatting

| Shortcut | Format |
|----------|--------|
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+E` | Code |
| `Ctrl+H` | Highlight |
| `Ctrl+Shift+K` | Strikethrough |

## Navigation Between Blocks

| Shortcut | Action |
|----------|--------|
| `Up` | Move cursor to previous block (if at first line) |
| `Down` | Move cursor to next block (if at last line) |
| `Ctrl+Up` | Jump to previous sibling block |
| `Ctrl+Down` | Jump to next sibling block |
| `Ctrl+Shift+U` | Jump to parent block |

## Multi-Block Selection

| Shortcut | Action |
|----------|--------|
| `Shift+Up` | Extend selection to include previous block |
| `Shift+Down` | Extend selection to include next block |
| `Ctrl+A` | Select all blocks on page |
| `Escape` | Clear selection |

With blocks selected:
| Shortcut | Action |
|----------|--------|
| `Tab` | Indent all selected |
| `Shift+Tab` | Outdent all selected |
| `Delete` | Delete all selected |
| `Alt+Up/Down` | Move selected blocks |
| `Ctrl+C` | Copy selected blocks |
| `Ctrl+X` | Cut selected blocks |

## Autocomplete Triggers

| Trigger | Opens | Behavior |
|---------|-------|----------|
| `[[` | Page link autocomplete | Type to filter, Enter to select |
| `((` | Block reference autocomplete | Type to search block content |
| `#` | Tag autocomplete | Type to filter existing tags |
| `/` | Slash command menu | Insert templates, toggle types |
| `::` | Property autocomplete | Key-value property insertion |

### Autocomplete Navigation

| Key | Action |
|-----|--------|
| `Up/Down` | Navigate options |
| `Enter` | Select option |
| `Escape` | Close autocomplete |
| `Tab` | Select first option |
| Continue typing | Filter options |

## Vim Mode (Future)

Optional vim keybindings for the editor, using ProseMirror's keymap plugin system.

| Mode | Behavior |
|------|----------|
| Normal | Navigate, delete, yank, paste |
| Insert | Standard editing (current default) |
| Visual | Block selection |

This is a plugin, not a core feature. Enabled in settings.

## Discoverability

Keyboard shortcuts must be discoverable:
1. **Command palette** shows shortcuts next to command names
2. **Tooltip on hover** shows shortcut for toolbar buttons
3. **Settings page** lists all shortcuts
4. **First-run guide** teaches essential shortcuts
5. **`?` key** opens shortcut cheat sheet (when not in editor)

## Customization (Future)

Users should be able to remap shortcuts. Store custom mappings in the `metadata` relation:

```datalog
:put metadata { key: 'keybindings', value: '{"toggleSidebar": "Ctrl+B", ...}' }
```

<!-- TODO: Define exact keybinding conflict resolution strategy -->
<!-- TODO: Define slash command menu items -->
<!-- TODO: Define vim mode plugin scope -->
<!-- TODO: Define accessibility: screen reader navigation mode -->
<!-- TODO: Define focus trap behavior for modals/dialogs -->
