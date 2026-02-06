# ProseMirror Editor

## Why ProseMirror Direct (Not TipTap)

See [ADR 004](../decisions/004-editor-prosemirror.md). TipTap adds abstraction we don't need and obscures ProseMirror's plugin system, which we need fine-grained control over for the outliner behavior.

## Schema

ProseMirror's schema defines which node types and marks are allowed. This is a structural security boundary — content that doesn't match is rejected at parse time.

### Node Types

```typescript
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },

    block: {
      content: 'inline*',
      attrs: {
        blockId: {
          default: null,
          validate: (value: unknown) => {
            if (value !== null && typeof value !== 'string')
              throw new RangeError('blockId must be a string or null');
          },
        },
        indentLevel: {
          default: 0,
          validate: (value: unknown) => {
            if (typeof value !== 'number' || value < 0)
              throw new RangeError('indentLevel must be a non-negative number');
          },
        },
      },
      parseDOM: [{ tag: 'div[data-block]' }],
      toDOM(node) {
        return ['div', {
          'data-block': '',
          'data-block-id': node.attrs.blockId,
          'data-indent-level': node.attrs.indentLevel,
        }, 0];
      },
    },

    text: { group: 'inline' },

    pageLink: {
      group: 'inline',
      inline: true,
      attrs: {
        pageId: {
          validate: (v: unknown) => { if (typeof v !== 'string') throw new RangeError('pageId must be a string'); },
        },
        title: {
          validate: (v: unknown) => { if (typeof v !== 'string') throw new RangeError('title must be a string'); },
        },
      },
      parseDOM: [{ tag: 'a[data-page-link]' }],
      toDOM(node) {
        return ['a', {
          'data-page-link': '',
          'data-page-id': node.attrs.pageId,
          class: 'page-link',
        }, node.attrs.title];
      },
    },

    blockRef: {
      group: 'inline',
      inline: true,
      attrs: {
        blockId: {
          validate: (v: unknown) => { if (typeof v !== 'string') throw new RangeError('blockId must be a string'); },
        },
        preview: {
          default: '',
          validate: (v: unknown) => { if (typeof v !== 'string') throw new RangeError('preview must be a string'); },
        },
      },
      parseDOM: [{ tag: 'span[data-block-ref]' }],
      toDOM(node) {
        return ['span', {
          'data-block-ref': '',
          'data-ref-block-id': node.attrs.blockId,
          class: 'block-ref',
        }, node.attrs.preview];
      },
    },

    codeBlock: {
      content: 'text*',
      marks: '',
      attrs: { language: { default: '' } },
      code: true,
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
      toDOM() { return ['pre', ['code', 0]]; },
    },
  },

  marks: {
    bold: {
      parseDOM: [{ tag: 'strong' }],
      toDOM() { return ['strong', 0]; },
    },
    italic: {
      parseDOM: [{ tag: 'em' }],
      toDOM() { return ['em', 0]; },
    },
    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM() { return ['code', 0]; },
    },
    highlight: {
      parseDOM: [{ tag: 'mark' }],
      toDOM() { return ['mark', 0]; },
    },
  },
});
```

### Why No `<script>`, `<iframe>`, `<img>`, etc.

The schema doesn't define these node types. ProseMirror will reject them at parse time. This is a structural defense independent of DOMPurify — even if sanitization fails, the editor schema won't render dangerous elements.

### Why `validate` on Every Attribute?

CVE-2024-40626 demonstrated that ProseMirror's `DOMSerializer` would accept array values as attributes, enabling type confusion attacks where `blockId: ["script", { src: "//evil.com" }]` would render as a `<script>` tag. The `validate` property (added in prosemirror-model 1.22.1) prevents this. **Pin prosemirror-model >= 1.22.1**.

## Plugins

### 1. Outliner Behavior Plugin

Handles indent/outdent, block splitting, block merging, and drag-to-reorder.

```
Tab        → Indent (increase indent level)
Shift+Tab  → Outdent (decrease indent level)
Enter      → Split block at cursor
Backspace  → Merge with previous block (if cursor at start)
```

### 2. Reference Autocomplete Plugin

Triggered by typing `[[` (page link) or `((` (block reference).

```
User types: "See [[Pro"
                     ↑ autocomplete triggers
Popup shows:
  ▸ Project Alpha
  ▸ Project Beta
  ▸ Programming Notes

User selects → inserts pageLink node
```

### 3. Content Parser Plugin

On every transaction, parses the document to extract:
- `[[Page Name]]` → page links
- `((block-id))` → block references
- `#tag` → tags
- `key:: value` → properties

Extracted entities are stored via the service layer (not directly in ProseMirror state).

### 4. Persistence Plugin

Debounced save to CozoDB on content change:

