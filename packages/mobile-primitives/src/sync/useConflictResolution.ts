/**
 * useConflictResolution Hook
 *
 * Provides imperative API for resolving conflicts with UI state management.
 * Handles the resolution workflow including confirmation and persistence.
 */

import { useState, useCallback } from 'react';
import type { ConflictMetadata, ConflictStore } from '@double-bind/types';

/**
 * Hook return type with conflict resolution methods.
 */
export interface UseConflictResolutionReturn {
  /**
   * Currently selected conflict for resolution.
   */
  selectedConflict: ConflictMetadata | null;

  /**
   * Whether the resolution modal is visible.
   */
  isModalVisible: boolean;

  /**
   * Select a conflict for resolution.
   */
  selectConflict: (conflict: ConflictMetadata) => void;

  /**
   * Clear the selected conflict.
   */
  clearSelection: () => void;

  /**
   * Show the resolution modal.
   */
  showModal: () => void;

  /**
   * Hide the resolution modal.
   */
  hideModal: () => void;

  /**
   * Resolve the selected conflict with the chosen method.
   */
  resolveConflict: (
    conflictId: string,
    method: 'local' | 'remote' | 'merge-later'
  ) => Promise<void>;

  /**
   * Get all unresolved conflicts.
   */
  getUnresolvedConflicts: () => Promise<ConflictMetadata[]>;

  /**
   * Refresh the conflict list.
   */
  refreshConflicts: () => Promise<ConflictMetadata[]>;

  /**
   * Whether a resolution operation is in progress.
   */
  isResolving: boolean;

  /**
   * Error message if resolution failed.
   */
  error: string | null;
}

/**
 * Hook for managing conflict resolution UI and state.
 *
 * @param conflictStore - Storage for conflict metadata
 * @param onResolved - Optional callback when a conflict is resolved
 * @returns Conflict resolution methods and state
 *
 * @example
 * ```typescript
 * const {
 *   selectedConflict,
 *   isModalVisible,
 *   selectConflict,
 *   resolveConflict,
 *   getUnresolvedConflicts,
 * } = useConflictResolution(conflictStore, (conflictId, method) => {
 *   // Handle resolution completion
 *   updateUI(conflictId, method);
 * });
 *
 * // Select a conflict
 * selectConflict(conflict);
 *
 * // Resolve it
 * await resolveConflict(conflict.conflictId, 'local');
 * ```
 */
export function useConflictResolution(
  conflictStore: ConflictStore,
  onResolved?: (conflictId: string, method: 'local' | 'remote' | 'merge-later') => void
): UseConflictResolutionReturn {
  const [selectedConflict, setSelectedConflict] = useState<ConflictMetadata | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Select a conflict for resolution.
   */
  const selectConflict = useCallback((conflict: ConflictMetadata) => {
    setSelectedConflict(conflict);
    setError(null);
  }, []);

  /**
   * Clear the selected conflict.
   */
  const clearSelection = useCallback(() => {
    setSelectedConflict(null);
    setError(null);
  }, []);

  /**
   * Show the resolution modal.
   */
  const showModal = useCallback(() => {
    setIsModalVisible(true);
  }, []);

  /**
   * Hide the resolution modal.
   */
  const hideModal = useCallback(() => {
    setIsModalVisible(false);
  }, []);

  /**
   * Resolve a conflict with the chosen method.
   */
  const resolveConflict = useCallback(
    async (conflictId: string, method: 'local' | 'remote' | 'merge-later') => {
      setIsResolving(true);
      setError(null);

      try {
        // Get the conflict
        const conflict = await conflictStore.getConflict(conflictId);
        if (!conflict) {
          throw new Error('Conflict not found');
        }

        // Determine the resolution method based on user choice
        let resolutionMethod: 'local' | 'remote' | 'merged' | 'both' | 'manual';
        let mergedSnapshot: unknown = undefined;

        switch (method) {
          case 'local':
            resolutionMethod = 'local';
            mergedSnapshot = conflict.localVersion.snapshot;
            break;

          case 'remote':
            resolutionMethod = 'remote';
            mergedSnapshot = conflict.remoteVersion.snapshot;
            break;

          case 'merge-later':
            // Update state to 'pending' instead of 'resolved'
            await conflictStore.updateConflict(conflictId, {
              state: 'pending',
            });
            clearSelection();
            hideModal();
            onResolved?.(conflictId, method);
            return;

          default:
            throw new Error(`Unknown resolution method: ${method}`);
        }

        // Resolve the conflict
        await conflictStore.resolveConflict(conflictId, {
          conflictId,
          method: resolutionMethod,
          mergedSnapshot,
          notes: `Resolved via UI with method: ${method}`,
        });

        // Clear selection and hide modal
        clearSelection();
        hideModal();

        // Notify callback
        onResolved?.(conflictId, method);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        throw err;
      } finally {
        setIsResolving(false);
      }
    },
    [conflictStore, onResolved, clearSelection, hideModal]
  );

  /**
   * Get all unresolved conflicts.
   */
  const getUnresolvedConflicts = useCallback(async (): Promise<ConflictMetadata[]> => {
    try {
      return await conflictStore.getUnresolvedConflicts();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch conflicts';
      setError(errorMessage);
      return [];
    }
  }, [conflictStore]);

  /**
   * Refresh the conflict list.
   */
  const refreshConflicts = useCallback(async (): Promise<ConflictMetadata[]> => {
    setError(null);
    return getUnresolvedConflicts();
  }, [getUnresolvedConflicts]);

  return {
    selectedConflict,
    isModalVisible,
    selectConflict,
    clearSelection,
    showModal,
    hideModal,
    resolveConflict,
    getUnresolvedConflicts,
    refreshConflicts,
    isResolving,
    error,
  };
}
