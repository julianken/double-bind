/**
 * Test setup for mobile-primitives
 *
 * Mocks React Native modules for Vitest environment.
 */

import { vi } from 'vitest';

// Mock React Native core modules
vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T): T => styles,
  },
  Pressable: 'Pressable',
  FlatList: 'FlatList',
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    removeEventListener: vi.fn(),
  },
  Platform: {
    OS: 'ios',
    select: <T>(obj: { ios?: T; android?: T; default?: T }) => obj.ios ?? obj.default,
  },
  AccessibilityInfo: {
    isScreenReaderEnabled: vi.fn(() => Promise.resolve(false)),
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

// Mock react-native-gesture-handler
vi.mock('react-native-gesture-handler', () => ({
  Pressable: 'Pressable',
  Gesture: {
    Tap: vi.fn(() => ({
      numberOfTaps: vi.fn().mockReturnThis(),
      maxDuration: vi.fn().mockReturnThis(),
      onStart: vi.fn().mockReturnThis(),
      onEnd: vi.fn().mockReturnThis(),
      requireExternalGestureToFail: vi.fn().mockReturnThis(),
    })),
    LongPress: vi.fn(() => ({
      minDuration: vi.fn().mockReturnThis(),
      maxDistance: vi.fn().mockReturnThis(),
      numberOfPointers: vi.fn().mockReturnThis(),
      onStart: vi.fn().mockReturnThis(),
      onEnd: vi.fn().mockReturnThis(),
      onFinalize: vi.fn().mockReturnThis(),
    })),
    Exclusive: vi.fn((...gestures) => gestures),
  },
  GestureDetector: 'GestureDetector',
}));
