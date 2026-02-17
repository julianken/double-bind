# @double-bind/ui-primitives

<!-- last-verified: 2026-02-16 -->

## Purpose

Shared React components used by the desktop app. These are domain-aware UI components for a knowledge management application, not a generic component library.

## Public API

See `packages/ui-primitives/src/index.ts` for the complete export list.

### Component Categories

| Category     | Components                                                       | Source Directory  |
| ------------ | ---------------------------------------------------------------- | ----------------- |
| Layout       | `SplitPane`, `Panel`, `StatusBar`                                | `src/layout/`     |
| Blocks       | `BlockNode`, `BulletHandle`, `InlineBlockRef`, `InlinePageLink`  | `src/blocks/`     |
| Navigation   | `PageList`, `SearchBar`, `CommandPalette`, `Breadcrumb`          | `src/navigation/` |
| Data Display | `BacklinksPanel`, `PropertyTable`, `TagList`, `QueryResultTable` | `src/data/`       |
| Graph        | `GraphView`, `MiniGraph`                                         | `src/graph/`      |
| Hooks        | `useKeyboardShortcut`, `useResizable`, `useFocusTrap`            | `src/hooks/`      |

### Styles

The package exports CSS design tokens and base styles:

- `@double-bind/ui-primitives/styles` — compiled CSS
- `@double-bind/ui-primitives/styles/tokens` — CSS custom properties
- `@double-bind/ui-primitives/styles/base` — reset and typography

## Internal Structure

```
packages/ui-primitives/src/
├── index.ts
├── layout/          # SplitPane, Panel, StatusBar
├── blocks/          # BlockNode, BulletHandle, inline components
├── navigation/      # PageList, SearchBar, CommandPalette, Breadcrumb
├── data/            # BacklinksPanel, PropertyTable, TagList, QueryResultTable
├── graph/           # GraphView, MiniGraph
└── hooks/           # Shared UI hooks
```

## Dependencies

**Internal:** `@double-bind/types`
**Key external:** `react`, `react-force-graph-2d`, `@tanstack/react-virtual`

## Testing

React Testing Library tests for each component: rendering, user interactions, callback behavior, and ARIA accessibility.
