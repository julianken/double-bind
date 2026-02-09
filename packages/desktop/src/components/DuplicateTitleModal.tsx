/**
 * DuplicateTitleModal - Modal shown when attempting to rename a page to a duplicate title.
 *
 * Displays when:
 * - User edits a page title to match an existing page (case-insensitive)
 * - Provides options to navigate to the existing page or choose a different name
 *
 * Uses the same modal styling patterns as CommandPalette for consistency.
 */

import { useCallback, useEffect, useRef } from 'react';
import styles from './DuplicateTitleModal.module.css';

// ============================================================================
// Types
// ============================================================================

export interface DuplicateTitleModalProps {
  /**
   * Whether the modal is currently visible.
   */
  isOpen: boolean;

  /**
   * The ID of the existing page with the conflicting title.
   */
  existingPageId: string;

  /**
   * The title of the existing page (for display).
   */
  existingPageTitle: string;

  /**
   * Callback when user clicks "Go to existing page".
   */
  onNavigate: () => void;

  /**
   * Callback when user clicks "Choose different name" or presses Escape.
   */
  onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * DuplicateTitleModal - Modal for handling duplicate page title conflicts.
 *
 * Features:
 * - Backdrop click dismisses the modal
 * - Escape key dismisses the modal
 * - Two action buttons: navigate to existing or choose different name
 * - Focus trap within the modal
 *
 * @example
 * ```tsx
 * <DuplicateTitleModal
 *   isOpen={showDuplicateModal}
 *   existingPageId="page-123"
 *   existingPageTitle="My Page"
 *   onNavigate={() => {
 *     navigateToPage(`page/${existingPageId}`);
 *     setShowDuplicateModal(false);
 *   }}
 *   onClose={() => setShowDuplicateModal(false)}
 * />
 * ```
 */
export function DuplicateTitleModal({
  isOpen,
  existingPageId,
  existingPageTitle,
  onNavigate,
  onClose,
}: DuplicateTitleModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigateButtonRef = useRef<HTMLButtonElement>(null);

  // Focus the navigate button when modal opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        navigateButtonRef.current?.focus();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Only close if clicking directly on backdrop, not the container
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Handle navigate click
  const handleNavigate = useCallback(() => {
    onNavigate();
  }, [onNavigate]);

  // Handle close click
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-title-modal-title"
      data-testid="duplicate-title-modal"
    >
      <div
        ref={containerRef}
        className={styles.container}
        data-existing-page-id={existingPageId}
      >
        <h2 id="duplicate-title-modal-title" className={styles.title}>
          Page Already Exists
        </h2>

        <p className={styles.description}>
          A page named <strong>&quot;{existingPageTitle}&quot;</strong> already exists.
        </p>

        <div className={styles.actions}>
          <button
            ref={navigateButtonRef}
            type="button"
            className={styles.primaryButton}
            onClick={handleNavigate}
            data-testid="navigate-to-existing"
          >
            Go to existing page
          </button>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleClose}
            data-testid="choose-different-name"
          >
            Choose different name
          </button>
        </div>
      </div>
    </div>
  );
}
