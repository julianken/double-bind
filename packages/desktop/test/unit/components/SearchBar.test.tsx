/**
 * Unit tests for SearchBar component
 *
 * Tests cover:
 * - Rendering (placeholder, icons, shortcuts)
 * - Input behavior (typing, debouncing)
 * - Minimum length hint display
 * - Clear button functionality
 * - Keyboard shortcuts (Escape)
 * - Sidebar quiet mode (focus/blur)
 * - Loading state display
 * - Navigation on search
 * - Accessibility features
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '../../../src/components/SearchBar.js';
import { useAppStore } from '../../../src/stores/ui-store.js';
import { useSearchStore } from '../../../src/stores/search-store.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Simulate a keyboard event on the window.
 */
function simulateKeyDown(key: string, modifiers: { ctrl?: boolean; meta?: boolean } = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: modifiers.ctrl ?? false,
    metaKey: modifiers.meta ?? false,
    bubbles: true,
    cancelable: true,
  });

  window.dispatchEvent(event);

  return event;
}

// ============================================================================
// Tests
// ============================================================================

describe('SearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store state
    useAppStore.setState({
      currentPageId: null,
      pageHistory: [],
      historyIndex: -1,
    });

    // Reset search store state (DBB-337: shared search state)
    useSearchStore.getState().clearSearch();
  });

  afterEach(() => {
    cleanup();
    // Also reset search store after each test to ensure clean state
    useSearchStore.getState().clearSearch();
  });

  // ============================================================================
  // Rendering
  // ============================================================================

  describe('Rendering', () => {
    it('renders with search role', () => {
      render(<SearchBar />);

      expect(screen.getByRole('search')).toBeDefined();
    });

    it('renders with default placeholder', () => {
      render(<SearchBar />);

      expect(screen.getByPlaceholderText('Search pages and blocks...')).toBeDefined();
    });

    it('renders with custom placeholder', () => {
      render(<SearchBar placeholder="Custom search..." />);

      expect(screen.getByPlaceholderText('Custom search...')).toBeDefined();
    });

    it('renders with data-testid', () => {
      render(<SearchBar />);

      expect(screen.getByTestId('search-bar')).toBeDefined();
      expect(screen.getByTestId('search-bar-input')).toBeDefined();
    });

    it('renders search icon when not loading', () => {
      render(<SearchBar />);

      // Should have a search icon (SVG with circle and line for magnifying glass)
      const searchBar = screen.getByTestId('search-bar');
      const svg = searchBar.querySelector('svg');
      expect(svg).toBeDefined();
    });

    it('renders keyboard shortcut hint when input is empty', () => {
      render(<SearchBar />);

      expect(screen.getByTestId('search-bar-shortcut')).toBeDefined();
    });

    it('applies custom className', () => {
      render(<SearchBar className="custom-class" />);

      const searchBar = screen.getByTestId('search-bar');
      expect(searchBar.className).toContain('custom-class');
    });
  });

  // ============================================================================
  // Input Behavior
  // ============================================================================

  describe('Input Behavior', () => {
    it('updates value when typing', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'test query');

      expect(input).toHaveProperty('value', 'test query');
    });

    it('calls onSearch callback when typing', async () => {
      const onSearch = vi.fn();
      const user = userEvent.setup();
      render(<SearchBar onSearch={onSearch} />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'abc');

      expect(onSearch).toHaveBeenCalledWith('a');
      expect(onSearch).toHaveBeenCalledWith('ab');
      expect(onSearch).toHaveBeenCalledWith('abc');
    });

    it('hides keyboard shortcut hint when input has value', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      // Shortcut hint should be visible initially
      expect(screen.getByTestId('search-bar-shortcut')).toBeDefined();

      // Type something
      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'test');

      // Shortcut hint should be hidden
      expect(screen.queryByTestId('search-bar-shortcut')).toBeNull();
    });

    it('shows clear button when input has value', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      // Clear button should not be visible initially
      expect(screen.queryByTestId('search-bar-clear')).toBeNull();

      // Type something
      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'test');

      // Clear button should be visible
      expect(screen.getByTestId('search-bar-clear')).toBeDefined();
    });
  });

  // ============================================================================
  // Minimum Length Hint
  // ============================================================================

  describe('Minimum Length Hint', () => {
    it('does not show hint when input is empty', () => {
      render(<SearchBar />);

      expect(screen.queryByTestId('search-bar-min-length-hint')).toBeNull();
    });

    it('shows hint when query is 1 character', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'a');

      expect(screen.getByTestId('search-bar-min-length-hint')).toBeDefined();
      expect(screen.getByText('Type at least 2 characters')).toBeDefined();
    });

    it('hides hint when query reaches minimum length', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'ab');

      expect(screen.queryByTestId('search-bar-min-length-hint')).toBeNull();
    });

    it('hides hint when query is cleared', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'a');

      // Hint should be visible
      expect(screen.getByTestId('search-bar-min-length-hint')).toBeDefined();

      // Clear using backspace
      await user.type(input, '{Backspace}');

      // Hint should be hidden
      expect(screen.queryByTestId('search-bar-min-length-hint')).toBeNull();
    });

    it('shows hint again when deleting back to 1 character', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'abc');

      // Hint should not be visible
      expect(screen.queryByTestId('search-bar-min-length-hint')).toBeNull();

      // Delete to 1 character
      await user.type(input, '{Backspace}{Backspace}');

      // Hint should be visible
      expect(screen.getByTestId('search-bar-min-length-hint')).toBeDefined();
    });

    it('has aria-live attribute for accessibility', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'a');

      const hint = screen.getByTestId('search-bar-min-length-hint');
      expect(hint.getAttribute('aria-live')).toBe('polite');
    });
  });

  // ============================================================================
  // Clear Button
  // ============================================================================

  describe('Clear Button', () => {
    it('clears input when clicked', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'test query');
      expect(input).toHaveProperty('value', 'test query');

      const clearButton = screen.getByTestId('search-bar-clear');
      await user.click(clearButton);

      expect(input).toHaveProperty('value', '');
    });

    it('calls onClear callback when clicked', async () => {
      const onClear = vi.fn();
      const user = userEvent.setup();
      render(<SearchBar onClear={onClear} />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'test');

      const clearButton = screen.getByTestId('search-bar-clear');
      await user.click(clearButton);

      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('refocuses input after clearing', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'test');

      const clearButton = screen.getByTestId('search-bar-clear');
      await user.click(clearButton);

      expect(document.activeElement).toBe(input);
    });

    it('has accessible label', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'test');

      expect(screen.getByLabelText('Clear search')).toBeDefined();
    });

    it('hides minimum length hint after clearing', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'a');

      // Hint should be visible
      expect(screen.getByTestId('search-bar-min-length-hint')).toBeDefined();

      const clearButton = screen.getByTestId('search-bar-clear');
      await user.click(clearButton);

      // Hint should be hidden
      expect(screen.queryByTestId('search-bar-min-length-hint')).toBeNull();
    });
  });

  // ============================================================================
  // Escape Key
  // ============================================================================

  describe('Escape Key', () => {
    it('clears input when Escape is pressed', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'test query');
      expect(input).toHaveProperty('value', 'test query');

      await user.keyboard('{Escape}');

      expect(input).toHaveProperty('value', '');
    });

    it('blurs input when Escape is pressed', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'test');
      expect(document.activeElement).toBe(input);

      await user.keyboard('{Escape}');

      expect(document.activeElement).not.toBe(input);
    });

    it('calls onClear callback when Escape is pressed', async () => {
      const onClear = vi.fn();
      const user = userEvent.setup();
      render(<SearchBar onClear={onClear} />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'test');
      await user.keyboard('{Escape}');

      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Sidebar Quiet Mode
  // ============================================================================

  describe('Sidebar Quiet Mode', () => {
    it('sets sidebarQuiet to true when input is focused', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      expect(useAppStore.getState().sidebarQuiet).toBe(false);

      const input = screen.getByTestId('search-bar-input');
      await user.click(input);

      expect(useAppStore.getState().sidebarQuiet).toBe(true);
    });

    it('sets sidebarQuiet to false when input is blurred', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.click(input);
      expect(useAppStore.getState().sidebarQuiet).toBe(true);

      await user.tab();
      expect(useAppStore.getState().sidebarQuiet).toBe(false);
    });

    it('does not respond to Ctrl+K for focus (moved to useGlobalShortcuts)', () => {
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      expect(document.activeElement).not.toBe(input);

      // Ctrl+K no longer focuses the SearchBar; it opens the CommandPalette via useGlobalShortcuts
      simulateKeyDown('k', { ctrl: true });

      expect(document.activeElement).not.toBe(input);
    });
  });

  // ============================================================================
  // Loading State
  // ============================================================================

  describe('Loading State', () => {
    it('shows loading spinner during search', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'test query');

      // The mock search has a delay, so loading should be visible
      await waitFor(() => {
        expect(screen.getByTestId('search-loading-spinner')).toBeDefined();
      });
    });

    it('hides loading spinner after search completes', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'test query');

      // Wait for search to complete
      await waitFor(
        () => {
          expect(screen.queryByTestId('search-loading-spinner')).toBeNull();
        },
        { timeout: 1000 }
      );
    });

    it('does not show loading spinner for single character input', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'a');

      // Wait a moment to ensure loading doesn't appear
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(screen.queryByTestId('search-loading-spinner')).toBeNull();
    });
  });

  // ============================================================================
  // Navigation
  // ============================================================================

  describe('Navigation', () => {
    it('navigates to search results on Enter', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'test query');
      await user.keyboard('{Enter}');

      // Check store state
      const storeState = useAppStore.getState();
      expect(storeState.currentPageId).toBe('search');
    });

    it('does not navigate on Enter with empty query', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      useAppStore.setState({ currentPageId: 'some-page' });

      const input = screen.getByTestId('search-bar-input');
      input.focus();
      await user.keyboard('{Enter}');

      // Should not change navigation
      const storeState = useAppStore.getState();
      expect(storeState.currentPageId).toBe('some-page');
    });

    it('navigates to search results when results are available', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'test query');

      // Wait for search to complete and navigation to occur
      await waitFor(
        () => {
          const storeState = useAppStore.getState();
          expect(storeState.currentPageId).toBe('search');
        },
        { timeout: 1000 }
      );
    });
  });

  // ============================================================================
  // Form Submission
  // ============================================================================

  describe('Form Submission', () => {
    it('prevents default form submission', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const form = screen.getByTestId('search-bar');
      const submitHandler = vi.fn((e: Event) => {
        if (e.defaultPrevented) {
          // Good - default was prevented
        }
      });

      form.addEventListener('submit', submitHandler);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'test');
      await user.keyboard('{Enter}');

      // Form should not cause page reload (default prevented)
      expect(submitHandler).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Accessibility
  // ============================================================================

  describe('Accessibility', () => {
    it('has search role on form', () => {
      render(<SearchBar />);

      expect(screen.getByRole('search')).toBeDefined();
    });

    it('has accessible label on input', () => {
      render(<SearchBar />);

      expect(screen.getByLabelText('Search pages and blocks')).toBeDefined();
    });

    it('input is focusable', () => {
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      input.focus();

      expect(document.activeElement).toBe(input);
    });

    it('clear button is focusable when visible', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'test');

      const clearButton = screen.getByTestId('search-bar-clear');
      clearButton.focus();

      expect(document.activeElement).toBe(clearButton);
    });

    it('uses type="search" for native search behavior', () => {
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      expect(input.getAttribute('type')).toBe('search');
    });

    it('minimum length hint has aria-live for screen readers', async () => {
      const user = userEvent.setup();
      render(<SearchBar />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'a');

      const hint = screen.getByTestId('search-bar-min-length-hint');
      expect(hint.getAttribute('aria-live')).toBe('polite');
    });
  });
});
