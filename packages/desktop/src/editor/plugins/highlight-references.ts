/**
 * Highlight References Plugin for ProseMirror
 *
 * Applies inline decorations to [[page links]], ((block refs)), and #tags
 * as the user types. Uses the same regex patterns as the content parser
 * so highlighting is consistent with parsing.
 *
 * Decorations are purely visual (CSS classes) and do not interfere with
 * text editing or cursor movement.
 *
 * @see packages/core/src/parsers/content-parser.ts for canonical patterns
 * @see docs/frontend/prosemirror.md for editor architecture
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as ProseMirrorNode } from 'prosemirror-model';

// ============================================================================
// Plugin Key
// ============================================================================

/**
 * Plugin key for accessing highlight references state.
 */
export const highlightReferencesPluginKey = new PluginKey<DecorationSet>(
  'highlight-references'
);

// ============================================================================
// Regex Patterns (matching content-parser.ts)
// ============================================================================

/**
 * Page links: [[Page Name]]
 * Negative lookbehind ensures we don't match #[[tags]] as page links.
 */
const PAGE_LINK_RE = /(?<!#)\[\[((?:[^\]\n]|\](?!\]))+)\]\]/g;

/**
 * Block references: ((ULID))
 * Matches exactly 26 Crockford Base32 characters.
 */
const BLOCK_REF_RE = /\(\(([0-9A-HJKMNP-TV-Z]{26})\)\)/g;

/**
 * Tags: #tag or #[[multi word tag]]
 * Simple tags: # followed by word characters and hyphens.
 * Multi-word tags: #[[ followed by any chars followed by ]].
 */
const TAG_RE = /#(?:\[\[([^\]]+)\]\]|([\w][\w-]*))/g;

// ============================================================================
// Decoration Builder
// ============================================================================

/**
 * Scans a ProseMirror document for reference patterns and builds
 * a DecorationSet with inline CSS class decorations.
 *
 * @param doc - The ProseMirror document node
 * @returns A DecorationSet with decorations for all found references
 */
function buildDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    const text = node.text;

    // Find page links
    PAGE_LINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = PAGE_LINK_RE.exec(text)) !== null) {
      const from = pos + match.index;
      const to = pos + match.index + match[0].length;
      decorations.push(
        Decoration.inline(from, to, { class: 'highlight-page-link' })
      );
    }

    // Find block refs
    BLOCK_REF_RE.lastIndex = 0;
    while ((match = BLOCK_REF_RE.exec(text)) !== null) {
      const from = pos + match.index;
      const to = pos + match.index + match[0].length;
      decorations.push(
        Decoration.inline(from, to, { class: 'highlight-block-ref' })
      );
    }

    // Find tags
    TAG_RE.lastIndex = 0;
    while ((match = TAG_RE.exec(text)) !== null) {
      const from = pos + match.index;
      const to = pos + match.index + match[0].length;
      decorations.push(
        Decoration.inline(from, to, { class: 'highlight-tag' })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

// ============================================================================
// Plugin Creation
// ============================================================================

/**
 * Creates a ProseMirror plugin that highlights [[page links]],
 * ((block refs)), and #tags with inline CSS class decorations.
 *
 * Decorations update on every document change. When the document
 * has not changed, the previous decoration set is reused for performance.
 *
 * @returns ProseMirror Plugin instance
 *
 * @example
 * ```typescript
 * import { highlightReferencesPlugin } from './plugins/highlight-references';
 *
 * const plugins = [
 *   highlightReferencesPlugin(),
 *   // ... other plugins
 * ];
 * ```
 */
export function highlightReferencesPlugin(): Plugin {
  return new Plugin<DecorationSet>({
    key: highlightReferencesPluginKey,

    state: {
      init(_config: unknown, state: EditorState): DecorationSet {
        return buildDecorations(state.doc);
      },

      apply(tr: Transaction, oldDecorations: DecorationSet): DecorationSet {
        // Only rebuild decorations when the document changes
        if (tr.docChanged) {
          return buildDecorations(tr.doc);
        }
        return oldDecorations;
      },
    },

    props: {
      decorations(state: EditorState): DecorationSet | undefined {
        return highlightReferencesPluginKey.getState(state);
      },
    },
  });
}
