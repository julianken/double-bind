/**
 * UI Store - Application state for UI and navigation
 *
 * Manages:
 * - Sidebar state (mode: open/rail/closed, width)
 * - Right panel state (open/closed, content type, width)
 * - Block focus and selection
 * - Command palette
 * - Navigation history (max 50 entries)
 * - Window state (focus, fullscreen, save state)
 * - Editor / focus mode
 *
 * See docs/frontend/state-management.md for architecture details.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export type SidebarMode = 'open' | 'rail' | 'closed';
export type RouteType = 'page' | 'graph' | 'search' | 'query' | 'daily-notes';
export type SaveState = 'idle' | 'saving' | 'saved';
export type RightPanelContent = 'backlinks' | 'properties' | 'graph' | null;
export type ThemePreference = 'light' | 'dark' | 'dim' | 'sepia' | 'hc-light' | 'hc-dark' | 'system';
export type ResolvedTheme = 'light' | 'dark' | 'dim' | 'sepia' | 'hc-light' | 'hc-dark';

export interface AppStore {
  // === Sidebar ===
  /** @deprecated Derived from sidebarMode; kept 1 release for compat */
  sidebarOpen: boolean;
  sidebarMode: SidebarMode;      // persisted; default: 'open'
  sidebarWidth: number;          // persisted; default: 240
  setSidebarMode: (mode: SidebarMode) => void;
  cycleSidebarMode: () => void;  // open → rail → closed → open
  setSidebarWidth: (width: number) => void;
  /** @deprecated Shim that calls cycleSidebarMode() */
  toggleSidebar: () => void;

  // === Right Panel ===
  rightPanelOpen: boolean;
  rightPanelContent: RightPanelContent;
  rightPanelWidth: number;       // persisted; default: 300
  openRightPanel: (content: RightPanelContent) => void;
  closeRightPanel: () => void;
  setRightPanelWidth: (width: number) => void;

  // === Block Focus ===
  focusedBlockId: string | null;
  focusClickCoords: { left: number; top: number } | null;
  setFocusedBlock: (blockId: string | null, clickCoords?: { left: number; top: number }) => void;

  // === Block Selection ===
  selectedBlockIds: Set<string>;
  selectBlock: (blockId: string) => void;
  deselectBlock: (blockId: string) => void;
  clearSelection: () => void;

  // === Command Palette ===
  commandPaletteOpen: boolean;
  toggleCommandPalette: () => void;

  // === Navigation ===
  currentPageId: string | null;
  /** Not persisted; set by page loader */
  currentPageTitle: string | null;
  /** Not persisted */
  currentRouteType: RouteType | null;
  /** Not persisted; set by page loader */
  blockCount: number | null;
  pageHistory: string[];
  /** Internal: tracks position in history for back/forward */
  historyIndex: number;
  /** Not persisted; evicted at MAX_HISTORY_SIZE */
  scrollPositions: Map<string, number>;
  navigateToPage: (pageId: string) => void;
  goBack: () => void;
  goForward: () => void;
  setCurrentPageMeta: (meta: {
    title: string | null;
    blockCount: number | null;
    routeType: RouteType | null;
  }) => void;
  setScrollPosition: (pageId: string, scrollY: number) => void;

  // === Theme (DEPRECATED — use SettingsStore) ===
  /** Shim; removed from persist after migration */
  themePreference: ThemePreference;
  /** Writes locally for Phase 1 compat; Phase 6 will connect to SettingsStore */
  setThemePreference: (preference: ThemePreference) => void;

  // === Window ===
  /** Not persisted */
  windowFocused: boolean;
  /** Not persisted */
  isFullscreen: boolean;
  /** Not persisted */
  saveState: SaveState;
  setWindowFocused: (focused: boolean) => void;
  setSaveState: (state: SaveState) => void;
  toggleFullscreen: () => Promise<void>;

  // === Sidebar UI State ===
  /** Not persisted */
  quickCaptureFocused: boolean;
  setQuickCaptureFocused: (focused: boolean) => void;

  // === Editor / Focus Mode ===
  /** Not persisted; initialized from SettingsStore.focusModeDefault */
  focusModeActive: boolean;
  /** Not persisted */
  zoomedBlockId: string | null;
  /** Persisted */
  typewriterEnabled: boolean;
  /** Persisted; default: false */
  blockDimmingEnabled: boolean;
  /** Not persisted; true during active typing */
  sidebarQuiet: boolean;
  toggleFocusMode: () => void;
  setZoomedBlock: (blockId: string | null) => void;
  toggleTypewriter: () => void;
  toggleBlockDimming: () => void;
  setSidebarQuiet: (quiet: boolean) => void;
}

// Persistence partition
type AppStorePersisted = Pick<
  AppStore,
  | 'sidebarMode'
  | 'sidebarWidth'
  | 'rightPanelWidth'
  | 'typewriterEnabled'
  | 'blockDimmingEnabled'
  | 'sidebarOpen'   // kept 1 release for backward compat, then remove
>;

// ============================================================================
// Store
// ============================================================================

const MAX_HISTORY_SIZE = 50;

