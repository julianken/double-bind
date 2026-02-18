/**
 * Typing Isolation Plugin
 *
 * Sets `data-typing="true"` on <html> during active typing so CSS can
 * suppress non-editor transitions. Prevents sidebar hover effects and
 * other animations from competing for GPU resources during fast typing.
 *
 * The attribute is cleared after 800ms of no typing activity.
 */

import { Plugin } from 'prosemirror-state';

const TYPING_DEBOUNCE_MS = 800;

export function typingIsolationPlugin(): Plugin {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  return new Plugin({
    props: {
      handleKeyDown(_view, event) {
        const isContentKey =
          event.key.length === 1 ||
          event.key === 'Backspace' ||
          event.key === 'Delete' ||
          event.key === 'Enter';

        if (!isContentKey) return false;

        document.documentElement.setAttribute('data-typing', 'true');

        if (debounceTimer !== null) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
          document.documentElement.removeAttribute('data-typing');
          debounceTimer = null;
        }, TYPING_DEBOUNCE_MS);

        return false;
      },
    },
  });
}
