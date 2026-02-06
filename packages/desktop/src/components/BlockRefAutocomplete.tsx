/**
 * BlockRefAutocomplete - React component for block reference autocomplete dropdown.
 *
 * This component renders the autocomplete dropdown UI for block references.
 * It displays search results with block preview and page title, and handles
 * keyboard navigation and selection.
 *
 * @see docs/frontend/keyboard-first.md for autocomplete behavior spec
 */

import { useEffect, useRef, type CSSProperties } from 'react';
import type { BlockRefResult } from '../editor/plugins/autocomplete.js';

/**
 * Props for BlockRefAutocomplete component.
 */
export interface BlockRefAutocompleteProps {
  /** Whether the autocomplete is active/visible */
  active: boolean;
  /** Search results to display */
  results: BlockRefResult[];
  /** Currently selected index */
  selectedIndex: number;
  /** Whether a search is loading */
  isLoading: boolean;
  /** The query string typed by user */
  query: string;
  /** Position to anchor the dropdown (from editor) */
  anchorRect?: DOMRect | null;
  /** Callback when a result is clicked */
  onSelect?: (result: BlockRefResult) => void;
  /** Callback when mouse hovers over a result */
  onHover?: (index: number) => void;
  /** Optional className for styling */
  className?: string;
  /** Optional test ID */
  testId?: string;
}

/**
 * BlockRefAutocomplete renders a dropdown list of block references
 * matching the user's search query.
 */
export function BlockRefAutocomplete({
  active,
  results,
  selectedIndex,
  isLoading,
  query,
  anchorRect,
  onSelect,
  onHover,
  className = '',
  testId = 'block-ref-autocomplete',
}: BlockRefAutocompleteProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (
      selectedRef.current &&
      dropdownRef.current &&
      typeof selectedRef.current.scrollIntoView === 'function'
    ) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  if (!active) {
    return null;
  }

  // Calculate position based on anchor
  const style: CSSProperties = {
    position: 'absolute',
    zIndex: 1000,
    minWidth: '300px',
    maxWidth: '500px',
    maxHeight: '300px',
    overflowY: 'auto',
    backgroundColor: 'var(--bg-secondary, #1e1e1e)',
    border: '1px solid var(--border-color, #333)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  };

  if (anchorRect) {
    style.top = anchorRect.bottom + 4;
    style.left = anchorRect.left;
  }

  return (
    <div
      ref={dropdownRef}
      className={`block-ref-autocomplete ${className}`}
      style={style}
      data-testid={testId}
      role="listbox"
      aria-label="Block reference suggestions"
    >
      {isLoading && (
        <div
          className="autocomplete-loading"
          style={{
            padding: '12px 16px',
            color: 'var(--text-muted, #888)',
            fontSize: '14px',
          }}
        >
          Searching blocks...
        </div>
      )}

      {!isLoading && results.length === 0 && query.length > 0 && (
        <div
          className="autocomplete-empty"
          style={{
            padding: '12px 16px',
            color: 'var(--text-muted, #888)',
            fontSize: '14px',
          }}
        >
          No blocks found for &quot;{query}&quot;
        </div>
      )}

      {!isLoading && results.length === 0 && query.length === 0 && (
        <div
          className="autocomplete-hint"
          style={{
            padding: '12px 16px',
            color: 'var(--text-muted, #888)',
            fontSize: '14px',
          }}
        >
          Type to search blocks...
        </div>
      )}

      {results.map((result, index) => (
        <div
          key={result.blockId}
          ref={index === selectedIndex ? selectedRef : null}
          className={`autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
          style={{
            padding: '10px 16px',
            cursor: 'pointer',
            backgroundColor: index === selectedIndex ? 'var(--bg-accent, #2a2a2a)' : 'transparent',
            borderBottom:
              index < results.length - 1 ? '1px solid var(--border-color-light, #2a2a2a)' : 'none',
          }}
          role="option"
          aria-selected={index === selectedIndex}
          data-testid={`${testId}-item-${index}`}
          onClick={() => onSelect?.(result)}
          onMouseEnter={() => onHover?.(index)}
        >
          <div
            className="autocomplete-item-preview"
            style={{
              fontSize: '14px',
              color: 'var(--text-primary, #e0e0e0)',
              marginBottom: '4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {result.preview}
          </div>
          <div
            className="autocomplete-item-page"
            style={{
              fontSize: '12px',
              color: 'var(--text-muted, #888)',
            }}
          >
            {result.pageTitle || 'Untitled'}
          </div>
        </div>
      ))}

      {/* Keyboard hint */}
      <div
        className="autocomplete-hint-footer"
        style={{
          padding: '8px 16px',
          fontSize: '11px',
          color: 'var(--text-muted, #666)',
          backgroundColor: 'var(--bg-tertiary, #1a1a1a)',
          borderTop: '1px solid var(--border-color, #333)',
          display: 'flex',
          gap: '16px',
        }}
      >
        <span>
          <kbd style={kbdStyle}>Up</kbd>/<kbd style={kbdStyle}>Down</kbd> navigate
        </span>
        <span>
          <kbd style={kbdStyle}>Enter</kbd> select
        </span>
        <span>
          <kbd style={kbdStyle}>Esc</kbd> close
        </span>
      </div>
    </div>
  );
}

/**
 * Style for keyboard hints.
 */
const kbdStyle: CSSProperties = {
  display: 'inline-block',
  padding: '2px 6px',
  fontSize: '10px',
  fontFamily: 'monospace',
  backgroundColor: 'var(--bg-secondary, #2a2a2a)',
  borderRadius: '3px',
  border: '1px solid var(--border-color, #444)',
};

export default BlockRefAutocomplete;
