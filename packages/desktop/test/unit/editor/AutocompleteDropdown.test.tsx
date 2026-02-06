/**
 * Unit tests for AutocompleteDropdown component
 *
 * Tests the React component that renders the autocomplete suggestions dropdown.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  AutocompleteDropdown,
  AUTOCOMPLETE_CSS_CLASSES,
  type AutocompleteDropdownProps,
} from '../../../src/editor/AutocompleteDropdown.js';
import type { AutocompleteSuggestion } from '../../../src/editor/plugins/page-autocomplete.js';

// Mock scrollIntoView for JSDOM
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

/**
 * Create mock suggestions for testing
 */
function createMockSuggestions(count: number): AutocompleteSuggestion[] {
  return Array.from({ length: count }, (_, i) => ({
    pageId: `page-${i + 1}`,
    title: `Test Page ${i + 1}`,
    isCreateNew: false,
  }));
}

/**
 * Render the dropdown with default props
 */
function renderDropdown(overrides: Partial<AutocompleteDropdownProps> = {}) {
  const defaultProps: AutocompleteDropdownProps = {
    isOpen: true,
    suggestions: createMockSuggestions(3),
    selectedIndex: 0,
    coords: { top: 100, left: 200 },
    onSelect: vi.fn(),
    ...overrides,
  };

  return render(<AutocompleteDropdown {...defaultProps} />);
}

