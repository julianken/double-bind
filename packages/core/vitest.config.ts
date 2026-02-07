import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'core',
    globals: true,
    environment: 'node',
    include: ['test/unit/**/*.{test,spec}.ts'],
    exclude: ['test/integration/**'],
    passWithNoTests: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
