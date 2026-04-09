/**
 * Unit tests for NewPageButton component
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { NewPageButton } from '../../../src/components/NewPageButton.js';
import { ServiceProvider, type Services } from '../../../src/providers/ServiceProvider.js';
import { useAppStore } from '../../../src/stores/ui-store.js';
import { clearQueryCache } from '../../../src/hooks/useCozoQuery.js';
import type { PageService, BlockService } from '@double-bind/core';
import type { Page } from '@double-bind/types';

// Create a QueryClient for testing
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });

// ============================================================================
// Mocks
// ============================================================================

const mockPage: Page = {
  pageId: 'test-page-id-123',
  title: 'Untitled',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isDeleted: false,
  dailyNoteDate: null,
};

const createMockPageService = () => ({
  createPage: vi.fn().mockResolvedValue(mockPage),
  getAllPages: vi.fn().mockResolvedValue([]),
  getPageWithBlocks: vi.fn(),
  deletePage: vi.fn(),
  getTodaysDailyNote: vi.fn(),
  searchPages: vi.fn(),
});

const mockBlockService = {} as BlockService;

// ============================================================================
// Test Setup
// ============================================================================

function createWrapper(pageService: Partial<PageService>) {
  const services: Services = {
    pageService: pageService as PageService,
    blockService: mockBlockService,
  };

  return function Wrapper({ children }: { children: ReactNode }) {
    const queryClient = createTestQueryClient();
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ServiceProvider, { services }, children)
    );
  };
}

function renderWithProvider(
  ui: React.ReactElement,
  pageService: Partial<PageService> = createMockPageService()
) {
  const Wrapper = createWrapper(pageService);
  return render(createElement(Wrapper, null, ui));
}

describe('NewPageButton', () => {
  let mockPageService: ReturnType<typeof createMockPageService>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearQueryCache();

    // Reset store state
    useAppStore.setState({
      currentPageId: null,
      pageHistory: [],
      historyIndex: -1,
    });

    mockPageService = createMockPageService();
  });

  afterEach(() => {
    cleanup();
    clearQueryCache();
  });

  // ============================================================================
  // Rendering
  // ============================================================================

  describe('Rendering', () => {
    it('renders with default label', () => {
      renderWithProvider(<NewPageButton />, mockPageService);

      expect(screen.getByRole('button', { name: 'New Page' })).toBeDefined();
    });

    it('renders with custom label', () => {
      renderWithProvider(<NewPageButton label="Create Page" />, mockPageService);

      expect(screen.getByRole('button', { name: 'Create Page' })).toBeDefined();
    });

    it('renders with custom className', () => {
      renderWithProvider(<NewPageButton className="custom-class" />, mockPageService);

      const button = screen.getByTestId('new-page-button');
      expect(button.className).toContain('custom-class');
    });

    it('has data-testid for testing', () => {
      renderWithProvider(<NewPageButton />, mockPageService);

      expect(screen.getByTestId('new-page-button')).toBeDefined();
    });
  });

  // ============================================================================
  // Click Behavior
  // ============================================================================

  describe('Click Behavior', () => {
    it('calls pageService.createPage when clicked', async () => {
      renderWithProvider(<NewPageButton />, mockPageService);

      const button = screen.getByRole('button', { name: 'New Page' });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockPageService.createPage).toHaveBeenCalledTimes(1);
      });
    });

    it('navigates to new page after creation', async () => {
      renderWithProvider(<NewPageButton />, mockPageService);

      const button = screen.getByRole('button', { name: 'New Page' });
      fireEvent.click(button);

      await waitFor(() => {
        const storeState = useAppStore.getState();
        // currentPageId stores the full route path, not just the ID
        expect(storeState.currentPageId).toBe(`page/${mockPage.pageId}`);
      });
    });
  });

  // ============================================================================
  // Loading State
  // ============================================================================

  describe('Loading State', () => {
    it('shows "Creating..." while creating', async () => {
      let resolveCreate: ((page: Page) => void) | null = null;
      mockPageService.createPage.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          })
      );

      renderWithProvider(<NewPageButton />, mockPageService);

      const button = screen.getByRole('button', { name: 'New Page' });
      fireEvent.click(button);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Creating...' })).toBeDefined();
      });

      // Resolve the promise
      resolveCreate?.(mockPage);

      // Should return to normal state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'New Page' })).toBeDefined();
      });
    });

    it('is disabled while creating', async () => {
      let resolveCreate: ((page: Page) => void) | null = null;
      mockPageService.createPage.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          })
      );

      renderWithProvider(<NewPageButton />, mockPageService);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Should be disabled
      await waitFor(() => {
        expect(button).toHaveProperty('disabled', true);
      });

      // Resolve the promise
      resolveCreate?.(mockPage);

      // Should be enabled again
      await waitFor(() => {
        expect(button).toHaveProperty('disabled', false);
      });
    });

    it('has aria-busy while creating', async () => {
      let resolveCreate: ((page: Page) => void) | null = null;
      mockPageService.createPage.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          })
      );

      renderWithProvider(<NewPageButton />, mockPageService);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Should have aria-busy
      await waitFor(() => {
        expect(button.getAttribute('aria-busy')).toBe('true');
      });

      // Resolve the promise
      resolveCreate?.(mockPage);

      // Should not have aria-busy
      await waitFor(() => {
        expect(button.getAttribute('aria-busy')).toBe('false');
      });
    });
  });

  // ============================================================================
  // Callbacks
  // ============================================================================

  describe('Callbacks', () => {
    it('calls onSuccess after successful creation', async () => {
      const onSuccess = vi.fn();
      renderWithProvider(<NewPageButton onSuccess={onSuccess} />, mockPageService);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('calls onError when creation fails', async () => {
      const error = new Error('Creation failed');
      mockPageService.createPage.mockRejectedValue(error);

      const onError = vi.fn();
      renderWithProvider(<NewPageButton onError={onError} />, mockPageService);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(error);
      });
    });

    it('does not call onSuccess when creation fails', async () => {
      mockPageService.createPage.mockRejectedValue(new Error('Failed'));

      const onSuccess = vi.fn();
      renderWithProvider(<NewPageButton onSuccess={onSuccess} />, mockPageService);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockPageService.createPage).toHaveBeenCalled();
      });

      // Give time for any erroneous callback
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('does not call onError when creation succeeds', async () => {
      const onError = vi.fn();
      renderWithProvider(<NewPageButton onError={onError} />, mockPageService);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockPageService.createPage).toHaveBeenCalled();
      });

      // Give time for any erroneous callback
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onError).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Multiple Clicks
  // ============================================================================

  describe('Multiple Clicks', () => {
    it('allows sequential creations after completion', async () => {
      renderWithProvider(<NewPageButton />, mockPageService);

      const button = screen.getByRole('button');

      // First click
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockPageService.createPage).toHaveBeenCalledTimes(1);
      });

      // Wait for completion
      await waitFor(() => {
        expect(button).toHaveProperty('disabled', false);
      });

      // Second click
      mockPageService.createPage.mockResolvedValue({ ...mockPage, pageId: 'page-2' });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockPageService.createPage).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ============================================================================
  // Accessibility
  // ============================================================================

  describe('Accessibility', () => {
    it('is a button element', () => {
      renderWithProvider(<NewPageButton />, mockPageService);

      const button = screen.getByTestId('new-page-button');
      expect(button.tagName).toBe('BUTTON');
    });

    it('has type="button" to prevent form submission', () => {
      renderWithProvider(<NewPageButton />, mockPageService);

      const button = screen.getByTestId('new-page-button');
      expect(button.getAttribute('type')).toBe('button');
    });

    it('can be focused', () => {
      renderWithProvider(<NewPageButton />, mockPageService);

      const button = screen.getByTestId('new-page-button');
      button.focus();

      expect(document.activeElement).toBe(button);
    });
  });
});
