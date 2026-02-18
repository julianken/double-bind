/**
 * HoverPreviewPopover — Small card shown when hovering a node in the graph.
 *
 * Displays:
 * - Page title
 * - Block count
 * - Connection count (degree)
 *
 * Positioned near the mouse cursor; clamped to stay within the viewport.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './HoverPreviewPopover.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HoverPreviewPopoverProps {
  /** Screen x position (from mouse event) */
  x: number;
  /** Screen y position (from mouse event) */
  y: number;
  /** Page title to display */
  title: string;
  /** Number of blocks in the page */
  blockCount: number;
  /** Number of connections (edges) for this node */
  connectionCount: number;
  /** Whether the popover is visible */
  visible: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Offset from the cursor to avoid covering the node */
const CURSOR_OFFSET_X = 16;
const CURSOR_OFFSET_Y = 12;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Hover popover for graph nodes.
 *
 * @example
 * ```tsx
 * <HoverPreviewPopover
 *   x={mouseX}
 *   y={mouseY}
 *   title={hoveredPage.title}
 *   blockCount={hoveredPage.blockCount}
 *   connectionCount={connectionCount}
 *   visible={isHovering}
 * />
 * ```
 */
export function HoverPreviewPopover({
  x,
  y,
  title,
  blockCount,
  connectionCount,
  visible,
}: HoverPreviewPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [clampedPos, setClampedPos] = useState({ x: x + CURSOR_OFFSET_X, y: y + CURSOR_OFFSET_Y });

  useEffect(() => {
    if (!popoverRef.current) {
      setClampedPos({ x: x + CURSOR_OFFSET_X, y: y + CURSOR_OFFSET_Y });
      return;
    }

    const { offsetWidth: width, offsetHeight: height } = popoverRef.current;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let cx = x + CURSOR_OFFSET_X;
    let cy = y + CURSOR_OFFSET_Y;

    // Clamp so the popover stays within the viewport
    if (cx + width > viewportWidth - 8) {
      cx = x - width - CURSOR_OFFSET_X;
    }
    if (cy + height > viewportHeight - 8) {
      cy = y - height - CURSOR_OFFSET_Y;
    }

    setClampedPos({ x: Math.max(8, cx), y: Math.max(8, cy) });
  }, [x, y]);

  if (!visible) return null;

  return (
    <div
      ref={popoverRef}
      className={styles.popover}
      style={{ left: clampedPos.x, top: clampedPos.y }}
      data-testid="hover-preview-popover"
      aria-hidden="true"
      role="tooltip"
    >
      <p className={styles.title}>{title}</p>
      <div className={styles.stats}>
        <span className={styles.stat} data-testid="popover-block-count">
          <span className={styles.statValue}>{blockCount}</span>
          <span className={styles.statLabel}>{blockCount === 1 ? 'block' : 'blocks'}</span>
        </span>
        <span className={styles.separator} aria-hidden="true">·</span>
        <span className={styles.stat} data-testid="popover-connection-count">
          <span className={styles.statValue}>{connectionCount}</span>
          <span className={styles.statLabel}>{connectionCount === 1 ? 'link' : 'links'}</span>
        </span>
      </div>
    </div>
  );
}
