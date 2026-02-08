/**
 * ThemeToggle - Component for switching between light, dark, and system themes
 *
 * Provides a dropdown menu with three options:
 * - Light: Force light theme
 * - Dark: Force dark theme
 * - System: Follow OS preference (default)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../hooks/useTheme.js';
import type { ThemePreference } from '../stores/ui-store.js';
import styles from './ThemeToggle.module.css';

// ============================================================================
// Icons
// ============================================================================

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

// ============================================================================
// Types
// ============================================================================

interface ThemeOption {
  value: ThemePreference;
  label: string;
  icon: React.ReactNode;
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'light', label: 'Light', icon: <SunIcon /> },
  { value: 'dark', label: 'Dark', icon: <MoonIcon /> },
  { value: 'system', label: 'System', icon: <MonitorIcon /> },
];

// ============================================================================
// Component
// ============================================================================

export interface ThemeToggleProps {
  /** Optional CSS class name */
  className?: string;
}

/**
 * Theme toggle dropdown component.
 *
 * @example
 * ```tsx
 * <ThemeToggle />
 * ```
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { themePreference, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Get current theme option for display
  const currentOption = THEME_OPTIONS.find((opt) => opt.value === themePreference) ?? {
    value: 'system' as ThemePreference,
    label: 'System',
    icon: <MonitorIcon />,
  };

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
          event.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          setIsOpen(false);
          buttonRef.current?.focus();
          break;
        case 'ArrowDown': {
          event.preventDefault();
          const currentIndex = THEME_OPTIONS.findIndex((opt) => opt.value === themePreference);
          const nextIndex = (currentIndex + 1) % THEME_OPTIONS.length;
          const nextOption = THEME_OPTIONS[nextIndex];
          if (nextOption) setTheme(nextOption.value);
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          const currentIndex = THEME_OPTIONS.findIndex((opt) => opt.value === themePreference);
          const prevIndex = (currentIndex - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length;
          const prevOption = THEME_OPTIONS[prevIndex];
          if (prevOption) setTheme(prevOption.value);
          break;
        }
        case 'Home': {
          event.preventDefault();
          const firstOption = THEME_OPTIONS[0];
          if (firstOption) setTheme(firstOption.value);
          break;
        }
        case 'End': {
          event.preventDefault();
          const lastOption = THEME_OPTIONS[THEME_OPTIONS.length - 1];
          if (lastOption) setTheme(lastOption.value);
          break;
        }
      }
    },
    [isOpen, themePreference, setTheme]
  );

  const handleOptionClick = useCallback(
    (value: ThemePreference) => {
      setTheme(value);
      setIsOpen(false);
      buttonRef.current?.focus();
    },
    [setTheme]
  );

  const toggleMenu = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className ?? ''}`}
      data-testid="theme-toggle"
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        onClick={toggleMenu}
        onKeyDown={handleKeyDown}
        aria-label={`Change theme (currently: ${currentOption.label})`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="theme-menu"
        data-testid="theme-toggle-button"
      >
        <span className={styles.buttonIcon}>{currentOption.icon}</span>
        <span className={styles.buttonLabel}>{currentOption.label}</span>
        <span className={`${styles.chevron} ${isOpen ? styles['chevron--open'] : ''}`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          id="theme-menu"
          role="menu"
          aria-label="Theme options"
          className={styles.menu}
          data-testid="theme-toggle-menu"
        >
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitem"
              className={`${styles.menuItem} ${option.value === themePreference ? styles['menuItem--active'] : ''}`}
              onClick={() => handleOptionClick(option.value)}
              aria-current={option.value === themePreference ? 'true' : undefined}
              data-testid={`theme-option-${option.value}`}
            >
              <span className={styles.menuItemIcon}>{option.icon}</span>
              <span className={styles.menuItemLabel}>{option.label}</span>
              {option.value === themePreference && (
                <span className={styles.checkmark} aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
