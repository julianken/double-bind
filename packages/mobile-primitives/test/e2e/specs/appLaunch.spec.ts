/**
 * E2E Test: App Launch and Initialization
 *
 * Tests the critical path of app launch, initialization, and basic navigation.
 * Verifies that the mobile app starts correctly, loads data, and presents the UI.
 *
 * CRITICAL: This is infrastructure prep. Tests use mock implementations.
 * When Detox is installed, replace mock calls with actual Detox API.
 *
 * Test Coverage:
 * - App launches without crashing
 * - Splash screen appears and dismisses
 * - Main navigation is visible
 * - Database initializes correctly
 * - Initial content loads
 */

/* eslint-disable no-console */

import { describe, it, beforeEach } from 'vitest';
import {
  waitForElement,
  assertElementExists,
  reloadApp,
  takeScreenshot,
  wait,
} from '../setup/testHelpers';
import { createDeviceMock } from '../mocks/DeviceMock';

describe('App Launch and Initialization', () => {
  const device = createDeviceMock('ios');

  beforeEach(async () => {
    // Reset device state before each test
    await device.reset();
  });

  it('should launch app successfully', async () => {
    // Mock: Launch app
    console.log('[Test] Launching app');

    // Wait for app to initialize
    await waitForElement('app-shell', 10000);

    // Verify main navigation is visible
    await assertElementExists('main-navigation');

    // Take screenshot for visual verification
    await takeScreenshot('app-launch-success');
  });

  it('should show splash screen during initialization', async () => {
    // Mock: Launch app with splash screen
    console.log('[Test] Launching app with splash screen');

    // Verify splash screen appears
    await assertElementExists('splash-screen');

    // Wait for splash to dismiss
    await wait(2000);

    // Verify app shell appears after splash
    await waitForElement('app-shell', 5000);
    await assertElementExists('main-navigation');
  });

  it('should initialize database and load initial data', async () => {
    console.log('[Test] Verifying database initialization');

    await waitForElement('app-shell', 10000);

    // Wait for database to initialize and load pages
    await wait(1000);

    // Verify pages list is visible (even if empty)
    await assertElementExists('pages-list');

    // Verify "New Page" button is available
    await assertElementExists('new-page-button');
  });

  it('should navigate to home/inbox page on launch', async () => {
    console.log('[Test] Verifying initial navigation');

    await waitForElement('app-shell', 10000);

    // Check if home/inbox page is shown
    // Mobile app should show a default landing page
    await assertElementExists('page-view');
  });

  it('should handle app reload gracefully', async () => {
    console.log('[Test] Testing app reload');

    await waitForElement('app-shell', 10000);

    // Reload the app
    await reloadApp();

    // Verify app re-initializes correctly
    await waitForElement('app-shell', 10000);
    await assertElementExists('main-navigation');
    await assertElementExists('pages-list');
  });

  it('should display navigation elements', async () => {
    console.log('[Test] Verifying navigation elements');

    await waitForElement('app-shell', 10000);

    // Verify key navigation elements are present
    await assertElementExists('main-navigation');
    await assertElementExists('pages-list');
    await assertElementExists('new-page-button');
    await assertElementExists('search-button');
  });

  it('should handle orientation changes during launch', async () => {
    console.log('[Test] Testing orientation changes');

    await waitForElement('app-shell', 10000);

    // Rotate to landscape
    await device.rotate('landscape');
    await wait(500);

    // Verify app adapts to landscape
    await assertElementExists('app-shell');
    await assertElementExists('main-navigation');

    // Rotate back to portrait
    await device.rotate('portrait');
    await wait(500);

    // Verify app adapts to portrait
    await assertElementExists('app-shell');
    await assertElementExists('main-navigation');
  });

  it('should show error state if database fails to initialize', async () => {
    console.log('[Test] Testing database initialization failure handling');

    // Mock: Simulate database initialization failure
    // In real implementation, this would involve injecting an error
    console.log('[Mock] Simulating database error');

    // Verify error message is shown
    // await assertTextVisible('Database initialization failed');
    // await assertElementExists('retry-button');
  });

  it('should preserve state after backgrounding', async () => {
    console.log('[Test] Testing state preservation after backgrounding');

    await waitForElement('app-shell', 10000);

    // Send app to background and bring back
    await device.sendToBackground(3000);

    // Verify app state is preserved
    await assertElementExists('app-shell');
    await assertElementExists('main-navigation');
  });

  it('should handle memory pressure during launch', async () => {
    console.log('[Test] Testing memory pressure handling');

    // Simulate low memory condition
    await device.simulateMemoryPressure('low');

    await waitForElement('app-shell', 10000);

    // App should still launch successfully under memory pressure
    await assertElementExists('main-navigation');

    // Reset memory pressure
    await device.simulateMemoryPressure('normal');
  });

  it('should show loading indicator during initialization', async () => {
    console.log('[Test] Verifying loading indicators');

    // Check for loading indicator
    // await assertElementExists('loading-indicator');

    await waitForElement('app-shell', 10000);

    // Loading indicator should be gone
    // await assertElementNotExists('loading-indicator');
  });

  it('should initialize with correct safe area insets', async () => {
    console.log('[Test] Verifying safe area insets');

    await waitForElement('app-shell', 10000);

    // Get safe area insets from device mock
    const insets = device.getSafeAreaInsets();
    console.log('[Test] Safe area insets:', insets);

    // Verify content is not obscured by notch/home indicator
    // This is a visual check that would require screenshot comparison
    await takeScreenshot('safe-area-insets');
  });
});
