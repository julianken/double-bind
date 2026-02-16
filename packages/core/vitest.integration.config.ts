import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'core-integration',
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.{test,spec}.ts'],
    exclude: ['test/unit/**'],
    passWithNoTests: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Sequential execution prevents resource exhaustion
      },
    },
    testTimeout: 30000, // 30 seconds per test
  },
});
