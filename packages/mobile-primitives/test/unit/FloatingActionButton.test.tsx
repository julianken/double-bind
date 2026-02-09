/**
 * FloatingActionButton.spec.tsx - Tests for FloatingActionButton component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react-native';
import { FloatingActionButton } from '../../src/FloatingActionButton';

describe('FloatingActionButton', () => {
  it('should render with icon', () => {
    const { getByText } = render(
      <FloatingActionButton icon="+" onPress={() => {}} accessibilityLabel="Create" />
    );

    expect(getByText('+')).toBeTruthy();
  });

  it('should call onPress when pressed', () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      <FloatingActionButton icon="+" onPress={onPress} accessibilityLabel="Create" testID="fab" />
    );

    fireEvent.press(getByTestId('fab'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('should not call onPress when disabled', () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      <FloatingActionButton
        icon="+"
        onPress={onPress}
        accessibilityLabel="Create"
        disabled
        testID="fab"
      />
    );

    fireEvent.press(getByTestId('fab'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('should have correct accessibility properties', () => {
    const { getByTestId } = render(
      <FloatingActionButton
        icon="+"
        onPress={() => {}}
        accessibilityLabel="Create new page"
        testID="fab"
      />
    );

    const fab = getByTestId('fab');
    expect(fab.props.accessibilityRole).toBe('button');
    expect(fab.props.accessibilityLabel).toBe('Create new page');
  });

  it('should apply custom style', () => {
    const customStyle = { bottom: 100 };
    const { getByTestId } = render(
      <FloatingActionButton
        icon="+"
        onPress={() => {}}
        accessibilityLabel="Create"
        style={customStyle}
        testID="fab"
      />
    );

    const fab = getByTestId('fab');
    expect(fab.props.style).toEqual(expect.arrayContaining([expect.objectContaining(customStyle)]));
  });

  it('should render different icons', () => {
    const { getByText } = render(
      <FloatingActionButton icon="✎" onPress={() => {}} accessibilityLabel="Edit" />
    );

    expect(getByText('✎')).toBeTruthy();
  });
});
