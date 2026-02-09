import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Unit test projects - each package runs its own unit tests
  'packages/types',
  'packages/test-utils',
  'packages/migrations',
  'packages/query-lang',
  'packages/core',
  'packages/ui-primitives',
  'packages/mobile-primitives',
  'packages/desktop',

  // Integration test project - runs core integration tests with real CozoDB
  {
    test: {
      name: 'core-integration',
      root: './packages/core',
      globals: true,
      environment: 'node',
      include: ['test/integration/**/*.{test,spec}.ts'],
      passWithNoTests: true,
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
    },
  },

  // Migrations integration tests - runs migration tests with real CozoDB
  {
    test: {
      name: 'migrations-integration',
      root: './packages/migrations',
      globals: true,
      environment: 'node',
      include: ['test/integration/**/*.{test,spec}.ts'],
      passWithNoTests: true,
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
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
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
    },
  },
]);
