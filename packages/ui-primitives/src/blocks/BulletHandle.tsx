/**
 * BulletHandle - Visual indicator to the left of each block
 *
 * Renders either a bullet dot (for leaf blocks) or a disclosure triangle
 * (for blocks with children). The triangle rotates to indicate collapsed
 * vs expanded state.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/treeview/
 */

import { type CSSProperties, type MouseEvent, forwardRef, memo } from 'react';

export interface BulletHandleProps {
  /**
   * Whether the block has children.
   * When true, renders a disclosure triangle instead of a bullet.
   */
  hasChildren: boolean;

  /**
   * Whether the block is collapsed (children hidden).
   * Only relevant when hasChildren is true.
   * The triangle points right when collapsed, down when expanded.
   */
  isCollapsed: boolean;

  /**
   * Callback fired when the handle is clicked.
   * Typically used to toggle collapse state.
   */
  onToggle: () => void;

  /**
   * Optional CSS class name for custom styling.
   */
  className?: string;

  /**
   * Indentation level for visual alignment.
   * Defaults to 0.
   */
  indent?: number;
}

// Inline styles for the component (no external CSS dependencies)
const styles = {
  container: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    cursor: 'pointer',
    userSelect: 'none',
    flexShrink: 0,
    borderRadius: '3px',
    transition: 'background-color 0.15s ease',
  } satisfies CSSProperties,

  containerHover: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  } satisfies CSSProperties,

  bullet: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'currentColor',
    opacity: 0.5,
  } satisfies CSSProperties,

  triangle: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderWidth: '4px 0 4px 6px',
    borderColor: 'transparent transparent transparent currentColor',
    opacity: 0.6,
    transition: 'transform 0.15s ease',
  } satisfies CSSProperties,

  triangleExpanded: {
    transform: 'rotate(90deg)',
  } satisfies CSSProperties,

  triangleCollapsed: {
    transform: 'rotate(0deg)',
  } satisfies CSSProperties,
} as const;

/**
 * BulletHandle component for block list items.
 *
 * @example
 * ```tsx
 * // Leaf block (no children) - renders bullet dot
 * <BulletHandle
 *   hasChildren={false}
 *   isCollapsed={false}
 *   onToggle={() => {}}
 * />
 *
 * // Parent block with children - renders disclosure triangle
 * <BulletHandle
 *   hasChildren={true}
 *   isCollapsed={false}
 *   onToggle={handleToggle}
 * />
 * ```
 */
export const BulletHandle = memo(
  forwardRef<HTMLButtonElement, BulletHandleProps>(function BulletHandle(
    { hasChildren, isCollapsed, onToggle, className, indent = 0 },
    ref
  ) {
    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      // Prevent event from bubbling to parent elements
      event.stopPropagation();
      onToggle();
    };

    // Calculate margin based on indentation level
    const marginLeft = indent * 24; // 24px per indent level

    return (
      <button
        ref={ref}
        type="button"
        className={className}
        onClick={handleClick}
        aria-expanded={hasChildren ? !isCollapsed : undefined}
        aria-label={
          hasChildren ? (isCollapsed ? 'Expand block' : 'Collapse block') : 'Block bullet'
        }
        style={{
          ...styles.container,
          marginLeft,
          // Remove default button styles
          border: 'none',
          background: 'transparent',
          padding: 0,
        }}
        data-testid="bullet-handle"
        data-has-children={hasChildren}
        data-collapsed={isCollapsed}
      >
        {hasChildren ? (
          <span
            style={{
              ...styles.triangle,
              ...(isCollapsed ? styles.triangleCollapsed : styles.triangleExpanded),
            }}
            data-testid="disclosure-triangle"
            aria-hidden="true"
          />
        ) : (
          <span style={styles.bullet} data-testid="bullet-dot" aria-hidden="true" />
        )}
      </button>
    );
  })
);
