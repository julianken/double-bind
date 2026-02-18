/**
 * Unit tests for SlashCommandMenu component
 *
 * Tests cover:
 * - CustomEvent-based open/close (slash-command-open, slash-command-close)
 * - Keyboard navigation: ArrowUp, ArrowDown
 * - Enter to select highlighted item
 * - Escape to close
 * - Mouse click to select
 * - Mouse enter updates active index
 * - onSelect / onClose callbacks
 * - Renders null when closed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import {
  SlashCommandMenu,
  BLOCK_COMMANDS,
  type BlockCommand,
  type SlashCommandCoords,
} from '../../../src/components/SlashCommandMenu.js';

// ============================================================================
// Helpers
// ============================================================================

const defaultCoords: SlashCommandCoords = {
  top: 100,
  left: 50,
  bottom: 120,
  right: 200,
};

function dispatchSlashOpen(coords: SlashCommandCoords = defaultCoords, pos = 0) {
  const event = new CustomEvent('slash-command-open', {
    bubbles: true,
    detail: { pos, coords },
  });
  document.dispatchEvent(event);
}

function dispatchSlashClose() {
  const event = new CustomEvent('slash-command-close', {
    bubbles: true,
    detail: {},
  });
  document.dispatchEvent(event);
}

// ============================================================================
// Setup / Teardown
// ============================================================================

beforeEach(() => {
  // Nothing to reset — each test renders fresh component
});

afterEach(() => {
  cleanup();
});

// ============================================================================
// Tests
// ============================================================================

describe('SlashCommandMenu', () => {
  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  describe('Rendering', () => {
    it('renders nothing when closed', () => {
      render(<SlashCommandMenu />);
      expect(screen.queryByTestId('slash-command-menu')).toBeNull();
    });

    it('renders the menu when slash-command-open fires', async () => {
      render(<SlashCommandMenu />);

      await act(async () => {
        dispatchSlashOpen();
      });

      expect(screen.getByTestId('slash-command-menu')).toBeDefined();
    });

    it('renders all block commands', async () => {
      render(<SlashCommandMenu />);

      await act(async () => {
        dispatchSlashOpen();
      });

      for (const command of BLOCK_COMMANDS) {
        expect(screen.getByTestId(`slash-command-item-${command.id}`)).toBeDefined();
      }
    });

    it('renders the "Turn into" header', async () => {
      render(<SlashCommandMenu />);

      await act(async () => {
        dispatchSlashOpen();
      });

      expect(screen.getByText('Turn into')).toBeDefined();
    });

    it('hides the menu when slash-command-close fires', async () => {
      render(<SlashCommandMenu />);

      await act(async () => {
        dispatchSlashOpen();
      });

      expect(screen.getByTestId('slash-command-menu')).toBeDefined();

      await act(async () => {
        dispatchSlashClose();
      });

      expect(screen.queryByTestId('slash-command-menu')).toBeNull();
    });

    it('positions the menu using coords from the event', async () => {
      render(<SlashCommandMenu />);

      const coords = { top: 200, left: 100, bottom: 220, right: 400 };
      await act(async () => {
        dispatchSlashOpen(coords);
      });

      const menu = screen.getByTestId('slash-command-menu');
      // The menu uses fixed positioning; top = bottom + 4 = 224
      expect(menu.style.top).toBe('224px');
      expect(menu.style.left).toBe('100px');
    });
  });

  // --------------------------------------------------------------------------
  // Keyboard Navigation
  // --------------------------------------------------------------------------

  describe('Keyboard Navigation', () => {
    it('first item is active on open', async () => {
      render(<SlashCommandMenu />);

      await act(async () => {
        dispatchSlashOpen();
      });

      const firstItem = screen.getByTestId(`slash-command-item-${BLOCK_COMMANDS[0]!.id}`);
      expect(firstItem.getAttribute('aria-selected')).toBe('true');
    });

    it('ArrowDown moves selection to next item', async () => {
      render(<SlashCommandMenu />);

      await act(async () => {
        dispatchSlashOpen();
      });

      await act(async () => {
        fireEvent.keyDown(document, { key: 'ArrowDown' });
      });

      const secondItem = screen.getByTestId(`slash-command-item-${BLOCK_COMMANDS[1]!.id}`);
      expect(secondItem.getAttribute('aria-selected')).toBe('true');

      const firstItem = screen.getByTestId(`slash-command-item-${BLOCK_COMMANDS[0]!.id}`);
      expect(firstItem.getAttribute('aria-selected')).toBe('false');
    });

    it('ArrowUp wraps from first to last item', async () => {
      render(<SlashCommandMenu />);

      await act(async () => {
        dispatchSlashOpen();
      });

      await act(async () => {
        fireEvent.keyDown(document, { key: 'ArrowUp' });
      });

      const lastItem = screen.getByTestId(
        `slash-command-item-${BLOCK_COMMANDS[BLOCK_COMMANDS.length - 1]!.id}`
      );
      expect(lastItem.getAttribute('aria-selected')).toBe('true');
    });

    it('ArrowDown wraps from last to first item', async () => {
      render(<SlashCommandMenu />);

      await act(async () => {
        dispatchSlashOpen();
      });

      // Navigate to the last item
      for (let i = 0; i < BLOCK_COMMANDS.length - 1; i++) {
        await act(async () => {
          fireEvent.keyDown(document, { key: 'ArrowDown' });
        });
      }

      // One more down should wrap to first
      await act(async () => {
        fireEvent.keyDown(document, { key: 'ArrowDown' });
      });

      const firstItem = screen.getByTestId(`slash-command-item-${BLOCK_COMMANDS[0]!.id}`);
      expect(firstItem.getAttribute('aria-selected')).toBe('true');
    });

    it('Escape closes the menu and calls onClose', async () => {
      const onClose = vi.fn();
      render(<SlashCommandMenu onClose={onClose} />);

      await act(async () => {
        dispatchSlashOpen();
      });

      expect(screen.getByTestId('slash-command-menu')).toBeDefined();

      await act(async () => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(screen.queryByTestId('slash-command-menu')).toBeNull();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('Enter selects the active item and calls onSelect', async () => {
      const onSelect = vi.fn();
      render(<SlashCommandMenu onSelect={onSelect} />);

      await act(async () => {
        dispatchSlashOpen();
      });

      // Active item is first (Text)
      await act(async () => {
        fireEvent.keyDown(document, { key: 'Enter' });
      });

      expect(onSelect).toHaveBeenCalledOnce();
      expect(onSelect).toHaveBeenCalledWith(BLOCK_COMMANDS[0]);
      expect(screen.queryByTestId('slash-command-menu')).toBeNull();
    });

    it('Enter selects the navigated-to item', async () => {
      const onSelect = vi.fn();
      render(<SlashCommandMenu onSelect={onSelect} />);

      await act(async () => {
        dispatchSlashOpen();
      });

      // Navigate down to Heading 1
      await act(async () => {
        fireEvent.keyDown(document, { key: 'ArrowDown' });
      });

      await act(async () => {
        fireEvent.keyDown(document, { key: 'Enter' });
      });

      expect(onSelect).toHaveBeenCalledWith(BLOCK_COMMANDS[1]);
    });

    it('keyboard shortcuts do not fire when menu is closed', async () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();
      render(<SlashCommandMenu onSelect={onSelect} onClose={onClose} />);

      // Menu is closed — keyboard events should be no-ops
      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onSelect).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Mouse Interaction
  // --------------------------------------------------------------------------

  describe('Mouse Interaction', () => {
    it('clicking an item selects it and closes the menu', async () => {
      const onSelect = vi.fn();
      render(<SlashCommandMenu onSelect={onSelect} />);

      await act(async () => {
        dispatchSlashOpen();
      });

      const heading1Item = screen.getByTestId('slash-command-item-heading1');
      await act(async () => {
        fireEvent.click(heading1Item);
      });

      expect(onSelect).toHaveBeenCalledOnce();
      const called = onSelect.mock.calls[0]![0] as BlockCommand;
      expect(called.id).toBe('heading1');
      expect(screen.queryByTestId('slash-command-menu')).toBeNull();
    });

    it('hovering an item updates the active index', async () => {
      render(<SlashCommandMenu />);

      await act(async () => {
        dispatchSlashOpen();
      });

      const heading2Item = screen.getByTestId('slash-command-item-heading2');
      await act(async () => {
        fireEvent.mouseEnter(heading2Item);
      });

      expect(heading2Item.getAttribute('aria-selected')).toBe('true');
    });
  });

  // --------------------------------------------------------------------------
  // Callbacks
  // --------------------------------------------------------------------------

  describe('Callbacks', () => {
    it('resets active index to 0 on each open', async () => {
      render(<SlashCommandMenu />);

      // Open and navigate
      await act(async () => {
        dispatchSlashOpen();
      });

      await act(async () => {
        fireEvent.keyDown(document, { key: 'ArrowDown' });
        fireEvent.keyDown(document, { key: 'ArrowDown' });
      });

      // Close
      await act(async () => {
        dispatchSlashClose();
      });

      // Reopen — should be back at index 0
      await act(async () => {
        dispatchSlashOpen();
      });

      const firstItem = screen.getByTestId(`slash-command-item-${BLOCK_COMMANDS[0]!.id}`);
      expect(firstItem.getAttribute('aria-selected')).toBe('true');
    });

    it('does not call onSelect when closing with Escape', async () => {
      const onSelect = vi.fn();
      render(<SlashCommandMenu onSelect={onSelect} />);

      await act(async () => {
        dispatchSlashOpen();
      });

      await act(async () => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Accessibility
  // --------------------------------------------------------------------------

  describe('Accessibility', () => {
    it('has role=listbox on the menu container', async () => {
      render(<SlashCommandMenu />);

      await act(async () => {
        dispatchSlashOpen();
      });

      const menu = screen.getByRole('listbox');
      expect(menu).toBeDefined();
    });

    it('has aria-label on the menu', async () => {
      render(<SlashCommandMenu />);

      await act(async () => {
        dispatchSlashOpen();
      });

      const menu = screen.getByRole('listbox');
      expect(menu.getAttribute('aria-label')).toBe('Block type commands');
    });

    it('items have role=option', async () => {
      render(<SlashCommandMenu />);

      await act(async () => {
        dispatchSlashOpen();
      });

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(BLOCK_COMMANDS.length);
    });
  });
});
