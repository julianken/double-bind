import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../../src/stores/ui-store.js';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAppStore.setState({
      sidebarOpen: true,
      sidebarWidth: 240,
      rightPanelOpen: false,
      rightPanelContent: null,
      focusedBlockId: null,
      selectedBlockIds: new Set(),
      commandPaletteOpen: false,
      currentPageId: null,
      pageHistory: [],
      historyIndex: -1,
    });
  });

  // ============================================================================
  // Sidebar
  // ============================================================================

  describe('Sidebar', () => {
    it('toggles sidebar open/closed', () => {
      const store = useAppStore.getState();
      expect(store.sidebarOpen).toBe(true);

      store.toggleSidebar();
      expect(useAppStore.getState().sidebarOpen).toBe(false);

      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().sidebarOpen).toBe(true);
    });

    it('sets sidebar width', () => {
      const store = useAppStore.getState();
      expect(store.sidebarWidth).toBe(240);

      store.setSidebarWidth(300);
      expect(useAppStore.getState().sidebarWidth).toBe(300);

      useAppStore.getState().setSidebarWidth(180);
      expect(useAppStore.getState().sidebarWidth).toBe(180);
    });
  });

  // ============================================================================
  // Right Panel
  // ============================================================================

  describe('Right Panel', () => {
    it('opens right panel with content', () => {
      const store = useAppStore.getState();
      expect(store.rightPanelOpen).toBe(false);
      expect(store.rightPanelContent).toBe(null);

      store.openRightPanel('backlinks');
      const state1 = useAppStore.getState();
      expect(state1.rightPanelContent).toBe('backlinks');
      expect(state1.rightPanelOpen).toBe(true);

      useAppStore.getState().openRightPanel('properties');
      const state2 = useAppStore.getState();
      expect(state2.rightPanelContent).toBe('properties');
      expect(state2.rightPanelOpen).toBe(true);
    });

    it('closes right panel', () => {
      const store = useAppStore.getState();
      store.openRightPanel('graph');
      expect(useAppStore.getState().rightPanelOpen).toBe(true);
      expect(useAppStore.getState().rightPanelContent).toBe('graph');

      useAppStore.getState().closeRightPanel();
      const state = useAppStore.getState();
      expect(state.rightPanelContent).toBe(null);
      expect(state.rightPanelOpen).toBe(false);
    });
  });

  // ============================================================================
  // Focus
  // ============================================================================

  describe('Focus', () => {
    it('sets focused block ID', () => {
      const store = useAppStore.getState();
      expect(store.focusedBlockId).toBe(null);

      store.setFocusedBlock('block-1');
      expect(useAppStore.getState().focusedBlockId).toBe('block-1');

      useAppStore.getState().setFocusedBlock('block-2');
      expect(useAppStore.getState().focusedBlockId).toBe('block-2');
    });

    it('clears focused block', () => {
      const store = useAppStore.getState();
      store.setFocusedBlock('block-1');
      expect(useAppStore.getState().focusedBlockId).toBe('block-1');

      useAppStore.getState().setFocusedBlock(null);
      expect(useAppStore.getState().focusedBlockId).toBe(null);
    });
  });

  // ============================================================================
  // Selection
  // ============================================================================

  describe('Selection', () => {
    it('selects blocks', () => {
      const store = useAppStore.getState();
      expect(store.selectedBlockIds.size).toBe(0);

      store.selectBlock('block-1');
      expect(useAppStore.getState().selectedBlockIds.size).toBe(1);
      expect(useAppStore.getState().selectedBlockIds.has('block-1')).toBe(true);

      useAppStore.getState().selectBlock('block-2');
      const state = useAppStore.getState();
      expect(state.selectedBlockIds.size).toBe(2);
      expect(state.selectedBlockIds.has('block-1')).toBe(true);
      expect(state.selectedBlockIds.has('block-2')).toBe(true);
    });

    it('deselects blocks', () => {
      const store = useAppStore.getState();
      store.selectBlock('block-1');
      store.selectBlock('block-2');
      expect(useAppStore.getState().selectedBlockIds.size).toBe(2);

      useAppStore.getState().deselectBlock('block-1');
      const state = useAppStore.getState();
      expect(state.selectedBlockIds.size).toBe(1);
      expect(state.selectedBlockIds.has('block-1')).toBe(false);
      expect(state.selectedBlockIds.has('block-2')).toBe(true);
    });

    it('creates new Set instance when selecting/deselecting', () => {
      const store = useAppStore.getState();
      store.selectBlock('block-1');
      const originalSet = useAppStore.getState().selectedBlockIds;

      useAppStore.getState().selectBlock('block-2');
      const newSet = useAppStore.getState().selectedBlockIds;

      expect(newSet).not.toBe(originalSet);
      expect(newSet.has('block-1')).toBe(true);
      expect(newSet.has('block-2')).toBe(true);
    });

    it('clears selection', () => {
      const store = useAppStore.getState();
      store.selectBlock('block-1');
      store.selectBlock('block-2');
      store.selectBlock('block-3');
      expect(useAppStore.getState().selectedBlockIds.size).toBe(3);

      useAppStore.getState().clearSelection();
      expect(useAppStore.getState().selectedBlockIds.size).toBe(0);
    });
  });

  // ============================================================================
  // Command Palette
  // ============================================================================

  describe('Command Palette', () => {
    it('toggles command palette open', () => {
      const store = useAppStore.getState();
      expect(store.commandPaletteOpen).toBe(false);

      store.toggleCommandPalette();
      expect(useAppStore.getState().commandPaletteOpen).toBe(true);
    });

    it('toggles command palette closed', () => {
      const store = useAppStore.getState();
      store.toggleCommandPalette();
      expect(useAppStore.getState().commandPaletteOpen).toBe(true);

      useAppStore.getState().toggleCommandPalette();
      expect(useAppStore.getState().commandPaletteOpen).toBe(false);
    });
  });

  // ============================================================================
  // Navigation
  // ============================================================================

  describe('Navigation', () => {
    it('navigates to a page', () => {
      const store = useAppStore.getState();
      expect(store.currentPageId).toBe(null);
      expect(store.pageHistory).toEqual([]);

      store.navigateToPage('page-1');
      const state = useAppStore.getState();
      expect(state.currentPageId).toBe('page-1');
      expect(state.pageHistory).toEqual(['page-1']);
    });

    it('builds navigation history', () => {
      const store = useAppStore.getState();
      store.navigateToPage('page-1');
      useAppStore.getState().navigateToPage('page-2');
      useAppStore.getState().navigateToPage('page-3');

      const state = useAppStore.getState();
      expect(state.currentPageId).toBe('page-3');
      expect(state.pageHistory).toEqual(['page-1', 'page-2', 'page-3']);
    });

    it('does not add duplicate when navigating to current page', () => {
      const store = useAppStore.getState();
      store.navigateToPage('page-1');
      useAppStore.getState().navigateToPage('page-1');

      const state = useAppStore.getState();
      expect(state.pageHistory).toEqual(['page-1']);
    });

    it('truncates forward history when navigating from middle', () => {
      const store = useAppStore.getState();
      store.navigateToPage('page-1');
      useAppStore.getState().navigateToPage('page-2');
      useAppStore.getState().navigateToPage('page-3');

      // Go back twice
      useAppStore.getState().goBack();
      useAppStore.getState().goBack();
      expect(useAppStore.getState().currentPageId).toBe('page-1');

      // Navigate to new page - should truncate forward history
      useAppStore.getState().navigateToPage('page-4');

      const state = useAppStore.getState();
      expect(state.currentPageId).toBe('page-4');
      expect(state.pageHistory).toEqual(['page-1', 'page-4']);
    });

    it('enforces max history size', () => {
      // Navigate to 52 pages (exceeds max of 50)
      for (let i = 1; i <= 52; i++) {
        useAppStore.getState().navigateToPage(`page-${i}`);
      }

      const state = useAppStore.getState();
      expect(state.pageHistory.length).toBe(50);
      expect(state.pageHistory[0]).toBe('page-3'); // First two trimmed
      expect(state.pageHistory[49]).toBe('page-52');
      expect(state.currentPageId).toBe('page-52');
    });

    it('goes back in history', () => {
      const store = useAppStore.getState();
      store.navigateToPage('page-1');
      useAppStore.getState().navigateToPage('page-2');
      useAppStore.getState().navigateToPage('page-3');

      useAppStore.getState().goBack();
      expect(useAppStore.getState().currentPageId).toBe('page-2');

      useAppStore.getState().goBack();
      expect(useAppStore.getState().currentPageId).toBe('page-1');
    });

    it('does not go back beyond beginning', () => {
      const store = useAppStore.getState();
      store.navigateToPage('page-1');

      useAppStore.getState().goBack();
      expect(useAppStore.getState().currentPageId).toBe('page-1');

      useAppStore.getState().goBack();
      expect(useAppStore.getState().currentPageId).toBe('page-1');
    });

    it('goes forward in history', () => {
      const store = useAppStore.getState();
      store.navigateToPage('page-1');
      useAppStore.getState().navigateToPage('page-2');
      useAppStore.getState().navigateToPage('page-3');

      // Go back twice
      useAppStore.getState().goBack();
      useAppStore.getState().goBack();
      expect(useAppStore.getState().currentPageId).toBe('page-1');

      // Go forward
      useAppStore.getState().goForward();
      expect(useAppStore.getState().currentPageId).toBe('page-2');

      useAppStore.getState().goForward();
      expect(useAppStore.getState().currentPageId).toBe('page-3');
    });

    it('does not go forward beyond end', () => {
      const store = useAppStore.getState();
      store.navigateToPage('page-1');
      useAppStore.getState().navigateToPage('page-2');

      useAppStore.getState().goForward();
      expect(useAppStore.getState().currentPageId).toBe('page-2');

      useAppStore.getState().goForward();
      expect(useAppStore.getState().currentPageId).toBe('page-2');
    });

    it('handles back/forward navigation correctly', () => {
      const store = useAppStore.getState();
      store.navigateToPage('page-1');
      useAppStore.getState().navigateToPage('page-2');
      useAppStore.getState().navigateToPage('page-3');
      useAppStore.getState().navigateToPage('page-4');

      // Back twice
      useAppStore.getState().goBack();
      useAppStore.getState().goBack();
      expect(useAppStore.getState().currentPageId).toBe('page-2');

      // Forward once
      useAppStore.getState().goForward();
      expect(useAppStore.getState().currentPageId).toBe('page-3');

      // Back once
      useAppStore.getState().goBack();
      expect(useAppStore.getState().currentPageId).toBe('page-2');

      // Forward twice
      useAppStore.getState().goForward();
      useAppStore.getState().goForward();
      expect(useAppStore.getState().currentPageId).toBe('page-4');
    });
  });

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('Initial State', () => {
    it('has correct default values', () => {
      const store = useAppStore.getState();

      expect(store.sidebarOpen).toBe(true);
      expect(store.sidebarWidth).toBe(240);
      expect(store.rightPanelOpen).toBe(false);
      expect(store.rightPanelContent).toBe(null);
      expect(store.focusedBlockId).toBe(null);
      expect(store.selectedBlockIds.size).toBe(0);
      expect(store.commandPaletteOpen).toBe(false);
      expect(store.currentPageId).toBe(null);
      expect(store.pageHistory).toEqual([]);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles empty history index correctly', () => {
      const store = useAppStore.getState();

      store.goBack();

      useAppStore.getState().goForward();
    });

    it('maintains immutability for selectedBlockIds', () => {
      const store = useAppStore.getState();
      store.selectBlock('block-1');

      // Get the Set reference
      const firstSet = useAppStore.getState().selectedBlockIds;

      // Select another block
      useAppStore.getState().selectBlock('block-2');

      // Original Set reference should not be affected
      expect(firstSet.size).toBe(1);
      expect(firstSet.has('block-2')).toBe(false);

      // New Set should have both blocks
      const newSet = useAppStore.getState().selectedBlockIds;
      expect(newSet.size).toBe(2);
      expect(newSet.has('block-1')).toBe(true);
      expect(newSet.has('block-2')).toBe(true);
    });

    it('handles rapid navigation correctly', () => {
      // Simulate rapid navigation
      for (let i = 1; i <= 10; i++) {
        useAppStore.getState().navigateToPage(`page-${i}`);
      }

      const state = useAppStore.getState();
      expect(state.pageHistory.length).toBe(10);
      expect(state.currentPageId).toBe('page-10');
    });
  });
});
