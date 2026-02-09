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

// Mock react-native-webview
vi.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));
