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
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  RefreshControl: 'RefreshControl',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
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

// Mock react-native-gesture-handler
vi.mock('react-native-gesture-handler', () => ({
  Pressable: 'Pressable',
  GestureDetector: 'GestureDetector',
  Gesture: {
    Tap: () => ({
      numberOfTaps: () => ({ maxDuration: () => ({ onEnd: () => ({}) }) }),
      requireExternalGestureToFail: () => {},
    }),
    LongPress: () => ({
      minDuration: () => ({ maxDistance: () => ({ onEnd: () => ({}) }) }),
    }),
    Exclusive: (...args: unknown[]) => args,
  },
  FlatList: 'FlatList',
}));
