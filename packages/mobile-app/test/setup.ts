/**
 * Test setup for mobile-app package.
 *
 * Configures mocks for React Native modules used in testing.
 */

import { vi } from 'vitest';

// Mock react-native-gesture-handler
vi.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  Gesture: {
    Pan: () => ({
      averageTouches: () => ({
        onUpdate: () => ({
          onEnd: () => ({}),
        }),
      }),
    }),
    Pinch: () => ({
      onUpdate: () => ({
        onEnd: () => ({}),
      }),
    }),
    Tap: () => ({
      numberOfTaps: () => ({
        onEnd: () => ({}),
      }),
    }),
    Simultaneous: (..._gestures: unknown[]) => ({}),
    Exclusive: (..._gestures: unknown[]) => ({}),
  },
}));

// Mock react-native-reanimated
vi.mock('react-native-reanimated', () => ({
  default: {
    View: ({ children }: { children: React.ReactNode }) => children,
  },
  useSharedValue: <T>(initial: T) => ({ value: initial }),
  useAnimatedStyle: (fn: () => object) => fn(),
  withSpring: <T>(value: T) => value,
}));

// Mock react-native-svg
vi.mock('react-native-svg', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
  Svg: ({ children }: { children: React.ReactNode }) => children,
  G: ({ children }: { children: React.ReactNode }) => children,
  Circle: () => null,
  Line: () => null,
  Path: () => null,
  Text: () => null,
}));

// Mock react-native modules
vi.mock('react-native', async () => {
  const actual = await vi.importActual('react-native');
  return {
    ...(actual as object),
    Platform: {
      OS: 'ios',
      select: (obj: { ios?: unknown; android?: unknown }) => obj.ios,
    },
    AppState: {
      currentState: 'active',
      addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    View: ({ children }: { children: React.ReactNode }) => children,
    Text: ({ children }: { children: React.ReactNode }) => children,
    StyleSheet: {
      create: (styles: object) => styles,
    },
    useWindowDimensions: () => ({ width: 375, height: 812 }),
  };
});
