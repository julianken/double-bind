# Block Rendering Performance

## The Problem

A page can have thousands of blocks. Rendering all of them simultaneously is expensive. But traditional virtual scrolling (mount/unmount DOM elements) is incompatible with the outliner's editing model.

## Why NOT JavaScript Virtual Scrolling

Virtual scrolling libraries (react-virtual, react-virtuoso, react-window) work by **mounting and unmounting DOM elements** as they enter and leave the viewport. This is fundamentally incompatible with an outliner editor:

| Problem | Impact |
|---------|--------|
| **Focus loss** | Unmounting a block destroys its focus state. If the user is mid-typing and scrolls, focus is lost. react-window issue #650 confirms this. |
| **IME composition loss** | CJK input composition is destroyed when the DOM element is unmounted. Cannot be restored. |
| **Accessibility** | Screen readers expect all content to be in the DOM. Virtualized content is invisible to assistive technology. |
| **Browser find (Cmd+F)** | Cannot find text in unmounted elements. |
| **Selection** | Cross-block text selection requires all blocks in the selection range to exist in the DOM. |

## Strategy: content-visibility + Hybrid Editor

Two complementary techniques replace JavaScript virtualization:

### 1. CSS `content-visibility: auto`

```css
.block-container {
  content-visibility: auto;
  contain-intrinsic-size: auto 32px; /* estimated height for off-screen blocks */
}
```

`content-visibility: auto` tells the browser to **skip rendering off-screen elements** while keeping them in the DOM. This provides:
- No DOM unmounting — focus, selection, IME, and a11y are preserved
- Browser-native optimization (no JavaScript overhead)
- Cmd+F still works (browser renders on demand for find)
- Scroll position is maintained correctly

**Caveats**:
- `contain-intrinsic-size` is needed to prevent scroll height jumps
- Safari may not search `content-visibility: auto` content with Cmd+F in some versions
- Requires `containment` — elements cannot overflow their container

### 2. Hybrid View/Edit Editor

Only the actively-edited block has a live ProseMirror EditorView (see [ProseMirror docs](./prosemirror.md#hybrid-architecture-one-active-editorview)). All other blocks render as static HTML — much cheaper than full editor instances.

### Combined Effect

| Blocks | Without Optimization | With content-visibility + Hybrid |
|-------:|--------------------:|--------------------------------:|
| 100 | ~5,000 DOM nodes + 100 editors | ~5,000 DOM nodes + 1 editor |
| 1,000 | ~50,000 DOM nodes + 1,000 editors | ~50,000 DOM nodes + 1 editor (off-screen skipped by browser) |
| 10,000 | Unusable | ~50,000 DOM nodes + 1 editor (browser renders only visible) |

## Block Tree DOM Structure

For accessibility, the block tree uses **nested DOM elements** (not a flat list with indent levels):

```html
<ul class="block-tree" role="tree">
  <li class="block-container" role="treeitem" aria-expanded="true">
    <div class="block-content">Block A content</div>
    <ul class="block-children" role="group">
      <li class="block-container" role="treeitem">
        <div class="block-content">Block A.1 content</div>
      </li>
      <li class="block-container" role="treeitem">
        <div class="block-content">Block A.2 content</div>
      </li>
    </ul>
  </li>
  <li class="block-container" role="treeitem" aria-expanded="false">
    <div class="block-content">Block B content (collapsed)</div>
    <!-- children not rendered when collapsed -->
  </li>
</ul>
```

### Why Nested (Not Flat)?

JAWS and NVDA (the two most-used screen readers) require actual nested `<ul>/<li>` structures to correctly announce hierarchy. A flat list with `aria-level` attributes only works in Windows Narrator.

### Drag-and-Drop

Drag-and-drop for block reordering uses a flat projection of the visible tree for drop target calculation, but the DOM remains nested. Libraries like `dnd-kit` support this with custom `sortableKeyboardCoordinates` and collision detection.

## Performance Targets

| Metric | Target |
|--------|--------|
| Initial render (100 blocks) | <16ms (one frame) |
| Scroll performance (1000 blocks) | 60fps |
| Block activation (click to cursor) | <5ms |
| Block deactivation (save + render static) | <10ms |
| Collapse/expand subtree | <16ms |

## When to Escalate

If `content-visibility: auto` is insufficient for extreme cases (10,000+ blocks), consider:
1. **Pagination**: Only load the first N blocks, with "Load more" at the bottom
2. **Subtree collapsing**: Auto-collapse deep subtrees beyond viewport
3. **Hybrid virtualization**: Virtualize only blocks that are >3 screens away from viewport (large buffer), keeping the active editing region fully mounted
