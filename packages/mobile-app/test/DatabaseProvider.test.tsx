/**
 * Unit tests for DatabaseProvider and useDatabase hook.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MockDatabase } from '@double-bind/test-utils';
import { DatabaseProvider, useDatabase, useDatabaseReady } from '../src/index';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

// Mock React Native Platform module
vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  AppState: {
    addEventListener: vi.fn(() => ({
      remove: vi.fn(),
    })),
    currentState: 'active',
  },
}));

// Track mock db instances
let mockDbInstance: MockDatabase | null = null;
let createCallCount = 0;
let createShouldFail = false;
let createFailError = 'Database initialization failed';

// Mock MobileDatabase
vi.mock('@double-bind/mobile', () => ({
  MobileDatabase: {
    create: vi.fn(async (_path: string) => {
      createCallCount++;
      if (createShouldFail) {
        throw new Error(createFailError);
      }
      mockDbInstance = new MockDatabase();
      // Add mobile-specific methods that MobileDatabase has
      (mockDbInstance as unknown as Record<string, unknown>).suspend = vi.fn(async () => {});
      (mockDbInstance as unknown as Record<string, unknown>).resume = vi.fn(async () => {});
      return mockDbInstance;
    }),
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Test Utilities
// ─────────────────────────────────────────────────────────────────────────────

function TestConsumer({ testId }: { testId?: string }) {
  const { db, status, error, platform } = useDatabase();

  return (
    <div data-testid={testId ?? 'test-consumer'}>
      <span data-testid="status">{status}</span>
      <span data-testid="platform">{platform}</span>
      <span data-testid="has-db">{db ? 'yes' : 'no'}</span>
      {error && <span data-testid="error">{error}</span>}
    </div>
  );
}

function wrapper({ children }: { children: ReactNode }) {
  return <DatabaseProvider>{children}</DatabaseProvider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('DatabaseProvider', () => {
  beforeEach(() => {
    mockDbInstance = null;
    createCallCount = 0;
    createShouldFail = false;
    createFailError = 'Database initialization failed';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should start with initializing status', async () => {
      render(
        <DatabaseProvider>
          <TestConsumer />
        </DatabaseProvider>
      );

      // Initial status should be idle or initializing
      expect(screen.getByTestId('status').textContent).toMatch(/idle|initializing/);
    });

    it('should transition to ready status after successful initialization', async () => {
      render(
        <DatabaseProvider>
          <TestConsumer />
        </DatabaseProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('ready');
      });

      expect(screen.getByTestId('has-db').textContent).toBe('yes');
    });

    it('should detect iOS platform', async () => {
      render(
        <DatabaseProvider>
          <TestConsumer />
        </DatabaseProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('platform').textContent).toBe('ios');
      });
    });

    it('should call MobileDatabase.create with provided path', async () => {
      const { MobileDatabase } = await import('@double-bind/mobile');

      render(
        <DatabaseProvider databasePath="/custom/path/db.sqlite">
          <TestConsumer />
        </DatabaseProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('ready');
      });

      expect(MobileDatabase.create).toHaveBeenCalledWith('/custom/path/db.sqlite');
    });

    it('should call onReady callback when initialization succeeds', async () => {
      const onReady = vi.fn();

      render(
        <DatabaseProvider onReady={onReady}>
          <TestConsumer />
        </DatabaseProvider>
      );

      await waitFor(() => {
        expect(onReady).toHaveBeenCalledTimes(1);
      });

      expect(onReady).toHaveBeenCalledWith(mockDbInstance);
    });
  });

  describe('error handling', () => {
    it('should transition to error status on initialization failure', async () => {
      createShouldFail = true;

      render(
        <DatabaseProvider>
          <TestConsumer />
        </DatabaseProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('error');
      });

      expect(screen.getByTestId('error').textContent).toBe('Database initialization failed');
      expect(screen.getByTestId('has-db').textContent).toBe('no');
    });

    it('should call onError callback when initialization fails', async () => {
      createShouldFail = true;
      const onError = vi.fn();

      render(
        <DatabaseProvider onError={onError}>
          <TestConsumer />
        </DatabaseProvider>
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onError.mock.calls[0]?.[0]?.message).toBe('Database initialization failed');
    });

    it('should allow retry after error', async () => {
      createShouldFail = true;

      function RetryTestConsumer() {
        const { status, retry, error } = useDatabase();

        return (
          <div>
            <span data-testid="status">{status}</span>
            {error && <span data-testid="error">{error}</span>}
            <button data-testid="retry" onClick={retry}>
              Retry
            </button>
          </div>
        );
      }

      render(
        <DatabaseProvider>
          <RetryTestConsumer />
        </DatabaseProvider>
      );

      // Wait for initial error
      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('error');
      });

      expect(createCallCount).toBe(1);

      // Fix the error and retry
      createShouldFail = false;

      await act(async () => {
        screen.getByTestId('retry').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('ready');
      });

      expect(createCallCount).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should close database on unmount', async () => {
      const { unmount } = render(
        <DatabaseProvider>
          <TestConsumer />
        </DatabaseProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('ready');
      });

      expect(mockDbInstance).not.toBeNull();
      const closeSpy = vi.spyOn(mockDbInstance!, 'close');

      unmount();

      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('useDatabase', () => {
  beforeEach(() => {
    mockDbInstance = null;
    createCallCount = 0;
    createShouldFail = false;
  });

  it('should throw when used outside of DatabaseProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useDatabase());
    }).toThrow('useDatabase must be used within a DatabaseProvider');

    consoleSpy.mockRestore();
  });

  it('should return context value when used within provider', async () => {
    const { result } = renderHook(() => useDatabase(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.db).toBe(mockDbInstance);
    expect(result.current.platform).toBe('ios');
    expect(result.current.error).toBeNull();
    expect(typeof result.current.retry).toBe('function');
  });
});

describe('useDatabaseReady', () => {
  beforeEach(() => {
    mockDbInstance = null;
    createCallCount = 0;
    createShouldFail = false;
  });

  it('should throw when database is not ready', () => {
    // Make initialization hang by never resolving
    createShouldFail = true;

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function TestUseDatabaseReady() {
      const { db } = useDatabaseReady();
      return <div>{db ? 'ready' : 'not ready'}</div>;
    }

    expect(() => {
      render(
        <DatabaseProvider>
          <TestUseDatabaseReady />
        </DatabaseProvider>
      );
    }).toThrow('useDatabaseReady requires the database to be initialized');

    consoleSpy.mockRestore();
  });
});
