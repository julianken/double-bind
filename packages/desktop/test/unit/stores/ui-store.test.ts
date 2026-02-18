import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../../src/stores/ui-store.js';

describe('useAppStore', () => {
  beforeEach(() => {
    // Clear localStorage to prevent persistence from affecting tests
    localStorage.clear();

    // Reset store to initial state before each test
    useAppStore.setState({
      sidebarMode: 'open',
      sidebarOpen: true, // derived boolean; keep in sync with sidebarMode
      sidebarWidth: 240,
      rightPanelOpen: false,
      rightPanelContent: null,
      rightPanelWidth: 300,
      focusedBlockId: null,
      focusClickCoords: null,
      selectedBlockIds: new Set(),
      commandPaletteOpen: false,
      currentPageId: null,
      currentPageTitle: null,
      currentRouteType: null,
      blockCount: null,
      pageHistory: [],
      historyIndex: -1,
      scrollPositions: new Map(),
      themePreference: 'system',
      windowFocused: true,
      isFullscreen: false,
      saveState: 'idle',
      quickCaptureFocused: false,
      focusModeActive: false,
      zoomedBlockId: null,
      typewriterEnabled: false,
      blockDimmingEnabled: false,
      sidebarQuiet: false,
    });
  });

  // ============================================================================
  // Sidebar
  // ============================================================================

  describe('Sidebar', () => {
    it('cycles sidebar mode: open → rail → closed → open', () => {
      const store = useAppStore.getState();
      expect(store.sidebarMode).toBe('open');
      expect(store.sidebarOpen).toBe(true);

      store.cycleSidebarMode();
      expect(useAppStore.getState().sidebarMode).toBe('rail');
      expect(useAppStore.getState().sidebarOpen).toBe(false);

      useAppStore.getState().cycleSidebarMode();
      expect(useAppStore.getState().sidebarMode).toBe('closed');
      expect(useAppStore.getState().sidebarOpen).toBe(false);

      useAppStore.getState().cycleSidebarMode();
      expect(useAppStore.getState().sidebarMode).toBe('open');
      expect(useAppStore.getState().sidebarOpen).toBe(true);
    });

    it('setSidebarMode updates sidebarMode and derived sidebarOpen', () => {
      const store = useAppStore.getState();

      store.setSidebarMode('rail');
      expect(useAppStore.getState().sidebarMode).toBe('rail');
      expect(useAppStore.getState().sidebarOpen).toBe(false);

      useAppStore.getState().setSidebarMode('closed');
      expect(useAppStore.getState().sidebarMode).toBe('closed');
      expect(useAppStore.getState().sidebarOpen).toBe(false);

      useAppStore.getState().setSidebarMode('open');
      expect(useAppStore.getState().sidebarMode).toBe('open');
      expect(useAppStore.getState().sidebarOpen).toBe(true);
    });

    it('toggleSidebar (deprecated shim) cycles sidebar mode', () => {
      const store = useAppStore.getState();
      // Start: open → sidebarOpen: true
      expect(store.sidebarOpen).toBe(true);
      expect(store.sidebarMode).toBe('open');

      // First toggle: open → rail
      store.toggleSidebar();
      expect(useAppStore.getState().sidebarMode).toBe('rail');
      expect(useAppStore.getState().sidebarOpen).toBe(false);

      // Second toggle: rail → closed
      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().sidebarMode).toBe('closed');
      expect(useAppStore.getState().sidebarOpen).toBe(false);

      // Third toggle: closed → open
      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().sidebarMode).toBe('open');
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

    it('sets right panel width', () => {
      const store = useAppStore.getState();
      expect(store.rightPanelWidth).toBe(300);

      store.setRightPanelWidth(400);
      expect(useAppStore.getState().rightPanelWidth).toBe(400);
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

    it('sets current page meta', () => {
      const store = useAppStore.getState();
      expect(store.currentPageTitle).toBe(null);
      expect(store.blockCount).toBe(null);
      expect(store.currentRouteType).toBe(null);

      store.setCurrentPageMeta({ title: 'My Page', blockCount: 5, routeType: 'page' });
      const state = useAppStore.getState();
      expect(state.currentPageTitle).toBe('My Page');
      expect(state.blockCount).toBe(5);
      expect(state.currentRouteType).toBe('page');
    });

    it('sets and retrieves scroll positions', () => {
      const store = useAppStore.getState();
      store.navigateToPage('page-1');
      store.setScrollPosition('page-1', 250);

      expect(useAppStore.getState().scrollPositions.get('page-1')).toBe(250);
    });
  });

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('Initial State', () => {
    it('has correct default values', () => {
      const store = useAppStore.getState();

      expect(store.sidebarMode).toBe('open');
      expect(store.sidebarOpen).toBe(true);
      expect(store.sidebarWidth).toBe(240);
      expect(store.rightPanelOpen).toBe(false);
      expect(store.rightPanelContent).toBe(null);
      expect(store.rightPanelWidth).toBe(300);
      expect(store.focusedBlockId).toBe(null);
      expect(store.selectedBlockIds.size).toBe(0);
      expect(store.commandPaletteOpen).toBe(false);
      expect(store.currentPageId).toBe(null);
      expect(store.pageHistory).toEqual([]);
      expect(store.typewriterEnabled).toBe(false);
      expect(store.blockDimmingEnabled).toBe(false);
    });
  });

  // ============================================================================
  // Persistence
  // ============================================================================

  describe('Persistence', () => {
    it('persists sidebarMode to localStorage', () => {
      const store = useAppStore.getState();
      store.setSidebarMode('rail');
      expect(useAppStore.getState().sidebarMode).toBe('rail');

      // Check localStorage was updated
      const stored = JSON.parse(localStorage.getItem('double-bind-ui') || '{}');
      expect(stored.state?.sidebarMode).toBe('rail');
    });

    it('persists sidebarOpen (compat) to localStorage', () => {
      const store = useAppStore.getState();
      store.setSidebarMode('rail');
      expect(useAppStore.getState().sidebarOpen).toBe(false);

      // Check localStorage was updated
      const stored = JSON.parse(localStorage.getItem('double-bind-ui') || '{}');
      expect(stored.state?.sidebarOpen).toBe(false);
    });

    it('persists sidebarWidth to localStorage', () => {
      const store = useAppStore.getState();
      store.setSidebarWidth(350);

      // Check localStorage was updated
      const stored = JSON.parse(localStorage.getItem('double-bind-ui') || '{}');
      expect(stored.state?.sidebarWidth).toBe(350);
    });

    it('persists rightPanelWidth to localStorage', () => {
      const store = useAppStore.getState();
      store.setRightPanelWidth(400);

      const stored = JSON.parse(localStorage.getItem('double-bind-ui') || '{}');
      expect(stored.state?.rightPanelWidth).toBe(400);
    });

    it('does not persist non-UI state to localStorage', () => {
      const store = useAppStore.getState();
      store.navigateToPage('page-1');
      store.setFocusedBlock('block-1');
      store.openRightPanel('backlinks');

      // Check localStorage only contains partialize'd fields
      const stored = JSON.parse(localStorage.getItem('double-bind-ui') || '{}');
      expect(stored.state).toHaveProperty('sidebarMode');
      expect(stored.state).toHaveProperty('sidebarOpen');
      expect(stored.state).toHaveProperty('sidebarWidth');
      expect(stored.state).not.toHaveProperty('currentPageId');
      expect(stored.state).not.toHaveProperty('focusedBlockId');
      expect(stored.state).not.toHaveProperty('rightPanelOpen');
    });
  });

  // ============================================================================
  // Window State
  // ============================================================================

  describe('Window State', () => {
    it('sets window focused state', () => {
      const store = useAppStore.getState();
      store.setWindowFocused(false);
      expect(useAppStore.getState().windowFocused).toBe(false);

      useAppStore.getState().setWindowFocused(true);
      expect(useAppStore.getState().windowFocused).toBe(true);
    });

    it('sets save state', () => {
      const store = useAppStore.getState();
      expect(store.saveState).toBe('idle');

      store.setSaveState('saving');
      expect(useAppStore.getState().saveState).toBe('saving');

      useAppStore.getState().setSaveState('saved');
      expect(useAppStore.getState().saveState).toBe('saved');
    });
  });

  // ============================================================================
  // Editor / Focus Mode
  // ============================================================================

  describe('Editor / Focus Mode', () => {
    it('toggles focus mode', () => {
      const store = useAppStore.getState();
      expect(store.focusModeActive).toBe(false);

      store.toggleFocusMode();
      expect(useAppStore.getState().focusModeActive).toBe(true);

      useAppStore.getState().toggleFocusMode();
      expect(useAppStore.getState().focusModeActive).toBe(false);
    });

    it('sets zoomed block', () => {
      const store = useAppStore.getState();
      expect(store.zoomedBlockId).toBe(null);

      store.setZoomedBlock('block-1');
      expect(useAppStore.getState().zoomedBlockId).toBe('block-1');

      useAppStore.getState().setZoomedBlock(null);
      expect(useAppStore.getState().zoomedBlockId).toBe(null);
    });

    it('toggles typewriter mode', () => {
      const store = useAppStore.getState();
      expect(store.typewriterEnabled).toBe(false);

      store.toggleTypewriter();
      expect(useAppStore.getState().typewriterEnabled).toBe(true);
    });

    it('toggles block dimming', () => {
      const store = useAppStore.getState();
      expect(store.blockDimmingEnabled).toBe(false);

      store.toggleBlockDimming();
      expect(useAppStore.getState().blockDimmingEnabled).toBe(true);
    });

    it('sets sidebar quiet', () => {
      const store = useAppStore.getState();
      expect(store.sidebarQuiet).toBe(false);

      store.setSidebarQuiet(true);
      expect(useAppStore.getState().sidebarQuiet).toBe(true);
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
