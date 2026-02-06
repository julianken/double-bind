# @double-bind/ui-primitives

## Purpose

Shared React components used by the desktop app (and potentially by plugins). These are domain-aware UI components, not a generic component library.

## Public API

### Layout Components

```typescript
// Resizable split pane
<SplitPane left={<Sidebar />} right={<Content />} defaultLeftWidth={250} />

// Collapsible panel
<Panel title="Backlinks" collapsible defaultOpen={true}>
  {children}
</Panel>

// Status bar at bottom of window
<StatusBar items={[{ label: 'Page', value: pageTitle }, { label: 'Blocks', value: blockCount }]} />
```

### Block Components

```typescript
// Renders a block with bullet, content, and children
<BlockNode
  blockId={blockId}
  indent={level}
  isCollapsed={isCollapsed}
  isFocused={isFocused}
  onToggleCollapse={handleToggle}
  onFocus={handleFocus}
/>

// Bullet/handle with expand/collapse
<BulletHandle
  hasChildren={true}
  isCollapsed={false}
  onClick={handleToggle}
/>

// Block reference inline component
<InlineBlockRef blockId={targetBlockId} />

// Page link inline component
<InlinePageLink pageId={targetPageId} title={pageTitle} />
```

### Navigation Components

```typescript
// Sidebar page list
<PageList
  pages={pages}
  selectedPageId={currentPageId}
  onSelectPage={handleSelect}
  onCreatePage={handleCreate}
/>

// Search input with results dropdown
<SearchBar
  onSearch={handleSearch}
  results={searchResults}
  onSelectResult={handleSelect}
/>

// Command palette overlay
<CommandPalette
  commands={commands}
  open={isOpen}
  onClose={handleClose}
  onExecute={handleExecute}
/>

// Breadcrumb navigation
<Breadcrumb path={[{ id: 'p1', title: 'Parent' }, { id: 'p2', title: 'Current' }]} />
```

### Data Display Components

```typescript
// Backlinks panel showing linked and unlinked references
<BacklinksPanel
  blockId={blockId}
  linkedRefs={linkedRefs}
  unlinkedRefs={unlinkedRefs}
/>

// Property table (key-value display)
<PropertyTable
  properties={properties}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>

// Tag display
<TagList tags={tags} onRemove={handleRemove} onAdd={handleAdd} />

// Query result table
<QueryResultTable headers={headers} rows={rows} />
```

### Graph Components

```typescript
// Force-directed graph visualization
<GraphView
  nodes={nodes}
  edges={edges}
  onNodeClick={handleNodeClick}
  onNodeHover={handleNodeHover}
  highlightedNodeId={focusedPageId}
/>

// Small inline graph (for neighborhood view in panel)
<MiniGraph
  centerNodeId={pageId}
  nodes={neighborNodes}
  edges={neighborEdges}
  width={300}
  height={200}
/>
```

## Internal Structure

```
packages/ui-primitives/src/
├── index.ts
├── layout/
│   ├── SplitPane.tsx
│   ├── Panel.tsx
│   └── StatusBar.tsx
├── blocks/
│   ├── BlockNode.tsx
│   ├── BulletHandle.tsx
│   ├── InlineBlockRef.tsx
│   └── InlinePageLink.tsx
├── navigation/
│   ├── PageList.tsx
│   ├── SearchBar.tsx
│   ├── CommandPalette.tsx
│   └── Breadcrumb.tsx
├── data/
│   ├── BacklinksPanel.tsx
│   ├── PropertyTable.tsx
│   ├── TagList.tsx
│   └── QueryResultTable.tsx
├── graph/
│   ├── GraphView.tsx
│   └── MiniGraph.tsx
└── hooks/
    ├── useKeyboardShortcut.ts
    ├── useResizable.ts
    └── useFocusTrap.ts
```

## Dependencies

- `@double-bind/types` — domain types (Page, Block, etc.)
- `@double-bind/core` — services for data fetching hooks
- `react`, `react-dom` — React
- `react-force-graph-2d` — graph visualization
- `@tanstack/react-virtual` — virtual scrolling

## Testing

React Testing Library tests for each component:
- Renders correctly with minimal props
- Handles user interactions (click, keyboard)
- Calls callbacks with correct arguments
- Accessibility: correct ARIA roles and labels

<!-- TODO: Define component API contracts (required vs optional props) -->
<!-- TODO: Define styling approach (CSS modules, Tailwind, CSS-in-JS) -->
<!-- TODO: Define theme tokens (colors, spacing, typography) -->
<!-- TODO: Define Storybook or similar for component development -->
<!-- TODO: Define accessibility testing strategy -->
