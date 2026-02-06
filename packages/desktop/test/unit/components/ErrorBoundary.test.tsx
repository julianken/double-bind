/**
 * Tests for ErrorBoundary component.
 */

import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ErrorBoundary, type ErrorBoundaryProps } from '../../../src/components/ErrorBoundary';

// Component that throws an error when shouldThrow is true
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

// Component that renders children and can trigger an error via button
function ThrowErrorOnClick({ children }: { children: React.ReactNode }) {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error('Click triggered error');
  }

  return (
    <div>
      {children}
      <button onClick={() => setShouldThrow(true)}>Trigger Error</button>
    </div>
  );
}

describe('ErrorBoundary', () => {
  // Suppress console.error for cleaner test output
  // eslint-disable-next-line no-console
  const originalError = console.error;
  beforeEach(() => {
    // eslint-disable-next-line no-console
    console.error = vi.fn();
  });

  afterEach(() => {
    // eslint-disable-next-line no-console
    console.error = originalError;
  });

  describe('Basic Functionality', () => {
    it('renders children when no error occurs', () => {
      render(
        <ErrorBoundary fallback={<div>Error occurred</div>}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeDefined();
      expect(screen.queryByText('Error occurred')).toBeNull();
    });

    it('renders fallback UI when child throws error', () => {
      render(
        <ErrorBoundary fallback={<div>Error occurred</div>}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error occurred')).toBeDefined();
      expect(screen.queryByText('No error')).toBeNull();
    });

    it('catches errors from nested children', () => {
      render(
        <ErrorBoundary fallback={<div>Error caught</div>}>
          <div>
            <div>
              <ThrowError shouldThrow={true} />
            </div>
          </div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Error caught')).toBeDefined();
    });
  });

  describe('Function-based Fallback', () => {
    it('calls function fallback with error and reset callback', () => {
      const fallbackFn = vi.fn((error: Error, reset: () => void) => (
        <div>
          <span data-testid="error-message">{error.message}</span>
          <button onClick={reset}>Reset</button>
        </div>
      ));

      render(
        <ErrorBoundary fallback={fallbackFn}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Verify fallback function was called at least once
      expect(fallbackFn).toHaveBeenCalled();

      // Verify error message is displayed
      expect(screen.getByTestId('error-message').textContent).toBe('Test error');

      // Verify reset button exists
      expect(screen.getByRole('button', { name: 'Reset' })).toBeDefined();
    });

    it('resets error state when reset is called', async () => {
      const user = userEvent.setup();
      let shouldThrow = true;

      function ResetTestComponent() {
        return <ThrowError shouldThrow={shouldThrow} />;
      }

      render(
        <ErrorBoundary
          fallback={(error, reset) => (
            <div>
              <div data-testid="error-state">Error: {error.message}</div>
              <button
                onClick={() => {
                  shouldThrow = false; // Allow successful render
                  reset();
                }}
              >
                Try Again
              </button>
            </div>
          )}
        >
          <ResetTestComponent />
        </ErrorBoundary>
      );

      // Initially shows error
      expect(screen.getByTestId('error-state')).toBeDefined();

      // Click reset button
      await user.click(screen.getByRole('button', { name: 'Try Again' }));

      // After reset, children render successfully
      expect(screen.getByText('No error')).toBeDefined();
      expect(screen.queryByTestId('error-state')).toBeNull();
    });

    it('displays different errors when components throw different errors', () => {
      const fallback = (error: Error) => <div data-testid="error">{error.message}</div>;

      function ComponentA() {
        throw new Error('Error from A');
      }

      function ComponentB() {
        throw new Error('Error from B');
      }

      const { unmount } = render(
        <ErrorBoundary fallback={fallback}>
          <ComponentA />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('error').textContent).toBe('Error from A');

      // Unmount and render a new ErrorBoundary instance
      unmount();

      render(
        <ErrorBoundary fallback={fallback}>
          <ComponentB />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('error').textContent).toBe('Error from B');
    });
  });

  describe('Error Logging', () => {
    it('logs error to console.error', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      render(
        <ErrorBoundary fallback={<div>Error</div>}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
      // Check that one of the console.error calls includes [ErrorBoundary]
      const hasErrorBoundaryLog = consoleErrorSpy.mock.calls.some((call) =>
        call.some((arg) => typeof arg === 'string' && arg.includes('[ErrorBoundary]'))
      );
      expect(hasErrorBoundaryLog).toBe(true);
    });

    it('calls onError callback when error occurs', () => {
      const onErrorMock = vi.fn();

      render(
        <ErrorBoundary fallback={<div>Error</div>} onError={onErrorMock}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onErrorMock).toHaveBeenCalledTimes(1);
      expect(onErrorMock.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(onErrorMock.mock.calls[0][0].message).toBe('Test error');
      expect(onErrorMock.mock.calls[0][1]).toHaveProperty('componentStack');
    });

    it('does not call onError when no error occurs', () => {
      const onErrorMock = vi.fn();

      render(
        <ErrorBoundary fallback={<div>Error</div>} onError={onErrorMock}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(onErrorMock).not.toHaveBeenCalled();
    });

    it('works without onError callback', () => {
      // Should not throw when onError is not provided
      expect(() => {
        render(
          <ErrorBoundary fallback={<div>Error</div>}>
            <ThrowError shouldThrow={true} />
          </ErrorBoundary>
        );
      }).not.toThrow();
    });
  });

  describe('Multiple Error Boundaries', () => {
    it('isolates errors to the nearest boundary', () => {
      render(
        <ErrorBoundary fallback={<div data-testid="outer-error">Outer Error</div>}>
          <div>
            <span>Outer content</span>
            <ErrorBoundary fallback={<div data-testid="inner-error">Inner Error</div>}>
              <ThrowError shouldThrow={true} />
            </ErrorBoundary>
          </div>
        </ErrorBoundary>
      );

      // Inner boundary catches the error
      expect(screen.getByTestId('inner-error')).toBeDefined();

      // Outer boundary and its content remain visible
      expect(screen.getByText('Outer content')).toBeDefined();
      expect(screen.queryByTestId('outer-error')).toBeNull();
    });

    it('propagates to outer boundary when inner boundary also throws', () => {
      function FallbackWithError() {
        throw new Error('Fallback error');
      }

      render(
        <ErrorBoundary fallback={<div data-testid="outer-error">Outer Error</div>}>
          <ErrorBoundary fallback={<FallbackWithError />}>
            <ThrowError shouldThrow={true} />
          </ErrorBoundary>
        </ErrorBoundary>
      );

      // Outer boundary catches the error from inner boundary's fallback
      expect(screen.getByTestId('outer-error')).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('handles errors that occur after initial render', async () => {
      const user = userEvent.setup();

      render(
        <ErrorBoundary fallback={(error) => <div data-testid="error">{error.message}</div>}>
          <ThrowErrorOnClick>
            <div>Initial content</div>
          </ThrowErrorOnClick>
        </ErrorBoundary>
      );

      // Initially renders successfully
      expect(screen.getByText('Initial content')).toBeDefined();

      // Click to trigger error
      await user.click(screen.getByRole('button', { name: 'Trigger Error' }));

      // Error boundary catches the error
      expect(screen.getByTestId('error').textContent).toBe('Click triggered error');
      expect(screen.queryByText('Initial content')).toBeNull();
    });

    it('handles synchronous errors in render', () => {
      function SyncError() {
        throw new Error('Synchronous error');
      }

      render(
        <ErrorBoundary fallback={<div data-testid="error">Caught sync error</div>}>
          <SyncError />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('error')).toBeDefined();
    });

    it('renders complex fallback UI', () => {
      const complexFallback = (
        <div data-testid="complex-fallback">
          <h1>Error Title</h1>
          <p>Error description</p>
          <button>Action 1</button>
          <button>Action 2</button>
        </div>
      );

      render(
        <ErrorBoundary fallback={complexFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('complex-fallback')).toBeDefined();
      expect(screen.getByText('Error Title')).toBeDefined();
      expect(screen.getByText('Error description')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Action 1' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Action 2' })).toBeDefined();
    });
  });

  describe('TypeScript Types', () => {
    it('accepts valid prop types', () => {
      const validProps: ErrorBoundaryProps = {
        fallback: <div>Fallback</div>,
        children: <div>Children</div>,
        onError: (error, errorInfo) => {
          // Test error handler - intentionally logs
          // eslint-disable-next-line no-console
          console.log(error, errorInfo);
        },
      };

      render(<ErrorBoundary {...validProps} />);
      expect(screen.getByText('Children')).toBeDefined();
    });

    it('accepts function-based fallback with correct signature', () => {
      const functionFallback: ErrorBoundaryProps['fallback'] = (
        error: Error,
        reset: () => void
      ) => (
        <div>
          <span>{error.message}</span>
          <button onClick={reset}>Reset</button>
        </div>
      );

      const props: ErrorBoundaryProps = {
        fallback: functionFallback,
        children: <div>Children</div>,
      };

      render(<ErrorBoundary {...props} />);
      expect(screen.getByText('Children')).toBeDefined();
    });
  });
});
