/**
 * Centralized test cleanup utilities
 */
import { cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { cleanupTestQueries } from './queryClient.js';
import { useAppStore } from '../../src/stores/ui-store.js';

/**
 * Complete test cleanup. Call in afterEach for comprehensive cleanup.
 */
export function cleanupTest(queryClient?: QueryClient): void {
  // React Testing Library cleanup
  cleanup();

  // Query cache cleanup
  cleanupTestQueries(queryClient);

  // Mock cleanup
  vi.clearAllMocks();
  vi.resetAllMocks();
}

/**
 * Reset Zustand store to initial state. Call in beforeEach.
 */
export function resetAppStore(): void {
  useAppStore.setState({
    // Sidebar
    sidebarMode: 'open',
    sidebarOpen: true, // derived boolean; keep in sync with sidebarMode
    sidebarWidth: 240,
    // Right Panel
    rightPanelOpen: false,
    rightPanelContent: null,
    // Focus
    focusedBlockId: null,
    // Selection
    selectedBlockIds: new Set<string>(),
    // Command Palette
    commandPaletteOpen: false,
    // Navigation
    currentPageId: null,
    pageHistory: [],
    historyIndex: -1,
    // Theme
    themePreference: 'system',
  });
}
