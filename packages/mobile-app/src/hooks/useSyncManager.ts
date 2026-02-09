/**
 * useSyncManager - Manages data synchronization triggers and lifecycle.
 *
 * This hook provides mechanisms to trigger sync operations based on:
 * - Manual user trigger
 * - Background schedule (periodic sync)
 * - Network availability changes
 * - App foreground/background transitions
 *
 * It tracks sync status, handles errors, and supports cancellation.
 *
 * @example
 * ```tsx
 * function SyncButton() {
 *   const { syncStatus, lastSyncAt, triggerSync, error } = useSyncManager({
 *     onSyncComplete: () => {
 *       // Handle sync completion
 *     },
 *     backgroundSyncInterval: 5 * 60 * 1000, // 5 minutes
 *   });
 *
 *   return (
 *     <Button onPress={triggerSync} disabled={syncStatus === 'syncing'}>
 *       {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
 *     </Button>
 *   );
 * }
 * ```
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import type { MobileGraphDB } from '@double-bind/mobile';

/**
 * Sync status states.
 */
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

/**
 * Options for configuring the sync manager.
 */
export interface UseSyncManagerOptions {
  /**
   * Database instance to use for sync operations.
   * Sync will be disabled if null.
   */
  db: MobileGraphDB | null;

  /**
   * Interval (ms) for background sync.
   * Set to 0 to disable background sync.
   * Default: 0 (disabled)
   */
  backgroundSyncInterval?: number;

  /**
   * Whether to trigger sync when network becomes available.
   * Default: true
   */
  syncOnNetworkAvailable?: boolean;

  /**
   * Whether to trigger sync when app comes to foreground.
   * Default: true
   */
  syncOnAppForeground?: boolean;

  /**
   * Minimum time (ms) since last sync before allowing another.
   * Prevents excessive syncing on rapid state changes.
   * Default: 30000 (30 seconds)
   */
  minSyncInterval?: number;

  /**
   * Path to store sync backups.
   * Default: 'sync-backup.db'
   */
  syncBackupPath?: string;

  /**
   * Called when sync completes successfully.
   */
  onSyncComplete?: () => void;

  /**
   * Called when sync encounters an error.
   */
  onSyncError?: (error: Error) => void;

  /**
   * Called when sync is cancelled.
   */
  onSyncCancelled?: () => void;
}

/**
 * Result type for useSyncManager hook.
 */
export interface UseSyncManagerResult {
  /** Current sync status */
  syncStatus: SyncStatus;
  /** Timestamp of last successful sync */
  lastSyncAt: Date | null;
  /** Trigger a manual sync operation */
  triggerSync: () => Promise<void>;
  /** Cancel an in-progress sync operation */
  cancelSync: () => void;
  /** Error from last sync attempt */
  error: Error | null;
  /** Whether network is currently available */
  isNetworkAvailable: boolean;
  /** Whether app is currently in foreground */
  isAppForeground: boolean;
}

/**
 * Internal state for tracking sync lifecycle.
 */
interface SyncState {
  status: SyncStatus;
  lastSyncAt: Date | null;
  error: Error | null;
  cancelled: boolean;
  isNetworkAvailable: boolean;
  isAppForeground: boolean;
}

/**
 * Hook to manage sync trigger mechanisms.
 *
 * @param options Configuration options
 * @returns Sync manager interface
 */
