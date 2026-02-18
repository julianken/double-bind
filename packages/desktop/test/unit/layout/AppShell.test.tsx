/**
 * Tests for AppShell layout component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AppShell } from '../../../src/layout/AppShell';
import { useAppStore } from '../../../src/stores/ui-store';

// ============================================================================
// Test Helpers
// ============================================================================

// Reset store to default state before each test
function resetStore() {
  useAppStore.setState({
    sidebarMode: 'open',
    sidebarOpen: true, // derived boolean; keep in sync with sidebarMode
    sidebarWidth: 240,
    rightPanelOpen: false,
    rightPanelContent: null,
  });
}

// Component that throws an error
function ThrowError({ message = 'Test error' }: { message?: string }) {
  throw new Error(message);
}

// ============================================================================
// Tests
// ============================================================================

describe('AppShell', () => {
  // Suppress console.error for cleaner test output
  // eslint-disable-next-line no-console
  const originalError = console.error;
  beforeEach(() => {
    resetStore();
    // eslint-disable-next-line no-console
    console.error = vi.fn();
  });

  afterEach(() => {
    // eslint-disable-next-line no-console
    console.error = originalError;
  });

  describe('Layout Structure', () => {
    it('renders all layout sections', () => {
      render(
        <AppShell
          sidebar={<div>Sidebar Content</div>}
          rightPanel={<div>Right Panel Content</div>}
          statusBar={<div>Status Bar Content</div>}
        >
          <div>Main Content</div>
        </AppShell>
      );

      expect(screen.getByTestId('app-shell')).toBeDefined();
      expect(screen.getByTestId('app-shell-sidebar')).toBeDefined();
      expect(screen.getByTestId('app-shell-main')).toBeDefined();
      expect(screen.getByTestId('app-shell-right-panel')).toBeDefined();
      expect(screen.getByTestId('app-shell-status-bar')).toBeDefined();
    });

    it('renders content in each section', () => {
      render(
        <AppShell
          sidebar={<div>Sidebar Content</div>}
          rightPanel={<div>Right Panel Content</div>}
          statusBar={<div>Status Bar Content</div>}
        >
          <div>Main Content</div>
        </AppShell>
      );

      expect(screen.getByText('Sidebar Content')).toBeDefined();
      expect(screen.getByText('Main Content')).toBeDefined();
      expect(screen.getByText('Right Panel Content')).toBeDefined();
      expect(screen.getByText('Status Bar Content')).toBeDefined();
    });

    it('renders without optional rightPanel', () => {
      render(
        <AppShell sidebar={<div>Sidebar</div>} statusBar={<div>Status</div>}>
          <div>Main</div>
        </AppShell>
      );

      expect(screen.queryByTestId('app-shell-right-panel')).toBeNull();
    });

    it('renders without optional statusBar content', () => {
      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      // Status bar element exists but is empty
      expect(screen.getByTestId('app-shell-status-bar')).toBeDefined();
    });
  });

  describe('Sidebar State', () => {
    it('uses sidebarWidth from store', () => {
      useAppStore.setState({ sidebarWidth: 300 });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const sidebar = screen.getByTestId('app-shell-sidebar');
      expect(sidebar.style.width).toBe('300px');
    });

    it('respects sidebarOpen state', () => {
      useAppStore.setState({ sidebarMode: 'open', sidebarOpen: true, sidebarWidth: 240 });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const sidebar = screen.getByTestId('app-shell-sidebar');
      expect(sidebar.style.width).toBe('240px');
    });

    it('collapses sidebar when sidebarOpen is false', () => {
      useAppStore.setState({ sidebarMode: 'rail', sidebarOpen: false });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const sidebar = screen.getByTestId('app-shell-sidebar');
      expect(sidebar.style.width).toBe('0px');
    });
  });

  describe('Right Panel State', () => {
    it('shows right panel when rightPanelOpen is true', () => {
      useAppStore.setState({ rightPanelOpen: true });

      render(
        <AppShell sidebar={<div>Sidebar</div>} rightPanel={<div>Panel</div>}>
          <div>Main</div>
        </AppShell>
      );

      const rightPanel = screen.getByTestId('app-shell-right-panel');
      expect(rightPanel.style.width).toBe('300px');
      expect(rightPanel.getAttribute('aria-hidden')).toBe('false');
    });

    it('hides right panel when rightPanelOpen is false', () => {
      useAppStore.setState({ rightPanelOpen: false });

      render(
        <AppShell sidebar={<div>Sidebar</div>} rightPanel={<div>Panel</div>}>
          <div>Main</div>
        </AppShell>
      );

      const rightPanel = screen.getByTestId('app-shell-right-panel');
      expect(rightPanel.style.width).toBe('0px');
      expect(rightPanel.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('Error Boundaries', () => {
    it('catches errors in sidebar and shows default fallback', () => {
      render(
        <AppShell sidebar={<ThrowError message="Sidebar crash" />}>
          <div>Main Content</div>
        </AppShell>
      );

      // Main content should still be visible
      expect(screen.getByText('Main Content')).toBeDefined();

      // Sidebar error fallback should be shown
      expect(screen.getByText('Sidebar unavailable')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
    });

    it('catches errors in main content and shows default fallback', () => {
      render(
        <AppShell sidebar={<div>Sidebar Content</div>}>
          <ThrowError message="Main crash" />
        </AppShell>
      );

      // Sidebar should still be visible
      expect(screen.getByText('Sidebar Content')).toBeDefined();

      // Main content error fallback should be shown
      expect(screen.getByText('Failed to load page')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeDefined();
    });

    it('isolates sidebar errors from main content', () => {
      render(
        <AppShell sidebar={<ThrowError />}>
          <div>Main Content Unaffected</div>
        </AppShell>
      );

      expect(screen.getByText('Main Content Unaffected')).toBeDefined();
      expect(screen.getByText('Sidebar unavailable')).toBeDefined();
    });

    it('isolates main content errors from sidebar', () => {
      render(
        <AppShell sidebar={<div>Sidebar Unaffected</div>}>
          <ThrowError />
        </AppShell>
      );

      expect(screen.getByText('Sidebar Unaffected')).toBeDefined();
      expect(screen.getByText('Failed to load page')).toBeDefined();
    });

    it('uses custom sidebar fallback when provided', () => {
      render(
        <AppShell sidebar={<ThrowError />} sidebarFallback={<div>Custom Sidebar Fallback</div>}>
          <div>Main</div>
        </AppShell>
      );

      expect(screen.getByText('Custom Sidebar Fallback')).toBeDefined();
      expect(screen.queryByText('Sidebar unavailable')).toBeNull();
    });

    it('uses custom main content fallback when provided', () => {
      render(
        <AppShell
          sidebar={<div>Sidebar</div>}
          mainContentFallback={<div>Custom Main Fallback</div>}
        >
          <ThrowError />
        </AppShell>
      );

      expect(screen.getByText('Custom Main Fallback')).toBeDefined();
      expect(screen.queryByText('Failed to load page')).toBeNull();
    });

    it('allows retry in sidebar after error', async () => {
      const user = userEvent.setup();
      let shouldThrow = true;

      function SidebarContent() {
        if (shouldThrow) {
          throw new Error('Test');
        }
        return <div>Sidebar Recovered</div>;
      }

      render(
        <AppShell sidebar={<SidebarContent />}>
          <div>Main</div>
        </AppShell>
      );

      // Initially shows error
      expect(screen.getByText('Sidebar unavailable')).toBeDefined();

      // Fix the error and retry
      shouldThrow = false;
      await user.click(screen.getByRole('button', { name: 'Retry' }));

      // Sidebar should recover
      expect(screen.getByText('Sidebar Recovered')).toBeDefined();
    });

    it('allows retry in main content after error', async () => {
      const user = userEvent.setup();
      let shouldThrow = true;

      function MainContent() {
        if (shouldThrow) {
          throw new Error('Test');
        }
        return <div>Main Recovered</div>;
      }

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <MainContent />
        </AppShell>
      );

      // Initially shows error
      expect(screen.getByText('Failed to load page')).toBeDefined();

      // Fix the error and retry
      shouldThrow = false;
      await user.click(screen.getByRole('button', { name: 'Try Again' }));

      // Main content should recover
      expect(screen.getByText('Main Recovered')).toBeDefined();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(
        <AppShell
          sidebar={<div>Sidebar</div>}
          rightPanel={<div>Panel</div>}
          statusBar={<div>Status</div>}
        >
          <div>Main</div>
        </AppShell>
      );

      expect(screen.getByLabelText('Sidebar')).toBeDefined();
      expect(screen.getByLabelText('Main content')).toBeDefined();
      expect(screen.getByLabelText('Right panel')).toBeDefined();
    });

    it('uses semantic HTML elements', () => {
      render(
        <AppShell
          sidebar={<div>Sidebar</div>}
          rightPanel={<div>Panel</div>}
          statusBar={<div>Status</div>}
        >
          <div>Main</div>
        </AppShell>
      );

      // Sidebar uses <aside>
      const sidebar = screen.getByTestId('app-shell-sidebar');
      expect(sidebar.tagName.toLowerCase()).toBe('aside');

      // Main content uses <main>
      const main = screen.getByTestId('app-shell-main');
      expect(main.tagName.toLowerCase()).toBe('main');

      // Right panel uses <aside>
      const rightPanel = screen.getByTestId('app-shell-right-panel');
      expect(rightPanel.tagName.toLowerCase()).toBe('aside');

      // Status bar uses <footer>
      const statusBar = screen.getByTestId('app-shell-status-bar');
      expect(statusBar.tagName.toLowerCase()).toBe('footer');
    });

    it('error fallbacks have proper ARIA roles', () => {
      render(
        <AppShell sidebar={<ThrowError />}>
          <ThrowError />
        </AppShell>
      );

      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBe(2);
    });
  });

  describe('Flexbox Layout', () => {
    it('main content has flex-grow behavior', () => {
      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const main = screen.getByTestId('app-shell-main');
      // Check that flex includes grow value of 1 (may be shorthand like '1 1 0%')
      expect(main.style.flex).toMatch(/^1/);
    });

    it('sidebar has fixed width (no flex-grow)', () => {
      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const sidebar = screen.getByTestId('app-shell-sidebar');
      expect(sidebar.style.flexShrink).toBe('0');
    });

    it('right panel has fixed width (no flex-grow)', () => {
      useAppStore.setState({ rightPanelOpen: true });

      render(
        <AppShell sidebar={<div>Sidebar</div>} rightPanel={<div>Panel</div>}>
          <div>Main</div>
        </AppShell>
      );

      const rightPanel = screen.getByTestId('app-shell-right-panel');
      expect(rightPanel.style.flexShrink).toBe('0');
    });
  });

  describe('Navigation Buttons', () => {
    it('renders navigation toolbar with back/forward buttons', () => {
      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      expect(screen.getByTestId('navigation-bar')).toBeDefined();
      expect(screen.getByTestId('nav-back')).toBeDefined();
      expect(screen.getByTestId('nav-forward')).toBeDefined();
    });

    it('back button is disabled when historyIndex is 0', () => {
      useAppStore.setState({ historyIndex: 0, pageHistory: ['page1'] });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const backButton = screen.getByTestId('nav-back');
      expect(backButton).toBeInstanceOf(HTMLButtonElement);
      expect((backButton as HTMLButtonElement).disabled).toBe(true);
    });

    it('forward button is disabled when at end of history', () => {
      useAppStore.setState({ historyIndex: 0, pageHistory: ['page1'] });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const forwardButton = screen.getByTestId('nav-forward');
      expect(forwardButton).toBeInstanceOf(HTMLButtonElement);
      expect((forwardButton as HTMLButtonElement).disabled).toBe(true);
    });

    it('back button calls goBack when enabled', async () => {
      const user = userEvent.setup();
      useAppStore.setState({
        historyIndex: 1,
        pageHistory: ['page1', 'page2'],
        currentPageId: 'page2',
      });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const backButton = screen.getByTestId('nav-back');
      expect((backButton as HTMLButtonElement).disabled).toBe(false);

      await user.click(backButton);

      // goBack decrements historyIndex
      expect(useAppStore.getState().historyIndex).toBe(0);
      expect(useAppStore.getState().currentPageId).toBe('page1');
    });

    it('forward button calls goForward when enabled', async () => {
      const user = userEvent.setup();
      useAppStore.setState({
        historyIndex: 0,
        pageHistory: ['page1', 'page2'],
        currentPageId: 'page1',
      });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const forwardButton = screen.getByTestId('nav-forward');
      expect((forwardButton as HTMLButtonElement).disabled).toBe(false);

      await user.click(forwardButton);

      // goForward increments historyIndex
      expect(useAppStore.getState().historyIndex).toBe(1);
      expect(useAppStore.getState().currentPageId).toBe('page2');
    });

    it('buttons have correct aria-labels', () => {
      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const backButton = screen.getByTestId('nav-back');
      const forwardButton = screen.getByTestId('nav-forward');

      expect(backButton.getAttribute('aria-label')).toBe('Go back');
      expect(forwardButton.getAttribute('aria-label')).toBe('Go forward');
    });
  });

  describe('Store Integration', () => {
    it('updates when sidebar state changes', () => {
      const { rerender } = render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const sidebar = screen.getByTestId('app-shell-sidebar');
      expect(sidebar.style.width).toBe('240px');

      // Update store
      useAppStore.setState({ sidebarWidth: 320 });

      // Re-render to pick up state change
      rerender(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      expect(sidebar.style.width).toBe('320px');
    });

    it('updates when right panel state changes', () => {
      const { rerender } = render(
        <AppShell sidebar={<div>Sidebar</div>} rightPanel={<div>Panel</div>}>
          <div>Main</div>
        </AppShell>
      );

      const rightPanel = screen.getByTestId('app-shell-right-panel');
      expect(rightPanel.style.width).toBe('0px');

      // Update store
      useAppStore.setState({ rightPanelOpen: true });

      // Re-render to pick up state change
      rerender(
        <AppShell sidebar={<div>Sidebar</div>} rightPanel={<div>Panel</div>}>
          <div>Main</div>
        </AppShell>
      );

      expect(rightPanel.style.width).toBe('300px');
    });
  });
});
