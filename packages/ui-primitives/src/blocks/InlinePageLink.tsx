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
  useState,
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

// CSS custom properties for theming
const cssVars = {
  color: 'var(--db-inline-link-color, #2563eb)',
  colorHover: 'var(--db-inline-link-color-hover, #1d4ed8)',
  colorMissing: 'var(--db-inline-link-color-missing, #9ca3af)',
  backgroundColor: 'var(--db-inline-link-bg, transparent)',
  backgroundColorHover: 'var(--db-inline-link-bg-hover, rgba(37, 99, 235, 0.08))',
} as const;

// Inline styles for the component (no external CSS dependencies)
const styles = {
  base: {
    display: 'inline',
    color: cssVars.color,
    textDecoration: 'none',
    // Use non-shorthand properties to avoid React warnings when mixing
    borderTopStyle: 'none',
    borderLeftStyle: 'none',
    borderRightStyle: 'none',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    cursor: 'pointer',
    borderRadius: '2px',
    padding: '0 2px',
    margin: '0 1px',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    lineHeight: 'inherit',
    // Reset button styles using non-shorthand
    backgroundColor: 'transparent',
  } satisfies CSSProperties,

  hover: {
    borderBottomColor: cssVars.color,
    backgroundColor: cssVars.backgroundColorHover,
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
    const [isHovered, setIsHovered] = useState(false);

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
      setIsHovered(true);
      onHover?.(pageId);
    }, [pageId, onHover]);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
      onHover?.(null);
    }, [onHover]);

    // Combine styles based on state
    const combinedStyles: CSSProperties = {
      ...styles.base,
      ...(exists && isHovered ? styles.hover : {}),
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
