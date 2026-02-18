/**
 * useHoverPreview - Manages hover preview state for page links.
 *
 * Listens for `hover-preview-open` and `hover-preview-close` CustomEvents
 * dispatched by ProseMirror plugins or StaticBlockContent when hovering
 * over [[page links]].
 *
 * Debounce strategy:
 * - Open: 150ms delay before making the preview visible (avoids flicker on quick mouse-over)
 * - Close: immediate (no delay for a snappy dismissal)
 *
 * @example
 * ```tsx
 * const { isVisible, position, pageId, close } = useHoverPreview();
 *
 * if (isVisible && pageId) {
 *   return <HoverPreviewCard pageId={pageId} position={position} onClose={close} />;
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PageId } from '@double-bind/types';

// ============================================================================
// Types
// ============================================================================

export interface HoverPreviewPosition {
  x: number;
  y: number;
}

export interface UseHoverPreviewResult {
  /** Whether the hover preview is currently visible */
  isVisible: boolean;
  /** Screen-space position for the preview card */
  position: HoverPreviewPosition;
  /** The page ID to preview, or null when not hovering */
  pageId: PageId | null;
  /** Immediately close the preview */
  close: () => void;
}

// CustomEvent detail shapes
interface HoverPreviewOpenDetail {
  pageId: PageId;
  x: number;
  y: number;
}

interface HoverPreviewCloseDetail {
  pageId?: PageId;
}

// ============================================================================
// Constants
// ============================================================================

const OPEN_DEBOUNCE_MS = 300;

// ============================================================================
// Hook
// ============================================================================

/**
 * useHoverPreview manages the visible/position/pageId state for the hover
 * preview overlay.
 *
 * Event contract (dispatched on `window`):
 *   hover-preview-open  → CustomEvent<{ pageId: PageId; x: number; y: number }>
 *   hover-preview-close → CustomEvent<{ pageId?: PageId }>
 */
export function useHoverPreview(): UseHoverPreviewResult {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<HoverPreviewPosition>({ x: 0, y: 0 });
  const [pageId, setPageId] = useState<PageId | null>(null);

  // Ref to track the pending open timer so we can cancel it on close
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    // Cancel any pending open debounce so we don't re-open after closing
    if (openTimerRef.current !== null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    setIsVisible(false);
    setPageId(null);
  }, []);

  useEffect(() => {
    function handleOpen(event: Event) {
      const customEvent = event as CustomEvent<HoverPreviewOpenDetail>;
      const detail = customEvent.detail;

      if (!detail?.pageId) return;

      // Cancel any pending previous open timer
      if (openTimerRef.current !== null) {
        clearTimeout(openTimerRef.current);
      }

      // Debounce: wait 150ms before showing to avoid flicker on quick mousing
      openTimerRef.current = setTimeout(() => {
        openTimerRef.current = null;
        setPageId(detail.pageId);
        setPosition({ x: detail.x, y: detail.y });
        setIsVisible(true);
      }, OPEN_DEBOUNCE_MS);
    }

    function handleClose(_event: Event) {
      // Immediate close — no debounce needed
      if (openTimerRef.current !== null) {
        clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
      }
      setIsVisible(false);
      setPageId(null);
    }

    window.addEventListener('hover-preview-open', handleOpen);
    window.addEventListener('hover-preview-close', handleClose);

    return () => {
      window.removeEventListener('hover-preview-open', handleOpen);
      window.removeEventListener('hover-preview-close', handleClose);

      // Clean up any pending timer on unmount
      if (openTimerRef.current !== null) {
        clearTimeout(openTimerRef.current);
      }
    };
  }, []);

  return { isVisible, position, pageId, close };
}

// ============================================================================
// Helper: dispatch events (used by ProseMirror plugins / StaticBlockContent)
// ============================================================================

/**
 * Dispatch a hover-preview-open event.
 * Call this when the mouse enters a page link.
 */
export function dispatchHoverPreviewOpen(pageId: PageId, x: number, y: number): void {
  window.dispatchEvent(
    new CustomEvent<HoverPreviewOpenDetail>('hover-preview-open', {
      detail: { pageId, x, y },
    })
  );
}

/**
 * Dispatch a hover-preview-close event.
 * Call this when the mouse leaves a page link.
 */
export function dispatchHoverPreviewClose(pageId?: PageId): void {
  window.dispatchEvent(
    new CustomEvent<HoverPreviewCloseDetail>('hover-preview-close', {
      detail: { pageId },
    })
  );
}
