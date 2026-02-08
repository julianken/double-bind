/**
 * CommandPalette - Global command palette component
 *
 * A keyboard-first command palette for quick access to application commands.
 * Triggered via Ctrl+P (Windows/Linux) or Cmd+P (macOS).
 *
 * Features:
 * - Fuzzy search matching for commands
 * - Grouped commands by category
 * - Keyboard navigation (arrow keys, Enter, Escape)
 * - Modal overlay with backdrop dismissal
 * - Highlighted matching text in fuzzy search
 * - WCAG 2.1 AA compliant (44px minimum touch targets)
 *
 * @see docs/frontend/keyboard-first.md for keyboard shortcuts
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useAppStore } from '../stores/ui-store.js';
import styles from './CommandPalette.module.css';

// ============================================================================
// Types
// ============================================================================

/**
 * Command definition for the palette
 */
export interface Command {
  /** Unique identifier for the command */
  id: string;
  /** Display name of the command */
  name: string;
  /** Brief description of what the command does */
  description: string;
  /** Category/section for grouping (e.g., "Navigation", "Search", "Pages") */
  section: string;
  /** Keyboard shortcut hint (e.g., "Ctrl+G", "Cmd+N") */
  shortcut?: string;
  /** Icon component or null */
  icon?: React.ReactNode;
  /** Action to execute when command is selected */
  action: () => void;
}

/**
 * Props for CommandPalette component
 */
export interface CommandPaletteProps {
  /** Whether the palette is visible */
  isOpen?: boolean;
  /** Callback when palette should close */
  onClose?: () => void;
  /** Commands to display */
  commands?: Command[];
  /** Optional className for styling */
  className?: string;
  /** Optional test ID */
  testId?: string;
}

/**
 * Fuzzy match result with highlighted segments
 */
interface FuzzyMatchResult {
  command: Command;
  score: number;
  matches: Array<{ start: number; end: number }>;
}

// ============================================================================
// Constants
// ============================================================================

const PLACEHOLDER_TEXT = 'Type a command...';

// ============================================================================
// Icons
// ============================================================================

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
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

function NavigationIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

function PageIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="2" width="10" height="12" rx="1" />
      <path d="M5 5h6M5 8h6M5 11h4" />
    </svg>
  );
}

