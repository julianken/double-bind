// Jest setup file for React Native
// Add any global test setup here

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }) => children,
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
    Simultaneous: () => ({}),
    Exclusive: () => ({}),
  },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  default: {
    View: ({ children }) => children,
  },
  useSharedValue: (initial) => ({ value: initial }),
  useAnimatedStyle: (fn) => fn(),
  withSpring: (value) => value,
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => ({
  default: ({ children }) => children,
  Svg: ({ children }) => children,
  G: ({ children }) => children,
  Circle: () => null,
  Line: () => null,
  Path: () => null,
  Text: () => null,
}));
