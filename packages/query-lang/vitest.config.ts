import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'query-lang',
    globals: true,
    environment: 'node',
    include: ['test/**/*.{test,spec}.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
