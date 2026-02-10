/**
 * Jest Configuration for Detox E2E Tests
 *
 * This configuration will be used when Detox is installed and configured.
 * For now, it serves as a template for future implementation.
 *
 * Detox requires Jest as its test runner, so this config is separate from
 * the Vitest config used for unit tests.
 *
 * @see https://wix.github.io/Detox/docs/introduction/getting-started
 */

module.exports = {
  preset: 'react-native',

  // Use the Detox preset
  testEnvironment: 'detox/runners/jest',

  // Test file patterns
  testMatch: ['<rootDir>/../specs/**/*.spec.ts'],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/detox-setup.ts'],

  // Transform TypeScript files
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Coverage configuration
  collectCoverageFrom: [
    '../../../src/**/*.{ts,tsx}',
    '!../../../src/**/*.d.ts',
    '!../../../src/**/*.test.{ts,tsx}',
  ],

  // Timeout for tests (mobile tests can be slower)
  testTimeout: 120000,

  // Reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './test-results',
        outputName: 'e2e-test-results.xml',
      },
    ],
  ],

  // Verbose output
  verbose: true,

  // Max workers (CRITICAL: Sequential execution only)
  maxWorkers: 1,

  // Bail on first failure (optional, speeds up feedback)
  bail: false,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
