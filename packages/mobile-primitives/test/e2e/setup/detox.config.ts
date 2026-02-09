/**
 * Detox Configuration Template
 *
 * This file provides a configuration template for Detox E2E testing.
 * Detox is not installed as a dependency in this phase - this is infrastructure prep.
 *
 * When ready to implement:
 * 1. Install Detox: pnpm add -D detox @types/detox
 * 2. Install device drivers: brew tap wix/brew && brew install applesimutils
 * 3. Configure iOS/Android projects to include Detox dependencies
 *
 * @see https://wix.github.io/Detox/docs/introduction/getting-started
 */

export interface DetoxConfiguration {
  testRunner: {
    args: {
      config: string;
      maxWorkers?: number;
    };
    jest?: {
      setupTimeout?: number;
      reportSlowerTests?: number;
    };
  };
  apps: Record<
    string,
    {
      type: string;
      binaryPath?: string;
      build?: string;
    }
  >;
  devices: Record<
    string,
    {
      type: string;
      device?: {
        type: string;
      };
    }
  >;
  configurations: Record<
    string,
    {
      device: string;
      app: string;
    }
  >;
}

/**
 * Detox configuration for Double-Bind mobile app E2E tests
 *
 * CRITICAL: Sequential test execution only (maxWorkers: 1)
 * - Parallel execution causes device simulator conflicts
 * - Parallel execution causes severe system resource exhaustion
 * - Tests share device state and must run sequentially
 */
const config: DetoxConfiguration = {
  testRunner: {
    args: {
      config: './test/e2e/setup/jest.config.js',
      maxWorkers: 1, // REQUIRED: Sequential execution only
    },
    jest: {
      setupTimeout: 120000, // 2 minutes for simulator boot
      reportSlowerTests: 50, // Report tests slower than 50ms
    },
  },

  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/DoubleBindMobile.app',
      build:
        'xcodebuild -workspace ios/DoubleBindMobile.xcworkspace -scheme DoubleBindMobile -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/DoubleBindMobile.app',
      build:
        'xcodebuild -workspace ios/DoubleBindMobile.xcworkspace -scheme DoubleBindMobile -configuration Release -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build: 'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
    },
  },

  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15 Pro', // Latest recommended device
      },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        type: 'Pixel_6_Pro_API_34', // Android 14
      },
    },
  },

  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
    'android.emu.release': {
      device: 'emulator',
      app: 'android.release',
    },
  },
};

export default config;
