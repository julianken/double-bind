/**
 * Detox Test Setup
 *
 * Global setup file for Detox E2E tests.
 * Runs before all tests to initialize the test environment.
 *
 * IMPORTANT: This is infrastructure prep. Detox is not installed yet.
 * When Detox is installed, uncomment the actual Detox imports.
 */

/* eslint-disable no-console */

// When Detox is installed, uncomment:
// import { device, element, by, expect as detoxExpect } from 'detox';

beforeAll(async () => {
  console.log('[Detox Setup] Initializing test environment');

  // When Detox is installed, uncomment:
  // await device.launchApp({
  //   newInstance: true,
  //   permissions: { notifications: 'YES' },
  // });
});

beforeEach(async () => {
  console.log('[Detox Setup] Preparing for test');

  // Reset app state before each test
  // When Detox is installed, uncomment:
  // await device.reloadReactNative();
});

afterAll(async () => {
  console.log('[Detox Setup] Cleaning up test environment');

  // When Detox is installed, uncomment:
  // await device.terminateApp();
});

// Export mock matchers for type safety during infrastructure prep
export const mockMatchers = {
  toBeVisible: () => true,
  toExist: () => true,
  toHaveText: (_text: string) => true,
  toHaveValue: (_value: string) => true,
  toBeNotVisible: () => true,
  toNotExist: () => true,
};

// Extend Jest expect with Detox matchers (when Detox is installed)
// This allows TypeScript to recognize Detox-specific assertions

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeVisible(): R;
      toExist(): R;
      toHaveText(text: string): R;
      toHaveValue(value: string): R;
      toBeNotVisible(): R;
      toNotExist(): R;
    }
  }
}