// Zustand store creation
const store = create<AppStore>()(
  persist(
    (set, get) => ({
      // === Sidebar ===
      sidebarMode: 'open',
      sidebarOpen: true, // derived; kept for compat
      sidebarWidth: 240,

      setSidebarMode: (mode) =>
        set({
          sidebarMode: mode,
          sidebarOpen: mode === 'open', // keep derived boolean in sync
        }),

      cycleSidebarMode: () =>
        set((state) => {
          const next: Record<SidebarMode, SidebarMode> = {
            open: 'rail',
            rail: 'closed',
            closed: 'open',
          };
          const mode = next[state.sidebarMode];
          return { sidebarMode: mode, sidebarOpen: mode === 'open' };
        }),

      setSidebarWidth: (width: number) => set({ sidebarWidth: width }),

      // DEPRECATED shim → calls cycleSidebarMode()
      toggleSidebar: () => {
        get().cycleSidebarMode();
      },

      // === Right Panel ===
      rightPanelOpen: false,
      rightPanelContent: null,
      rightPanelWidth: 300,
      openRightPanel: (content: RightPanelContent) =>
        set({ rightPanelContent: content, rightPanelOpen: true }),
      closeRightPanel: () => set({ rightPanelOpen: false, rightPanelContent: null }),
      setRightPanelWidth: (width: number) => set({ rightPanelWidth: width }),

      // === Block Focus ===
      focusedBlockId: null,
      focusClickCoords: null,
      setFocusedBlock: (blockId: string | null, clickCoords?: { left: number; top: number }) =>
        set({ focusedBlockId: blockId, focusClickCoords: clickCoords ?? null }),

      // === Block Selection ===
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
      currentPageTitle: null,
      currentRouteType: null,
      blockCount: null,
      pageHistory: [],
      historyIndex: -1,
      scrollPositions: new Map(),

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

          // Evict scroll positions for pages no longer in history
          const newScrollPositions = new Map(state.scrollPositions);
          for (const key of newScrollPositions.keys()) {
            if (!trimmedHistory.includes(key)) {
              newScrollPositions.delete(key);
            }
          }

          return {
            currentPageId: pageId,
            pageHistory: trimmedHistory,
            historyIndex: trimmedHistory.length - 1,
            scrollPositions: newScrollPositions,
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

      setCurrentPageMeta: (meta) =>
        set({
          currentPageTitle: meta.title,
          blockCount: meta.blockCount,
          currentRouteType: meta.routeType,
        }),

      setScrollPosition: (pageId, scrollY) =>
        set((state) => {
          const newScrollPositions = new Map(state.scrollPositions);
          newScrollPositions.set(pageId, scrollY);
          return { scrollPositions: newScrollPositions };
        }),

      // === Theme (DEPRECATED — use SettingsStore) ===
      themePreference: 'system',
      setThemePreference: (preference: ThemePreference) => {
        // Write through to SettingsStore (Phase 6 connects this)
        // After settings-store.ts is integrated:
        // useSettingsStore.getState().setThemePreference(preference);
        // For Phase 1, also set locally to avoid breaking useTheme:
        set({ themePreference: preference });
      },

      // === Window ===
      windowFocused: true,
      isFullscreen: false,
      saveState: 'idle',
      setWindowFocused: (focused: boolean) => set({ windowFocused: focused }),
      setSaveState: (state: SaveState) => set({ saveState: state }),
      toggleFullscreen: async () => {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const appWindow = getCurrentWindow();
          await appWindow.toggleMaximize();
          const maximized = await appWindow.isMaximized();
          set({ isFullscreen: maximized });
        } catch {
          // Stub: not in Tauri context (e.g., browser dev mode)
          set((state) => ({ isFullscreen: !state.isFullscreen }));
        }
      },

      // === Sidebar UI State ===
      quickCaptureFocused: false,
      setQuickCaptureFocused: (focused: boolean) => set({ quickCaptureFocused: focused }),

      // === Editor / Focus Mode ===
      focusModeActive: false,
      zoomedBlockId: null,
      typewriterEnabled: false,
      blockDimmingEnabled: false,
      sidebarQuiet: false,
      toggleFocusMode: () => set((state) => ({ focusModeActive: !state.focusModeActive })),
      setZoomedBlock: (blockId: string | null) => set({ zoomedBlockId: blockId }),
      toggleTypewriter: () => set((state) => ({ typewriterEnabled: !state.typewriterEnabled })),
      toggleBlockDimming: () =>
        set((state) => ({ blockDimmingEnabled: !state.blockDimmingEnabled })),
      setSidebarQuiet: (quiet: boolean) => set({ sidebarQuiet: quiet }),
    }),
    {
      name: 'double-bind-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state): AppStorePersisted => ({
        sidebarMode: state.sidebarMode,
        sidebarOpen: state.sidebarOpen, // kept 1 release for backward compat
        sidebarWidth: state.sidebarWidth,
        rightPanelWidth: state.rightPanelWidth,
        typewriterEnabled: state.typewriterEnabled,
        blockDimmingEnabled: state.blockDimmingEnabled,
      }),
    }
  )
);

// Export the store for use in components
export const useAppStore = store;

// Expose store for E2E testing (only in development/test)
if (typeof window !== 'undefined' && (import.meta.env.DEV || import.meta.env.MODE === 'test')) {
  (window as unknown as { __APP_STORE__?: typeof store }).__APP_STORE__ = store;
}
