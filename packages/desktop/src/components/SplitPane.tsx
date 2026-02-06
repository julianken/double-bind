/**
 * SplitPane - Resizable split layout component
 *
 * Renders left and right panes with a draggable divider.
 * Width persists via Zustand store to localStorage on app restart.
 *
 * @see docs/packages/ui-primitives.md for API specification
 */

import type { ReactNode, JSX } from 'react';
import { useCallback, useEffect } from 'react';
import { useResizable } from '../hooks/useResizable.js';
import { useAppStore } from '../stores/ui-store.js';

// ============================================================================
// Constants
// ============================================================================

/** Default left pane width in pixels */
const DEFAULT_LEFT_WIDTH = 250;

/** Minimum left pane width to prevent over-collapse */
const MIN_LEFT_WIDTH = 150;

/** Maximum left pane width to prevent over-expansion */
const MAX_LEFT_WIDTH = 500;

/** Divider handle width in pixels */
const DIVIDER_WIDTH = 4;

// ============================================================================
// Types
// ============================================================================

export interface SplitPaneProps {
  /** Content for the left pane */
  left: ReactNode;
  /** Content for the right pane */
  right: ReactNode;
  /** Default width of the left pane in pixels */
  defaultLeftWidth?: number;
  /** Minimum width constraint for left pane */
  minLeftWidth?: number;
  /** Maximum width constraint for left pane */
  maxLeftWidth?: number;
  /** Custom className for the container */
  className?: string;
}

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'row' as const,
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  },
  leftPane: (width: number) => ({
    width: `${width}px`,
    minWidth: `${width}px`,
    height: '100%',
    overflow: 'auto',
    flexShrink: 0,
  }),
  divider: (isDragging: boolean) => ({
    width: `${DIVIDER_WIDTH}px`,
    cursor: 'col-resize',
    backgroundColor: isDragging ? '#0066cc' : '#e0e0e0',
    transition: isDragging ? 'none' : 'background-color 0.2s ease',
    flexShrink: 0,
    // Visual feedback on hover
    ...(isDragging ? {} : { ':hover': { backgroundColor: '#c0c0c0' } }),
  }),
  rightPane: {
    flex: 1,
    height: '100%',
    overflow: 'auto',
    minWidth: 0, // Allow shrinking below content size
  },
};

// ============================================================================
// Component
// ============================================================================

/**
 * SplitPane component for resizable split between sidebar and content.
 *
 * @example
 * ```tsx
 * <SplitPane
 *   left={<Sidebar />}
 *   right={<Content />}
 *   defaultLeftWidth={250}
 * />
 * ```
 */
export function SplitPane({
  left,
  right,
  defaultLeftWidth = DEFAULT_LEFT_WIDTH,
  minLeftWidth = MIN_LEFT_WIDTH,
  maxLeftWidth = MAX_LEFT_WIDTH,
  className,
}: SplitPaneProps): JSX.Element {
  // Connect to Zustand store for persisted width
  const storedWidth = useAppStore((state) => state.sidebarWidth);
  const setSidebarWidth = useAppStore((state) => state.setSidebarWidth);

  // Determine initial width: use stored value if available, otherwise default
  const initialWidth = storedWidth > 0 ? storedWidth : defaultLeftWidth;

  // Handle width change - persist to store
  const handleWidthChange = useCallback(
    (newWidth: number) => {
      setSidebarWidth(newWidth);
    },
    [setSidebarWidth]
  );

  // Initialize resizable behavior
  const { width, isDragging, handleMouseDown } = useResizable({
    initialWidth,
    minWidth: minLeftWidth,
    maxWidth: maxLeftWidth,
    onWidthChange: handleWidthChange,
  });

  // Sync initial default width to store if not already set
  useEffect(() => {
    if (storedWidth === 0 || storedWidth === 240) {
      // 240 is the store's default, update if using different defaultLeftWidth
      if (defaultLeftWidth !== 240) {
        setSidebarWidth(defaultLeftWidth);
      }
    }
  }, [defaultLeftWidth, storedWidth, setSidebarWidth]);

  // Prevent text selection during drag
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';

      return () => {
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isDragging]);

  return (
    <div
      className={className}
      style={styles.container}
      data-testid="split-pane"
      role="region"
      aria-label="Resizable split pane"
    >
      {/* Left Pane */}
      <div style={styles.leftPane(width)} data-testid="split-pane-left" role="complementary">
        {left}
      </div>

      {/* Draggable Divider */}
      <div
        style={styles.divider(isDragging)}
        onMouseDown={handleMouseDown}
        data-testid="split-pane-divider"
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={minLeftWidth}
        aria-valuemax={maxLeftWidth}
        tabIndex={0}
        aria-label="Resize sidebar"
      />

      {/* Right Pane */}
      <div style={styles.rightPane} data-testid="split-pane-right" role="main">
        {right}
      </div>
    </div>
  );
}