function GraphIcon() {
  return (
    <svg
      width="16"
      height="16"
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

function SettingsIcon() {
  return (
    <svg
      width="16"
      height="16"
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
// Fuzzy Search Algorithm
// ============================================================================

/**
 * Simple fuzzy matching algorithm that scores based on:
 * - Character matches (sequential matches score higher)
 * - Position of first match (earlier is better)
 * - Consecutive matches (bonus for sequential characters)
 *
 * @param pattern - The search pattern
 * @param text - The text to search in
 * @returns Match result with score and match positions, or null if no match
 */
export function fuzzyMatch(
  pattern: string,
  text: string
): { score: number; matches: Array<{ start: number; end: number }> } | null {
  if (!pattern) {
    return { score: 0, matches: [] };
  }

  const lowerPattern = pattern.toLowerCase();
  const lowerText = text.toLowerCase();

  let patternIndex = 0;
  let score = 0;
  let consecutiveMatches = 0;
  let lastMatchIndex = -1;
  const matches: Array<{ start: number; end: number }> = [];

  for (
    let textIndex = 0;
    textIndex < lowerText.length && patternIndex < lowerPattern.length;
    textIndex++
  ) {
    if (lowerText[textIndex] === lowerPattern[patternIndex]) {
      // Found a match
      const lastMatch = matches[matches.length - 1];
      if (lastMatchIndex === textIndex - 1 && lastMatch) {
        // Consecutive match - bonus score and extend current range
        consecutiveMatches++;
        score += 2 + consecutiveMatches;

        // Extend the last match range
        lastMatch.end = textIndex + 1;
      } else {
        // Non-consecutive match - start new range
        consecutiveMatches = 0;
        score += 1;

        // Add new match range
        matches.push({ start: textIndex, end: textIndex + 1 });
      }

      // Bonus for matching at start
      if (textIndex === 0) {
        score += 5;
      }

      // Bonus for matching after space (word boundary)
      if (textIndex > 0 && lowerText[textIndex - 1] === ' ') {
        score += 3;
      }

      lastMatchIndex = textIndex;
      patternIndex++;
    }
  }

  // Return null if pattern wasn't fully matched
  if (patternIndex < lowerPattern.length) {
    return null;
  }

  return { score, matches };
}

/**
 * Fuzzy search commands and return sorted results
 */
function fuzzySearchCommands(query: string, commands: Command[]): FuzzyMatchResult[] {
  if (!query.trim()) {
    return commands.map((command) => ({
      command,
      score: 0,
      matches: [],
    }));
  }

  const results: FuzzyMatchResult[] = [];

  for (const command of commands) {
    // Search in name and description
    const nameMatch = fuzzyMatch(query, command.name);
    const descMatch = fuzzyMatch(query, command.description);

    // Use the better match
    if (nameMatch || descMatch) {
      const nameScore = nameMatch?.score ?? 0;
      const descScore = descMatch?.score ?? 0;

      // Prefer name matches (multiply by 2)
      if (nameScore * 2 >= descScore) {
        results.push({
          command,
          score: nameScore * 2,
          matches: nameMatch?.matches ?? [],
        });
      } else {
        results.push({
          command,
          score: descScore,
          matches: [], // Don't highlight description matches in name
        });
      }
    }
  }

  // Sort by score (descending)
  return results.sort((a, b) => b.score - a.score);
}

// ============================================================================
// Highlight Component
// ============================================================================

/**
 * Renders text with highlighted match segments
 */
function HighlightedText({
  text,
  matches,
}: {
  text: string;
  matches: Array<{ start: number; end: number }>;
}) {
  if (matches.length === 0) {
    return <>{text}</>;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of matches) {
    // Add text before match
    if (match.start > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.start)}</span>);
    }

    // Add highlighted match
    parts.push(
      <mark key={`match-${match.start}`} className={styles.highlight}>
        {text.slice(match.start, match.end)}
      </mark>
    );

    lastIndex = match.end;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

// ============================================================================
// Default Commands
// ============================================================================

/**
 * Creates default commands for the palette
 */
export function createDefaultCommands(
  navigateToPage: (pageId: string) => void,
  toggleSidebar: () => void,
  closeRightPanel: () => void
): Command[] {
  return [
    // Navigation section
    {
      id: 'nav-daily-notes',
      name: 'Go to Daily Notes',
      description: "Open today's daily notes page",
      section: 'Navigation',
      shortcut: undefined,
      icon: <NavigationIcon />,
      action: () => navigateToPage(''),
    },
    {
      id: 'nav-graph',
      name: 'Go to Graph View',
      description: 'Open the knowledge graph visualization',
      section: 'Navigation',
      shortcut: 'Ctrl+G',
      icon: <GraphIcon />,
      action: () => navigateToPage('graph'),
    },
    {
      id: 'nav-query',
      name: 'Go to Query Editor',
      description: 'Open the Datalog query editor',
      section: 'Navigation',
      icon: <PageIcon />,
      action: () => navigateToPage('query'),
    },
    // Search section
    {
      id: 'search-pages',
      name: 'Search Pages',
      description: 'Search across all pages and blocks',
      section: 'Search',
      shortcut: 'Ctrl+F',
      icon: <SearchIcon />,
      action: () => navigateToPage('search'),
    },
    // Pages section
    {
      id: 'pages-new',
      name: 'Create New Page',
      description: 'Create a new empty page',
      section: 'Pages',
      shortcut: 'Ctrl+N',
      icon: <PageIcon />,
      action: () => {
        // Placeholder - would trigger page creation
        navigateToPage('page/new');
      },
    },
    // View section
    {
      id: 'view-toggle-sidebar',
      name: 'Toggle Sidebar',
      description: 'Show or hide the sidebar',
      section: 'View',
      shortcut: 'Ctrl+\\',
      icon: <SettingsIcon />,
      action: toggleSidebar,
    },
    {
      id: 'view-close-panel',
      name: 'Close Right Panel',
      description: 'Close the right side panel',
      section: 'View',
      shortcut: 'Escape',
      icon: <SettingsIcon />,
      action: closeRightPanel,
    },
  ];
}

// ============================================================================
// Component
// ============================================================================

/**
 * CommandPalette component for global command access.
 *
 * @example
 * ```tsx
 * function App() {
 *   const [isOpen, setIsOpen] = useState(false);
 *
 *   return (
 *     <>
 *       <button onClick={() => setIsOpen(true)}>Open Palette</button>
 *       <CommandPalette
 *         isOpen={isOpen}
 *         onClose={() => setIsOpen(false)}
 *         commands={myCommands}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function CommandPalette({
  isOpen: externalIsOpen,
  onClose: externalOnClose,
  commands: externalCommands,
  className = '',
  testId = 'command-palette',
}: CommandPaletteProps) {
  // Use store state if not controlled externally
  const storeIsOpen = useAppStore((s) => s.commandPaletteOpen);
  const togglePalette = useAppStore((s) => s.toggleCommandPalette);
  const navigateToPage = useAppStore((s) => s.navigateToPage);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const closeRightPanel = useAppStore((s) => s.closeRightPanel);

  const isOpen = externalIsOpen ?? storeIsOpen;
  const onClose = externalOnClose ?? togglePalette;

  // State
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Default commands
  const defaultCommands = useMemo(
    () => createDefaultCommands(navigateToPage, toggleSidebar, closeRightPanel),
    [navigateToPage, toggleSidebar, closeRightPanel]
  );

  const commands = externalCommands ?? defaultCommands;

  // Filtered and sorted results
  const searchResults = useMemo(() => fuzzySearchCommands(query, commands), [query, commands]);

  // Flatten results for selection
  const flatResults = searchResults;

  // Group results by section
  const groupedResults = useMemo(() => {
    const groups: Record<string, FuzzyMatchResult[]> = {};

    for (const result of searchResults) {
      const section = result.command.section;
      if (!groups[section]) {
        groups[section] = [];
      }
      groups[section].push(result);
    }

    return groups;
  }, [searchResults]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after render
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (
      selectedRef.current &&
      listRef.current &&
      typeof selectedRef.current.scrollIntoView === 'function'
    ) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
          break;

        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;

        case 'Enter':
          event.preventDefault();
          if (flatResults[selectedIndex]) {
            flatResults[selectedIndex].command.action();
            onClose();
          }
          break;

        case 'Escape':
          event.preventDefault();
          onClose();
          break;

        case 'Tab':
          // Prevent tabbing out of the palette
          event.preventDefault();
          break;
      }
    },
    [flatResults, selectedIndex, onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Handle command selection
  const handleCommandClick = useCallback(
    (command: Command) => {
      command.action();
      onClose();
    },
    [onClose]
  );

  // Handle input change
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setSelectedIndex(0);
  }, []);

  // Global keyboard listener for Ctrl+P
  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      if (isCtrlOrCmd && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        togglePalette();
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [togglePalette]);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  // Calculate flat index for each result to track selection
  let currentFlatIndex = 0;

  return (
    <div
      className={`${styles.backdrop} ${className}`}
      onClick={handleBackdropClick}
      data-testid={testId}
      role="dialog"
      aria-label="Command palette"
      aria-modal="true"
    >
      <div className={styles.container} role="presentation">
        {/* Search Input */}
        <div className={styles.inputContainer}>
          <span className={styles.inputIcon}>
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER_TEXT}
            className={styles.input}
            aria-label="Search commands"
            aria-controls="command-list"
            aria-activedescendant={
              flatResults[selectedIndex]
                ? `command-${flatResults[selectedIndex].command.id}`
                : undefined
            }
            data-testid={`${testId}-input`}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </div>

        {/* Command List */}
        <div
          ref={listRef}
          id="command-list"
          className={styles.listContainer}
          role="listbox"
          aria-label="Commands"
          data-testid={`${testId}-list`}
        >
          {flatResults.length === 0 ? (
            <div className={styles.emptyState} data-testid={`${testId}-empty`}>
              No commands found for &quot;{query}&quot;
            </div>
          ) : (
            Object.entries(groupedResults).map(([section, results]) => (
              <div key={section} role="group" aria-labelledby={`section-${section}`}>
                <div
                  id={`section-${section}`}
                  className={styles.sectionHeader}
                  data-testid={`${testId}-section-${section.toLowerCase()}`}
                >
                  {section}
                </div>
                {results.map((result) => {
                  const index = currentFlatIndex++;
                  const isSelected = index === selectedIndex;

                  const itemClasses = [
                    styles.commandItem,
                    isSelected && styles['commandItem--selected'],
                  ].filter(Boolean).join(' ');

                  return (
                    <div
                      key={result.command.id}
                      ref={isSelected ? selectedRef : null}
                      id={`command-${result.command.id}`}
                      role="option"
                      aria-selected={isSelected}
                      className={itemClasses}
                      onClick={() => handleCommandClick(result.command)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      data-testid={`${testId}-item-${result.command.id}`}
                    >
                      {result.command.icon && (
                        <span className={styles.commandIcon}>{result.command.icon}</span>
                      )}
                      <div className={styles.commandContent}>
                        <div className={styles.commandName}>
                          <HighlightedText text={result.command.name} matches={result.matches} />
                        </div>
                        <div className={styles.commandDesc}>{result.command.description}</div>
                      </div>
                      {result.command.shortcut && (
                        <span className={styles.shortcut}>{result.command.shortcut}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className={styles.footer} data-testid={`${testId}-footer`}>
          <span>
            <kbd className={styles.kbd}>↑</kbd>
            <kbd className={styles.kbd}>↓</kbd> navigate
          </span>
          <span>
            <kbd className={styles.kbd}>Enter</kbd> select
          </span>
          <span>
            <kbd className={styles.kbd}>Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
