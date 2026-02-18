/**
 * InlineBlockRef - Inline reference to another block ((block refs))
 *
 * Renders as an inline span with link-like styling that can be clicked
 * to navigate to the referenced block. Supports hover states for previews
 * and handles missing/deleted target blocks with visual indication.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/link/
 */

import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  forwardRef,
  memo,
  useCallback,
} from 'react';
import type { BlockId } from '@double-bind/types';

export interface InlineBlockRefProps {
  /**
   * The ID of the referenced block.
   */
  blockId: BlockId;

  /**
   * Preview text content of the referenced block.
   * If not provided, displays the blockId as fallback.
   */
  content?: string;

  /**
   * Callback fired when the reference is clicked.
   */
  onClick: (blockId: BlockId) => void;

  /**
   * Callback fired when hover state changes.
   * Called with blockId on mouse enter, null on mouse leave.
   */
  onHover?: (blockId: BlockId | null) => void;

  /**
   * Whether the target block exists.
   * When false, renders with strikethrough/dimmed styling.
   * Defaults to true.
   */
  exists?: boolean;

  /**
   * Optional CSS class name for custom styling.
   */
  className?: string;
}

// CSS custom properties for theming — prefer design tokens, fall back to raw values
const cssVars = {
  color: 'var(--accent-interactive, var(--db-inline-ref-color, #2563eb))',
  bg: 'var(--accent-subtle, var(--db-inline-ref-bg, rgba(37, 99, 235, 0.08)))',
  colorMissing: 'var(--text-muted, var(--db-inline-ref-color-missing, #9ca3af))',
} as const;

// Inline styles match editor-styles.css .highlight-block-ref to prevent
// layout shift when switching between static and editor modes.
const styles = {
  base: {
    display: 'inline',
    color: cssVars.color,
    backgroundColor: cssVars.bg,
    textDecoration: 'none',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm, 2px)',
    padding: '0 2px',
    margin: '0',
    border: 'none',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    lineHeight: 'inherit',
  } satisfies CSSProperties,

  missing: {
    color: cssVars.colorMissing,
    textDecoration: 'line-through',
    cursor: 'not-allowed',
    opacity: 0.7,
    backgroundColor: 'transparent',
  } satisfies CSSProperties,

  brackets: {
    color: cssVars.colorMissing,
    opacity: 0.6,
    userSelect: 'none',
  } satisfies CSSProperties,
} as const;

/**
 * InlineBlockRef component for rendering block references.
 *
 * @example
 * ```tsx
 * // Basic block reference
 * <InlineBlockRef
 *   blockId="01HQXYZ123456"
 *   content="This is the referenced block content"
 *   onClick={(id) => navigateToBlock(id)}
 * />
 *
 * // With hover preview
 * <InlineBlockRef
 *   blockId="01HQXYZ123456"
 *   content="Referenced content"
 *   onClick={handleClick}
 *   onHover={(id) => id ? showPreview(id) : hidePreview()}
 * />
 *
 * // Missing/deleted target
 * <InlineBlockRef
 *   blockId="01HQXYZ123456"
 *   exists={false}
 *   onClick={handleClick}
 * />
 * ```
 */
export const InlineBlockRef = memo(
  forwardRef<HTMLButtonElement, InlineBlockRefProps>(function InlineBlockRef(
    { blockId, content, onClick, onHover, exists = true, className },
    ref
  ) {
    const handleClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (exists) {
          onClick(blockId);
        }
      },
      [blockId, exists, onClick]
    );

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          if (exists) {
            onClick(blockId);
          }
        }
      },
      [blockId, exists, onClick]
    );

    const handleMouseEnter = useCallback(() => {
      onHover?.(blockId);
    }, [blockId, onHover]);

    const handleMouseLeave = useCallback(() => {
      onHover?.(null);
    }, [onHover]);

    // Display content or fallback to blockId
    const displayText = content || blockId;

    // Combine styles based on state
    const combinedStyles: CSSProperties = {
      ...styles.base,
      ...(!exists ? styles.missing : {}),
    };

    return (
      <button
        ref={ref}
        type="button"
        className={className}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={combinedStyles}
        aria-label={exists ? `Go to block: ${displayText}` : `Missing block reference: ${blockId}`}
        aria-disabled={!exists}
        data-testid="inline-block-ref"
        data-block-id={blockId}
        data-exists={exists}
      >
        <span style={styles.brackets} aria-hidden="true">
          ((
        </span>
        <span data-testid="inline-block-ref-content">{displayText}</span>
        <span style={styles.brackets} aria-hidden="true">
          ))
        </span>
      </button>
    );
  })
);
