/**
 * Test setup for mobile-primitives package
 *
 * Mocks React Native modules for testing in Node environment
 */

import { vi } from 'vitest';

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
vi.mock('react-native', () => ({
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T) => styles,
    hairlineWidth: 1,
  },
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  TouchableOpacity: 'TouchableOpacity',
  Pressable: 'Pressable',
  ActivityIndicator: 'ActivityIndicator',
  RefreshControl: 'RefreshControl',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Modal: 'Modal',
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
    addEventListener: vi.fn((event: string, handler: (typeof dimensionListeners)[0]) => {
      if (event === 'change') {
        dimensionListeners.push(handler);
      }
      return {
        remove: () => {
          const index = dimensionListeners.indexOf(handler);
          if (index > -1) dimensionListeners.splice(index, 1);
        },
      };
    }),
  },
}));

// Mock react-native-gesture-handler
vi.mock('react-native-gesture-handler', () => ({
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
  GestureDetector: 'GestureDetector',
  Pressable: 'Pressable',
}));

// Mock react-native-reanimated
vi.mock('react-native-reanimated', () => ({
  default: {
    View: 'Animated.View',
    Text: 'Animated.Text',
    ScrollView: 'Animated.ScrollView',
  },
  useSharedValue: vi.fn((initialValue) => ({ value: initialValue })),
  useAnimatedStyle: vi.fn((updater) => updater()),
  withSpring: vi.fn((value) => value),
  withTiming: vi.fn((value) => value),
  runOnJS: vi.fn((fn) => fn),
}));

// Mock react-native-safe-area-context
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  SafeAreaProvider: 'SafeAreaProvider',
  useSafeAreaInsets: vi.fn(() => ({
    top: 44,
    right: 0,
    bottom: 34,
    left: 0,
  })),
}));

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
