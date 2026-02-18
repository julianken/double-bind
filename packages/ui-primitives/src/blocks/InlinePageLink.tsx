/**
 * InlinePageLink - Inline link to another page ([[page links]])
 *
 * Renders as an inline span with link-like styling that can be clicked
 * to navigate to the linked page. Supports hover states for previews
 * and handles missing/deleted target pages with visual indication.
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
import type { PageId } from '@double-bind/types';

export interface InlinePageLinkProps {
  /**
   * The ID of the linked page.
   */
  pageId: PageId;

  /**
   * Title of the linked page.
   */
  title: string;

  /**
   * Callback fired when the link is clicked.
   */
  onClick: (pageId: PageId) => void;

  /**
   * Callback fired when hover state changes.
   * Called with pageId on mouse enter, null on mouse leave.
   */
  onHover?: (pageId: PageId | null) => void;

  /**
   * Whether the target page exists.
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
  color: 'var(--accent-primary, var(--db-inline-link-color, #2563eb))',
  colorMissing: 'var(--text-muted, var(--db-inline-link-color-missing, #9ca3af))',
} as const;

// Inline styles match editor-styles.css .highlight-page-link to prevent
// layout shift when switching between static and editor modes.
const styles = {
  base: {
    display: 'inline',
    color: cssVars.color,
    textDecoration: 'underline',
    cursor: 'pointer',
    padding: '0',
    margin: '0',
    border: 'none',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    lineHeight: 'inherit',
    backgroundColor: 'transparent',
  } satisfies CSSProperties,

  missing: {
    color: cssVars.colorMissing,
    textDecoration: 'line-through',
    cursor: 'not-allowed',
    opacity: 0.7,
  } satisfies CSSProperties,

  brackets: {
    color: cssVars.colorMissing,
    opacity: 0.6,
    userSelect: 'none',
  } satisfies CSSProperties,
} as const;

/**
 * InlinePageLink component for rendering page links.
 *
 * @example
 * ```tsx
 * // Basic page link
 * <InlinePageLink
 *   pageId="01HQXYZ123456"
 *   title="Project Ideas"
 *   onClick={(id) => navigateToPage(id)}
 * />
 *
 * // With hover preview
 * <InlinePageLink
 *   pageId="01HQXYZ123456"
 *   title="Meeting Notes"
 *   onClick={handleClick}
 *   onHover={(id) => id ? showPreview(id) : hidePreview()}
 * />
 *
 * // Missing/deleted target
 * <InlinePageLink
 *   pageId="01HQXYZ123456"
 *   title="Deleted Page"
 *   exists={false}
 *   onClick={handleClick}
 * />
 * ```
 */
export const InlinePageLink = memo(
  forwardRef<HTMLButtonElement, InlinePageLinkProps>(function InlinePageLink(
    { pageId, title, onClick, onHover, exists = true, className },
    ref
  ) {
    const handleClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (exists) {
          onClick(pageId);
        }
      },
      [pageId, exists, onClick]
    );

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          if (exists) {
            onClick(pageId);
          }
        }
      },
      [pageId, exists, onClick]
    );

    const handleMouseEnter = useCallback(() => {
      onHover?.(pageId);
    }, [pageId, onHover]);

    const handleMouseLeave = useCallback(() => {
      onHover?.(null);
    }, [onHover]);

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
        aria-label={exists ? `Go to page: ${title}` : `Missing page: ${title}`}
        aria-disabled={!exists}
        data-testid="inline-page-link"
        data-page-id={pageId}
        data-exists={exists}
      >
        <span style={styles.brackets} aria-hidden="true">
          [[
        </span>
        <span data-testid="inline-page-link-title">{title}</span>
        <span style={styles.brackets} aria-hidden="true">
          ]]
        </span>
      </button>
    );
  })
);
