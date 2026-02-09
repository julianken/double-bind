/**
 * In-memory conflict store implementation.
 *
 * Provides a simple in-memory storage for conflict metadata.
 * Suitable for testing and can serve as a reference implementation
 * for database-backed stores.
 */

import type {
  ConflictMetadata,
  ConflictStore,
  ResolveConflictInput,
} from '@double-bind/types';

/**
 * In-memory implementation of ConflictStore.
 *
 * Stores conflicts in memory. Not persistent across app restarts.
 * For production use, implement a database-backed store.
 */
export class InMemoryConflictStore implements ConflictStore {
  private conflicts = new Map<string, ConflictMetadata>();

  async saveConflict(conflict: ConflictMetadata): Promise<void> {
    this.conflicts.set(conflict.conflictId, { ...conflict });
  }

  async getConflict(conflictId: string): Promise<ConflictMetadata | null> {
    const conflict = this.conflicts.get(conflictId);
    return conflict ? { ...conflict } : null;
  }

  async getConflictsForEntity(entityId: string): Promise<ConflictMetadata[]> {
    const results: ConflictMetadata[] = [];
    for (const conflict of this.conflicts.values()) {
      if (conflict.entityId === entityId) {
        results.push({ ...conflict });
      }
    }
    return results;
  }

  async getUnresolvedConflicts(): Promise<ConflictMetadata[]> {
    const results: ConflictMetadata[] = [];
    for (const conflict of this.conflicts.values()) {
      if (conflict.state !== 'resolved' && conflict.state !== 'rejected') {
        results.push({ ...conflict });
      }
    }
    return results;
  }

  async updateConflict(
    conflictId: string,
    updates: Partial<ConflictMetadata>
  ): Promise<void> {
    const existing = this.conflicts.get(conflictId);
    if (!existing) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    this.conflicts.set(conflictId, {
      ...existing,
      ...updates,
    });
  }

  async resolveConflict(conflictId: string, resolution: ResolveConflictInput): Promise<void> {
    const existing = this.conflicts.get(conflictId);
    if (!existing) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    const resolvedAt = Date.now();

    this.conflicts.set(conflictId, {
      ...existing,
      state: 'resolved',
      resolvedAt,
      resolution: {
        method: resolution.method,
        resultId: existing.entityId, // Could be different for 'both' method
        description: resolution.notes,
      },
      metadata: {
        ...existing.metadata,
        resolvedBy: resolution.userId,
        notes: resolution.notes,
      },
    });
  }

  async deleteConflict(conflictId: string): Promise<void> {
    this.conflicts.delete(conflictId);
  }

  async pruneResolvedConflicts(olderThan: number): Promise<number> {
    let count = 0;
    for (const [conflictId, conflict] of this.conflicts.entries()) {
      if (
        conflict.state === 'resolved' &&
        conflict.resolvedAt &&
        conflict.resolvedAt < olderThan
      ) {
        this.conflicts.delete(conflictId);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all conflicts (for testing).
   */
  clear(): void {
    this.conflicts.clear();
  }

  /**
   * Get total count of conflicts (for testing).
   */
  size(): number {
    return this.conflicts.size;
  }
}
