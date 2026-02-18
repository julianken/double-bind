/**
 * Tests for useBlockContextMenu hook
 *
 * Validates:
 * - Opens on block-context-menu CustomEvent
 * - Close resets state
 * - Cut action copies content and deletes block (close inside async chain)
 * - Duplicate action creates a copy (close inside async chain)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import {
  useBlockContextMenu,
  dispatchBlockContextMenu,
} from '../../../src/hooks/useBlockContextMenu.js';
import { ServiceProvider, type Services } from '../../../src/providers/ServiceProvider.js';
import type { BlockService, PageService } from '@double-bind/core';
import type { Block, BlockId } from '@double-bind/types';

// ============================================================================
// Mock factories
// ============================================================================

const MOCK_BLOCK_ID = 'block-01HTEST' as BlockId;

const mockBlock: Block = {
  blockId: MOCK_BLOCK_ID,
  pageId: 'page-01HTEST' as any,
  parentId: null,
  content: 'Hello, world!',
  contentType: 'text',
  order: 'a0',
  isCollapsed: false,
  isDeleted: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

function createMockBlockService(overrides: Partial<BlockService> = {}): BlockService {
  return {
    getById: vi.fn().mockResolvedValue(mockBlock),
    createBlock: vi.fn().mockResolvedValue({ ...mockBlock, blockId: 'block-NEW' as BlockId }),
    deleteBlock: vi.fn().mockResolvedValue(undefined),
    updateContent: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as BlockService;
}

function createWrapper(blockService: BlockService) {
  const services: Services = {
    pageService: {} as PageService,
    blockService,
  };
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(ServiceProvider, { services }, children);
  };
}

// ============================================================================
// Clipboard mock
// ============================================================================

const writeTextMock = vi.fn().mockResolvedValue(undefined);

Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: writeTextMock },
  writable: true,
  configurable: true,
});

// ============================================================================
// Helpers
// ============================================================================

/** Fire a block-context-menu CustomEvent at the given coordinates. */
function fireContextMenuEvent(blockId: BlockId, x = 100, y = 200): void {
  dispatchBlockContextMenu(blockId, x, y);
}