export function useSyncManager(
  options: UseSyncManagerOptions
): UseSyncManagerResult {
  const {
    db,
    backgroundSyncInterval = 0,
    syncOnNetworkAvailable = true,
    syncOnAppForeground = true,
    minSyncInterval = 30000,
    syncBackupPath = 'sync-backup.db',
    onSyncComplete,
    onSyncError,
    onSyncCancelled,
  } = options;

  // State
  const [state, setState] = useState<SyncState>({
    status: 'idle',
    lastSyncAt: null,
    error: null,
    cancelled: false,
    isNetworkAvailable: true,
    isAppForeground: true,
  });

  // Refs for stable callbacks and cleanup
  const callbacksRef = useRef({ onSyncComplete, onSyncError, onSyncCancelled });
  callbacksRef.current = { onSyncComplete, onSyncError, onSyncCancelled };

  const syncInProgressRef = useRef(false);
  const backgroundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousNetworkStateRef = useRef<boolean>(true);
  const previousAppStateRef = useRef<AppStateStatus>(AppState.currentState);

  /**
   * Perform the actual sync operation using database backup/restore.
   */
  const performSync = useCallback(async (): Promise<void> => {
    if (!db) {
      throw new Error('Database not available for sync');
    }

    // For now, sync is implemented as a backup operation
    // In a real implementation, this would integrate with a sync server
    await db.backup(syncBackupPath);
  }, [db, syncBackupPath]);

  /**
   * Execute a sync operation with proper state management.
   */
  const executeSync = useCallback(
    async (_source: 'manual' | 'background' | 'network' | 'foreground') => {
      // Prevent concurrent syncs
      if (syncInProgressRef.current) {
        return;
      }

      // Check if enough time has passed since last sync
      if (
        state.lastSyncAt &&
        Date.now() - state.lastSyncAt.getTime() < minSyncInterval
      ) {
        return;
      }

      // Skip if no database
      if (!db) {
        return;
      }

      syncInProgressRef.current = true;

      setState((prev) => ({
        ...prev,
        status: 'syncing',
        error: null,
        cancelled: false,
      }));

      try {
        await performSync();

        // Check if cancelled during sync
        setState((prev) => {
          if (prev.cancelled) {
            callbacksRef.current.onSyncCancelled?.();
            return {
              ...prev,
              status: 'idle',
              cancelled: false,
            };
          }

          callbacksRef.current.onSyncComplete?.();
          return {
            ...prev,
            status: 'success',
            lastSyncAt: new Date(),
            error: null,
          };
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        setState((prev) => {
          // Don't update to error state if cancelled
          if (prev.cancelled) {
            callbacksRef.current.onSyncCancelled?.();
            return {
              ...prev,
              status: 'idle',
              cancelled: false,
            };
          }

          callbacksRef.current.onSyncError?.(error);
          return {
            ...prev,
            status: 'error',
            error,
          };
        });
      } finally {
        syncInProgressRef.current = false;
      }
    },
    [db, minSyncInterval, performSync, state.lastSyncAt]
  );

  /**
   * Manual sync trigger.
   */
  const triggerSync = useCallback(async () => {
    await executeSync('manual');
  }, [executeSync]);

  /**
   * Cancel an in-progress sync.
   */
  const cancelSync = useCallback(() => {
    if (syncInProgressRef.current) {
      setState((prev) => ({
        ...prev,
        cancelled: true,
      }));
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Background Sync Scheduler
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (backgroundSyncInterval <= 0 || !db) {
      return;
    }

    backgroundTimerRef.current = setInterval(() => {
      void executeSync('background');
    }, backgroundSyncInterval);

    return () => {
      if (backgroundTimerRef.current) {
        clearInterval(backgroundTimerRef.current);
        backgroundTimerRef.current = null;
      }
    };
  }, [backgroundSyncInterval, db, executeSync]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Network Availability Detection
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!syncOnNetworkAvailable || !db) {
      return;
    }

    const unsubscribe = NetInfo.addEventListener((netState: NetInfoState) => {
      const isConnected = netState.isConnected ?? false;

      setState((prev) => ({
        ...prev,
        isNetworkAvailable: isConnected,
      }));

      // Trigger sync when network becomes available (was disconnected, now connected)
      if (isConnected && !previousNetworkStateRef.current) {
        void executeSync('network');
      }

      previousNetworkStateRef.current = isConnected;
    });

    // Initialize network state
    NetInfo.fetch().then((netState) => {
      const isConnected = netState.isConnected ?? false;
      setState((prev) => ({
        ...prev,
        isNetworkAvailable: isConnected,
      }));
      previousNetworkStateRef.current = isConnected;
    });

    return () => {
      unsubscribe();
    };
  }, [syncOnNetworkAvailable, db, executeSync]);

  // ─────────────────────────────────────────────────────────────────────────────
  // App Foreground Detection
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!syncOnAppForeground || !db) {
      return;
    }

    const handleAppStateChange = (nextState: AppStateStatus) => {
      const isForeground = nextState === 'active';

      setState((prev) => ({
        ...prev,
        isAppForeground: isForeground,
      }));

      // Trigger sync when app comes to foreground (was background, now active)
      if (nextState === 'active' && previousAppStateRef.current === 'background') {
        void executeSync('foreground');
      }

      previousAppStateRef.current = nextState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Initialize app state
    const currentState = AppState.currentState;
    setState((prev) => ({
      ...prev,
      isAppForeground: currentState === 'active',
    }));
    previousAppStateRef.current = currentState;

    return () => {
      subscription.remove();
    };
  }, [syncOnAppForeground, db, executeSync]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Cleanup on unmount
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (backgroundTimerRef.current) {
        clearInterval(backgroundTimerRef.current);
      }
      if (syncInProgressRef.current) {
        setState((prev) => ({ ...prev, cancelled: true }));
      }
    };
  }, []);

  return {
    syncStatus: state.status,
    lastSyncAt: state.lastSyncAt,
    triggerSync,
    cancelSync,
    error: state.error,
    isNetworkAvailable: state.isNetworkAvailable,
    isAppForeground: state.isAppForeground,
  };
}
