/**
 * DirectShare - Direct share targets for Android
 *
 * Provides utilities for registering and managing Android Direct Share targets,
 * allowing users to share directly to specific notes or pages.
 */

import type { DirectShareTarget, DirectShareServiceConfig } from './types';

/**
 * Android Direct Share service bridge
 */
export interface DirectShareBridge {
  /** Update direct share targets */
  updateTargets: (targets: DirectShareTarget[]) => Promise<void>;
  /** Clear all direct share targets */
  clearTargets: () => Promise<void>;
  /** Get current targets */
  getTargets: () => Promise<DirectShareTarget[]>;
}

/**
 * Default direct share bridge implementation
 */
let directShareBridge: DirectShareBridge | null = null;

/**
 * Set the direct share bridge implementation
 */
export function setDirectShareBridge(bridge: DirectShareBridge): void {
  directShareBridge = bridge;
}

/**
 * Direct Share Service
 *
 * Manages direct share targets for Android, providing quick access
 * to frequently used notes and pages from the system share sheet.
 *
 * @example
 * ```typescript
 * const service = new DirectShareService({
 *   maxTargets: 5,
 *   includeRecentNotes: true
 * });
 *
 * // Update targets with recent notes
 * await service.updateRecentNotes([
 *   { id: '1', title: 'My Note', type: 'note' },
 *   { id: '2', title: 'Project Ideas', type: 'page' }
 * ]);
 * ```
 */
export class DirectShareService {
  private config: DirectShareServiceConfig;
  private currentTargets: DirectShareTarget[] = [];

  constructor(config: DirectShareServiceConfig = {}) {
    this.config = {
      maxTargets: config.maxTargets ?? 5,
      includeRecentNotes: config.includeRecentNotes ?? true,
      includeFavoritePages: config.includeFavoritePages ?? true,
    };
  }

  /**
   * Update direct share targets with recent notes
   *
   * @param notes - Array of recent notes to add as share targets
   */
  async updateRecentNotes(
    notes: Array<{ id: string; title: string; type: 'note' | 'page' }>
  ): Promise<void> {
    if (!this.config.includeRecentNotes) {
      return;
    }

    const targets: DirectShareTarget[] = notes
      .slice(0, this.config.maxTargets)
      .map((note, index) => ({
        id: note.id,
        title: note.title,
        subtitle: note.type === 'note' ? 'Note' : 'Page',
        type: note.type,
        rank: index,
        icon: note.type === 'note' ? 'note_icon' : 'page_icon',
      }));

    await this.updateTargets(targets);
  }

  /**
   * Update direct share targets with favorite pages
   *
   * @param pages - Array of favorite pages to add as share targets
   */
  async updateFavoritePages(pages: Array<{ id: string; title: string }>): Promise<void> {
    if (!this.config.includeFavoritePages) {
      return;
    }

    const targets: DirectShareTarget[] = pages
      .slice(0, this.config.maxTargets)
      .map((page, index) => ({
        id: page.id,
        title: page.title,
        subtitle: 'Favorite',
        type: 'page',
        rank: index,
        icon: 'favorite_icon',
      }));

    await this.updateTargets(targets);
  }

  /**
   * Update direct share targets
   *
   * @param targets - Array of direct share targets
   */
  async updateTargets(targets: DirectShareTarget[]): Promise<void> {
    if (!directShareBridge) {
      throw new Error('Direct share bridge not available. Call setDirectShareBridge() first.');
    }

    // Limit to max targets
    const limitedTargets = targets.slice(0, this.config.maxTargets);

    this.currentTargets = limitedTargets;
    await directShareBridge.updateTargets(limitedTargets);
  }

  /**
   * Clear all direct share targets
   */
  async clearTargets(): Promise<void> {
    if (!directShareBridge) {
      throw new Error('Direct share bridge not available. Call setDirectShareBridge() first.');
    }

    this.currentTargets = [];
    await directShareBridge.clearTargets();
  }

  /**
   * Get current direct share targets
   */
  async getTargets(): Promise<DirectShareTarget[]> {
    if (!directShareBridge) {
      throw new Error('Direct share bridge not available. Call setDirectShareBridge() first.');
    }

    return directShareBridge.getTargets();
  }

  /**
   * Add a single target
   *
   * @param target - Direct share target to add
   */
  async addTarget(target: DirectShareTarget): Promise<void> {
    const currentTargets = await this.getTargets();

    // Check if target already exists
    const existingIndex = currentTargets.findIndex((t) => t.id === target.id);
    if (existingIndex >= 0) {
      // Update existing target
      currentTargets[existingIndex] = target;
    } else {
      // Add new target
      currentTargets.push(target);
    }

    await this.updateTargets(currentTargets);
  }

  /**
   * Remove a target by ID
   *
   * @param targetId - ID of the target to remove
   */
  async removeTarget(targetId: string): Promise<void> {
    const currentTargets = await this.getTargets();
    const filtered = currentTargets.filter((t) => t.id !== targetId);
    await this.updateTargets(filtered);
  }

  /**
   * Sort targets by rank
   */
  private sortByRank(targets: DirectShareTarget[]): DirectShareTarget[] {
    return [...targets].sort((a, b) => {
      const rankA = a.rank ?? Infinity;
      const rankB = b.rank ?? Infinity;
      return rankA - rankB;
    });
  }
}

/**
 * Create direct share targets from notes
 *
 * Helper function to create DirectShareTarget objects from note data.
 *
 * @param notes - Array of notes with id and title
 * @returns Array of DirectShareTarget objects
 */
export function createTargetsFromNotes(
  notes: Array<{ id: string; title: string }>
): DirectShareTarget[] {
  return notes.map((note, index) => ({
    id: note.id,
    title: note.title,
    subtitle: 'Note',
    type: 'note',
    rank: index,
    icon: 'note_icon',
  }));
}

/**
 * Create direct share targets from pages
 *
 * Helper function to create DirectShareTarget objects from page data.
 *
 * @param pages - Array of pages with id and title
 * @returns Array of DirectShareTarget objects
 */
export function createTargetsFromPages(
  pages: Array<{ id: string; title: string }>
): DirectShareTarget[] {
  return pages.map((page, index) => ({
    id: page.id,
    title: page.title,
    subtitle: 'Page',
    type: 'page',
    rank: index,
    icon: 'page_icon',
  }));
}

/**
 * Mock Direct Share Bridge for testing
 */
export class MockDirectShareBridge implements DirectShareBridge {
  private targets: DirectShareTarget[] = [];

  async updateTargets(targets: DirectShareTarget[]): Promise<void> {
    this.targets = [...targets];
  }

  async clearTargets(): Promise<void> {
    this.targets = [];
  }

  async getTargets(): Promise<DirectShareTarget[]> {
    return [...this.targets];
  }
}
