/**
 * Test setup for mobile-primitives package
 *
 * Mocks React Native modules for testing in Node environment
 */

import { vi } from 'vitest';

// Mock component factory - used across all React Native mocks
const createMockComponent = (name: string) => {
  const Component = (props: { children?: React.ReactNode }) => {
    // Mock component that passes through children
    return props.children;
  };
  Component.displayName = name;
  return Component;
};

// Store dimension change listeners for testing
export const dimensionListeners: Array<
  (event: {
    window: { width: number; height: number };
    screen: { width: number; height: number };
  }) => void
> = [];

// Default dimensions (iPhone 14 Pro)
let mockDimensions = { width: 375, height: 812, scale: 3, fontScale: 1 };

// Reset function for tests
export function resetMockDimensions(
  dimensions = { width: 375, height: 812, scale: 3, fontScale: 1 }
) {
  mockDimensions = dimensions;
  dimensionListeners.length = 0;
}

// Simulate dimension change
export function simulateDimensionChange(width: number, height: number) {
  mockDimensions = { ...mockDimensions, width, height };
  dimensionListeners.forEach((listener) => {
    listener({
      window: { width, height },
      screen: { width, height },
    });
  });
}

// Mock React Native
vi.mock('react-native', () => {
  return {
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
      hairlineWidth: 1,
    },
    View: createMockComponent('View'),
    Text: createMockComponent('Text'),
    TextInput: createMockComponent('TextInput'),
    ScrollView: createMockComponent('ScrollView'),
    FlatList: createMockComponent('FlatList'),
    TouchableOpacity: createMockComponent('TouchableOpacity'),
    Pressable: createMockComponent('Pressable'),
    ActivityIndicator: createMockComponent('ActivityIndicator'),
    RefreshControl: createMockComponent('RefreshControl'),
    KeyboardAvoidingView: createMockComponent('KeyboardAvoidingView'),
    InputAccessoryView: createMockComponent('InputAccessoryView'),
    Modal: createMockComponent('Modal'),
    Keyboard: {
      dismiss: vi.fn(),
      addListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    Platform: {
      OS: 'ios',
      select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
    },
    Dimensions: {
      get: vi.fn(() => mockDimensions),
      addEventListener: vi.fn(
        (
          event: string,
          handler: (event: {
            window: { width: number; height: number };
            screen: { width: number; height: number };
          }) => void
        ) => {
          if (event === 'change') {
            dimensionListeners.push(handler);
          }
          return {
            remove: () => {
              const index = dimensionListeners.indexOf(handler);
              if (index > -1) dimensionListeners.splice(index, 1);
            },
          };
        }
      ),
    },
  };
});

// Mock react-native-gesture-handler
vi.mock('react-native-gesture-handler', () => {
  return {
    Gesture: {
      Tap: vi.fn(() => ({
        numberOfTaps: vi.fn().mockReturnThis(),
        maxDuration: vi.fn().mockReturnThis(),
        onEnd: vi.fn().mockReturnThis(),
        requireExternalGestureToFail: vi.fn().mockReturnThis(),
      })),
      LongPress: vi.fn(() => ({
        minDuration: vi.fn().mockReturnThis(),
        maxDistance: vi.fn().mockReturnThis(),
        onEnd: vi.fn().mockReturnThis(),
      })),
      Pan: vi.fn(() => ({
        activeOffsetX: vi.fn().mockReturnThis(),
        onUpdate: vi.fn().mockReturnThis(),
        onEnd: vi.fn().mockReturnThis(),
      })),
      Exclusive: vi.fn((...gestures) => gestures),
    },
    GestureDetector: createMockComponent('GestureDetector'),
    Pressable: createMockComponent('Pressable'),
  };
});

// Mock react-native-reanimated
vi.mock('react-native-reanimated', () => {
  return {
    default: {
      View: createMockComponent('Animated.View'),
      Text: createMockComponent('Animated.Text'),
      ScrollView: createMockComponent('Animated.ScrollView'),
    },
    useSharedValue: vi.fn((initialValue) => ({ value: initialValue })),
    useAnimatedStyle: vi.fn((updater) => updater()),
    withSpring: vi.fn((value) => value),
    withTiming: vi.fn((value) => value),
    runOnJS: vi.fn((fn) => fn),
  };
});

// Mock react-native-safe-area-context
vi.mock('react-native-safe-area-context', () => {
  return {
    SafeAreaView: createMockComponent('SafeAreaView'),
    SafeAreaProvider: createMockComponent('SafeAreaProvider'),
    useSafeAreaInsets: vi.fn(() => ({
      top: 44,
      right: 0,
      bottom: 34,
      left: 0,
    })),
  };
});

// Mock @double-bind/core parseContent function
vi.mock('@double-bind/core', () => ({
  parseContent: vi.fn((content: string) => {
    // Simple mock implementation that extracts page links
    const pageLinks: Array<{ title: string; startIndex: number; endIndex: number }> = [];
    const linkPattern = /\[\[([^\]]+)\]\]/g;
    let match;

    while ((match = linkPattern.exec(content)) !== null) {
      pageLinks.push({
        title: match[1]!,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    return {
      pageLinks,
      blockRefs: [],
      tags: [],
      properties: [],
    };
  }),
}));
