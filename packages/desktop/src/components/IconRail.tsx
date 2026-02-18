/**
 * IconRail - Icon-only navigation rail for collapsed sidebar mode.
 *
 * Features:
 * - 5 navigation buttons: Daily Notes, Graph, Search, Query, Settings
 * - 44px minimum touch targets per WCAG 2.1 AA
 * - Vertical layout centered in 48px-wide rail
 * - Active route highlighted with --accent-interactive
 * - Inline SVG icons matching CommandPalette.tsx pattern
 *
 * @see docs/frontend/react-architecture.md for component hierarchy
 */

import { memo, useCallback } from 'react';
import styles from './IconRail.module.css';

// ============================================================================
// Types
// ============================================================================

export interface IconRailProps {
  /** Callback invoked with the route string when a nav button is clicked */
  onNavigate: (route: string) => void;
  /** The currently active route identifier */
  activeRoute?: string;
}

// ============================================================================
// Navigation Items
// ============================================================================

interface NavItem {
  route: string;
  label: string;
  icon: React.ReactNode;
}

// ============================================================================
// Icons
// ============================================================================

function HomeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 6.5L8 2l6 4.5V14H2V6.5z" />
      <path d="M6 14V9h4v5" />
    </svg>
  );
}

function GraphIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="4" cy="4" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="8" cy="12" r="2" />
      <path d="M6 4h4M5 6l2 4M11 6l-2 4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="5" />
      <path d="M11 11L14 14" />
    </svg>
  );
}

function QueryIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 4l-3 4 3 4M11 4l3 4-3 4M9 2l-2 12" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" />
    </svg>
  );
}

// ============================================================================
// Nav items definition
// ============================================================================

const NAV_ITEMS: NavItem[] = [
  {
    route: 'daily-notes',
    label: 'Daily Notes',
    icon: <HomeIcon />,
  },
  {
    route: 'graph',
    label: 'Graph',
    icon: <GraphIcon />,
  },
  {
    route: 'search',
    label: 'Search',
    icon: <SearchIcon />,
  },
  {
    route: 'query',
    label: 'Query',
    icon: <QueryIcon />,
  },
  {
    route: 'settings',
    label: 'Settings',
    icon: <SettingsIcon />,
  },
];

// ============================================================================
// Component
// ============================================================================

/**
 * IconRail renders vertical icon navigation for rail sidebar mode.
 * Each button has an aria-label and title tooltip for accessibility.
 */
export const IconRail = memo(function IconRail({ onNavigate, activeRoute }: IconRailProps) {
  const handleClick = useCallback(
    (route: string) => {
      onNavigate(route);
    },
    [onNavigate]
  );

  return (
    <nav
      className={styles.rail}
      data-testid="icon-rail"
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activeRoute === item.route;

        return (
          <button
            key={item.route}
            type="button"
            className={`${styles.navButton} ${isActive ? styles['navButton--active'] : ''}`}
            onClick={() => handleClick(item.route)}
            aria-label={item.label}
            title={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            {item.icon}
          </button>
        );
      })}
    </nav>
  );
});
