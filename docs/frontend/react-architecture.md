# React Architecture

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
        │   │   └── <PageListItem />
        │   └── <SidebarFooter />
        │
        ├── <MainContent>
        │   ├── <PageView>
        │   │   ├── <PageTitle />
        │   │   ├── <BlockEditor>
        │   │   │   └── <BlockNode /> (recursive)
        │   │   │       ├── <BulletHandle />
        │   │   │       ├── <BlockContent /> (ProseMirror)
        │   │   │       └── <BlockChildren />
        │   │   └── <BacklinksPanel />
        │   │
        │   ├── <DailyNotesView />
        │   ├── <GraphView />
        │   ├── <QueryView />
        │   └── <SearchResultsView />
        │
        └── <RightPanel> (optional)
            ├── <BacklinksPanel />
            ├── <PagePropertiesPanel />
            └── <GraphNeighborhoodPanel />
      </AppShell>
    </Router>
  </ServiceProvider>
</App>
```

## Routing

Custom Zustand-based router (~30 lines). No URL routing needed — Tauri desktop apps have no address bar. Navigation state (`currentPageId`, `pageHistory`) lives in the `AppStore`. See [desktop.md](../packages/desktop.md#router-custom-zustand-based-30-lines) for implementation.

| Route | Component | Description |
|-------|-----------|-------------|
| `/page/:pageId` | `PageView` | View/edit a specific page |
| `/daily` | `DailyNotesView` | Today's daily note (auto-creates) |
| `/graph` | `GraphView` | Full knowledge graph |
| `/query` | `QueryView` | Datalog query editor |
| `/search?q=...` | `SearchResultsView` | Search results |

### Navigation Model

Navigation in a note-taking app is different from typical web apps:
- Users frequently open pages in the sidebar while keeping the current page open
- "Open in right panel" for side-by-side viewing
- Navigation history for back/forward (Ctrl+[ / Ctrl+])
- No full-page transitions — content area swaps while sidebar persists

## Layout: AppShell

```
┌──────────────────────────────────────────────┐
│ ┌──────────┐ ┌─────────────────┐ ┌────────┐ │
│ │          │ │                 │ │        │ │
│ │ Sidebar  │ │   Main Content  │ │ Right  │ │
│ │          │ │                 │ │ Panel  │ │
│ │  250px   │ │    flex-grow    │ │ 300px  │ │
│ │  fixed   │ │                 │ │optional│ │
│ │          │ │                 │ │        │ │
│ └──────────┘ └─────────────────┘ └────────┘ │
│ [Status Bar                                ] │
└──────────────────────────────────────────────┘
```

- Sidebar: collapsible, resizable
- Main content: takes remaining space
- Right panel: toggle-able for backlinks, properties, graph neighborhood
- Status bar: current page path, word count, sync status (future)

## Data Flow Pattern

Components access CozoDB through service methods wrapped in `useCozoQuery` hooks:

```typescript
// hooks/usePageBlocks.ts
function usePageBlocks(pageId: string) {
  return useCozoQuery(
    ['blocks', 'byPage', pageId],
    () => blockService.getByPage(pageId),
    { enabled: !!pageId }
  );
}

// Mutations invalidate affected queries
async function updateBlockContent(blockId: string, content: string) {
  await blockService.updateContent(blockId, content);
  invalidateQueries(['blocks']);
  invalidateQueries(['backlinks']);
  invalidateQueries(['search']);
}
```

Components never call `GraphDB` directly. The data flow is:

```
Component → useCozoQuery hook → Service → Repository → GraphDB → CozoDB
                                                          ↑
Component → mutation function → Service → Repository → GraphDB → CozoDB
                    ↓
            invalidateQueries() → triggers re-fetch for affected useCozoQuery hooks
```

## Rendering Strategy

### Block Rendering

Each `BlockNode` is a memoized component. Only re-renders when:
- Its own content changes
- Its children change (add/remove/reorder)
- Its collapsed state changes

```typescript
const BlockNode = memo(function BlockNode({ blockId }: { blockId: string }) {
  const { data: block } = useBlock(blockId);
  const { data: children } = useBlockChildren(blockId);
  const focusedBlockId = useAppStore(s => s.focusedBlockId);
  const isEditing = focusedBlockId === blockId;

  return (
    <li className="block-container" role="treeitem" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 32px' }}>
      <BulletHandle
        isCollapsed={block.isCollapsed}
        hasChildren={children.length > 0}
      />
      {isEditing ? (
        <BlockEditor blockId={blockId} initialContent={block.content} />
      ) : (
        <StaticBlockContent content={block.content} onClick={() => activateBlock(blockId)} />
      )}
      {!block.isCollapsed && children.length > 0 && (
        <ul className="block-children" role="group">
          {children.map(c => <BlockNode key={c.blockId} blockId={c.blockId} />)}
        </ul>
      )}
    </li>
  );
});
```

### Page Load Sequence

1. Router resolves page ID
2. `usePageBlocks(pageId)` fetches all blocks for the page
3. Blocks are organized into tree structure (by parent_id)
4. Root blocks render, each recursively rendering children
5. ProseMirror instances initialize per visible block
6. Backlinks panel loads asynchronously (non-blocking)

## Error Boundaries

Three levels of error boundaries isolate failures:

```
<App>
  <ErrorBoundary fallback={<AppCrashScreen />}>        ← Root: catches service init failures
    <AppShell>
      <ErrorBoundary fallback={<SidebarError />}>      ← Sidebar: crash doesn't affect editor
        <Sidebar />
      </ErrorBoundary>
      <ErrorBoundary fallback={<PageLoadError />}>     ← Content: page-level recovery
        <MainContent />
      </ErrorBoundary>
    </AppShell>
  </ErrorBoundary>
</App>
```

### ErrorBoundary Component

A single reusable component (in `ui-primitives`):

```typescript
// packages/ui-primitives/src/ErrorBoundary.tsx
interface ErrorBoundaryProps {
  fallback: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      const { fallback } = this.props;
      return typeof fallback === 'function'
        ? fallback(this.state.error, this.reset)
        : fallback;
    }
    return this.props.children;
  }
}
```

### Fallback Components

| Boundary | Fallback | Behavior |
|----------|----------|----------|
| Root (`AppCrashScreen`) | "Something went wrong" + "Reload" button | Calls `window.location.reload()`. Last resort. |
| Sidebar (`SidebarError`) | "Sidebar unavailable" + "Retry" link | Calls `reset()` to re-mount sidebar |
| Content (`PageLoadError`) | "Failed to load page" + "Go Home" button | Navigates to daily note via Zustand |

### TUI/CLI Error Handling

TUI (Ink) and CLI have no React Error Boundaries:
- **TUI**: Ink's `<ErrorBoundary>` component (from `ink` package) catches rendering errors. Fatal errors print stack trace and exit with code 1.
- **CLI**: Top-level try/catch in each command handler. Errors are printed to stderr with the appropriate exit code (see cli.md).
