/**
 * Unit tests for CommandPalette component
 *
 * Tests cover:
 * - Rendering and visibility
 * - Fuzzy search algorithm
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Command selection and execution
 * - Backdrop click dismissal
 * - Global keyboard shortcut (Ctrl+K / Cmd+K)
 * - Accessibility features
 * - Highlighted matching text
 * - Grouped command display
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CommandPalette,
  fuzzyMatch,
  type Command,
} from '../../../src/components/CommandPalette.js';
import { useAppStore } from '../../../src/stores/ui-store.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Simulate a keyboard event on the window.
 */
function simulateGlobalKeyDown(key: string, modifiers: { ctrl?: boolean; meta?: boolean } = {}) {
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

/**
 * Create mock commands for testing
 */
function createMockCommands(): Command[] {
  return [
    {
      id: 'cmd-1',
      name: 'Go to Daily Notes',
      description: 'Open daily notes page',
      section: 'Navigation',
      shortcut: 'Ctrl+D',
      action: vi.fn(),
    },
    {
      id: 'cmd-2',
      name: 'Go to Graph View',
      description: 'Open graph visualization',
      section: 'Navigation',
      shortcut: 'Ctrl+G',
      action: vi.fn(),
    },
    {
      id: 'cmd-3',
      name: 'Search Pages',
      description: 'Search across all pages',
      section: 'Search',
      shortcut: 'Ctrl+F',
      action: vi.fn(),
    },
    {
      id: 'cmd-4',
      name: 'Create New Page',
      description: 'Create a blank page',
      section: 'Pages',
      shortcut: 'Ctrl+N',
      action: vi.fn(),
    },
  ];
}

// ============================================================================
// Tests
// ============================================================================

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store state
    useAppStore.setState({
      commandPaletteOpen: false,
      currentPageId: null,
      pageHistory: [],
      historyIndex: -1,
      sidebarOpen: true,
      rightPanelOpen: false,
      rightPanelContent: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  // ============================================================================
  // Visibility
  // ============================================================================

  describe('Visibility', () => {
    it('renders nothing when closed (controlled)', () => {
      const { container } = render(
        <CommandPalette isOpen={false} onClose={vi.fn()} commands={createMockCommands()} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when closed (store state)', () => {
      useAppStore.setState({ commandPaletteOpen: false });

      const { container } = render(<CommandPalette commands={createMockCommands()} />);

      expect(container.firstChild).toBeNull();
    });

    it('renders when open (controlled)', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      expect(screen.getByTestId('command-palette')).toBeDefined();
    });

    it('renders when open (store state)', () => {
      useAppStore.setState({ commandPaletteOpen: true });

      render(<CommandPalette commands={createMockCommands()} />);

      expect(screen.getByTestId('command-palette')).toBeDefined();
    });
  });

  // ============================================================================
  // Rendering
  // ============================================================================

  describe('Rendering', () => {
    it('renders search input', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      expect(screen.getByTestId('command-palette-input')).toBeDefined();
      expect(screen.getByPlaceholderText('Type a command...')).toBeDefined();
    });

    it('renders command list', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      expect(screen.getByTestId('command-palette-list')).toBeDefined();
    });

    it('renders all commands', () => {
      const commands = createMockCommands();
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={commands} />);

      expect(screen.getByText('Go to Daily Notes')).toBeDefined();
      expect(screen.getByText('Go to Graph View')).toBeDefined();
      expect(screen.getByText('Search Pages')).toBeDefined();
      expect(screen.getByText('Create New Page')).toBeDefined();
    });

    it('renders command descriptions', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      expect(screen.getByText('Open daily notes page')).toBeDefined();
      expect(screen.getByText('Open graph visualization')).toBeDefined();
    });

    it('renders keyboard shortcuts', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      expect(screen.getByText('Ctrl+D')).toBeDefined();
      expect(screen.getByText('Ctrl+G')).toBeDefined();
      expect(screen.getByText('Ctrl+F')).toBeDefined();
    });

    it('renders section headers', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      expect(screen.getByTestId('command-palette-section-navigation')).toBeDefined();
      expect(screen.getByTestId('command-palette-section-search')).toBeDefined();
      expect(screen.getByTestId('command-palette-section-pages')).toBeDefined();
    });

    it('renders keyboard hints footer', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      const footer = screen.getByTestId('command-palette-footer');
      expect(footer).toBeDefined();
      expect(footer.textContent).toContain('navigate');
      expect(footer.textContent).toContain('select');
      expect(footer.textContent).toContain('close');
    });

    it('focuses input when opened', async () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      // Wait for focus (uses requestAnimationFrame)
      await new Promise((resolve) => requestAnimationFrame(resolve));

      expect(document.activeElement).toBe(screen.getByTestId('command-palette-input'));
    });
  });

  // ============================================================================
  // Search and Filtering
  // ============================================================================

  describe('Search and Filtering', () => {
    it('filters commands based on search query', async () => {
      const user = userEvent.setup();
      const commands = createMockCommands();
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={commands} />);

      // All commands should be visible initially (check by test id)
      expect(screen.getByTestId('command-palette-item-cmd-1')).toBeDefined();
      expect(screen.getByTestId('command-palette-item-cmd-4')).toBeDefined();

      const input = screen.getByTestId('command-palette-input');
      await user.type(input, 'Daily');

      // After filtering for "Daily", only matching commands should be visible
      // The Daily Notes command should still be visible
      expect(screen.getByTestId('command-palette-item-cmd-1')).toBeDefined();
      // The Create New Page command should be hidden
      expect(screen.queryByTestId('command-palette-item-cmd-4')).toBeNull();
    });

    it('shows empty state when no matches', async () => {
      const user = userEvent.setup();
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      const input = screen.getByTestId('command-palette-input');
      await user.type(input, 'xyznonexistent');

      expect(screen.getByTestId('command-palette-empty')).toBeDefined();
      expect(screen.getByText('No commands found for "xyznonexistent"')).toBeDefined();
    });

    it('resets selection when query changes', async () => {
      const user = userEvent.setup();
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      const input = screen.getByTestId('command-palette-input');

      // Navigate down to select second item
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');

      // Type to filter - should reset selection to first match
      await user.type(input, 'page');

      // First matching item should be selected
      const options = screen.getAllByRole('option');
      expect(options[0]?.getAttribute('aria-selected')).toBe('true');
    });

    it('clears query when reopened', async () => {
      const { rerender } = render(
        <CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />
      );

      const user = userEvent.setup();
      const input = screen.getByTestId('command-palette-input');
      await user.type(input, 'test');

      expect(input).toHaveProperty('value', 'test');

      // Close and reopen
      rerender(<CommandPalette isOpen={false} onClose={vi.fn()} commands={createMockCommands()} />);
      rerender(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      // Query should be cleared
      const newInput = screen.getByTestId('command-palette-input');
      expect(newInput).toHaveProperty('value', '');
    });
  });

  // ============================================================================
  // Keyboard Navigation
  // ============================================================================

  describe('Keyboard Navigation', () => {
    it('selects first item by default', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      const options = screen.getAllByRole('option');
      expect(options[0]?.getAttribute('aria-selected')).toBe('true');
    });

    it('navigates down with ArrowDown', async () => {
      const user = userEvent.setup();
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      // Focus the input first
      const input = screen.getByTestId('command-palette-input');
      input.focus();
      await user.keyboard('{ArrowDown}');

      const options = screen.getAllByRole('option');
      expect(options[0]?.getAttribute('aria-selected')).toBe('false');
      expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    });

    it('navigates up with ArrowUp', async () => {
      const user = userEvent.setup();
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      // Focus the input first
      const input = screen.getByTestId('command-palette-input');
      input.focus();

      // Navigate down first
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');

      // Now navigate up
      await user.keyboard('{ArrowUp}');

      const options = screen.getAllByRole('option');
      expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    });

    it('stops at first item when pressing ArrowUp', async () => {
      const user = userEvent.setup();
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      // Try to go up from first item
      await user.keyboard('{ArrowUp}');

      const options = screen.getAllByRole('option');
      expect(options[0]?.getAttribute('aria-selected')).toBe('true');
    });

    it('stops at last item when pressing ArrowDown', async () => {
      const user = userEvent.setup();
      const commands = createMockCommands();
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={commands} />);

      // Navigate to last item and try to go further
      for (let i = 0; i < commands.length + 2; i++) {
        await user.keyboard('{ArrowDown}');
      }

      const options = screen.getAllByRole('option');
      expect(options[commands.length - 1]?.getAttribute('aria-selected')).toBe('true');
    });

    it('executes selected command on Enter', async () => {
      const commands = createMockCommands();
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(<CommandPalette isOpen={true} onClose={onClose} commands={commands} />);

      // Focus the input first
      const input = screen.getByTestId('command-palette-input');
      input.focus();
      await user.keyboard('{Enter}');

      expect(commands[0].action).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(<CommandPalette isOpen={true} onClose={onClose} commands={createMockCommands()} />);

      // Focus the input first
      const input = screen.getByTestId('command-palette-input');
      input.focus();
      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('prevents Tab from leaving palette', async () => {
      const user = userEvent.setup();
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      const input = screen.getByTestId('command-palette-input');
      input.focus();

      await user.keyboard('{Tab}');

      // Focus should still be on input (Tab prevented)
      expect(document.activeElement).toBe(input);
    });
  });

  // ============================================================================
  // Mouse Interactions
  // ============================================================================

  describe('Mouse Interactions', () => {
    it('closes when backdrop is clicked', () => {
      const onClose = vi.fn();
      render(<CommandPalette isOpen={true} onClose={onClose} commands={createMockCommands()} />);

      const backdrop = screen.getByTestId('command-palette');
      fireEvent.click(backdrop);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when content is clicked', () => {
      const onClose = vi.fn();
      render(<CommandPalette isOpen={true} onClose={onClose} commands={createMockCommands()} />);

      const input = screen.getByTestId('command-palette-input');
      fireEvent.click(input);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('executes command when item is clicked', () => {
      const commands = createMockCommands();
      const onClose = vi.fn();

      render(<CommandPalette isOpen={true} onClose={onClose} commands={commands} />);

      fireEvent.click(screen.getByText('Go to Graph View'));

      expect(commands[1].action).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('selects item on hover', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      const thirdItem = screen.getByTestId('command-palette-item-cmd-3');
      fireEvent.mouseEnter(thirdItem);

      expect(thirdItem.getAttribute('aria-selected')).toBe('true');
    });
  });

  // ============================================================================
  // Global Keyboard Shortcut
  // ============================================================================

  describe('Global Keyboard Shortcut', () => {
    it('toggles store state on Ctrl+K', () => {
      render(<CommandPalette commands={createMockCommands()} />);

      expect(useAppStore.getState().commandPaletteOpen).toBe(false);

      simulateGlobalKeyDown('k', { ctrl: true });

      expect(useAppStore.getState().commandPaletteOpen).toBe(true);
    });

    it('toggles store state on Cmd+K (Mac)', () => {
      render(<CommandPalette commands={createMockCommands()} />);

      expect(useAppStore.getState().commandPaletteOpen).toBe(false);

      simulateGlobalKeyDown('k', { meta: true });

      expect(useAppStore.getState().commandPaletteOpen).toBe(true);
    });

    it('closes palette on Ctrl+K when open', () => {
      useAppStore.setState({ commandPaletteOpen: true });
      render(<CommandPalette commands={createMockCommands()} />);

      expect(useAppStore.getState().commandPaletteOpen).toBe(true);

      simulateGlobalKeyDown('k', { ctrl: true });

      expect(useAppStore.getState().commandPaletteOpen).toBe(false);
    });

    it('handles uppercase K key', () => {
      render(<CommandPalette commands={createMockCommands()} />);

      expect(useAppStore.getState().commandPaletteOpen).toBe(false);

      simulateGlobalKeyDown('K', { ctrl: true });

      expect(useAppStore.getState().commandPaletteOpen).toBe(true);
    });

    it('does not open without modifier key', () => {
      render(<CommandPalette commands={createMockCommands()} />);

      expect(useAppStore.getState().commandPaletteOpen).toBe(false);

      simulateGlobalKeyDown('k');

      expect(useAppStore.getState().commandPaletteOpen).toBe(false);
    });
  });

  // ============================================================================
  // Accessibility
  // ============================================================================

  describe('Accessibility', () => {
    it('has dialog role', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      expect(screen.getByRole('dialog')).toBeDefined();
    });

    it('has accessible label', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      expect(screen.getByLabelText('Command palette')).toBeDefined();
    });

    it('has aria-modal attribute', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
    });

    it('has listbox role for command list', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      expect(screen.getByRole('listbox')).toBeDefined();
    });

    it('items have option role', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      const options = screen.getAllByRole('option');
      expect(options.length).toBe(4);
    });

    it('input has aria-controls attribute', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      const input = screen.getByTestId('command-palette-input');
      expect(input.getAttribute('aria-controls')).toBe('command-list');
    });

    it('input has aria-activedescendant attribute', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      const input = screen.getByTestId('command-palette-input');
      expect(input.getAttribute('aria-activedescendant')).toBe('command-cmd-1');
    });

    it('updates aria-activedescendant on navigation', async () => {
      const user = userEvent.setup();
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      await user.keyboard('{ArrowDown}');

      const input = screen.getByTestId('command-palette-input');
      expect(input.getAttribute('aria-activedescendant')).toBe('command-cmd-2');
    });

    it('section headers have group role', () => {
      render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={createMockCommands()} />);

      const groups = screen.getAllByRole('group');
      expect(groups.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Custom Props
  // ============================================================================

  describe('Custom Props', () => {
    it('accepts custom className', () => {
      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={createMockCommands()}
          className="custom-class"
        />
      );

      expect(screen.getByTestId('command-palette').className).toContain('custom-class');
    });

    it('accepts custom testId', () => {
      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={createMockCommands()}
          testId="my-palette"
        />
      );

      expect(screen.getByTestId('my-palette')).toBeDefined();
    });

    it('uses default commands when not provided', () => {
      useAppStore.setState({ commandPaletteOpen: true });
      render(<CommandPalette />);

      // Should have default commands
      expect(screen.getByTestId('command-palette-list').children.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Fuzzy Match Algorithm Tests
// ============================================================================

describe('fuzzyMatch', () => {
  it('returns empty matches for empty pattern', () => {
    const result = fuzzyMatch('', 'Hello World');

    expect(result).toEqual({ score: 0, matches: [] });
  });

  it('returns null when pattern is not found', () => {
    const result = fuzzyMatch('xyz', 'Hello World');

    expect(result).toBeNull();
  });

  it('matches exact substring', () => {
    const result = fuzzyMatch('hello', 'Hello World');

    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.matches).toHaveLength(1);
    expect(result!.matches[0]).toEqual({ start: 0, end: 5 });
  });

  it('matches case-insensitively', () => {
    const result = fuzzyMatch('HELLO', 'hello world');

    expect(result).not.toBeNull();
  });

  it('matches non-consecutive characters', () => {
    const result = fuzzyMatch('hw', 'Hello World');

    expect(result).not.toBeNull();
    expect(result!.matches.length).toBeGreaterThan(0);
  });

  it('scores consecutive matches higher', () => {
    const consecutiveResult = fuzzyMatch('abc', 'abcdef');
    // Non-consecutive: a...b...c spread out with many characters between
    const nonConsecutiveResult = fuzzyMatch('abc', 'a---b---c');

    expect(consecutiveResult).not.toBeNull();
    expect(nonConsecutiveResult).not.toBeNull();
    // Consecutive matches (abc in abcdef) should score higher than
    // non-consecutive matches (a, b, c spread out)
    expect(consecutiveResult!.score).toBeGreaterThan(nonConsecutiveResult!.score);
  });

  it('scores word boundary matches higher', () => {
    const wordBoundary = fuzzyMatch('w', 'Hello World');
    const midWord = fuzzyMatch('o', 'Hello World');

    // 'W' at word boundary should score higher than 'o' in middle
    expect(wordBoundary!.score).toBeGreaterThan(midWord!.score);
  });

  it('scores start-of-text matches higher', () => {
    const startMatch = fuzzyMatch('h', 'Hello World');
    const laterMatch = fuzzyMatch('w', 'Hello World');

    // First character match gets bonus
    expect(startMatch!.score).toBeGreaterThan(laterMatch!.score);
  });

  it('returns correct match ranges for consecutive matches', () => {
    const result = fuzzyMatch('ello', 'Hello World');

    expect(result).not.toBeNull();
    expect(result!.matches).toEqual([{ start: 1, end: 5 }]);
  });

  it('returns multiple match ranges for non-consecutive matches', () => {
    const result = fuzzyMatch('hw', 'Hello World');

    expect(result).not.toBeNull();
    // Should have two separate match ranges
    expect(result!.matches.length).toBe(2);
  });
});
