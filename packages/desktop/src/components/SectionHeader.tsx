/**
 * SectionHeader - Sidebar section label with optional collapsible behavior.
 *
 * Features:
 * - Uppercase text with section-specific typography tokens
 * - Optional count badge in parentheses
 * - Collapsible with rotating chevron when onToggle is provided
 *
 * Typography tokens used:
 * - letter-spacing: var(--tracking-section) (0.08em)
 * - font-weight: var(--font-semibold) (600)
 * - font-size: var(--text-meta) (11px)
 */

import { memo, useCallback } from 'react';
import styles from './SectionHeader.module.css';

// ============================================================================
// Types
// ============================================================================

export interface SectionHeaderProps {
  /** Section label displayed in uppercase */
  label: string;
  /** Optional item count shown in parentheses */
  count?: number;
  /** Whether the section is currently collapsed */
  collapsed?: boolean;
  /** Callback to toggle collapsed state; shows chevron when provided */
  onToggle?: () => void;
}

// ============================================================================
// Icons
// ============================================================================

function ChevronIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * SectionHeader renders a labeled section divider for the sidebar.
 *
 * @example
 * ```tsx
 * <SectionHeader
 *   label="STARRED"
 *   count={3}
 *   collapsed={false}
 *   onToggle={() => setStarredCollapsed(!starredCollapsed)}
 * />
 * ```
 */
export const SectionHeader = memo(function SectionHeader({
  label,
  count,
  collapsed = false,
  onToggle,
}: SectionHeaderProps) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onToggle?.();
      }
    },
    [onToggle]
  );

  const content = (
    <>
      <span className={styles.label}>{label}</span>
      {count !== undefined && (
        <span className={styles.count} aria-label={`${count} items`}>
          ({count})
        </span>
      )}
      {onToggle && (
        <span
          className={`${styles.chevron} ${collapsed ? styles['chevron--collapsed'] : ''}`}
          aria-hidden="true"
        >
          <ChevronIcon />
        </span>
      )}
    </>
  );

  if (onToggle) {
    return (
      <button
        type="button"
        className={styles.header}
        data-testid="section-header"
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        aria-expanded={!collapsed}
        aria-label={`${label} section, ${collapsed ? 'collapsed' : 'expanded'}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={styles.header}
      data-testid="section-header"
      role="heading"
      aria-level={3}
    >
      {content}
    </div>
  );
});
