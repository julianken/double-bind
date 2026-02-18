/**
 * QuickCapture - Rapid note capture textarea in the sidebar.
 *
 * Features:
 * - Submits on Enter (Shift+Enter inserts a newline)
 * - Syncs focus state to AppStore.quickCaptureFocused
 * - Focus ring using --accent-interactive token
 * - Delegates submission to useQuickCapture hook
 *
 * Replaces the disabled textarea stub in Sidebar.tsx.
 */

import { useCallback, useRef } from 'react';
import { useAppStore } from '../stores/ui-store.js';
import { useQuickCapture } from '../hooks/useQuickCapture.js';
import styles from './QuickCapture.module.css';

// ============================================================================
// Types
// ============================================================================

export interface QuickCaptureProps {
  /** Callback invoked when text is submitted (Enter key) */
  onSubmit?: (text: string) => void;
  /** Whether the textarea should be focused */
  focused?: boolean;
  /** Callback when the textarea receives focus */
  onFocus?: () => void;
  /** Callback when the textarea loses focus */
  onBlur?: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * QuickCapture provides a lightweight textarea for rapid note capture.
 * Submits on Enter, allows newlines with Shift+Enter.
 *
 * @example
 * ```tsx
 * <QuickCapture onSubmit={(text) => createBlockFromCapture(text)} />
 * ```
 */
export function QuickCapture({ onSubmit, onFocus, onBlur }: QuickCaptureProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const setQuickCaptureFocused = useAppStore((state) => state.setQuickCaptureFocused);
  const { handleSubmit, isSubmitting } = useQuickCapture();

  const handleFocus = useCallback(() => {
    setQuickCaptureFocused(true);
    onFocus?.();
  }, [setQuickCaptureFocused, onFocus]);

  const handleBlur = useCallback(() => {
    setQuickCaptureFocused(false);
    onBlur?.();
  }, [setQuickCaptureFocused, onBlur]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Shift+Enter inserts a newline — do nothing (default behavior)
      if (event.key === 'Enter' && event.shiftKey) {
        return;
      }

      // Enter alone submits
      if (event.key === 'Enter') {
        event.preventDefault();

        const text = textareaRef.current?.value.trim() ?? '';
        if (!text) return;

        // Use prop callback if provided, otherwise use hook
        if (onSubmit) {
          onSubmit(text);
        } else {
          handleSubmit(text);
        }

        // Clear the textarea after submission
        if (textareaRef.current) {
          textareaRef.current.value = '';
        }
      }

      // Escape blurs the textarea
      if (event.key === 'Escape') {
        textareaRef.current?.blur();
      }
    },
    [onSubmit, handleSubmit]
  );

  return (
    <div className={styles.container} data-testid="quick-capture">
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        placeholder="Quick capture..."
        aria-label="Quick capture"
        rows={2}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={isSubmitting}
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
      />
    </div>
  );
}
