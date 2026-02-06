import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Unit test projects - each package runs its own unit tests
  'packages/types',
  'packages/test-utils',
  'packages/migrations',
  'packages/core',

  // Integration test project - runs core integration tests with real CozoDB
  {
    test: {
      name: 'core-integration',
      root: './packages/core',
      globals: true,
      environment: 'node',
      include: ['test/integration/**/*.{test,spec}.ts'],
      passWithNoTests: true,
    },
  },

  // Scripts test project - tests for build/utility scripts
  {
    test: {
      name: 'scripts',
      root: './scripts',
      globals: true,
      environment: 'node',
      include: ['**/*.{test,spec}.ts'],
      passWithNoTests: true,
    },
  },
]);