describe('useBlockContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // Opens on block-context-menu CustomEvent
  // ==========================================================================

  describe('open on CustomEvent', () => {
    it('starts with isVisible=false and blockId=null', () => {
      const { result } = renderHook(() => useBlockContextMenu());

      expect(result.current.isVisible).toBe(false);
      expect(result.current.blockId).toBe(null);
    });

    it('sets isVisible=true and blockId when event fires', () => {
      const { result } = renderHook(() => useBlockContextMenu());

      act(() => {
        fireContextMenuEvent(MOCK_BLOCK_ID, 50, 75);
      });

      expect(result.current.isVisible).toBe(true);
      expect(result.current.blockId).toBe(MOCK_BLOCK_ID);
      expect(result.current.position).toEqual({ x: 50, y: 75 });
    });

    it('updates position and blockId when a second event fires', () => {
      const { result } = renderHook(() => useBlockContextMenu());

      const secondBlockId = 'block-SECOND' as BlockId;

      act(() => {
        fireContextMenuEvent(MOCK_BLOCK_ID, 10, 20);
      });

      act(() => {
        fireContextMenuEvent(secondBlockId, 300, 400);
      });

      expect(result.current.blockId).toBe(secondBlockId);
      expect(result.current.position).toEqual({ x: 300, y: 400 });
    });

    it('registers the event listener on mount and removes it on unmount', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useBlockContextMenu());

      expect(addSpy).toHaveBeenCalledWith('block-context-menu', expect.any(Function));

      unmount();

      expect(removeSpy).toHaveBeenCalledWith('block-context-menu', expect.any(Function));
    });
  });

  // ==========================================================================
  // Close resets state
  // ==========================================================================

  describe('close()', () => {
    it('sets isVisible=false and blockId=null after close()', () => {
      const { result } = renderHook(() => useBlockContextMenu());

      act(() => {
        fireContextMenuEvent(MOCK_BLOCK_ID);
      });

      expect(result.current.isVisible).toBe(true);

      act(() => {
        result.current.close();
      });

      expect(result.current.isVisible).toBe(false);
      expect(result.current.blockId).toBe(null);
    });

    it('produces an empty actions array after close()', () => {
      const { result } = renderHook(() => useBlockContextMenu());

      act(() => {
        fireContextMenuEvent(MOCK_BLOCK_ID);
      });

      expect(result.current.actions.length).toBeGreaterThan(0);

      act(() => {
        result.current.close();
      });

      expect(result.current.actions).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Cut action — copies content, deletes block, close inside async chain
  // ==========================================================================

  describe('Cut action', () => {
    it('copies block content to clipboard, deletes block, then calls close', async () => {
      const mockBlockService = createMockBlockService();
      const wrapper = createWrapper(mockBlockService);

      const { result } = renderHook(() => useBlockContextMenu(), { wrapper });

      act(() => {
        fireContextMenuEvent(MOCK_BLOCK_ID);
      });

      const cutAction = result.current.actions.find((a) => a.label === 'Cut');
      expect(cutAction).toBeDefined();

      await act(async () => {
        cutAction!.action();
        // Allow promises to resolve
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockBlockService.getById).toHaveBeenCalledWith(MOCK_BLOCK_ID);
      expect(writeTextMock).toHaveBeenCalledWith(mockBlock.content);
      expect(mockBlockService.deleteBlock).toHaveBeenCalledWith(MOCK_BLOCK_ID);
      // close() is called inside the async chain — menu is dismissed
      expect(result.current.isVisible).toBe(false);
    });

    it('calls close immediately when blockService is unavailable (no provider)', () => {
      // No wrapper = no ServiceProvider
      const { result } = renderHook(() => useBlockContextMenu());

      act(() => {
        fireContextMenuEvent(MOCK_BLOCK_ID);
      });

      expect(result.current.isVisible).toBe(true);

      const cutAction = result.current.actions.find((a) => a.label === 'Cut');
      expect(cutAction).toBeDefined();

      act(() => {
        cutAction!.action();
      });

      // close() fires immediately when no service is available
      expect(result.current.isVisible).toBe(false);
    });
  });

  // ==========================================================================
  // Duplicate action — creates copy, close inside async chain
  // ==========================================================================

  describe('Duplicate action', () => {
    it('creates a new block with the same content after current block, then calls close', async () => {
      const mockBlockService = createMockBlockService();
      const wrapper = createWrapper(mockBlockService);

      const { result } = renderHook(() => useBlockContextMenu(), { wrapper });

      act(() => {
        fireContextMenuEvent(MOCK_BLOCK_ID);
      });

      const dupAction = result.current.actions.find((a) => a.label === 'Duplicate');
      expect(dupAction).toBeDefined();

      await act(async () => {
        dupAction!.action();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockBlockService.getById).toHaveBeenCalledWith(MOCK_BLOCK_ID);
      expect(mockBlockService.createBlock).toHaveBeenCalledWith(
        mockBlock.pageId,
        mockBlock.parentId,
        mockBlock.content,
        MOCK_BLOCK_ID
      );
      // close() is called inside the async chain
      expect(result.current.isVisible).toBe(false);
    });

    it('calls close immediately when blockService is unavailable (no provider)', () => {
      const { result } = renderHook(() => useBlockContextMenu());

      act(() => {
        fireContextMenuEvent(MOCK_BLOCK_ID);
      });

      const dupAction = result.current.actions.find((a) => a.label === 'Duplicate');
      expect(dupAction).toBeDefined();

      act(() => {
        dupAction!.action();
      });

      expect(result.current.isVisible).toBe(false);
    });
  });

  // ==========================================================================
  // Copy action — copies content, closes immediately (fire-and-forget)
  // ==========================================================================

  describe('Copy action', () => {
    it('copies block content to clipboard and calls close', async () => {
      const mockBlockService = createMockBlockService();
      const wrapper = createWrapper(mockBlockService);

      const { result } = renderHook(() => useBlockContextMenu(), { wrapper });

      act(() => {
        fireContextMenuEvent(MOCK_BLOCK_ID);
      });

      const copyAction = result.current.actions.find((a) => a.label === 'Copy');
      expect(copyAction).toBeDefined();

      await act(async () => {
        copyAction!.action();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockBlockService.getById).toHaveBeenCalledWith(MOCK_BLOCK_ID);
      expect(writeTextMock).toHaveBeenCalledWith(mockBlock.content);
    });
  });

  // ==========================================================================
  // Actions array shape
  // ==========================================================================

  describe('actions array', () => {
    it('exposes Copy, Cut, Duplicate, and Delete actions', () => {
      const { result } = renderHook(() => useBlockContextMenu());

      act(() => {
        fireContextMenuEvent(MOCK_BLOCK_ID);
      });

      const labels = result.current.actions.map((a) => a.label);
      expect(labels).toContain('Copy');
      expect(labels).toContain('Cut');
      expect(labels).toContain('Duplicate');
      expect(labels).toContain('Delete Block');
    });

    it('Delete Block action has a separator', () => {
      const { result } = renderHook(() => useBlockContextMenu());

      act(() => {
        fireContextMenuEvent(MOCK_BLOCK_ID);
      });

      const deleteAction = result.current.actions.find((a) => a.label === 'Delete Block');
      expect(deleteAction?.separator).toBe(true);
    });
  });
});
