/**
 * Tests for PageTitle component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { PageTitle, type PageTitleProps } from '../../../src/components/PageTitle.js';

// ============================================================================
// Test Setup
// ============================================================================

const defaultProps: PageTitleProps = {
  pageId: 'test-page-id',
  title: 'Test Page Title',
  dailyNoteDate: null,
  onSave: vi.fn().mockResolvedValue(undefined),
  onFocusFirstBlock: vi.fn(),
  debounceMs: 50, // Short debounce for tests
};

function renderPageTitle(props: Partial<PageTitleProps> = {}) {
  return render(<PageTitle {...defaultProps} {...props} />);
}

describe('PageTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  // ==========================================================================
  // Basic Rendering
  // ==========================================================================

  describe('Basic Rendering', () => {
    it('renders as an editable input for regular pages', () => {
      renderPageTitle();

      const input = screen.getByTestId('page-title');
      expect(input.tagName).toBe('INPUT');
      expect(input.getAttribute('data-page-id')).toBe('test-page-id');
      expect(input.getAttribute('data-daily-note')).toBeNull();
    });

    it('renders with correct initial value', () => {
      renderPageTitle({ title: 'My Custom Title' });

      const input = screen.getByTestId('page-title') as HTMLInputElement;
      expect(input.value).toBe('My Custom Title');
    });

    it('renders as a heading for daily notes', () => {
      renderPageTitle({ dailyNoteDate: '2024-01-15' });

      const heading = screen.getByTestId('page-title');
      expect(heading.tagName).toBe('H1');
      expect(heading.getAttribute('data-daily-note')).toBe('true');
    });

    it('formats daily note date correctly', () => {
      renderPageTitle({ dailyNoteDate: '2024-01-15' });

      const heading = screen.getByTestId('page-title');
      // Should contain formatted date parts
      expect(heading.textContent).toContain('January');
      expect(heading.textContent).toContain('15');
      expect(heading.textContent).toContain('2024');
    });

    it('includes day of week in daily note format', () => {
      renderPageTitle({ dailyNoteDate: '2024-01-15' }); // Monday

      const heading = screen.getByTestId('page-title');
      expect(heading.textContent).toContain('Monday');
    });

    it('has correct accessibility attributes', () => {
      renderPageTitle();

      const input = screen.getByTestId('page-title');
      expect(input.getAttribute('aria-label')).toBe('Page title');
    });

    it('shows placeholder when title is empty', () => {
      renderPageTitle({ title: '' });

      const input = screen.getByTestId('page-title');
      expect(input.getAttribute('placeholder')).toBe('Untitled');
    });
  });

  // ==========================================================================
  // Editing Behavior
  // ==========================================================================

  describe('Editing Behavior', () => {
    it('updates local state on input change', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPageTitle();

      const input = screen.getByTestId('page-title') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, 'New Title');

      expect(input.value).toBe('New Title');
    });

    it('does not allow editing daily notes', () => {
      renderPageTitle({ dailyNoteDate: '2024-01-15' });

      const heading = screen.getByTestId('page-title');
      // Daily notes render as h1, not input
      expect(heading.tagName).toBe('H1');
    });
  });

  // ==========================================================================
  // Debounced Saving
  // ==========================================================================

  describe('Debounced Saving', () => {
    it('debounces save calls while typing', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPageTitle({ onSave, debounceMs: 100 });

      const input = screen.getByTestId('page-title') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, 'abc');

      // Should not have called save yet
      expect(onSave).not.toHaveBeenCalled();

      // Advance timers past debounce
      await act(async () => {
        await vi.advanceTimersByTimeAsync(150);
      });

      // Now it should have been called
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith('abc');
    });

    it('resets debounce timer on each keystroke', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPageTitle({ onSave, debounceMs: 100 });

      const input = screen.getByTestId('page-title') as HTMLInputElement;
      await user.clear(input);

      // Type first character
      await user.type(input, 'a');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      // Type second character (resets timer)
      await user.type(input, 'b');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      // Type third character (resets timer again)
      await user.type(input, 'c');

      // Only 50ms after last keystroke - should not have called save
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(onSave).not.toHaveBeenCalled();

      // After full debounce from last keystroke
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith('abc');
    });

    it('does not save if title unchanged', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPageTitle({ title: 'Original', onSave, debounceMs: 50 });

      const input = screen.getByTestId('page-title') as HTMLInputElement;

      // Type same title
      await user.clear(input);
      await user.type(input, 'Original');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Save on Blur
  // ==========================================================================

  describe('Save on Blur', () => {
    it('flushes pending save on blur', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPageTitle({ onSave, debounceMs: 1000 }); // Long debounce

      const input = screen.getByTestId('page-title') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, 'Blurred Title');

      // Should not have called save yet (debounce hasn't elapsed)
      expect(onSave).not.toHaveBeenCalled();

      // Blur the input
      await user.tab();

      // Should have called save immediately
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('Blurred Title');
      });
    });

    it('does not save on blur if no changes', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPageTitle({ title: 'Original', onSave });

      const input = screen.getByTestId('page-title');
      await user.click(input);
      await user.tab(); // Blur without changes

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Save on Enter
  // ==========================================================================

  describe('Save on Enter', () => {
    it('flushes pending save on Enter key', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPageTitle({ onSave, debounceMs: 1000 });

      const input = screen.getByTestId('page-title') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, 'Enter Title');

      expect(onSave).not.toHaveBeenCalled();

      // Press Enter
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('Enter Title');
      });
    });

    it('blurs input after Enter key', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPageTitle();

      const input = screen.getByTestId('page-title') as HTMLInputElement;
      await user.click(input);
      expect(document.activeElement).toBe(input);

      await user.keyboard('{Enter}');

      // Input should no longer be focused
      expect(document.activeElement).not.toBe(input);
    });
  });

  // ==========================================================================
  // Arrow Down Navigation
  // ==========================================================================

  describe('Arrow Down Navigation', () => {
    it('calls onFocusFirstBlock on Down arrow', async () => {
      const onFocusFirstBlock = vi.fn();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPageTitle({ onFocusFirstBlock });

      const input = screen.getByTestId('page-title');
      await user.click(input);
      await user.keyboard('{ArrowDown}');

      expect(onFocusFirstBlock).toHaveBeenCalledTimes(1);
    });

    it('flushes pending save before focusing first block', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const onFocusFirstBlock = vi.fn();
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPageTitle({ onSave, onFocusFirstBlock, debounceMs: 1000 });

      const input = screen.getByTestId('page-title') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, 'Save Before Nav');
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('Save Before Nav');
      });
      expect(onFocusFirstBlock).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Escape Key Behavior
  // ==========================================================================

  describe('Escape Key Behavior', () => {
    it('reverts to last saved title on Escape', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPageTitle({ title: 'Original Title' });

      const input = screen.getByTestId('page-title') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, 'Changed Title');

      expect(input.value).toBe('Changed Title');

      await user.keyboard('{Escape}');

      expect(input.value).toBe('Original Title');
    });

    it('cancels pending save on Escape', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPageTitle({ title: 'Original', onSave, debounceMs: 100 });

      const input = screen.getByTestId('page-title') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, 'Changed');
      await user.keyboard('{Escape}');

      // Wait for debounce to elapse
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      // Should not have saved
      expect(onSave).not.toHaveBeenCalled();
    });

    it('blurs input on Escape', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPageTitle();

      const input = screen.getByTestId('page-title');
      await user.click(input);
      expect(document.activeElement).toBe(input);

      await user.keyboard('{Escape}');

      expect(document.activeElement).not.toBe(input);
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('reverts title on save error', async () => {
      // Suppress the expected error
      const originalConsoleError = console.error;
      console.error = vi.fn();

      const onSave = vi.fn().mockRejectedValue(new Error('Save failed'));
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPageTitle({ title: 'Original', onSave, debounceMs: 50 });

      const input = screen.getByTestId('page-title') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, 'Failed Title');

      // Wait for debounce and save attempt
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should revert to original
      await waitFor(() => {
        expect(input.value).toBe('Original');
      });

      console.error = originalConsoleError;
    });

    it('does not save empty titles', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPageTitle({ title: 'Original', onSave, debounceMs: 50 });

      const input = screen.getByTestId('page-title') as HTMLInputElement;
      await user.clear(input);

      // Trigger a blur to force the save attempt
      await user.tab();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should not have called save for empty title
      expect(onSave).not.toHaveBeenCalled();
    });

    it('does not save whitespace-only titles', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPageTitle({ title: 'Original', onSave, debounceMs: 50 });

      const input = screen.getByTestId('page-title') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, '   ');

      // Trigger save via blur
      await user.tab();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should not have called save for whitespace-only title
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Saving State
  // ==========================================================================

  describe('Saving State', () => {
    it('sets data-saving attribute while saving', async () => {
      let resolvePromise: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      const onSave = vi.fn().mockReturnValue(savePromise);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPageTitle({ onSave, debounceMs: 50 });

      const input = screen.getByTestId('page-title') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, 'Saving...');

      // Trigger save
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should be saving
      expect(input.getAttribute('data-saving')).toBe('true');

      // Complete save
      await act(async () => {
        resolvePromise!();
      });
      await waitFor(() => {
        expect(input.getAttribute('data-saving')).toBe('false');
      });
    });
  });

  // ==========================================================================
  // External Updates
  // ==========================================================================

  describe('External Updates', () => {
    it('updates local state when title prop changes', () => {
      const { rerender } = renderPageTitle({ title: 'Initial' });

      const input = screen.getByTestId('page-title') as HTMLInputElement;
      expect(input.value).toBe('Initial');

      rerender(<PageTitle {...defaultProps} title="Updated Externally" />);

      expect(input.value).toBe('Updated Externally');
    });
  });

  // ==========================================================================
  // Daily Note Edge Cases
  // ==========================================================================

  describe('Daily Note Edge Cases', () => {
    it('handles invalid date format gracefully', () => {
      renderPageTitle({ dailyNoteDate: 'invalid-date' });

      const heading = screen.getByTestId('page-title');
      // Should fall back to showing the raw string
      expect(heading.textContent).toBe('invalid-date');
    });

    it('handles different months correctly', () => {
      renderPageTitle({ dailyNoteDate: '2024-12-25' });

      const heading = screen.getByTestId('page-title');
      expect(heading.textContent).toContain('December');
      expect(heading.textContent).toContain('25');
    });
  });
});
