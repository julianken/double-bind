import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'migrations',
    globals: true,
    environment: 'node',
    include: ['test/**/*.{test,spec}.ts'],
    passWithNoTests: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