describe('AutocompleteDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Rendering
  // ============================================================================

  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      renderDropdown();
      expect(screen.getByTestId('autocomplete-dropdown')).toBeDefined();
    });

    it('does not render when isOpen is false', () => {
      renderDropdown({ isOpen: false });
      expect(screen.queryByTestId('autocomplete-dropdown')).toBeNull();
    });

    it('does not render when coords is null', () => {
      renderDropdown({ coords: null });
      expect(screen.queryByTestId('autocomplete-dropdown')).toBeNull();
    });

    it('renders all suggestions', () => {
      const suggestions = createMockSuggestions(5);
      renderDropdown({ suggestions });

      suggestions.forEach((suggestion, index) => {
        expect(screen.getByTestId(`autocomplete-item-${index}`)).toBeDefined();
        expect(screen.getByText(suggestion.title)).toBeDefined();
      });
    });

    it('renders empty state when no suggestions', () => {
      renderDropdown({ suggestions: [] });
      expect(screen.getByTestId('autocomplete-empty')).toBeDefined();
      expect(screen.getByText('No matches found')).toBeDefined();
    });

    it('renders "Create new" option correctly', () => {
      const suggestions: AutocompleteSuggestion[] = [
        { pageId: 'p1', title: 'Existing Page', isCreateNew: false },
        { pageId: null, title: 'New Page', isCreateNew: true },
      ];

      renderDropdown({ suggestions });

      expect(screen.getByText('Create:')).toBeDefined();
      expect(screen.getByText('[[New Page]]')).toBeDefined();
    });
  });

  // ============================================================================
  // Positioning
  // ============================================================================

  describe('Positioning', () => {
    it('positions dropdown using coords', () => {
      const coords = { top: 150, left: 250 };
      renderDropdown({ coords });

      const dropdown = screen.getByTestId('autocomplete-dropdown');
      expect(dropdown.style.position).toBe('fixed');
      expect(dropdown.style.top).toBe('150px');
      expect(dropdown.style.left).toBe('250px');
    });

    it('applies maxHeight style', () => {
      renderDropdown({ maxHeight: 400 });

      const dropdown = screen.getByTestId('autocomplete-dropdown');
      expect(dropdown.style.maxHeight).toBe('400px');
    });

    it('uses default maxHeight of 300', () => {
      renderDropdown();

      const dropdown = screen.getByTestId('autocomplete-dropdown');
      expect(dropdown.style.maxHeight).toBe('300px');
    });
  });

  // ============================================================================
  // Selection
  // ============================================================================

  describe('Selection', () => {
    it('highlights selected item', () => {
      const suggestions = createMockSuggestions(3);
      renderDropdown({ suggestions, selectedIndex: 1 });

      const items = screen.getAllByRole('option');
      expect(items[0]?.className).not.toContain(AUTOCOMPLETE_CSS_CLASSES.itemSelected);
      expect(items[1]?.className).toContain(AUTOCOMPLETE_CSS_CLASSES.itemSelected);
      expect(items[2]?.className).not.toContain(AUTOCOMPLETE_CSS_CLASSES.itemSelected);
    });

    it('sets aria-selected on selected item', () => {
      const suggestions = createMockSuggestions(3);
      renderDropdown({ suggestions, selectedIndex: 1 });

      const items = screen.getAllByRole('option');
      expect(items[0]?.getAttribute('aria-selected')).toBe('false');
      expect(items[1]?.getAttribute('aria-selected')).toBe('true');
      expect(items[2]?.getAttribute('aria-selected')).toBe('false');
    });

    it('handles selectedIndex of -1 (none selected)', () => {
      const suggestions = createMockSuggestions(3);
      renderDropdown({ suggestions, selectedIndex: -1 });

      const items = screen.getAllByRole('option');
      items.forEach((item) => {
        expect(item.className).not.toContain(AUTOCOMPLETE_CSS_CLASSES.itemSelected);
        expect(item.getAttribute('aria-selected')).toBe('false');
      });
    });
  });

  // ============================================================================
  // Interactions
  // ============================================================================

  describe('Interactions', () => {
    it('calls onSelect when item is clicked', () => {
      const onSelect = vi.fn();
      const suggestions = createMockSuggestions(3);
      renderDropdown({ suggestions, onSelect });

      fireEvent.click(screen.getByTestId('autocomplete-item-1'));

      expect(onSelect).toHaveBeenCalledWith(suggestions[1], 1);
    });

    it('calls onHover when mouse enters item', () => {
      const onHover = vi.fn();
      const suggestions = createMockSuggestions(3);
      renderDropdown({ suggestions, onHover });

      fireEvent.mouseEnter(screen.getByTestId('autocomplete-item-2'));

      expect(onHover).toHaveBeenCalledWith(2);
    });

    it('does not call onHover if not provided', () => {
      const onSelect = vi.fn();
      const suggestions = createMockSuggestions(3);
      renderDropdown({ suggestions, onSelect, onHover: undefined });

      // Should not throw
      expect(() => {
        fireEvent.mouseEnter(screen.getByTestId('autocomplete-item-0'));
      }).not.toThrow();
    });
  });

  // ============================================================================
  // CSS Classes
  // ============================================================================

  describe('CSS Classes', () => {
    it('applies container class', () => {
      renderDropdown();

      const dropdown = screen.getByTestId('autocomplete-dropdown');
      expect(dropdown.className).toContain(AUTOCOMPLETE_CSS_CLASSES.container);
    });

    it('applies item class to suggestions', () => {
      const suggestions = createMockSuggestions(2);
      renderDropdown({ suggestions });

      const items = screen.getAllByRole('option');
      items.forEach((item) => {
        expect(item.className).toContain(AUTOCOMPLETE_CSS_CLASSES.item);
      });
    });

    it('applies create-new class to create option', () => {
      const suggestions: AutocompleteSuggestion[] = [
        { pageId: null, title: 'New Page', isCreateNew: true },
      ];
      renderDropdown({ suggestions });

      const item = screen.getByTestId('autocomplete-item-0');
      expect(item.className).toContain(AUTOCOMPLETE_CSS_CLASSES.itemCreateNew);
    });

    it('does not apply create-new class to regular items', () => {
      const suggestions = createMockSuggestions(1);
      renderDropdown({ suggestions });

      const item = screen.getByTestId('autocomplete-item-0');
      expect(item.className).not.toContain(AUTOCOMPLETE_CSS_CLASSES.itemCreateNew);
    });
  });

  // ============================================================================
  // Accessibility
  // ============================================================================

  describe('Accessibility', () => {
    it('has listbox role on container', () => {
      renderDropdown();

      const dropdown = screen.getByTestId('autocomplete-dropdown');
      expect(dropdown.getAttribute('role')).toBe('listbox');
    });

    it('has option role on items', () => {
      const suggestions = createMockSuggestions(2);
      renderDropdown({ suggestions });

      const items = screen.getAllByRole('option');
      expect(items.length).toBe(2);
    });

    it('has aria-label on container', () => {
      renderDropdown();

      const dropdown = screen.getByTestId('autocomplete-dropdown');
      expect(dropdown.getAttribute('aria-label')).toBe('Page suggestions');
    });

    it('sets correct aria-selected state', () => {
      const suggestions = createMockSuggestions(3);
      renderDropdown({ suggestions, selectedIndex: 2 });

      const items = screen.getAllByRole('option');
      expect(items[2]?.getAttribute('aria-selected')).toBe('true');
    });
  });

  // ============================================================================
  // Custom Test ID
  // ============================================================================

  describe('Custom Test ID', () => {
    it('uses default testId', () => {
      renderDropdown();
      expect(screen.getByTestId('autocomplete-dropdown')).toBeDefined();
    });

    it('uses custom testId when provided', () => {
      renderDropdown({ testId: 'custom-dropdown' });
      expect(screen.getByTestId('custom-dropdown')).toBeDefined();
    });
  });

  // ============================================================================
  // CSS Classes Export
  // ============================================================================

  describe('CSS Classes Export', () => {
    it('exports all required CSS classes', () => {
      expect(AUTOCOMPLETE_CSS_CLASSES.container).toBeDefined();
      expect(AUTOCOMPLETE_CSS_CLASSES.list).toBeDefined();
      expect(AUTOCOMPLETE_CSS_CLASSES.item).toBeDefined();
      expect(AUTOCOMPLETE_CSS_CLASSES.itemSelected).toBeDefined();
      expect(AUTOCOMPLETE_CSS_CLASSES.itemCreateNew).toBeDefined();
      expect(AUTOCOMPLETE_CSS_CLASSES.title).toBeDefined();
      expect(AUTOCOMPLETE_CSS_CLASSES.createLabel).toBeDefined();
      expect(AUTOCOMPLETE_CSS_CLASSES.empty).toBeDefined();
    });
  });
});
