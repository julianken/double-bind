/**
 * DynamicShortcuts.ts - Dynamic shortcut management for Android
 *
 * Manages dynamic shortcuts for recently accessed pages.
 * Android limits dynamic shortcuts to 4-5 depending on launcher.
 * Uses LRU eviction strategy when limit is reached.
 */

import type { PageId } from '@double-bind/types';
import { ShortcutAction, type Shortcut } from './ShortcutTypes';

/**
 * Maximum dynamic shortcuts supported by Android
 * Conservative limit that works across all launchers
 */
export const MAX_DYNAMIC_SHORTCUTS = 4;

/**
 * Recent page for dynamic shortcuts
 */
export interface RecentPage {
  pageId: PageId;
  title: string;
  accessedAt: number;
}

/**
 * Dynamic shortcut manager
 * Handles creation and LRU eviction of dynamic shortcuts
 */
export class DynamicShortcutManager {
  private shortcuts: Map<PageId, Shortcut> = new Map();
  private accessOrder: PageId[] = [];
  private maxShortcuts: number;

  constructor(maxShortcuts: number = MAX_DYNAMIC_SHORTCUTS) {
    this.maxShortcuts = Math.max(1, Math.min(maxShortcuts, 5));
  }

  /**
   * Add or update a dynamic shortcut for a recently accessed page
   * Implements LRU eviction if limit is reached
   */
  addShortcut(page: RecentPage): Shortcut {
    // Remove if already exists (will re-add at front)
    if (this.shortcuts.has(page.pageId)) {
      this.removeShortcut(page.pageId);
    }

    // Create shortcut
    const shortcut: Shortcut = {
      id: `dynamic_page_${page.pageId}`,
      shortLabel: this.truncateLabel(page.title, 10),
      longLabel: this.truncateLabel(page.title, 25),
      icon: 'ic_shortcut_page',
      action: ShortcutAction.OpenPage,
      payload: {
        pageId: page.pageId,
        pageName: page.title,
      },
      rank: 0, // Will be updated based on position
      enabled: true,
    };

    // Add to front of access order
    this.accessOrder.unshift(page.pageId);
    this.shortcuts.set(page.pageId, shortcut);

    // Evict oldest if over limit
    if (this.accessOrder.length > this.maxShortcuts) {
      const oldestPageId = this.accessOrder.pop()!;
      this.shortcuts.delete(oldestPageId);
    }

    // Update ranks based on access order
    this.updateRanks();

    return shortcut;
  }

  /**
   * Remove a dynamic shortcut
   */
  removeShortcut(pageId: PageId): boolean {
    const existed = this.shortcuts.has(pageId);
    this.shortcuts.delete(pageId);
    this.accessOrder = this.accessOrder.filter((id) => id !== pageId);
    this.updateRanks();
    return existed;
  }

  /**
   * Get all dynamic shortcuts in rank order
   */
  getShortcuts(): Shortcut[] {
    return this.accessOrder.map((pageId) => this.shortcuts.get(pageId)!).filter(Boolean);
  }

  /**
   * Get a specific dynamic shortcut by page ID
   */
  getShortcut(pageId: PageId): Shortcut | undefined {
    return this.shortcuts.get(pageId);
  }

  /**
   * Clear all dynamic shortcuts
   */
  clear(): void {
    this.shortcuts.clear();
    this.accessOrder = [];
  }

  /**
   * Get current shortcut count
   */
  get count(): number {
    return this.shortcuts.size;
  }

  /**
   * Check if at capacity
   */
  get isFull(): boolean {
    return this.shortcuts.size >= this.maxShortcuts;
  }

  /**
   * Record page access (updates order without creating shortcut)
   */
  recordPageAccess(pageId: PageId): void {
    // Move to front if exists
    if (this.shortcuts.has(pageId)) {
      this.accessOrder = this.accessOrder.filter((id) => id !== pageId);
      this.accessOrder.unshift(pageId);
      this.updateRanks();
    }
  }

  /**
   * Update shortcut ranks based on access order
   * Rank 0 = most recently accessed
   */
  private updateRanks(): void {
    this.accessOrder.forEach((pageId, index) => {
      const shortcut = this.shortcuts.get(pageId);
      if (shortcut) {
        shortcut.rank = index;
      }
    });
  }

  /**
   * Truncate label to max length, adding ellipsis if needed
   */
  private truncateLabel(label: string, maxLength: number): string {
    if (label.length <= maxLength) {
      return label;
    }
    return label.slice(0, maxLength - 1) + '…';
  }

  /**
   * Get shortcut IDs in rank order
   */
  getShortcutIds(): string[] {
    return this.getShortcuts().map((s) => s.id);
  }

  /**
   * Check if a page has a dynamic shortcut
   */
  hasShortcut(pageId: PageId): boolean {
    return this.shortcuts.has(pageId);
  }
}

/**
 * Create a dynamic shortcut from a recent page
 */
export function createDynamicShortcut(page: RecentPage): Shortcut {
  return {
    id: `dynamic_page_${page.pageId}`,
    shortLabel: page.title.slice(0, 10),
    longLabel: page.title.slice(0, 25),
    icon: 'ic_shortcut_page',
    action: ShortcutAction.OpenPage,
    payload: {
      pageId: page.pageId,
      pageName: page.title,
    },
    rank: 0,
    enabled: true,
  };
}
