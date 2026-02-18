/**
 * Breadcrumb - Current page context display
 *
 * Shows the current page title or a static label for non-page routes.
 * Reads navigation state from the app store and derives the display
 * text based on `currentRouteType` and `currentPageTitle`.
 *
 * Route type rendering:
 * - 'page': shows page title (or "Untitled" if null)
 * - 'graph': shows "Graph View"
 * - 'search': shows "Search"
 * - 'daily-notes': shows "Daily Notes"
 * - 'query': shows "Query"
 * - null: renders nothing
 *
 * @see docs/frontend/react-architecture.md for layout specifications
 */

import { useAppStore } from '../stores/index.js';
import { getRouteLabel } from '../utils/routeUtils.js';
import styles from './Breadcrumb.module.css';

// ============================================================================
// Types
// ============================================================================

export interface BreadcrumbProps {
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Breadcrumb displays the current navigation context in the app toolbar.
 *
 * @example
 * ```tsx
 * <Breadcrumb />
 * ```
 */
export function Breadcrumb({ className }: BreadcrumbProps) {
  const currentPageTitle = useAppStore((state) => state.currentPageTitle);
  const currentRouteType = useAppStore((state) => state.currentRouteType);

  let label: string;

  if (currentRouteType === 'page') {
    label = currentPageTitle ?? 'Untitled';
  } else if (currentRouteType !== null) {
    label = getRouteLabel(currentRouteType);
  } else {
    return null;
  }

  return (
    <span
      className={`${styles.breadcrumb}${className ? ` ${className}` : ''}`}
      data-testid="breadcrumb"
      title={label}
    >
      {label}
    </span>
  );
}
