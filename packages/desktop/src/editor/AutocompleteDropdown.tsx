/**
 * AutocompleteDropdown - React component for the [[page link autocomplete UI.
 *
 * Renders a positioned dropdown showing page suggestions when the user types [[.
 * Supports keyboard navigation highlights and mouse selection.
 *
 * Features:
 * - Positioned relative to cursor using coords from plugin state
 * - Keyboard navigation highlight (selectedIndex)
 * - Mouse hover selection
 * - "Create: [[title]]" option for new pages
 * - Accessible with proper ARIA attributes
 *
 * @see packages/desktop/src/editor/plugins/autocomplete.ts for plugin
 */

import { memo, useCallback, useEffect, useRef } from 'react';
import type { AutocompleteSuggestion } from './plugins/page-autocomplete.js';

// ============================================================================
// Types
// ============================================================================

export interface AutocompleteDropdownProps {
  /**
   * Whether the dropdown is visible
   */
  isOpen: boolean;

  /**
   * The list of suggestions to display
   */
  suggestions: AutocompleteSuggestion[];

  /**
   * Currently selected index (for keyboard navigation highlight)
   */
  selectedIndex: number;

  /**
   * Position coordinates for the dropdown
   */
  coords: { top: number; left: number } | null;

  /**
   * Callback when a suggestion is clicked
   */
  onSelect: (suggestion: AutocompleteSuggestion, index: number) => void;

  /**
   * Callback when mouse hovers over a suggestion
   */
  onHover?: (index: number) => void;

  /**
   * Maximum height of the dropdown (px)
   * @default 300
   */
  maxHeight?: number;

  /**
   * Test ID for testing
   */
  testId?: string;
}

export interface SuggestionItemProps {
  suggestion: AutocompleteSuggestion;
  index: number;
  isSelected: boolean;
  onClick: (suggestion: AutocompleteSuggestion, index: number) => void;
  onMouseEnter: (index: number) => void;
}

// ============================================================================
// CSS Classes (BEM-style)
// ============================================================================

export const AUTOCOMPLETE_CSS_CLASSES = {
  container: 'autocomplete-dropdown',
  containerHidden: 'autocomplete-dropdown--hidden',
  list: 'autocomplete-dropdown__list',
  item: 'autocomplete-dropdown__item',
  itemSelected: 'autocomplete-dropdown__item--selected',
  itemCreateNew: 'autocomplete-dropdown__item--create-new',
  title: 'autocomplete-dropdown__title',
  createLabel: 'autocomplete-dropdown__create-label',
  empty: 'autocomplete-dropdown__empty',
} as const;

// ============================================================================
// Subcomponents
// ============================================================================

/**
 * Individual suggestion item in the dropdown
 */
const SuggestionItem = memo(function SuggestionItem({
  suggestion,
  index,
  isSelected,
  onClick,
  onMouseEnter,
}: SuggestionItemProps) {
  const handleClick = useCallback(() => {
    onClick(suggestion, index);
  }, [suggestion, index, onClick]);

  const handleMouseEnter = useCallback(() => {
    onMouseEnter(index);
  }, [index, onMouseEnter]);

  const CSS = AUTOCOMPLETE_CSS_CLASSES;
  const classes = [
    CSS.item,
    isSelected && CSS.itemSelected,
    suggestion.isCreateNew && CSS.itemCreateNew,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      role="option"
      aria-selected={isSelected}
      className={classes}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      data-testid={`autocomplete-item-${index}`}
    >
      {suggestion.isCreateNew ? (
        <>
          <span className={CSS.createLabel}>Create: </span>
          <span className={CSS.title}>[[{suggestion.title}]]</span>
        </>
      ) : (
        <span className={CSS.title}>{suggestion.title}</span>
      )}
    </li>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * AutocompleteDropdown - Dropdown menu for page link autocomplete.
 *
 * This component renders a floating dropdown positioned at the cursor location.
 * It shows matching page suggestions and allows selection via mouse or keyboard.
 *
 * @example
 * ```tsx
 * <AutocompleteDropdown
 *   isOpen={autocompleteState.active}
 *   suggestions={autocompleteState.suggestions}
 *   selectedIndex={autocompleteState.selectedIndex}
 *   coords={autocompleteState.coords}
 *   onSelect={(suggestion) => selectSuggestion(view, index)}
 * />
 * ```
 */
export const AutocompleteDropdown = memo(function AutocompleteDropdown({
  isOpen,
  suggestions,
  selectedIndex,
  coords,
  onSelect,
  onHover,
  maxHeight = 300,
  testId = 'autocomplete-dropdown',
}: AutocompleteDropdownProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (!isOpen || selectedIndex < 0 || !listRef.current) {
      return;
    }

    const list = listRef.current;
    const selectedItem = list.children[selectedIndex] as HTMLElement | undefined;

    if (selectedItem) {
      selectedItem.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [isOpen, selectedIndex]);

  const handleHover = useCallback(
    (index: number) => {
      onHover?.(index);
    },
    [onHover]
  );

  const CSS = AUTOCOMPLETE_CSS_CLASSES;

  // Don't render if not open or no coords
  if (!isOpen || !coords) {
    return null;
  }

  // Calculate position styles
  const style: React.CSSProperties = {
    position: 'fixed',
    top: coords.top,
    left: coords.left,
    maxHeight,
    zIndex: 1000,
    overflow: 'auto',
  };

  return (
    <div
      className={CSS.container}
      style={style}
      role="listbox"
      aria-label="Page suggestions"
      data-testid={testId}
    >
      {suggestions.length === 0 ? (
        <div className={CSS.empty} data-testid="autocomplete-empty">
          No matches found
        </div>
      ) : (
        <ul ref={listRef} className={CSS.list}>
          {suggestions.map((suggestion, index) => (
            <SuggestionItem
              key={suggestion.pageId ?? `create-${suggestion.title}`}
              suggestion={suggestion}
              index={index}
              isSelected={index === selectedIndex}
              onClick={onSelect}
              onMouseEnter={handleHover}
            />
          ))}
        </ul>
      )}
    </div>
  );
});

// ============================================================================
// Default Styles (can be overridden via CSS)
// ============================================================================

/**
 * Default inline styles for the autocomplete dropdown.
 * These can be overridden by external CSS targeting the BEM classes.
 */
export const AUTOCOMPLETE_DEFAULT_STYLES = `
.autocomplete-dropdown {
  background: var(--color-bg-elevated, white);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 200px;
  max-width: 400px;
}

.autocomplete-dropdown__list {
  list-style: none;
  margin: 0;
  padding: 4px;
}

.autocomplete-dropdown__item {
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.autocomplete-dropdown__item:hover,
.autocomplete-dropdown__item--selected {
  background: var(--color-bg-hover, #f5f5f5);
}

.autocomplete-dropdown__item--create-new {
  color: var(--color-primary, #1976d2);
}

.autocomplete-dropdown__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.autocomplete-dropdown__create-label {
  font-weight: 500;
  flex-shrink: 0;
}

.autocomplete-dropdown__empty {
  padding: 12px;
  color: var(--color-text-muted, #666);
  text-align: center;
}
`;
