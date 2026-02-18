/**
 * HoverPreview - Floating page preview card (STUB)
 *
 * Listens for `hover-preview-show` and `hover-preview-hide` CustomEvents
 * dispatched by the hover-preview ProseMirror plugin (DBB-447).
 *
 * This is a stub implementation that shows a positioned card with the page
 * title. Full implementation with page content preview will be done in DBB-450.
 *
 * CustomEvent contract (from hover-preview.ts plugin):
 *   `hover-preview-show`
 *     - detail.pageId  — page ID string (may be empty for unresolved links)
 *     - detail.title   — link title text
 *     - detail.coords  — { top, left, bottom, right } of the hovered element
 *
 *   `hover-preview-hide`
 *     - detail         — {}
 *
 * @see packages/desktop/src/editor/plugins/hover-preview.ts
 * @see DBB-450 for full implementation
 */

import { memo, useState, useEffect, useCallback } from 'react';
import styles from './HoverPreview.module.css';

// ============================================================================
// Types
// ============================================================================

export interface HoverPreviewCoords {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface HoverPreviewState {
  visible: boolean;
  pageId: string;
  title: string;
  coords: HoverPreviewCoords | null;
}

export interface HoverPreviewProps {
  /**
   * Optional override to control the preview externally (for testing).
   * When not provided, the component self-manages via CustomEvent listeners.
   */
  controlled?: HoverPreviewState;
}

// ============================================================================
// HoverPreview Component
// ============================================================================

/**
 * HoverPreview stub — shows a floating card with the page title.
 *
 * Mounts to the document body via portal-style positioning.
 * Listens to document-level CustomEvents from the ProseMirror plugin.
 *
 * Note: This stub renders a positioned card using fixed positioning based on
 * the hovered element's bounding rect. Full preview content (page summary,
 * backlinks count) will be implemented in DBB-450.
 */
export const HoverPreview = memo(function HoverPreview({ controlled }: HoverPreviewProps) {
  const [state, setState] = useState<HoverPreviewState>({
    visible: false,
    pageId: '',
    title: '',
    coords: null,
  });

  const handleShow = useCallback((event: Event) => {
    const e = event as CustomEvent<{ pageId: string; title: string; coords: HoverPreviewCoords }>;
    setState({
      visible: true,
      pageId: e.detail.pageId,
      title: e.detail.title,
      coords: e.detail.coords,
    });
  }, []);

  const handleHide = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    // Listen for events bubbled up to document level
    document.addEventListener('hover-preview-show', handleShow);
    document.addEventListener('hover-preview-hide', handleHide);

    return () => {
      document.removeEventListener('hover-preview-show', handleShow);
      document.removeEventListener('hover-preview-hide', handleHide);
    };
  }, [handleShow, handleHide]);

  // Use controlled state if provided (for testing or external control)
  const activeState = controlled ?? state;

  if (!activeState.visible || !activeState.coords) {
    return null;
  }

  // Position the card below the hovered element
  const { bottom, left } = activeState.coords;
  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    top: bottom + 8,
    left,
  };

  return (
    <div
      className={styles.hoverPreview}
      style={cardStyle}
      role="tooltip"
      aria-label={`Preview: ${activeState.title}`}
      data-testid="hover-preview"
    >
      <div className={styles.hoverPreviewTitle}>
        {activeState.title || 'Untitled'}
      </div>
      {/* DBB-450: page content preview will go here */}
      <div className={styles.hoverPreviewStub}>
        Page preview — full implementation in DBB-450
      </div>
    </div>
  );
});

HoverPreview.displayName = 'HoverPreview';
