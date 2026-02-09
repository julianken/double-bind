/**
 * Mobile E2E Test Helpers
 *
 * Provides utilities for mobile E2E testing with Detox.
 * These helpers are designed to work with React Native Testing Library and Detox API.
 *
 * IMPORTANT: This is infrastructure prep. Detox is not installed yet.
 * When ready to implement:
 * 1. Install: pnpm add -D detox @types/detox detox-expo-helpers
 * 2. Configure iOS/Android projects with Detox dependencies
 * 3. Run: detox build -c ios.sim.debug
 * 4. Run: detox test -c ios.sim.debug
 *
 * @see https://wix.github.io/Detox/docs/introduction/getting-started
 */

/* eslint-disable no-console */

/**
 * Mock Detox element interface for type safety during infrastructure prep.
 * Replace with actual Detox types when Detox is installed.
 */
export interface MockDetoxElement {
  tap(): Promise<void>;
  longPress(duration?: number): Promise<void>;
  multiTap(times: number): Promise<void>;
  swipe(
    direction: 'left' | 'right' | 'up' | 'down',
    speed?: 'fast' | 'slow',
    percentage?: number
  ): Promise<void>;
  typeText(text: string): Promise<void>;
  replaceText(text: string): Promise<void>;
  clearText(): Promise<void>;
  scroll(
    pixels: number,
    direction?: 'up' | 'down' | 'left' | 'right',
    startPositionX?: number,
    startPositionY?: number
  ): Promise<void>;
}

/**
 * Mock Detox matcher interface for type safety during infrastructure prep.
 */
export interface MockDetoxMatcher {
  withAncestor(matcher: MockDetoxMatcher): MockDetoxMatcher;
  withDescendant(matcher: MockDetoxMatcher): MockDetoxMatcher;
  and(matcher: MockDetoxMatcher): MockDetoxMatcher;
}

/**
 * Generate unique IDs for test data with mobile-specific prefix.
 */
