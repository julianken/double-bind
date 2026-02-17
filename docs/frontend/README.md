# Frontend Architecture

## Overview

The frontend is a React application running inside Tauri's system webview. It combines a block-based outliner editor (ProseMirror) with graph visualization and query tools.

## Sections

| Document                                      | Contents                                       |
| --------------------------------------------- | ---------------------------------------------- |
| [React Architecture](react-architecture.md)   | Component hierarchy, routing, layout           |
| [ProseMirror Editor](prosemirror.md)          | Block editor schema, plugins, key bindings     |
| [State Management](state-management.md)       | Zustand + query hooks strategy                 |
| [Graph Visualization](graph-visualization.md) | Force-directed graph with react-force-graph-2d |
| [Virtual Scrolling](virtual-scrolling.md)     | Handling large pages with many blocks          |
| [Keyboard-First Design](keyboard-first.md)    | Keyboard shortcuts and command palette         |

## Design Principles

1. **Keyboard-first** — every action reachable without a mouse
2. **Fast perceived performance** — optimistic updates, instant navigation
3. **Minimal re-renders** — fine-grained subscriptions, memoized selectors
4. **Outliner as core** — the block editor is the primary interface, not a page editor
5. **Progressive disclosure** — simple by default, powerful when needed
