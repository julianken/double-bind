/**
 * useQuickCapture - Handles QuickCapture submit logic.
 *
 * Stub implementation: logs captured text to console.
 * Real implementation will connect to PageService when available.
 */

import { useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface UseQuickCaptureResult {
  /** Submit captured text for processing */
  handleSubmit: (text: string) => void;
  /** Whether a submission is in progress */
  isSubmitting: boolean;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useQuickCapture manages the QuickCapture submit flow.
 *
 * Currently a stub that logs submitted text. Will be wired to
 * PageService.createPage() or a block-creation service in a follow-up issue.
 *
 * @returns handleSubmit and isSubmitting state
 *
 * @example
 * ```ts
 * const { handleSubmit, isSubmitting } = useQuickCapture();
 *
 * function onEnterKey(text: string) {
 *   handleSubmit(text);
 * }
 * ```
 */
export function useQuickCapture(): UseQuickCaptureResult {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback((text: string) => {
    if (!text.trim() || isSubmitting) return;

    setIsSubmitting(true);

    // Stub: log the captured text
    // TODO: Connect to PageService.createBlock() or similar in follow-up issue
    // eslint-disable-next-line no-console
    console.log('[QuickCapture] Captured text:', text);

    // Simulate async completion for future real implementation
    // Using setTimeout to maintain the async contract without actual I/O
    setTimeout(() => {
      setIsSubmitting(false);
    }, 0);
  }, [isSubmitting]);

  return { handleSubmit, isSubmitting };
}
