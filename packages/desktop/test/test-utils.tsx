/**
 * Test utilities for desktop package.
 *
 * Provides helper functions and wrappers for testing React components
 * that use TanStack Query and ServiceProvider.
 */

import { type ReactNode, type ReactElement, type FC, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, type RenderOptions, type RenderResult } from '@testing-library/react';
import { ServiceProvider, type Services } from '../src/providers/ServiceProvider.js';

/**
 * Create a test-specific query client with settings optimized for testing.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Disable retries in tests
        retry: false,
        // Don't stale data in tests - we want fresh data each time
        staleTime: 0,
        // Don't garbage collect during tests
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperProps {
  children: ReactNode;
}

/**
 * Wrapper component that provides QueryClientProvider only.
 * Use when testing components that use useCozoQuery but not useServices.
 */
export function QueryWrapper({ children }: WrapperProps): ReactElement {
  const [queryClient] = useState(() => createTestQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

/**
 * Create a wrapper component that provides both QueryClientProvider and ServiceProvider.
 * Use when testing components that use both useCozoQuery and useServices.
 */
export function createWrapper(services: Services): FC<WrapperProps> {
  return function TestWrapper({ children }: WrapperProps): ReactElement {
    const [queryClient] = useState(() => createTestQueryClient());
    return (
      <QueryClientProvider client={queryClient}>
        <ServiceProvider services={services}>
          {children}
        </ServiceProvider>
      </QueryClientProvider>
    );
  };
}

/**
 * Custom render function that wraps components with QueryClientProvider.
 *
 * @example
 * ```tsx
 * import { renderWithQuery } from '../test-utils';
 *
 * test('my test', () => {
 *   renderWithQuery(<MyComponent />);
 * });
 * ```
 */
export function renderWithQuery(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult {
  return rtlRender(ui, { wrapper: QueryWrapper, ...options });
}

/**
 * Custom render function that wraps components with QueryClientProvider and ServiceProvider.
 *
 * @example
 * ```tsx
 * import { renderWithServices } from '../test-utils';
 *
 * test('my test', () => {
 *   const services = createMockServices();
 *   renderWithServices(<MyComponent />, services);
 * });
 * ```
 */
export function renderWithServices(
  ui: ReactElement,
  services: Services,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult {
  return rtlRender(ui, {
    wrapper: createWrapper(services),
    ...options,
  });
}

// Re-export everything from @testing-library/react for convenience
export * from '@testing-library/react';
