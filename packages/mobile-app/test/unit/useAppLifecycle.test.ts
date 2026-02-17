/**
 * Unit tests for useAppLifecycle hook.
 *
 * Tests the app lifecycle management hook that coordinates
 * database suspend/resume operations with React Native AppState.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

// Mock react-native before any imports that use it
vi.mock('react-native', () => {
  const mockAppState = {
    currentState: 'active' as 'active' | 'background' | 'inactive',
    addEventListener: vi.fn(),
  };
  return {
    AppState: mockAppState,
  };
});

import { renderHook, act, cleanup } from '@testing-library/react-hooks';
import { AppState } from 'react-native';
import { useAppLifecycle, useAppLifecycleState } from '../../src/hooks/useAppLifecycle.js';

// Type the mocked AppState
const mockAppState = AppState as unknown as {
  currentState: 'active' | 'background' | 'inactive';
  addEventListener: Mock;
};

// ============================================================================
// Mock Database Factory
// ============================================================================

interface MockMobileDatabase {
  suspend: Mock;
  resume: Mock;
  onLowMemory: Mock;
  close: Mock;
}

function createMockDatabase(): MockMobileDatabase {
  return {
    suspend: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    onLowMemory: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================================================
// Test Utilities
// ============================================================================

type AppStateChangeHandler = (state: 'active' | 'background' | 'inactive') => void;

function getAppStateListener(): AppStateChangeHandler | null {
  const calls = mockAppState.addEventListener.mock.calls;
  const lastCall = calls[calls.length - 1];
  if (lastCall && lastCall[0] === 'change') {
    return lastCall[1] as AppStateChangeHandler;
  }
  return null;
}

function simulateAppStateChange(newState: 'active' | 'background' | 'inactive'): void {
  mockAppState.currentState = newState;
  const listener = getAppStateListener();
  if (listener) {
    listener(newState);
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('useAppLifecycle', () => {
  let mockRemove: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAppState.currentState = 'active';
    mockRemove = vi.fn();
    mockAppState.addEventListener.mockReturnValue({ remove: mockRemove });
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // Basic Functionality
  // ==========================================================================

  describe('Basic Functionality', () => {
    it('subscribes to AppState on mount', () => {
      const db = createMockDatabase();

      renderHook(() => useAppLifecycle(db as unknown as Parameters<typeof useAppLifecycle>[0], {}));

      expect(mockAppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('unsubscribes from AppState on unmount', () => {
      const db = createMockDatabase();

      const { unmount } = renderHook(() =>
        useAppLifecycle(db as unknown as Parameters<typeof useAppLifecycle>[0], {})
      );

      unmount();

      expect(mockRemove).toHaveBeenCalled();
    });

    it('handles null database gracefully', async () => {
      renderHook(() => useAppLifecycle(null, {}));

      await act(async () => {
        simulateAppStateChange('background');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Should not throw
    });
  });

  // ==========================================================================
  // Background Transition
  // ==========================================================================

  describe('Background Transition', () => {
    it('calls db.suspend() when app goes to background', async () => {
      const db = createMockDatabase();

      renderHook(() => useAppLifecycle(db as unknown as Parameters<typeof useAppLifecycle>[0], {}));

      await act(async () => {
        simulateAppStateChange('background');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(db.suspend).toHaveBeenCalledTimes(1);
    });

    it('invokes onBackground callback after suspend completes', async () => {
      const db = createMockDatabase();
      const onBackground = vi.fn();

      renderHook(() =>
        useAppLifecycle(db as unknown as Parameters<typeof useAppLifecycle>[0], { onBackground })
      );

      await act(async () => {
        simulateAppStateChange('background');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(onBackground).toHaveBeenCalledTimes(1);
    });

    it('handles suspend errors gracefully', async () => {
      const db = createMockDatabase();
      const suspendError = new Error('Suspend failed');
      db.suspend.mockRejectedValueOnce(suspendError);
      const onError = vi.fn();

      renderHook(() =>
        useAppLifecycle(db as unknown as Parameters<typeof useAppLifecycle>[0], { onError })
      );

      await act(async () => {
        simulateAppStateChange('background');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(onError).toHaveBeenCalledWith(suspendError, 'suspend');
    });
  });

  // ==========================================================================
  // Foreground Transition
  // ==========================================================================

  describe('Foreground Transition', () => {
    it('calls db.resume() when app returns to foreground', async () => {
      const db = createMockDatabase();
      mockAppState.currentState = 'background';

      renderHook(() => useAppLifecycle(db as unknown as Parameters<typeof useAppLifecycle>[0], {}));

      await act(async () => {
        simulateAppStateChange('active');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(db.resume).toHaveBeenCalledTimes(1);
    });

    it('invokes onForeground callback after resume completes', async () => {
      const db = createMockDatabase();
      const onForeground = vi.fn();
      mockAppState.currentState = 'background';

      renderHook(() =>
        useAppLifecycle(db as unknown as Parameters<typeof useAppLifecycle>[0], { onForeground })
      );

      await act(async () => {
        simulateAppStateChange('active');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(onForeground).toHaveBeenCalledTimes(1);
    });

    it('handles resume errors gracefully', async () => {
      const db = createMockDatabase();
      const resumeError = new Error('Resume failed');
      db.resume.mockRejectedValueOnce(resumeError);
      const onError = vi.fn();
      mockAppState.currentState = 'background';

      renderHook(() =>
        useAppLifecycle(db as unknown as Parameters<typeof useAppLifecycle>[0], { onError })
      );

      await act(async () => {
        simulateAppStateChange('active');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(onError).toHaveBeenCalledWith(resumeError, 'resume');
    });
  });

  // ==========================================================================
  // Debouncing
  // ==========================================================================

  describe('Debouncing', () => {
    it('debounces rapid state changes', async () => {
      const db = createMockDatabase();

      renderHook(() =>
        useAppLifecycle(db as unknown as Parameters<typeof useAppLifecycle>[0], { debounceMs: 100 })
      );

      await act(async () => {
        // Rapid state changes
        simulateAppStateChange('background');
        simulateAppStateChange('active');
        simulateAppStateChange('background');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Should only process the first transition due to debouncing
      expect(db.suspend).toHaveBeenCalledTimes(1);
    });

    it('processes pending state after operation completes', async () => {
      const db = createMockDatabase();
      // Make suspend take some time
      db.suspend.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 50)));

      renderHook(() =>
        useAppLifecycle(db as unknown as Parameters<typeof useAppLifecycle>[0], { debounceMs: 10 })
      );

      await act(async () => {
        simulateAppStateChange('background');
        // State change arrives while suspend is in progress
        await new Promise((resolve) => setTimeout(resolve, 20));
        simulateAppStateChange('active');
        // Wait for all operations to complete
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(db.suspend).toHaveBeenCalled();
      expect(db.resume).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // iOS Inactive State
  // ==========================================================================

  describe('iOS Inactive State', () => {
    it('handles inactive -> background transition', async () => {
      const db = createMockDatabase();
      mockAppState.currentState = 'inactive';

      renderHook(() => useAppLifecycle(db as unknown as Parameters<typeof useAppLifecycle>[0], {}));

      await act(async () => {
        simulateAppStateChange('background');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(db.suspend).toHaveBeenCalledTimes(1);
    });

    it('handles background -> inactive -> active transition', async () => {
      const db = createMockDatabase();
      mockAppState.currentState = 'background';

      renderHook(() => useAppLifecycle(db as unknown as Parameters<typeof useAppLifecycle>[0], {}));

      await act(async () => {
        // Go through inactive on the way to active
        simulateAppStateChange('inactive');
        await new Promise((resolve) => setTimeout(resolve, 150));
        simulateAppStateChange('active');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Should call resume when finally reaching active
      expect(db.resume).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // State Deduplication
  // ==========================================================================

  describe('State Deduplication', () => {
    it('does not call suspend twice for same state', async () => {
      const db = createMockDatabase();

      renderHook(() => useAppLifecycle(db as unknown as Parameters<typeof useAppLifecycle>[0], {}));

      await act(async () => {
        simulateAppStateChange('background');
        await new Promise((resolve) => setTimeout(resolve, 150));
        simulateAppStateChange('background');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(db.suspend).toHaveBeenCalledTimes(1);
    });

    it('does not call resume twice for same state', async () => {
      const db = createMockDatabase();

      renderHook(() => useAppLifecycle(db as unknown as Parameters<typeof useAppLifecycle>[0], {}));

      await act(async () => {
        // Already active, simulate active again
        simulateAppStateChange('active');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(db.resume).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// useAppLifecycleState Tests
// ============================================================================

describe('useAppLifecycleState', () => {
  let mockRemove: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAppState.currentState = 'active';
    mockRemove = vi.fn();
    mockAppState.addEventListener.mockReturnValue({ remove: mockRemove });
  });

  afterEach(() => {
    cleanup();
  });

  it('returns current app state', () => {
    mockAppState.currentState = 'active';

    const { result } = renderHook(() => useAppLifecycleState());

    expect(result.current.appState).toBe('active');
    expect(result.current.isActive).toBe(true);
    expect(result.current.isBackground).toBe(false);
  });

  it('returns background state correctly', () => {
    mockAppState.currentState = 'background';

    const { result } = renderHook(() => useAppLifecycleState());

    expect(result.current.appState).toBe('background');
    expect(result.current.isActive).toBe(false);
    expect(result.current.isBackground).toBe(true);
  });

  it('subscribes to state changes', () => {
    renderHook(() => useAppLifecycleState());

    expect(mockAppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useAppLifecycleState());

    unmount();

    expect(mockRemove).toHaveBeenCalled();
  });
});
