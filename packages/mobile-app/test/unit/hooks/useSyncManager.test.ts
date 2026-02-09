/**
 * Tests for useSyncManager hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSyncManager, type UseSyncManagerOptions } from '../../../src/hooks/useSyncManager';
import type { MobileGraphDB } from '@double-bind/mobile';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

// Mock React Native modules
vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn(() => ({
      remove: vi.fn(),
    })),
  },
}));

// Mock NetInfo
vi.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: vi.fn(() => vi.fn()),
    fetch: vi.fn(() =>
      Promise.resolve({
        isConnected: true,
        type: 'wifi',
      })
    ),
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Test Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a mock MobileGraphDB instance.
 */
function createMockDB(): MobileGraphDB {
  return {
    backup: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ headers: [], rows: [] }),
    mutate: vi.fn().mockResolvedValue({ ok: true }),
    importRelations: vi.fn().mockResolvedValue(undefined),
    exportRelations: vi.fn().mockResolvedValue({}),
    importRelationsFromBackup: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    onLowMemory: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as MobileGraphDB;
}

/**
 * Create default options for useSyncManager.
 */
function createDefaultOptions(
  overrides: Partial<UseSyncManagerOptions> = {}
): UseSyncManagerOptions {
  return {
    db: createMockDB(),
    backgroundSyncInterval: 0,
    syncOnNetworkAvailable: false,
    syncOnAppForeground: false,
    minSyncInterval: 0, // Allow immediate syncs for testing
    syncBackupPath: 'test-sync-backup.db',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('useSyncManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Initialization
  // ───────────────────────────────────────────────────────────────────────────

  it('should initialize with idle status', () => {
    const options = createDefaultOptions();
    const { result } = renderHook(() => useSyncManager(options));

    expect(result.current.syncStatus).toBe('idle');
    expect(result.current.lastSyncAt).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should initialize with network and app state', async () => {
    const options = createDefaultOptions();
    const { result } = renderHook(() => useSyncManager(options));

    await waitFor(() => {
      expect(result.current.isNetworkAvailable).toBe(true);
      expect(result.current.isAppForeground).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Manual Sync
  // ───────────────────────────────────────────────────────────────────────────

  it('should trigger manual sync successfully', async () => {
    const onSyncComplete = vi.fn();
    const options = createDefaultOptions({ onSyncComplete });
    const { result } = renderHook(() => useSyncManager(options));

    await act(async () => {
      await result.current.triggerSync();
    });

    expect(result.current.syncStatus).toBe('success');
    expect(result.current.lastSyncAt).toBeInstanceOf(Date);
    expect(result.current.error).toBeNull();
    expect(onSyncComplete).toHaveBeenCalledOnce();
    expect(options.db!.backup).toHaveBeenCalledWith('test-sync-backup.db');
  });

  it('should handle sync errors', async () => {
    const syncError = new Error('Sync failed');
    const onSyncError = vi.fn();
    const mockDB = createMockDB();
    vi.mocked(mockDB.backup).mockRejectedValue(syncError);

    const options = createDefaultOptions({ db: mockDB, onSyncError });
    const { result } = renderHook(() => useSyncManager(options));

    await act(async () => {
      await result.current.triggerSync();
    });

    await waitFor(() => {
      expect(result.current.syncStatus).toBe('error');
      expect(result.current.error).toBe(syncError);
      expect(onSyncError).toHaveBeenCalledWith(syncError);
    });
  });

  it('should not allow concurrent syncs', async () => {
    const mockDB = createMockDB();
    let resolveBackup: (() => void) | null = null;
    vi.mocked(mockDB.backup).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveBackup = resolve;
        })
    );

    const options = createDefaultOptions({ db: mockDB });
    const { result } = renderHook(() => useSyncManager(options));

    // Start first sync (won't complete immediately)
    const firstSync = act(async () => {
      await result.current.triggerSync();
    });

    // Try to start second sync while first is in progress
    await act(async () => {
      await result.current.triggerSync();
    });

    // Complete first sync
    act(() => {
      resolveBackup?.();
    });
    await firstSync;

    // Backup should only be called once (concurrent prevented)
    expect(mockDB.backup).toHaveBeenCalledTimes(1);
  });

  it('should respect minimum sync interval', async () => {
    const options = createDefaultOptions({ minSyncInterval: 1000 });
    const { result } = renderHook(() => useSyncManager(options));

    // First sync
    await act(async () => {
      await result.current.triggerSync();
    });
    expect(result.current.syncStatus).toBe('success');

    // Try second sync immediately (should be blocked)
    const lastSyncAt = result.current.lastSyncAt;
    await act(async () => {
      await result.current.triggerSync();
    });
    expect(result.current.lastSyncAt).toBe(lastSyncAt); // Unchanged

    // Wait for interval and try again
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    await act(async () => {
      await result.current.triggerSync();
    });
    expect(result.current.lastSyncAt).not.toBe(lastSyncAt); // Changed
  });

  it('should skip sync if database is null', async () => {
    const options = createDefaultOptions({ db: null });
    const { result } = renderHook(() => useSyncManager(options));

    await act(async () => {
      await result.current.triggerSync();
    });

    expect(result.current.syncStatus).toBe('idle');
    expect(result.current.lastSyncAt).toBeNull();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Sync Cancellation
  // ───────────────────────────────────────────────────────────────────────────

  it('should cancel in-progress sync', async () => {
    const onSyncCancelled = vi.fn();
    const mockDB = createMockDB();
    let resolveBackup: (() => void) | null = null;
    vi.mocked(mockDB.backup).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveBackup = resolve;
        })
    );

    const options = createDefaultOptions({ db: mockDB, onSyncCancelled });
    const { result } = renderHook(() => useSyncManager(options));

    // Start sync
    const syncPromise = act(async () => {
      await result.current.triggerSync();
    });

    // Cancel while in progress
    act(() => {
      result.current.cancelSync();
    });

    // Complete the sync
    act(() => {
      resolveBackup?.();
    });
    await syncPromise;

    await waitFor(() => {
      expect(result.current.syncStatus).toBe('idle');
      expect(onSyncCancelled).toHaveBeenCalledOnce();
    });
  });

  it('should do nothing when cancelling if no sync is in progress', () => {
    const options = createDefaultOptions();
    const { result } = renderHook(() => useSyncManager(options));

    act(() => {
      result.current.cancelSync();
    });

    expect(result.current.syncStatus).toBe('idle');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Background Sync
  // ───────────────────────────────────────────────────────────────────────────

  it('should trigger background sync on interval', async () => {
    const onSyncComplete = vi.fn();
    const options = createDefaultOptions({
      backgroundSyncInterval: 5000,
      onSyncComplete,
    });
    const { result } = renderHook(() => useSyncManager(options));

    // Wait for first interval
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(result.current.lastSyncAt).not.toBeNull();
      expect(onSyncComplete).toHaveBeenCalledOnce();
    });

    // Wait for second interval
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(onSyncComplete).toHaveBeenCalledTimes(2);
    });
  });

  it('should not start background sync if interval is 0', async () => {
    const onSyncComplete = vi.fn();
    const options = createDefaultOptions({
      backgroundSyncInterval: 0,
      onSyncComplete,
    });
    renderHook(() => useSyncManager(options));

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(onSyncComplete).not.toHaveBeenCalled();
  });

  it('should clear background timer on unmount', async () => {
    const options = createDefaultOptions({ backgroundSyncInterval: 5000 });
    const { unmount } = renderHook(() => useSyncManager(options));

    unmount();

    // Advance timers to verify no sync happens
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(options.db!.backup).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Network Availability
  // ───────────────────────────────────────────────────────────────────────────

  it('should trigger sync when network becomes available', async () => {
    const onSyncComplete = vi.fn();
    let networkListener: ((state: { isConnected: boolean }) => void) | null = null;

    vi.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
      networkListener = listener;
      return vi.fn();
    });

    const options = createDefaultOptions({
      syncOnNetworkAvailable: true,
      onSyncComplete,
    });
    const { result } = renderHook(() => useSyncManager(options));

    // Simulate network disconnection
    await act(async () => {
      networkListener?.({ isConnected: false });
    });

    expect(result.current.isNetworkAvailable).toBe(false);

    // Simulate network reconnection
    await act(async () => {
      networkListener?.({ isConnected: true });
    });

    await waitFor(() => {
      expect(result.current.isNetworkAvailable).toBe(true);
      expect(onSyncComplete).toHaveBeenCalled();
    });
  });

  it('should not trigger sync when network disconnects', async () => {
    const onSyncComplete = vi.fn();
    let networkListener: ((state: { isConnected: boolean }) => void) | null = null;

    vi.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
      networkListener = listener;
      return vi.fn();
    });

    const options = createDefaultOptions({
      syncOnNetworkAvailable: true,
      onSyncComplete,
    });
    renderHook(() => useSyncManager(options));

    // Simulate network disconnection
    await act(async () => {
      networkListener?.({ isConnected: false });
    });

    // Sync should not be triggered on disconnect
    expect(onSyncComplete).not.toHaveBeenCalled();
  });

  it('should not sync on network changes when disabled', async () => {
    const onSyncComplete = vi.fn();
    let networkListener: ((state: { isConnected: boolean }) => void) | null = null;

    vi.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
      networkListener = listener;
      return vi.fn();
    });

    const options = createDefaultOptions({
      syncOnNetworkAvailable: false,
      onSyncComplete,
    });
    renderHook(() => useSyncManager(options));

    // Network changes
    await act(async () => {
      networkListener?.({ isConnected: false });
    });
    await act(async () => {
      networkListener?.({ isConnected: true });
    });

    expect(onSyncComplete).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // App Foreground
  // ───────────────────────────────────────────────────────────────────────────

  it('should trigger sync when app comes to foreground', async () => {
    const onSyncComplete = vi.fn();
    let appStateListener: ((state: string) => void) | null = null;

    vi.mocked(AppState.addEventListener).mockImplementation((event, listener) => {
      if (event === 'change') {
        appStateListener = listener;
      }
      return { remove: vi.fn() };
    });

    const options = createDefaultOptions({
      syncOnAppForeground: true,
      onSyncComplete,
    });
    const { result } = renderHook(() => useSyncManager(options));

    // Simulate app going to background
    await act(async () => {
      appStateListener?.('background');
    });

    expect(result.current.isAppForeground).toBe(false);

    // Simulate app coming to foreground
    await act(async () => {
      appStateListener?.('active');
    });

    await waitFor(() => {
      expect(result.current.isAppForeground).toBe(true);
      expect(onSyncComplete).toHaveBeenCalled();
    });
  });

  it('should not trigger sync when app goes to background', async () => {
    const onSyncComplete = vi.fn();
    let appStateListener: ((state: string) => void) | null = null;

    vi.mocked(AppState.addEventListener).mockImplementation((event, listener) => {
      if (event === 'change') {
        appStateListener = listener;
      }
      return { remove: vi.fn() };
    });

    const options = createDefaultOptions({
      syncOnAppForeground: true,
      onSyncComplete,
    });
    renderHook(() => useSyncManager(options));

    // Simulate app going to background
    await act(async () => {
      appStateListener?.('background');
    });

    // Sync should not be triggered on background
    expect(onSyncComplete).not.toHaveBeenCalled();
  });

  it('should not sync on app state changes when disabled', async () => {
    const onSyncComplete = vi.fn();
    let appStateListener: ((state: string) => void) | null = null;

    vi.mocked(AppState.addEventListener).mockImplementation((event, listener) => {
      if (event === 'change') {
        appStateListener = listener;
      }
      return { remove: vi.fn() };
    });

    const options = createDefaultOptions({
      syncOnAppForeground: false,
      onSyncComplete,
    });
    renderHook(() => useSyncManager(options));

    // App state changes
    await act(async () => {
      appStateListener?.('background');
    });
    await act(async () => {
      appStateListener?.('active');
    });

    expect(onSyncComplete).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ───────────────────────────────────────────────────────────────────────────

  it('should clean up subscriptions on unmount', () => {
    const unsubscribeNetwork = vi.fn();
    const unsubscribeAppState = { remove: vi.fn() };

    vi.mocked(NetInfo.addEventListener).mockReturnValue(unsubscribeNetwork);
    vi.mocked(AppState.addEventListener).mockReturnValue(unsubscribeAppState);

    const options = createDefaultOptions({
      syncOnNetworkAvailable: true,
      syncOnAppForeground: true,
    });
    const { unmount } = renderHook(() => useSyncManager(options));

    unmount();

    expect(unsubscribeNetwork).toHaveBeenCalled();
    expect(unsubscribeAppState.remove).toHaveBeenCalled();
  });

  it('should cancel sync on unmount if in progress', async () => {
    const mockDB = createMockDB();
    let resolveBackup: (() => void) | null = null;
    vi.mocked(mockDB.backup).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveBackup = resolve;
        })
    );

    const options = createDefaultOptions({ db: mockDB });
    const { unmount, result } = renderHook(() => useSyncManager(options));

    // Start sync
    act(() => {
      void result.current.triggerSync();
    });

    // Unmount while sync is in progress
    unmount();

    // Complete the sync
    act(() => {
      resolveBackup?.();
    });

    // Sync should be marked as cancelled
    await waitFor(() => {
      expect(result.current.syncStatus).toBe('idle');
    });
  });
});
