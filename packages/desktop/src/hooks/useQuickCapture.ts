/**
 * useQuickCapture - Handles QuickCapture submit logic.
 *
 * Stub implementation: logs captured text to console.
 * Real implementation will connect to PageService when available.
 */

import { useState, useCallback, useRef } from 'react';

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
  const isSubmittingRef = useRef(false);

  const handleSubmit = useCallback((text: string) => {
    if (!text.trim() || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    // TODO: Connect to PageService.createBlock() or similar in follow-up issue

    // Simulate async completion for future real implementation
    // Using setTimeout to maintain the async contract without actual I/O
    setTimeout(() => {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }, 0);
  }, []); // stable callback — ref guards against stale closure on isSubmitting

  return { handleSubmit, isSubmitting };
}
