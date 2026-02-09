/**
 * Test setup for mobile-app package.
 *
 * Configures jsdom and mocks React Native modules.
 */

import { vi } from 'vitest';

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

// Mock react-native
vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (obj: Record<string, unknown>) => obj.ios || obj.default,
  },
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    currentState: 'active',
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
}));

// Mock react-native-webview
vi.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));
