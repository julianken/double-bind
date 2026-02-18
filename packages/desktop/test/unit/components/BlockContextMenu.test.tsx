/**
 * Tests for BlockContextMenu component
 *
 * Validates:
 * - Hidden when isVisible=false (renders null)
 * - Shows on block-context-menu CustomEvent
 * - Renders required menu items: "Open in Right Panel", "Copy Reference", "Delete"
 * - Dismisses on backdrop click
 * - Dismisses on Escape key
 * - "Copy Reference" writes ((blockId)) to clipboard
 * - "Open in Right Panel" calls callback with blockId
 * - Positions menu at click coordinates
 * - ARIA role="menu"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { BlockContextMenu } from '../../../src/components/BlockContextMenu.js';
import { dispatchBlockContextMenu } from '../../../src/hooks/useBlockContextMenu.js';
import { ServiceProvider, type Services } from '../../../src/providers/ServiceProvider.js';
import type { BlockService, PageService } from '@double-bind/core';
import type { BlockId } from '@double-bind/types';

// ============================================================================
// Mock Setup
// ============================================================================

const MOCK_BLOCK_ID = 'block-01HTEST' as BlockId;

const writeTextMock = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: writeTextMock },
  writable: true,
  configurable: true,
});

function createMockBlockService(): BlockService {
  return {
    getById: vi.fn().mockResolvedValue({
      blockId: MOCK_BLOCK_ID,
      content: 'Test content',
      pageId: 'page-01H' as any,
      parentId: null,
      order: 'a0',
      contentType: 'text',
      isCollapsed: false,
      isDeleted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
    deleteBlock: vi.fn().mockResolvedValue(undefined),
    createBlock: vi.fn().mockResolvedValue(undefined),
    updateContent: vi.fn().mockResolvedValue(undefined),
  } as unknown as BlockService;
}

function createWrapper(blockService?: BlockService) {
  const services: Services = {
    pageService: {} as PageService,
    blockService: blockService ?? createMockBlockService(),
  };
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(ServiceProvider, { services }, children);
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('BlockContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // Hidden by default
  // ==========================================================================

  describe('hidden state', () => {
    it('renders nothing when no block-context-menu event has fired', () => {
      render(<BlockContextMenu />);

      expect(screen.queryByTestId('block-context-menu')).toBeNull();
    });
  });

  // ==========================================================================
  // Visible on event
  // ==========================================================================

  describe('visible on event', () => {
    it('shows the menu when block-context-menu fires', () => {
      render(<BlockContextMenu />, { wrapper: createWrapper() });

      act(() => {
        dispatchBlockContextMenu(MOCK_BLOCK_ID, 100, 200);
      });

      expect(screen.getByTestId('block-context-menu')).toBeDefined();
    });

    it('positions the menu at the click coordinates', () => {
      render(<BlockContextMenu />, { wrapper: createWrapper() });

      act(() => {
        dispatchBlockContextMenu(MOCK_BLOCK_ID, 150, 300);
      });

      const menu = screen.getByTestId('block-context-menu');
      expect(menu.style.top).toBe('300px');
      expect(menu.style.left).toBe('150px');
    });

    it('renders a menu with role="menu"', () => {
      render(<BlockContextMenu />, { wrapper: createWrapper() });

      act(() => {
        dispatchBlockContextMenu(MOCK_BLOCK_ID, 100, 200);
      });

      const menu = screen.getByRole('menu');
      expect(menu).toBeDefined();
    });
  });

  // ==========================================================================
  // Required menu items
  // ==========================================================================

  describe('menu items', () => {
    beforeEach(() => {
      render(<BlockContextMenu onOpenInRightPanel={vi.fn()} />, { wrapper: createWrapper() });

      act(() => {
        dispatchBlockContextMenu(MOCK_BLOCK_ID, 100, 200);
      });
    });

    it('shows "Open in Right Panel" item', () => {
      expect(
        screen.getByTestId('block-context-menu-item-open-in-right-panel')
      ).toBeDefined();
    });

    it('shows "Copy Reference" item', () => {
      expect(screen.getByTestId('block-context-menu-item-copy-reference')).toBeDefined();
    });

    it('shows "Delete" item from hook actions', () => {
      expect(screen.getByTestId('block-context-menu-item-delete')).toBeDefined();
    });
  });

  // ==========================================================================
  // Dismiss on backdrop click
  // ==========================================================================

  describe('dismiss on backdrop click', () => {
    it('closes the menu when the backdrop is clicked', () => {
      render(<BlockContextMenu />, { wrapper: createWrapper() });

      act(() => {
        dispatchBlockContextMenu(MOCK_BLOCK_ID, 100, 200);
      });

      expect(screen.getByTestId('block-context-menu')).toBeDefined();

      fireEvent.click(screen.getByTestId('block-context-menu-backdrop'));

      expect(screen.queryByTestId('block-context-menu')).toBeNull();
    });
  });

  // ==========================================================================
  // Dismiss on Escape
  // ==========================================================================

  describe('dismiss on Escape key', () => {
    it('closes the menu when Escape is pressed', () => {
      render(<BlockContextMenu />, { wrapper: createWrapper() });

      act(() => {
        dispatchBlockContextMenu(MOCK_BLOCK_ID, 100, 200);
      });

      expect(screen.getByTestId('block-context-menu')).toBeDefined();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(screen.queryByTestId('block-context-menu')).toBeNull();
    });
  });

  // ==========================================================================
  // Copy Reference action
  // ==========================================================================

  describe('Copy Reference action', () => {
    it('writes ((blockId)) to clipboard and closes the menu', async () => {
      render(<BlockContextMenu />, { wrapper: createWrapper() });

      act(() => {
        dispatchBlockContextMenu(MOCK_BLOCK_ID, 100, 200);
      });

      const copyRefBtn = screen.getByTestId('block-context-menu-item-copy-reference');
      fireEvent.click(copyRefBtn);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith(`((${MOCK_BLOCK_ID}))`);
      });

      expect(screen.queryByTestId('block-context-menu')).toBeNull();
    });
  });

  // ==========================================================================
  // Open in Right Panel action
  // ==========================================================================

  describe('Open in Right Panel action', () => {
    it('calls onOpenInRightPanel with the blockId and closes the menu', () => {
      const onOpenInRightPanel = vi.fn();
      render(
        <BlockContextMenu onOpenInRightPanel={onOpenInRightPanel} />,
        { wrapper: createWrapper() }
      );

      act(() => {
        dispatchBlockContextMenu(MOCK_BLOCK_ID, 100, 200);
      });

      const openBtn = screen.getByTestId('block-context-menu-item-open-in-right-panel');
      fireEvent.click(openBtn);

      expect(onOpenInRightPanel).toHaveBeenCalledWith(MOCK_BLOCK_ID);
      expect(screen.queryByTestId('block-context-menu')).toBeNull();
    });

    it('omits "Open in Right Panel" when no callback is provided', () => {
      render(<BlockContextMenu />, { wrapper: createWrapper() });

      act(() => {
        dispatchBlockContextMenu(MOCK_BLOCK_ID, 100, 200);
      });

      expect(
        screen.queryByTestId('block-context-menu-item-open-in-right-panel')
      ).toBeNull();
    });
  });
});
