/**
 * Tests for AppShell layout component.
 *
 * Note: Navigation back/forward buttons have moved to AppToolbar (DBB-442).
 * A stub AppToolbar lives in this branch for test compatibility; the full
 * implementation will replace it when DBB-442 merges.
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
    rightPanelWidth: 300,
    windowFocused: true,
    focusModeActive: false,
    typewriterEnabled: false,
    blockDimmingEnabled: false,
    saveState: 'idle',
    blockCount: null,
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
        <AppShell sidebar={<div>Sidebar Content</div>}>
          <div>Main Content</div>
        </AppShell>
      );

      expect(screen.getByTestId('app-shell')).toBeDefined();
      expect(screen.getByTestId('app-shell-sidebar')).toBeDefined();
      expect(screen.getByTestId('app-shell-main')).toBeDefined();
      expect(screen.getByTestId('app-shell-status-bar')).toBeDefined();
    });

    it('renders content in each section', () => {
      render(
        <AppShell sidebar={<div>Sidebar Content</div>}>
          <div>Main Content</div>
        </AppShell>
      );

      expect(screen.getByText('Sidebar Content')).toBeDefined();
      expect(screen.getByText('Main Content')).toBeDefined();
    });

    it('always renders navigation bar via AppToolbar', () => {
      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      expect(screen.getByTestId('navigation-bar')).toBeDefined();
    });

    it('always renders status bar', () => {
      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      expect(screen.getByTestId('app-shell-status-bar')).toBeDefined();
    });
  });

  describe('Sidebar State', () => {
    it('uses sidebarWidth from store when mode is open', () => {
      useAppStore.setState({ sidebarMode: 'open', sidebarWidth: 300 });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const sidebar = screen.getByTestId('app-shell-sidebar');
      expect(sidebar.style.width).toBe('300px');
    });

    it('respects sidebarMode=open state', () => {
      useAppStore.setState({ sidebarMode: 'open', sidebarOpen: true, sidebarWidth: 240 });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const sidebar = screen.getByTestId('app-shell-sidebar');
      expect(sidebar.style.width).toBe('240px');
    });

    it('collapses sidebar when sidebarMode is closed', () => {
      useAppStore.setState({ sidebarMode: 'closed', sidebarOpen: false });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const sidebar = screen.getByTestId('app-shell-sidebar');
      // No inline style applied for closed mode — CSS class handles it
      expect(sidebar.getAttribute('data-sidebar-mode')).toBe('closed');
    });

    it('sets data-sidebar-mode=rail when sidebarMode is rail', () => {
      useAppStore.setState({ sidebarMode: 'rail', sidebarOpen: false });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const sidebar = screen.getByTestId('app-shell-sidebar');
      expect(sidebar.getAttribute('data-sidebar-mode')).toBe('rail');
      expect(sidebar.style.width).toBe('48px');
    });

    it('sets data-sidebar-mode attribute reflecting current mode', () => {
      useAppStore.setState({ sidebarMode: 'open', sidebarWidth: 240 });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const sidebar = screen.getByTestId('app-shell-sidebar');
      expect(sidebar.getAttribute('data-sidebar-mode')).toBe('open');
    });
  });

  describe('Right Panel State', () => {
    it('shows right panel when rightPanelOpen is true', () => {
      useAppStore.setState({ rightPanelOpen: true, rightPanelWidth: 300 });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
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
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const rightPanel = screen.getByTestId('app-shell-right-panel');
      expect(rightPanel.style.width).toBe('');
      expect(rightPanel.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('Data Attributes', () => {
    it('sets data-window-focused=true when window is focused', () => {
      useAppStore.setState({ windowFocused: true });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const container = screen.getByTestId('app-shell');
      expect(container.getAttribute('data-window-focused')).toBe('true');
    });

    it('sets data-window-focused=false when window is not focused', () => {
      useAppStore.setState({ windowFocused: false });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const container = screen.getByTestId('app-shell');
      expect(container.getAttribute('data-window-focused')).toBe('false');
    });

    it('sets data-sidebar-mode on sidebar aside', () => {
      useAppStore.setState({ sidebarMode: 'open' });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const sidebar = screen.getByTestId('app-shell-sidebar');
      expect(sidebar.getAttribute('data-sidebar-mode')).toBe('open');
    });

    it('does not set data-focus-mode when focus mode is inactive', () => {
      useAppStore.setState({ focusModeActive: false, typewriterEnabled: false, blockDimmingEnabled: false });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const main = screen.getByTestId('app-shell-main');
      // data-focus-mode should be absent when all flags are off
      expect(main.getAttribute('data-focus-mode')).toBeNull();
    });

    it('sets data-focus-mode=active when focusModeActive is true', () => {
      useAppStore.setState({ focusModeActive: true, typewriterEnabled: false, blockDimmingEnabled: false });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const main = screen.getByTestId('app-shell-main');
      expect(main.getAttribute('data-focus-mode')).toBe('active');
    });

    it('combines multiple focus-mode flags in data-focus-mode', () => {
      useAppStore.setState({ focusModeActive: true, typewriterEnabled: true, blockDimmingEnabled: true });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const main = screen.getByTestId('app-shell-main');
      expect(main.getAttribute('data-focus-mode')).toBe('active typewriter dim');
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
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      expect(screen.getByLabelText('Sidebar')).toBeDefined();
      expect(screen.getByLabelText('Main content')).toBeDefined();
      expect(screen.getByLabelText('Right panel')).toBeDefined();
    });

    it('uses semantic HTML elements', () => {
      render(
        <AppShell sidebar={<div>Sidebar</div>}>
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
    // CSS module class-based flex properties are not computed by jsdom.
    // These tests verify the correct elements are used (semantic HTML),
    // which ensures the CSS classes have the correct targets.

    it('main content element is present for flex layout', () => {
      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const main = screen.getByTestId('app-shell-main');
      expect(main.tagName.toLowerCase()).toBe('main');
    });

    it('sidebar element is an aside for flex layout', () => {
      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const sidebar = screen.getByTestId('app-shell-sidebar');
      expect(sidebar.tagName.toLowerCase()).toBe('aside');
    });

    it('right panel element is present when open', () => {
      useAppStore.setState({ rightPanelOpen: true, rightPanelWidth: 300 });

      render(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const rightPanel = screen.getByTestId('app-shell-right-panel');
      expect(rightPanel.tagName.toLowerCase()).toBe('aside');
      // Width comes from inline style when open
      expect(rightPanel.style.width).toBe('300px');
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
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      const rightPanel = screen.getByTestId('app-shell-right-panel');
      // closed: no inline style
      expect(rightPanel.style.width).toBe('');

      // Update store
      useAppStore.setState({ rightPanelOpen: true, rightPanelWidth: 300 });

      // Re-render to pick up state change
      rerender(
        <AppShell sidebar={<div>Sidebar</div>}>
          <div>Main</div>
        </AppShell>
      );

      expect(rightPanel.style.width).toBe('300px');
    });
  });
});
