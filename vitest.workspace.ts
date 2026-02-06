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
]);
