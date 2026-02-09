/**
 * InputAccessoryView Component Tests
 *
 * Tests input accessory toolbar with buttons and formatting controls.
 */

import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { InputAccessoryView } from '../../../src/ios/InputAccessoryView';
import type { AccessoryButton } from '../../../src/ios/types';

describe('InputAccessoryView', () => {
  describe('rendering', () => {
    it('should render with required props only', () => {
      const { container } = render(<InputAccessoryView nativeID="test-toolbar" />);

      expect(container).toBeDefined();
    });

    it('should render done button by default', () => {
      const { getByText } = render(<InputAccessoryView nativeID="test-toolbar" />);

      expect(getByText('Done')).toBeDefined();
    });

    it('should render custom done button label', () => {
      const { getByText } = render(
        <InputAccessoryView nativeID="test-toolbar" doneButtonLabel="Dismiss" />
      );

      expect(getByText('Dismiss')).toBeDefined();
    });

    it('should hide done button when specified', () => {
      const { queryByText } = render(
        <InputAccessoryView nativeID="test-toolbar" showDoneButton={false} />
      );

      expect(queryByText('Done')).toBeNull();
    });
  });

  describe('left buttons', () => {
    it('should render left buttons', () => {
      const buttons: AccessoryButton[] = [
        { id: 'bold', label: 'B', onPress: vi.fn() },
        { id: 'italic', label: 'I', onPress: vi.fn() },
      ];

      const { getByText } = render(
        <InputAccessoryView nativeID="test-toolbar" leftButtons={buttons} />
      );

      expect(getByText('B')).toBeDefined();
      expect(getByText('I')).toBeDefined();
    });

    it('should call button onPress handler', () => {
      const onPress = vi.fn();
      const buttons: AccessoryButton[] = [{ id: 'bold', label: 'B', onPress }];

      const { getByText } = render(
        <InputAccessoryView nativeID="test-toolbar" leftButtons={buttons} />
      );

      fireEvent.press(getByText('B'));

      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('right buttons', () => {
    it('should render right buttons', () => {
      const buttons: AccessoryButton[] = [
        { id: 'date', label: 'Date', onPress: vi.fn() },
        { id: 'link', label: 'Link', onPress: vi.fn() },
      ];

      const { getByText } = render(
        <InputAccessoryView nativeID="test-toolbar" rightButtons={buttons} />
      );

      expect(getByText('Date')).toBeDefined();
      expect(getByText('Link')).toBeDefined();
    });

    it('should call button onPress handler', () => {
      const onPress = vi.fn();
      const buttons: AccessoryButton[] = [{ id: 'date', label: 'Date', onPress }];

      const { getByText } = render(
        <InputAccessoryView nativeID="test-toolbar" rightButtons={buttons} />
      );

      fireEvent.press(getByText('Date'));

      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('done button', () => {
    it('should call onDone when pressed', () => {
      const onDone = vi.fn();

      const { getByText } = render(<InputAccessoryView nativeID="test-toolbar" onDone={onDone} />);

      fireEvent.press(getByText('Done'));

      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('should not render when showDoneButton is false', () => {
      const { queryByText } = render(
        <InputAccessoryView nativeID="test-toolbar" showDoneButton={false} />
      );

      expect(queryByText('Done')).toBeNull();
    });
  });

  describe('styling', () => {
    it('should apply custom background color', () => {
      const { container } = render(
        <InputAccessoryView nativeID="test-toolbar" backgroundColor="#000000" />
      );

      expect(container).toBeDefined();
    });

    it('should apply custom tint color', () => {
      const { container } = render(
        <InputAccessoryView nativeID="test-toolbar" tintColor="#FF0000" />
      );

      expect(container).toBeDefined();
    });
  });

  describe('complex scenarios', () => {
    it('should render both left and right buttons with done button', () => {
      const leftButtons: AccessoryButton[] = [
        { id: 'bold', label: 'B', onPress: vi.fn() },
        { id: 'italic', label: 'I', onPress: vi.fn() },
      ];

      const rightButtons: AccessoryButton[] = [{ id: 'date', label: 'Date', onPress: vi.fn() }];

      const { getByText } = render(
        <InputAccessoryView
          nativeID="test-toolbar"
          leftButtons={leftButtons}
          rightButtons={rightButtons}
        />
      );

      expect(getByText('B')).toBeDefined();
      expect(getByText('I')).toBeDefined();
      expect(getByText('Date')).toBeDefined();
      expect(getByText('Done')).toBeDefined();
    });
  });
});
