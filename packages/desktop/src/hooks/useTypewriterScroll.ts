/**
 * useTypewriterScroll - Scrolls the active block to vertical center when
 * typewriter mode is enabled.
 *
 * When `typewriterEnabled` is true and `activeBlockId` changes, the DOM node
 * for the active block is scrolled into view with `block: 'center'` using a
 * smooth scroll animation.
 *
 * This hook is shared between PageView and DailyNotesView to avoid duplicating
 * the scroll logic.
 *
 * @example
 * ```tsx
 * // In PageView or DailyNotesView:
 * useTypewriterScroll();
 * ```
 */

import { useEffect } from 'react';
import { useAppStore } from '../stores/ui-store.js';

// ============================================================================
// Hook
// ============================================================================

/**
 * useTypewriterScroll subscribes to `focusedBlockId` and `typewriterEnabled`
 * from AppStore. When both are truthy, it finds the corresponding DOM node
 * via `[data-block-id]` and calls `scrollIntoView({ behavior: 'smooth', block: 'center' })`.
 *
 * The scroll is deferred to the next animation frame to ensure the ProseMirror
 * editor has finished mounting/positioning before we attempt to scroll.
 */
export function useTypewriterScroll(): void {
  const focusedBlockId = useAppStore((state) => state.focusedBlockId);
  const typewriterEnabled = useAppStore((state) => state.typewriterEnabled);

  useEffect(() => {
    if (!typewriterEnabled || !focusedBlockId) {
      return;
    }

    // Use requestAnimationFrame to defer until after React has finished
    // rendering the newly focused block editor DOM node.
    const rafId = requestAnimationFrame(() => {
      // CSS.escape may not be available in all environments (e.g., older jsdom).
      // Fall back to a simple attribute selector without escaping for robustness.
      const escapedId =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(focusedBlockId)
          : focusedBlockId;
      const blockEl = document.querySelector(`[data-block-id="${escapedId}"]`);
      if (blockEl) {
        blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [focusedBlockId, typewriterEnabled]);
}
