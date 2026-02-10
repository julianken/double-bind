/**
 * Unit tests for WikiLink component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react-native';
import { WikiLink } from '../../src/WikiLink';

describe('WikiLink', () => {
  describe('Rendering', () => {
    it('should render page title', () => {
      const { getByText } = render(
        <WikiLink
          pageTitle="Project Ideas"
          pageExists={true}
          onPress={vi.fn()}
        />
      );

      expect(getByText('Project Ideas')).toBeDefined();
    });

    it('should render with existing page style', () => {
      const { getByText } = render(
        <WikiLink
          pageTitle="Existing Page"
          pageExists={true}
          onPress={vi.fn()}
        />
      );

      const text = getByText('Existing Page');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({
          color: '#007AFF', // iOS blue
          textDecorationStyle: 'solid',
        })
      );
    });

    it('should render with missing page style', () => {
      const { getByText } = render(
        <WikiLink
          pageTitle="Missing Page"
          pageExists={false}
          onPress={vi.fn()}
        />
      );

      const text = getByText('Missing Page');
      expect(text.props.style).toContainEqual(
        expect.objectContaining({
          color: '#FF3B30', // iOS red
          textDecorationStyle: 'dashed',
        })
      );
    });

    it('should render with testID', () => {
      const { getByTestId } = render(
        <WikiLink
          pageTitle="Test Page"
          pageExists={true}
          onPress={vi.fn()}
          testID="wiki-link"
        />
      );

      expect(getByTestId('wiki-link')).toBeDefined();
    });
  });

  describe('Interaction', () => {
    it('should call onPress with page title when tapped', () => {
      const onPress = vi.fn();
      const { getByText } = render(
        <WikiLink
          pageTitle="Interactive Page"
          pageExists={true}
          onPress={onPress}
        />
      );

      fireEvent.press(getByText('Interactive Page'));
      expect(onPress).toHaveBeenCalledWith('Interactive Page');
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('should call onPress for missing pages', () => {
      const onPress = vi.fn();
      const { getByText } = render(
        <WikiLink
          pageTitle="New Page"
          pageExists={false}
          onPress={onPress}
        />
      );

      fireEvent.press(getByText('New Page'));
      expect(onPress).toHaveBeenCalledWith('New Page');
    });
  });

  describe('Accessibility', () => {
    it('should have link role', () => {
      const { getByRole } = render(
        <WikiLink
          pageTitle="Accessible Page"
          pageExists={true}
          onPress={vi.fn()}
        />
      );

      expect(getByRole('link')).toBeDefined();
    });

    it('should have descriptive label for existing pages', () => {
      const { getByLabelText } = render(
        <WikiLink
          pageTitle="Existing Page"
          pageExists={true}
          onPress={vi.fn()}
        />
      );

      expect(getByLabelText('Link to Existing Page')).toBeDefined();
    });

    it('should have descriptive label for missing pages', () => {
      const { getByLabelText } = render(
        <WikiLink
          pageTitle="Missing Page"
          pageExists={false}
          onPress={vi.fn()}
        />
      );

      expect(getByLabelText('Link to Missing Page (page does not exist)')).toBeDefined();
    });

    it('should have appropriate hint for existing pages', () => {
      const { getByLabelText } = render(
        <WikiLink
          pageTitle="Existing Page"
          pageExists={true}
          onPress={vi.fn()}
        />
      );

      const link = getByLabelText('Link to Existing Page');
      expect(link.props.accessibilityHint).toBe('Navigate to page');
    });

    it('should have appropriate hint for missing pages', () => {
      const { getByLabelText } = render(
        <WikiLink
          pageTitle="Missing Page"
          pageExists={false}
          onPress={vi.fn()}
        />
      );

      const link = getByLabelText('Link to Missing Page (page does not exist)');
      expect(link.props.accessibilityHint).toBe('Create and navigate to page');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty page title', () => {
      const { getByText } = render(
        <WikiLink
          pageTitle=""
          pageExists={false}
          onPress={vi.fn()}
        />
      );

      expect(getByText('')).toBeDefined();
    });

    it('should handle very long page titles', () => {
      const longTitle = 'A'.repeat(200);
      const { getByText } = render(
        <WikiLink
          pageTitle={longTitle}
          pageExists={true}
          onPress={vi.fn()}
        />
      );

      expect(getByText(longTitle)).toBeDefined();
    });

    it('should handle special characters in title', () => {
      const specialTitle = 'Page with [[brackets]] and {{braces}}';
      const { getByText } = render(
        <WikiLink
          pageTitle={specialTitle}
          pageExists={true}
          onPress={vi.fn()}
        />
      );

      expect(getByText(specialTitle)).toBeDefined();
    });
  });
});
