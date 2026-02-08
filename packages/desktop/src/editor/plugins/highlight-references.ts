/**
 * Highlight References Plugin for ProseMirror
 *
 * Applies inline decorations to [[page links]], ((block refs)), and #tags
 * as the user types. Uses the canonical regex patterns from @double-bind/core
 * so highlighting is consistent with parsing.
 *
 * Decorations are purely visual (CSS classes) and do not interfere with
 * text editing or cursor movement.
 *
 * To avoid double-highlighting, the decoration builder skips text nodes
 * that already have the corresponding schema mark (pageLink, blockRef, tag)
 * applied. This ensures that text inserted via autocomplete (which applies
 * a mark) is styled by the mark's toDOM, not by both the mark and the
 * decoration.
 *
 * @see packages/core/src/parsers/content-parser.ts for canonical patterns
 * @see docs/frontend/prosemirror.md for editor architecture
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { PATTERN_SOURCES } from '@double-bind/core';

// ============================================================================
// Plugin Key
// ============================================================================

/**
 * Plugin key for accessing highlight references state.
 */
export const highlightReferencesPluginKey = new PluginKey<DecorationSet>('highlight-references');

// ============================================================================
// Regex Patterns (imported from @double-bind/core)
// ============================================================================

/**
 * Create fresh RegExp instances from the canonical pattern sources.
 * Fresh instances are created per buildDecorations call to avoid
 * shared lastIndex state across calls.
 */
function createPatterns(): {
  pageLink: RegExp;
  blockRef: RegExp;
  tag: RegExp;
} {
  return {
    pageLink: new RegExp(PATTERN_SOURCES.pageLink.source, PATTERN_SOURCES.pageLink.flags),
    blockRef: new RegExp(PATTERN_SOURCES.blockRef.source, PATTERN_SOURCES.blockRef.flags),
    tag: new RegExp(PATTERN_SOURCES.tag.source, PATTERN_SOURCES.tag.flags),
  };
}

// ============================================================================
// Decoration Builder
// ============================================================================

/**
 * Scans a ProseMirror document for reference patterns and builds
 * a DecorationSet with inline CSS class decorations.
 *
 * Skips text nodes that already have the corresponding mark applied
 * to avoid double-highlighting (e.g., text inserted via autocomplete
 * with a pageLink mark should not also get a decoration).
 *
 * @param doc - The ProseMirror document node
 * @returns A DecorationSet with decorations for all found references
 */
export function buildDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];
  const patterns = createPatterns();

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    const text = node.text;

    // Check which marks are present on this text node
    const hasPageLinkMark = node.marks.some((m) => m.type.name === 'pageLink');
    const hasBlockRefMark = node.marks.some((m) => m.type.name === 'blockRef');
    const hasTagMark = node.marks.some((m) => m.type.name === 'tag');

    // Find page links (only if no pageLink mark)
    if (!hasPageLinkMark) {
      let match: RegExpExecArray | null;
      while ((match = patterns.pageLink.exec(text)) !== null) {
        const from = pos + match.index;
        const to = pos + match.index + match[0].length;
        decorations.push(Decoration.inline(from, to, { class: 'highlight-page-link' }));
      }
    }

    // Find block refs (only if no blockRef mark)
    if (!hasBlockRefMark) {
      let match: RegExpExecArray | null;
      while ((match = patterns.blockRef.exec(text)) !== null) {
        const from = pos + match.index;
        const to = pos + match.index + match[0].length;
        decorations.push(Decoration.inline(from, to, { class: 'highlight-block-ref' }));
      }
    }

    // Find tags (only if no tag mark)
    if (!hasTagMark) {
      let match: RegExpExecArray | null;
      while ((match = patterns.tag.exec(text)) !== null) {
        const from = pos + match.index;
        const to = pos + match.index + match[0].length;
        decorations.push(Decoration.inline(from, to, { class: 'highlight-tag' }));
      }
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
