# ADR-004: ProseMirror Directly (Not TipTap)

## Status
Accepted

## Context

The block editor is the primary UI surface. Users type in blocks, indent/outdent, drag to reorder, and embed references. The editor must support a custom outliner schema with block-level operations.

## Options Considered

### 1. TipTap (ProseMirror wrapper)
- **Pros**: Higher-level API, easier initial setup, extension ecosystem
- **Cons**: Abstraction layer makes custom outliner schema harder, TipTap opinions may conflict with outliner UX, dependency on TipTap's release cycle

### 2. ProseMirror directly
- **Pros**: Full control over schema, transactions, and key bindings. No abstraction fighting the outliner model. Well-documented, stable API.
- **Cons**: More boilerplate for initial setup, steeper learning curve, must build extensions from scratch

### 3. Slate
- **Pros**: React-native, familiar mental model
- **Cons**: Less stable API (breaking changes between versions), fewer production deployments at scale

## Decision

ProseMirror directly.

## Consequences

**Positive**:
- Full control over the document schema (block = ProseMirror node)
- Custom key bindings for outliner operations (Tab/Shift-Tab for indent/outdent, Enter for new block)
- ProseMirror's transaction model maps naturally to CozoDB mutations
- Built-in undo/redo at the editor level (hybrid undo strategy)

**Negative**:
- More initial setup code compared to TipTap
- Must build inline decorations for `[[links]]` and `((refs))` from scratch
- No pre-built extension marketplace

## Editor Architecture: Hybrid View/Edit Splitting

Architectural review examined how all production Roam-like editors (Roam, Logseq, Notion, AFFiNE/BlockSuite) handle ProseMirror at scale. The universal pattern is **one active EditorView + static HTML for everything else**.

### How It Works

1. **Only the actively-edited block gets a live ProseMirror `EditorView`**. All other blocks render as static HTML (generated from stored content).
2. **Click to activate**: When the user clicks a block, destroy the previous EditorView, create a new one for the clicked block, and restore cursor position.
3. **`content-visibility: auto`** on off-screen block containers tells the browser to skip rendering off-screen elements while keeping them in the DOM (no focus/selection loss).

### Why Not 500 Simultaneous EditorView Instances?

Each `EditorView` creates a contentEditable element, registers DOM event listeners (keyboard, mouse, clipboard, composition), and maintains a `MutationObserver`. At 500 instances, the DOM overhead and event listener multiplication causes measurable sluggishness.

### Why Not a Single ProseMirror Document?

A single document covering the entire page solves cross-block selection and unified undo, but:
- ProseMirror has no built-in viewport rendering (unlike CodeMirror 6)
- Large documents (~50K lines) show "very laggy typing"
- Block-level operations (indent, reorder) become complex schema mutations
- No production Roam-like editor uses this approach

### Accessibility: Nested DOM Required

Screen readers (JAWS, NVDA) require actual nested DOM structures (`<ul>` inside `<li>`) for correct hierarchy announcement. A flat list with `aria-level` only works in Windows Narrator. The block tree must use nested HTML elements.

<!-- TODO: Document the ProseMirror schema design -->
<!-- TODO: Document key binding map for outliner operations -->
<!-- TODO: Document the decoration strategy for links/refs -->
