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
import { persist, createJSONStorage } from 'zustand/middleware';

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
  openRightPanel: (content: RightPanelContent) => void;
  closeRightPanel: () => void;

  // === Focus ===
  focusedBlockId: string | null;
  setFocusedBlock: (blockId: string | null) => void;

  // === Selection ===
  selectedBlockIds: Set<string>;
  selectBlock: (blockId: string) => void;
  deselectBlock: (blockId: string) => void;
  clearSelection: () => void;

  // === Command Palette ===
  commandPaletteOpen: boolean;
  toggleCommandPalette: () => void;

  // === Navigation ===
  currentPageId: string | null;
  pageHistory: string[];
  historyIndex: number; // Internal: tracks position in history for back/forward
  navigateToPage: (pageId: string) => void;
  goBack: () => void;
  goForward: () => void;
}

// ============================================================================
// Store
// ============================================================================

const MAX_HISTORY_SIZE = 50;

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // === Sidebar ===
      sidebarOpen: true,
      sidebarWidth: 240,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarWidth: (width: number) => set({ sidebarWidth: width }),

      // === Right Panel ===
      rightPanelOpen: false,
      rightPanelContent: null,
      openRightPanel: (content: RightPanelContent) =>
        set({ rightPanelContent: content, rightPanelOpen: true }),
      closeRightPanel: () => set({ rightPanelOpen: false, rightPanelContent: null }),

      // === Focus ===
      focusedBlockId: null,
      setFocusedBlock: (blockId: string | null) => set({ focusedBlockId: blockId }),

      // === Selection ===
      selectedBlockIds: new Set(),
      selectBlock: (blockId: string) =>
        set((state) => {
          const newSelection = new Set(state.selectedBlockIds);
          newSelection.add(blockId);
          return { selectedBlockIds: newSelection };
        }),
      deselectBlock: (blockId: string) =>
        set((state) => {
          const newSelection = new Set(state.selectedBlockIds);
          newSelection.delete(blockId);
          return { selectedBlockIds: newSelection };
        }),
      clearSelection: () => set({ selectedBlockIds: new Set() }),

      // === Command Palette ===
      commandPaletteOpen: false,
      toggleCommandPalette: () =>
        set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

      // === Navigation ===
      currentPageId: null,
      pageHistory: [],
      historyIndex: -1, // Internal state for tracking position in history

      navigateToPage: (pageId: string) =>
        set((state) => {
          // Don't add if navigating to the same page
          if (state.currentPageId === pageId) {
            return state;
          }

          // When navigating to a new page, truncate forward history
          const newHistory = state.pageHistory.slice(0, state.historyIndex + 1);
          newHistory.push(pageId);

          // Enforce max history size by removing oldest entries
          const trimmedHistory =
            newHistory.length > MAX_HISTORY_SIZE
              ? newHistory.slice(newHistory.length - MAX_HISTORY_SIZE)
              : newHistory;

          return {
            currentPageId: pageId,
            pageHistory: trimmedHistory,
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
            currentPageId: state.pageHistory[newIndex],
            historyIndex: newIndex,
          };
        }),

      goForward: () =>
        set((state) => {
          if (state.historyIndex >= state.pageHistory.length - 1) {
            return state;
          }

          const newIndex = state.historyIndex + 1;
          return {
            currentPageId: state.pageHistory[newIndex],
            historyIndex: newIndex,
          };
        }),
    }),
    {
      name: 'double-bind-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
      }),
    }
  )
);