```typescript
function persistencePlugin(blockId: string, save: (content: string) => void) {
  let timeout: ReturnType<typeof setTimeout>;

  return new Plugin({
    view() {
      return {
        update(view, prevState) {
          if (!view.state.doc.eq(prevState.doc)) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              const content = serializeToText(view.state.doc);
              save(content);
            }, 300); // 300ms debounce
          }
        },
        destroy() {
          clearTimeout(timeout);
        },
      };
    },
  });
}
```

### 5. Markdown Input Rules

Convert markdown-like input to formatted text:

| Input | Result |
|-------|--------|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `` `code` `` | `code` |
| `# heading` | Heading node (if supported) |
| `- ` | Bullet point (block with marker) |
| `1. ` | Numbered item |
| `> ` | Blockquote |
| `---` | Horizontal rule |
| ```` ``` ```` | Code block |

## Content Serialization

Blocks are stored as plain text with lightweight markers, not as ProseMirror JSON. This keeps the database format editor-agnostic.

```
Storage:      "See [[Project Alpha]] and ((01HXYZ)) for details"
ProseMirror:  doc → block → [text, pageLink, text, blockRef, text]
```

### Serialization (ProseMirror → Storage)

Walk the document tree, converting nodes back to their text representations:
- `pageLink { pageId, title }` → `[[title]]`
- `blockRef { blockId }` → `((blockId))`
- `bold` mark → `**text**`
- etc.

### Deserialization (Storage → ProseMirror)

Parse the plain text content and create ProseMirror nodes:
- Regex match `[[...]]` → create `pageLink` node
- Regex match `((..))` → create `blockRef` node
- Regex match `**...**` → apply `bold` mark

## Hybrid Architecture: One Active EditorView

All production Roam-like editors (Roam, Logseq, Notion, AFFiNE/BlockSuite) use the same pattern: **one active ProseMirror EditorView** at a time, with static HTML for everything else.

### How It Works

1. **Non-edited blocks render as static HTML** generated from their stored plain-text content (parsed into `<strong>`, `<em>`, `<a>` elements, etc.)
2. **Clicking a block activates it**: Creates a ProseMirror EditorView for that block, positions the cursor at the click location
3. **Blurring deactivates**: Saves content, destroys the EditorView, renders static HTML
4. **Only one EditorView exists at any time**: The previously-active block's EditorView is destroyed when a new block is activated

### Why Not 500 Simultaneous Instances?

Each EditorView creates a contentEditable DOM element, registers a full suite of DOM event listeners (keyboard, mouse, clipboard, focus, drag, composition), and maintains a MutationObserver. At 500 instances, DOM overhead causes measurable sluggishness. No production editor does this.

### Why Not a Single ProseMirror Document?

- ProseMirror has no built-in viewport rendering (unlike CodeMirror 6)
- ~50K lines in a single document shows "very laggy typing"
- Block operations (indent, reorder) become complex schema mutations
- No production Roam-like editor uses this approach

### Cross-Block Keyboard Navigation

Since only one EditorView exists at a time, cross-block navigation requires custom keyboard handlers:

| Key | At Boundary | Action |
|-----|-------------|--------|
| `ArrowDown` | End of block | Save current, activate next sibling, cursor at start |
| `ArrowUp` | Start of block | Save current, activate previous sibling, cursor at end |
| `Enter` | Anywhere | Split block at cursor, create new block, activate it |
| `Backspace` | Start of block | Merge with previous block, activate merged block |

These handlers live outside ProseMirror, in the `BlockNode` React component wrapper.

### EditorView Lifecycle

```
User clicks block
    → Save previous block (if dirty)
    → Destroy previous EditorView
    → Create new EditorView for clicked block
    → Initialize with block content from DB
    → Attach plugins (persistence, autocomplete, input rules)
    → Set cursor at click position

Editor creation: ~1-2ms
```

## Key Bindings

| Shortcut | Action |
|----------|--------|
| `Enter` | Split block |
| `Backspace` (at start) | Merge with previous |
| `Tab` | Indent |
| `Shift+Tab` | Outdent |
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+K` | Insert link |
| `Ctrl+Shift+8` | Toggle bullet |
| `Ctrl+Shift+9` | Toggle numbered list |
| `Alt+Up/Down` | Move block up/down |
| `Ctrl+Shift+Up/Down` | Collapse/expand |
| `Ctrl+Enter` | Toggle TODO state |

<!-- TODO: Define exact ProseMirror schema with all node types -->
<!-- TODO: Define content serialization format specification -->
<!-- TODO: Define autocomplete popup positioning and behavior -->
<!-- TODO: Define drag-and-drop between blocks -->
<!-- TODO: Define multi-block selection behavior -->
<!-- TODO: Define clipboard handling (paste sanitization) -->
<!-- TODO: Define mobile-friendly touch interactions (future) -->
