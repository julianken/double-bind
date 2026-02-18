/**
 * Hover preview plugin for ProseMirror editor
 *
 * Detects when the user hovers over a `[[page link]]` decorated span (or an
 * element carrying a `data-type="page-link"` attribute from the pageLink mark)
 * and dispatches DOM CustomEvents so the React layer can show a preview card.
 *
 * Dispatch contract:
 *   `hover-preview-show`
 *     - `event.detail.pageId`  — page ID string (may be empty for unresolved links)
 *     - `event.detail.title`   — link title text
 *     - `event.detail.coords`  — `{ top, left, bottom, right }` of the target element
 *
 *   `hover-preview-hide`
 *     - `event.detail`         — `{}`
 *
 * The plugin attaches `mouseover` / `mouseout` listeners through
 * `props.handleDOMEvents` so cleanup is automatic when the plugin is destroyed.
 *
 * Detection strategy (two-layer):
 * 1. `data-type="page-link"` — used when the pageLink *mark* is applied (via
 *    autocomplete or serialisation).  The mark's `toDOM` renders an `<a>` with
 *    this attribute.
 * 2. `.highlight-page-link` CSS class — used when the highlight-references
 *    plugin applies a decoration to raw `[[…]]` text that has no mark yet.
 *
 * @see packages/desktop/src/editor/plugins/highlight-references.ts
 * @see packages/desktop/src/editor/schema.ts (pageLink mark)
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorState } from 'prosemirror-state';

// ============================================================================
// Plugin Key & Types
// ============================================================================

/**
 * Plugin key for accessing hover preview state.
 */
export const hoverPreviewPluginKey = new PluginKey<HoverPreviewState>('hover-preview');

/**
 * Bounding rectangle for positioning the preview card.
 */
export interface PreviewCoords {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

/**
 * State maintained by the hover preview plugin.
 */
export interface HoverPreviewState {
  /** Whether a preview is currently being shown */
  active: boolean;
  /** Page ID being previewed (may be empty string) */
  pageId: string;
  /** Display title of the link */
  title: string;
  /** Coordinates of the hovered element */
  coords: PreviewCoords | null;
}

const INACTIVE_STATE: HoverPreviewState = {
  active: false,
  pageId: '',
  title: '',
  coords: null,
};

/**
 * Options for the hover preview plugin.
 */
export interface HoverPreviewPluginOptions {
  /**
   * Debounce delay before showing the preview (ms).
   * Prevents flickering when the user moves the cursor quickly.
   * Defaults to 150 ms.
   */
  showDelayMs?: number;
  /**
   * Called after `hover-preview-show` is dispatched.
   */
  onShow?: (pageId: string, title: string, coords: PreviewCoords) => void;
  /**
   * Called after `hover-preview-hide` is dispatched.
   */
  onHide?: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extracts page link data from a DOM element using the two detection strategies
 * described in the module doc.  Returns null when the element is not a link.
 */
function extractPageLinkData(
  target: EventTarget | null
): { pageId: string; title: string } | null {
  if (!(target instanceof HTMLElement)) return null;

  // Walk up the DOM tree to find the closest link element (handles nested spans)
  const el = target.closest<HTMLElement>('[data-type="page-link"], .highlight-page-link');
  if (!el) return null;

  if (el.dataset.type === 'page-link') {
    // pageLink mark rendered by schema.ts
    return {
      pageId: el.dataset.pageId ?? '',
      title: el.dataset.title ?? el.textContent ?? '',
    };
  }

  // Decoration-only path: no explicit page ID, extract title from text
  const raw = el.textContent ?? '';
  // Strip the surrounding [[ and ]] brackets
  const title = raw.replace(/^\[\[/, '').replace(/\]\]$/, '');
  return { pageId: '', title };
}

/**
 * Returns the bounding rect of the element, normalised to a plain object.
 */
function getBoundingCoords(el: Element): PreviewCoords {
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    bottom: rect.bottom,
    right: rect.right,
  };
}

// ============================================================================
// Plugin Creation
// ============================================================================

/**
 * Creates the hover preview ProseMirror plugin.
 *
 * @example
 * ```ts
 * const hoverPlugin = createHoverPreviewPlugin({ showDelayMs: 200 });
 *
 * // In your React component, listen on the editor container:
 * container.addEventListener('hover-preview-show', (e) => {
 *   const { pageId, title, coords } = e.detail;
 *   showPreviewCard({ pageId, title, coords });
 * });
 * container.addEventListener('hover-preview-hide', () => {
 *   hidePreviewCard();
 * });
 * ```
 */
export function createHoverPreviewPlugin(options: HoverPreviewPluginOptions = {}): Plugin {
  const { showDelayMs = 150, onShow, onHide } = options;

  let showTimer: ReturnType<typeof setTimeout> | null = null;
  let isVisible = false;

  function clearShowTimer(): void {
    if (showTimer !== null) {
      clearTimeout(showTimer);
      showTimer = null;
    }
  }

  function handleMouseover(view: { dom: HTMLElement }, event: Event): boolean {
    if (!(event instanceof MouseEvent)) return false;

    const data = extractPageLinkData(event.target);
    if (!data) return false;

    // Find the actual hovered element for coordinate extraction
    const el = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-type="page-link"], .highlight-page-link'
    );
    if (!el) return false;

    clearShowTimer();

    showTimer = setTimeout(() => {
      const coords = getBoundingCoords(el);
      isVisible = true;

      const domEvent = new CustomEvent('hover-preview-show', {
        bubbles: true,
        cancelable: false,
        detail: { pageId: data.pageId, title: data.title, coords },
      });
      view.dom.dispatchEvent(domEvent);
      onShow?.(data.pageId, data.title, coords);
    }, showDelayMs);

    // Return false — we don't want to consume the event from ProseMirror
    return false;
  }

  function handleMouseout(view: { dom: HTMLElement }, event: Event): boolean {
    if (!(event instanceof MouseEvent)) return false;

    // Check if we're moving to a child element of the same link — if so, skip
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof HTMLElement) {
      const stillOnLink = relatedTarget.closest('[data-type="page-link"], .highlight-page-link');
      if (stillOnLink) return false;
    }

    const data = extractPageLinkData(event.target);
    if (!data && !isVisible) return false;

    clearShowTimer();

    if (isVisible) {
      isVisible = false;

      const domEvent = new CustomEvent('hover-preview-hide', {
        bubbles: true,
        cancelable: false,
        detail: {},
      });
      view.dom.dispatchEvent(domEvent);
      onHide?.();
    }

    return false;
  }

  return new Plugin<HoverPreviewState>({
    key: hoverPreviewPluginKey,

    state: {
      init(): HoverPreviewState {
        return { ...INACTIVE_STATE };
      },

      apply(_tr, prev): HoverPreviewState {
        // State is driven by DOM events rather than transactions; keep stable
        return prev;
      },
    },

    props: {
      handleDOMEvents: {
        mouseover(view, event) {
          return handleMouseover(view, event);
        },
        mouseout(view, event) {
          return handleMouseout(view, event);
        },
      },
    },

    view() {
      return {
        destroy() {
          clearShowTimer();
          isVisible = false;
        },
      };
    },
  });
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Returns the current hover preview plugin state from an EditorState.
 */
export function getHoverPreviewState(state: EditorState): HoverPreviewState | undefined {
  return hoverPreviewPluginKey.getState(state);
}
