/**
 * Test setup for mobile-app package.
 *
 * Configures jsdom and mocks React Native modules.
 */

import { vi } from 'vitest';

// Mock react-native
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-native')>();
  return {
    ...actual,
    Platform: {
      OS: 'ios',
      select: vi.fn((obj) => obj.ios || obj.default),
    },
    StyleSheet: {
      create: (styles: any) => styles,
    },
    View: 'View',
    Text: 'Text',
    TouchableOpacity: 'TouchableOpacity',
    useWindowDimensions: vi.fn(() => ({ width: 375, height: 667 })),
  };
});

// Mock @double-bind/mobile
vi.mock('@double-bind/mobile', () => ({
  MobileGraphDB: vi.fn().mockImplementation(() => ({
    query: vi.fn(),
    mutate: vi.fn(),
    close: vi.fn(),
  })),
  CozoNativeModule: {
    createDatabase: vi.fn(),
  },
}));

// Mock react-native-webview
vi.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));

// Mock react-native-gesture-handler
vi.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: vi.fn(() => ({
      onUpdate: vi.fn().mockReturnThis(),
      onEnd: vi.fn().mockReturnThis(),
    })),
    Pinch: vi.fn(() => ({
      onUpdate: vi.fn().mockReturnThis(),
      onEnd: vi.fn().mockReturnThis(),
    })),
    Tap: vi.fn(() => ({
      numberOfTaps: vi.fn().mockReturnThis(),
      onEnd: vi.fn().mockReturnThis(),
    })),
    Exclusive: vi.fn((a, b) => ({ a, b })),
    Simultaneous: vi.fn((a, b) => ({ a, b })),
  },
  GestureDetector: 'GestureDetector',
}));

// Mock react-native-reanimated
vi.mock('react-native-reanimated', () => ({
  default: {
    View: 'Animated.View',
  },
  useSharedValue: vi.fn((initial) => ({ value: initial })),
  useAnimatedStyle: vi.fn((fn) => fn()),
  withSpring: vi.fn((value) => value),
  runOnJS: vi.fn((fn) => fn),
}));

// Mock react-native-svg
vi.mock('react-native-svg', () => ({
  Svg: 'Svg',
  G: 'G',
  Circle: 'Circle',
  Text: 'Text',
  Line: 'Line',
  Defs: 'Defs',
  Marker: 'Marker',
  Path: 'Path',
}));
