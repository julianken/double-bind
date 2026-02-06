/**
 * UI Store - Application state for UI and navigation
 *
 * Manages:
 * - Sidebar state (open/closed, width)
 * - Right panel state (open/closed, content type)
 * - Block focus and selection
 * - Command palette
 * - Navigation history (max 50 entries)
 *
 * See docs/frontend/state-management.md for architecture details.
 */

import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

export type RightPanelContent = 'backlinks' | 'properties' | 'graph' | null;

export interface AppStore {
  // === Sidebar ===
  sidebarOpen: boolean;
  sidebarWidth: number;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;

  // === Right Panel ===
  rightPanelOpen: boolean;
  rightPanelContent: RightPanelContent;
  toggleRightPanel: () => void;
  setRightPanelContent: (content: RightPanelContent) => void;

  // === Focus ===
  focusedBlockId: string | null;
  setFocusedBlock: (blockId: string | null) => void;

  // === Selection ===
  selectedBlockIds: Set<string>;
  setSelectedBlocks: (blockIds: Set<string>) => void;
  toggleBlockSelection: (blockId: string) => void;

  // === Command Palette ===
  commandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;

  // === Navigation ===
  currentPageId: string | null;
  navigationHistory: string[];
  historyIndex: number;
  navigateToPage: (pageId: string) => void;
  goBack: () => void;
  goForward: () => void;
}

// ============================================================================
// Store
// ============================================================================

const MAX_HISTORY_SIZE = 50;

export const useAppStore = create<AppStore>((set) => ({
  // === Sidebar ===
  sidebarOpen: true,
  sidebarWidth: 240,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarWidth: (width: number) => set({ sidebarWidth: width }),

  // === Right Panel ===
  rightPanelOpen: false,
  rightPanelContent: null,
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setRightPanelContent: (content: RightPanelContent) =>
    set({ rightPanelContent: content, rightPanelOpen: content !== null }),

  // === Focus ===
  focusedBlockId: null,
  setFocusedBlock: (blockId: string | null) => set({ focusedBlockId: blockId }),

  // === Selection ===
  selectedBlockIds: new Set(),
  setSelectedBlocks: (blockIds: Set<string>) => set({ selectedBlockIds: new Set(blockIds) }),
  toggleBlockSelection: (blockId: string) =>
    set((state) => {
      const newSelection = new Set(state.selectedBlockIds);
      if (newSelection.has(blockId)) {
        newSelection.delete(blockId);
      } else {
        newSelection.add(blockId);
      }
      return { selectedBlockIds: newSelection };
    }),

  // === Command Palette ===
  commandPaletteOpen: false,
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),

  // === Navigation ===
  currentPageId: null,
  navigationHistory: [],
  historyIndex: -1,

  navigateToPage: (pageId: string) =>
    set((state) => {
      // Don't add if navigating to the same page
      if (state.currentPageId === pageId) {
        return state;
      }

      // When navigating to a new page, truncate forward history
      const newHistory = state.navigationHistory.slice(0, state.historyIndex + 1);
      newHistory.push(pageId);

      // Enforce max history size by removing oldest entries
      const trimmedHistory =
        newHistory.length > MAX_HISTORY_SIZE
          ? newHistory.slice(newHistory.length - MAX_HISTORY_SIZE)
          : newHistory;

      return {
        currentPageId: pageId,
        navigationHistory: trimmedHistory,
        historyIndex: trimmedHistory.length - 1,
      };
    }),

  goBack: () =>
    set((state) => {
      if (state.historyIndex <= 0) {
        return state;
      }

      const newIndex = state.historyIndex - 1;
      return {
        currentPageId: state.navigationHistory[newIndex],
        historyIndex: newIndex,
      };
    }),

  goForward: () =>
    set((state) => {
      if (state.historyIndex >= state.navigationHistory.length - 1) {
        return state;
      }

      const newIndex = state.historyIndex + 1;
      return {
        currentPageId: state.navigationHistory[newIndex],
        historyIndex: newIndex,
      };
    }),
}));