export function generateId(prefix: string = 'mobile-test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Wait for element to be visible with custom timeout.
 * Wraps Detox waitFor API with error handling.
 */
export async function waitForElement(testID: string, timeout: number = 5000): Promise<void> {
  // Mock implementation - replace with actual Detox waitFor when available
  console.log(`[Mock] Waiting for element: ${testID} (timeout: ${timeout}ms)`);
}

/**
 * Wait for element to disappear.
 */
export async function waitForElementToDisappear(
  testID: string,
  timeout: number = 5000
): Promise<void> {
  console.log(`[Mock] Waiting for element to disappear: ${testID} (timeout: ${timeout}ms)`);
}

/**
 * Scroll to element by test ID.
 * Useful for scrolling to blocks in long pages.
 */
export async function scrollToElement(
  scrollViewTestID: string,
  targetTestID: string
): Promise<void> {
  console.log(`[Mock] Scrolling ${scrollViewTestID} to ${targetTestID}`);
}

/**
 * Type text slowly to simulate realistic user input.
 * Mobile keyboards are slower than desktop typing.
 */
export async function typeTextSlowly(testID: string, text: string): Promise<void> {
  console.log(`[Mock] Typing slowly in ${testID}: "${text}"`);
}

/**
 * Perform swipe gesture to navigate or reveal actions.
 */
export async function swipeElement(
  testID: string,
  direction: 'left' | 'right' | 'up' | 'down',
  speed: 'fast' | 'slow' = 'fast'
): Promise<void> {
  console.log(`[Mock] Swiping ${testID} ${direction} at ${speed} speed`);
}

/**
 * Tap at specific coordinates (for graph interaction).
 */
export async function tapAtPoint(x: number, y: number): Promise<void> {
  console.log(`[Mock] Tapping at coordinates (${x}, ${y})`);
}

/**
 * Perform pinch gesture (for graph zoom).
 */
export async function pinchToZoom(
  testID: string,
  direction: 'in' | 'out',
  scale: number = 2.0
): Promise<void> {
  console.log(`[Mock] Pinch ${direction} on ${testID} with scale ${scale}`);
}

/**
 * Navigate to a page using the navigation system.
 */
export async function navigateToPage(pageTitle: string): Promise<void> {
  console.log(`[Mock] Navigating to page: ${pageTitle}`);
}

/**
 * Open command palette (mobile equivalent).
 */
export async function openCommandPalette(): Promise<void> {
  console.log(`[Mock] Opening command palette`);
}

/**
 * Take a screenshot with custom name for debugging.
 */
export async function takeScreenshot(name: string): Promise<void> {
  console.log(`[Mock] Taking screenshot: ${name}`);
}

/**
 * Reload React Native app (useful for testing app state persistence).
 */
export async function reloadApp(): Promise<void> {
  console.log(`[Mock] Reloading React Native app`);
}

/**
 * Put app in background and bring back (tests state preservation).
 */
export async function sendAppToBackground(duration: number = 2000): Promise<void> {
  console.log(`[Mock] Sending app to background for ${duration}ms`);
}

/**
 * Change device orientation.
 */
export async function setOrientation(orientation: 'portrait' | 'landscape'): Promise<void> {
  console.log(`[Mock] Setting orientation to ${orientation}`);
}

/**
 * Mock device settings.
 */
export async function setDeviceSettings(settings: {
  language?: string;
  locale?: string;
  timezone?: string;
}): Promise<void> {
  console.log(`[Mock] Setting device settings:`, settings);
}

/**
 * Clear app data (for fresh test state).
 */
export async function clearAppData(): Promise<void> {
  console.log(`[Mock] Clearing app data`);
}

/**
 * Assert text exists on screen.
 */
export async function assertTextVisible(text: string): Promise<void> {
  console.log(`[Mock] Asserting text visible: "${text}"`);
}

/**
 * Assert element exists by test ID.
 */
export async function assertElementExists(testID: string): Promise<void> {
  console.log(`[Mock] Asserting element exists: ${testID}`);
}

/**
 * Assert element does not exist.
 */
export async function assertElementNotExists(testID: string): Promise<void> {
  console.log(`[Mock] Asserting element does not exist: ${testID}`);
}

/**
 * Long press on element (for context menus).
 */
export async function longPressElement(testID: string, duration: number = 1000): Promise<void> {
  console.log(`[Mock] Long pressing ${testID} for ${duration}ms`);
}

/**
 * Multi-tap (for double-tap actions).
 */
export async function multiTapElement(testID: string, times: number): Promise<void> {
  console.log(`[Mock] Multi-tapping ${testID} ${times} times`);
}

/**
 * Wait for specified duration (use sparingly).
 */
export async function wait(ms: number): Promise<void> {
  console.log(`[Mock] Waiting ${ms}ms`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get element by test ID (returns mock element).
 */
export function getElementByTestId(testID: string): MockDetoxElement {
  return {
    async tap() {
      console.log(`[Mock] Tapping element: ${testID}`);
    },
    async longPress(duration = 1000) {
      console.log(`[Mock] Long pressing element: ${testID} for ${duration}ms`);
    },
    async multiTap(times) {
      console.log(`[Mock] Multi-tapping element: ${testID} ${times} times`);
    },
    async swipe(direction, speed = 'fast', percentage = 0.75) {
      console.log(
        `[Mock] Swiping element: ${testID} ${direction} at ${speed} speed (${percentage * 100}%)`
      );
    },
    async typeText(text) {
      console.log(`[Mock] Typing text in element: ${testID}: "${text}"`);
    },
    async replaceText(text) {
      console.log(`[Mock] Replacing text in element: ${testID}: "${text}"`);
    },
    async clearText() {
      console.log(`[Mock] Clearing text in element: ${testID}`);
    },
    async scroll(pixels, direction = 'down', startPositionX = 0, startPositionY = 0) {
      console.log(
        `[Mock] Scrolling element: ${testID} ${pixels}px ${direction} from (${startPositionX}, ${startPositionY})`
      );
    },
  };
}

/**
 * Get element by text.
 */
export function getElementByText(text: string): MockDetoxElement {
  return getElementByTestId(`text-${text}`);
}

/**
 * Get element by label.
 */
export function getElementByLabel(label: string): MockDetoxElement {
  return getElementByTestId(`label-${label}`);
}
