/**
 * CommandPalette - Global command palette component
 *
 * A keyboard-first command palette for quick access to application commands
 * and page navigation.
 * Triggered via Ctrl+K or Ctrl+P (Windows/Linux) or Cmd+K/Cmd+P (macOS).
 *
 * Modes:
 * - Page search (default): type page name → navigate. Prefix with `>` to switch to command mode.
 * - Command mode: activated by `>` prefix. Shows existing commands list.
 *
 * Features:
 * - Fuzzy search matching for both pages and commands
 * - Grouped commands by category (command mode)
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
  useContext,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { Page } from '@double-bind/types';
import { QueryClientContext } from '@tanstack/react-query';
import { useAppStore } from '../stores/ui-store.js';
import { useServicesOptional } from '../providers/ServiceProvider.js';
import { useCozoQuery } from '../hooks/useCozoQuery.js';
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

/**
 * Page fuzzy match result with highlighted segments
 */
interface PageMatchResult {
  page: Page;
  score: number;
  matches: Array<{ start: number; end: number }>;
}

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

/**
 * Fuzzy search pages and return sorted results
 */
function fuzzySearchPages(query: string, pages: Page[]): PageMatchResult[] {
  if (!query.trim()) {
    return pages.map((page) => ({
      page,
      score: 0,
      matches: [],
    }));
  }

  const results: PageMatchResult[] = [];

  for (const page of pages) {
    const titleMatch = fuzzyMatch(query, page.title);
    if (titleMatch) {
      results.push({
        page,
        score: titleMatch.score,
        matches: titleMatch.matches,
      });
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
// Relative Time Utility
// ============================================================================

/**
 * Formats a timestamp as a relative time string.
 * Examples: "just now", "5m ago", "2h ago", "3d ago", "Jan 15"
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60_000) {
    return 'just now';
  }

  if (diff < 3_600_000) {
    const minutes = Math.floor(diff / 60_000);
    return `${minutes}m ago`;
  }

  if (diff < 86_400_000) {
    const hours = Math.floor(diff / 3_600_000);
    return `${hours}h ago`;
  }

  if (diff < 604_800_000) {
    const days = Math.floor(diff / 86_400_000);
    return `${days}d ago`;
  }

  const date = new Date(timestamp);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
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
 * CommandPalette component for global command access and page navigation.
 *
 * Default mode is page search: type a page name and press Enter to navigate.
 * Prefix query with `>` to switch to command mode.
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

  // Services for page data (optional: may be null in test environments without ServiceProvider)
  const services = useServicesOptional();
  const pageService = services?.pageService;

  // QueryClient availability check (null in unit test environments without QueryClientProvider)
  const queryClientAvailable = !!useContext(QueryClientContext);

  // State
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Determine mode: command mode when query starts with '>'
  const isCommandMode = query.startsWith('>');
  const searchQuery = isCommandMode ? query.slice(1).trimStart() : query;

  // Placeholder text reflects current mode
  const placeholderText = isCommandMode ? 'Type a command...' : 'Search pages...';

  // Page data query (disabled when pageService or QueryClientProvider is not available)
  const queryFn = useCallback(
    () => (pageService ? pageService.getAllPages({ limit: 20 }) : Promise.resolve([])),
    [pageService]
  );
  const { data: pages } = useCozoQuery(['pages'], queryFn, {
    enabled: !!pageService && queryClientAvailable,
  });

  // Default commands
  const defaultCommands = useMemo(
    () => createDefaultCommands(navigateToPage, toggleSidebar, closeRightPanel),
    [navigateToPage, toggleSidebar, closeRightPanel]
  );

  const commands = externalCommands ?? defaultCommands;

  // Page search results
  const pageResults = useMemo(() => {
    if (isCommandMode) return [];
    const activePage = (pages ?? []).filter((p) => !p.isDeleted);
    return fuzzySearchPages(searchQuery, activePage);
  }, [isCommandMode, pages, searchQuery]);

  // Command search results
  const commandResults = useMemo(() => {
    if (!isCommandMode) return [];
    return fuzzySearchCommands(searchQuery, commands);
  }, [isCommandMode, searchQuery, commands]);

  // Total flat result count for selection bounds
  const totalResults = isCommandMode ? commandResults.length : pageResults.length;

  // Group command results by section
  const groupedCommandResults = useMemo(() => {
    const groups: Record<string, FuzzyMatchResult[]> = {};
    for (const result of commandResults) {
      const section = result.command.section;
      if (!groups[section]) {
        groups[section] = [];
      }
      groups[section].push(result);
    }
    return groups;
  }, [commandResults]);

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

  // Reset selection index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [isCommandMode, searchQuery]);

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
          setSelectedIndex((prev) => Math.min(prev + 1, totalResults - 1));
          break;

        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;

        case 'Enter':
          event.preventDefault();
          if (isCommandMode) {
            if (commandResults[selectedIndex]) {
              commandResults[selectedIndex].command.action();
              onClose();
            }
          } else {
            if (pageResults[selectedIndex]) {
              navigateToPage('page/' + pageResults[selectedIndex].page.pageId);
              onClose();
            }
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
    [isCommandMode, commandResults, pageResults, selectedIndex, onClose, navigateToPage, totalResults]
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

  // Handle page result selection
  const handlePageClick = useCallback(
    (page: Page) => {
      navigateToPage('page/' + page.pageId);
      onClose();
    },
    [navigateToPage, onClose]
  );

  // Handle input change
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setSelectedIndex(0);
  }, []);

  // Global keyboard listener for Ctrl+P (Ctrl+K is handled in useGlobalShortcuts)
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

  // Calculate flat index for command results (used in section rendering)
  let currentCommandFlatIndex = 0;

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
            placeholder={placeholderText}
            className={styles.input}
            aria-label={isCommandMode ? 'Search commands' : 'Search pages'}
            aria-controls="command-list"
            aria-activedescendant={
              isCommandMode
                ? (commandResults[selectedIndex]
                    ? `command-${commandResults[selectedIndex].command.id}`
                    : undefined)
                : (pageResults[selectedIndex]
                    ? `page-${pageResults[selectedIndex].page.pageId}`
                    : undefined)
            }
            data-testid={`${testId}-input`}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          {isCommandMode && (
            <span className={styles.modeIndicator} data-testid={`${testId}-mode-indicator`}>
              commands
            </span>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          id="command-list"
          className={styles.listContainer}
          role="listbox"
          aria-label={isCommandMode ? 'Commands' : 'Pages'}
          data-testid={`${testId}-list`}
        >
          {/* Page search mode */}
          {!isCommandMode && (
            pageResults.length === 0 ? (
              <div className={styles.emptyState} data-testid={`${testId}-empty`}>
                {searchQuery ? `No pages found for "${searchQuery}"` : 'No pages available'}
              </div>
            ) : (
              <div role="group" aria-labelledby="section-pages">
                <div
                  id="section-pages"
                  className={styles.sectionHeader}
                  data-testid={`${testId}-section-pages`}
                >
                  Pages
                </div>
                {pageResults.map((result, index) => {
                  const isSelected = index === selectedIndex;
                  const itemClasses = [
                    styles.commandItem,
                    isSelected && styles['commandItem--selected'],
                  ].filter(Boolean).join(' ');

                  return (
                    <div
                      key={result.page.pageId}
                      ref={isSelected ? selectedRef : null}
                      id={`page-${result.page.pageId}`}
                      role="option"
                      aria-selected={isSelected}
                      className={itemClasses}
                      onClick={() => handlePageClick(result.page)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      data-testid={`${testId}-page-${result.page.pageId}`}
                    >
                      <span className={styles.commandIcon}>
                        <PageIcon />
                      </span>
                      <div className={styles.commandContent}>
                        <div className={styles.commandName}>
                          <HighlightedText text={result.page.title} matches={result.matches} />
                        </div>
                      </div>
                      <span className={styles.pageTimestamp}>
                        {formatRelativeTime(result.page.updatedAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Command mode */}
          {isCommandMode && (
            commandResults.length === 0 ? (
              <div className={styles.emptyState} data-testid={`${testId}-empty`}>
                {searchQuery ? `No commands found for "${searchQuery}"` : 'No commands available'}
              </div>
            ) : (
              Object.entries(groupedCommandResults).map(([section, results]) => (
                <div key={section} role="group" aria-labelledby={`section-${section}`}>
                  <div
                    id={`section-${section}`}
                    className={styles.sectionHeader}
                    data-testid={`${testId}-section-${section.toLowerCase()}`}
                  >
                    {section}
                  </div>
                  {results.map((result) => {
                    const index = currentCommandFlatIndex++;
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
            )
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
          {!isCommandMode && (
            <span>
              <kbd className={styles.kbd}>&gt;</kbd> commands
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
