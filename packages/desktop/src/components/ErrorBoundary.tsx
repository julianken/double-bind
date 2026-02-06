/**
 * ErrorBoundary - React error boundary component
 *
 * Catches rendering errors in child component tree and displays fallback UI.
 * Implements React's error boundary pattern using class component syntax.
 *
 * @see https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';

export interface ErrorBoundaryProps {
  /**
   * Fallback UI to display when an error occurs.
   * Can be a static ReactNode or a function that receives the error and a reset callback.
   */
  fallback: ReactNode | ((error: Error, reset: () => void) => ReactNode);

  /**
   * Child components to render. These will be wrapped in the error boundary.
   */
  children: ReactNode;

  /**
   * Optional callback invoked when an error is caught.
   * Useful for error reporting/logging services.
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * ErrorBoundary component for graceful error handling.
 *
 * @example
 * ```tsx
 * <ErrorBoundary fallback={<div>Something went wrong</div>}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 *
 * @example With reset function
 * ```tsx
 * <ErrorBoundary
 *   fallback={(error, reset) => (
 *     <div>
 *       <p>Error: {error.message}</p>
 *       <button onClick={reset}>Try Again</button>
 *     </div>
 *   )}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  /**
   * Update state when an error is caught.
   * This lifecycle method is called during the "render" phase.
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  /**
   * Log error details after an error is caught.
   * This lifecycle method is called during the "commit" phase.
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console for development/debugging
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    // Invoke optional error reporting callback
    this.props.onError?.(error, errorInfo);
  }

  /**
   * Reset error state to attempt re-rendering children.
   */
  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;

    if (error) {
      const { fallback } = this.props;

      // Render function-based fallback with error and reset
      if (typeof fallback === 'function') {
        return fallback(error, this.reset);
      }

      // Render static fallback
      return fallback;
    }

    // No error - render children normally
    return this.props.children;
  }
}
