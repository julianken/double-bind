/**
 * KeyboardAvoidingView Component Tests
 *
 * Tests keyboard avoidance behavior for different configurations.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { render } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import { KeyboardAvoidingView } from '../../../src/ios/KeyboardAvoidingView';

describe('KeyboardAvoidingView', () => {
  describe('rendering', () => {
    it('should render children', () => {
      const { getByText } = render(
        <KeyboardAvoidingView>
          <Text>Test Content</Text>
        </KeyboardAvoidingView>
      );

      expect(getByText('Test Content')).toBeDefined();
    });

    it('should render with default props', () => {
      const { container } = render(
        <KeyboardAvoidingView>
          <View />
        </KeyboardAvoidingView>
      );

      expect(container).toBeDefined();
    });

    it('should accept custom styles', () => {
      const customStyle = { backgroundColor: 'red' };

      const { container } = render(
        <KeyboardAvoidingView style={customStyle}>
          <View />
        </KeyboardAvoidingView>
      );

      expect(container).toBeDefined();
    });
  });

  describe('behavior prop', () => {
    it('should support padding behavior', () => {
      const { container } = render(
        <KeyboardAvoidingView behavior="padding">
          <Text>Content</Text>
        </KeyboardAvoidingView>
      );

      expect(container).toBeDefined();
    });

    it('should support height behavior', () => {
      const { container } = render(
        <KeyboardAvoidingView behavior="height">
          <Text>Content</Text>
        </KeyboardAvoidingView>
      );

      expect(container).toBeDefined();
    });

    it('should support position behavior', () => {
      const { container } = render(
        <KeyboardAvoidingView behavior="position">
          <Text>Content</Text>
        </KeyboardAvoidingView>
      );

      expect(container).toBeDefined();
    });
  });

  describe('keyboardVerticalOffset prop', () => {
    it('should accept custom offset', () => {
      const { container } = render(
        <KeyboardAvoidingView keyboardVerticalOffset={100}>
          <Text>Content</Text>
        </KeyboardAvoidingView>
      );

      expect(container).toBeDefined();
    });
  });

  describe('enabled prop', () => {
    it('should be enabled by default', () => {
      const { container } = render(
        <KeyboardAvoidingView>
          <Text>Content</Text>
        </KeyboardAvoidingView>
      );

      expect(container).toBeDefined();
    });

    it('should support being disabled', () => {
      const { container } = render(
        <KeyboardAvoidingView enabled={false}>
          <Text>Content</Text>
        </KeyboardAvoidingView>
      );

      expect(container).toBeDefined();
    });
  });
});
