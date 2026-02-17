# React Architecture

<!-- last-verified: 2026-02-16 -->

## Component Hierarchy

```
<App>
  <ServiceProvider>
    <Router>
      <AppShell>
        ├── <Sidebar>
        │   ├── <SearchBar />
        │   ├── <QuickCapture />
        │   ├── <PageList />
        │   ├── <SidebarGraphSection />
        │   └── <SidebarFooter />
        │
        └── <MainContent>
            ├── <PageViewScreen>
            │   ├── <PageTitle />
            │   ├── <BlockEditor>
            │   │   └── <BlockNode /> (recursive)
            │   └── <BacklinksPanel />
            │
            ├── <DailyNotesView />
            ├── <GraphViewScreen />
            ├── <QueryViewScreen />
            └── <SearchResultsView />
      </AppShell>
    </Router>
  </ServiceProvider>
</App>
```

## Routing

Custom Zustand-based router. No URL routing needed — Tauri desktop apps have no address bar. Navigation state (`currentPageId`, `pageHistory`) lives in the `AppStore`.

| Route          | Screen Component  | Description                       |
| -------------- | ----------------- | --------------------------------- |
| `page/:pageId` | `PageViewScreen`  | View/edit a specific page         |
| `daily`        | `DailyNotesView`  | Today's daily note (auto-creates) |
| `graph`        | `GraphViewScreen` | Full knowledge graph              |
| `query`        | `QueryViewScreen` | Query editor                      |

See `packages/desktop/src/stores/ui-store.ts` for navigation state.

## Data Flow

Components access SQLite through services wrapped in query hooks:

```
Component → query hook → Service → Repository → Database → SQLite
                                                     ↑
Component → mutation → Service → Repository → Database → SQLite
                ↓
        invalidateQueries() → triggers re-fetch for affected hooks
```

Components never call the `Database` interface directly. See [State Management](state-management.md) for the full pattern.

## Layout

```
┌────────────────────────────────────┐
│ ┌──────────┐ ┌───────────────────┐ │
│ │          │ │                   │ │
│ │ Sidebar  │ │   Main Content    │ │
│ │          │ │                   │ │
│ │ resizable│ │    flex-grow      │ │
│ │          │ │                   │ │
│ └──────────┘ └───────────────────┘ │
└────────────────────────────────────┘
```

- Sidebar: collapsible (Ctrl+\\), resizable, persisted width
- Main content: takes remaining space

See `packages/desktop/src/layout/` for layout components.

## Error Boundaries

Three levels of error boundaries isolate failures:

| Boundary | Location      | Fallback              | Recovery               |
| -------- | ------------- | --------------------- | ---------------------- |
| Root     | `App.tsx`     | App crash screen      | Full page reload       |
| Sidebar  | `Sidebar.tsx` | "Sidebar unavailable" | Re-mount sidebar       |
| Content  | Per-screen    | "Failed to load"      | Navigate to daily note |

See `packages/desktop/src/components/ErrorBoundary.tsx` for the reusable component.

## Rendering Strategy

### Block Rendering

Each `BlockNode` is memoized. Only re-renders when its content, children, or collapsed state changes. When focused, a ProseMirror editor instance activates; unfocused blocks render static content.

### Page Load Sequence

1. Router resolves page ID from Zustand state
2. Query hooks fetch all blocks for the page
3. Blocks are organized into tree structure (by parent_id)
4. Root blocks render, each recursively rendering children
5. ProseMirror instances initialize per focused block
6. Backlinks panel loads asynchronously (non-blocking)
