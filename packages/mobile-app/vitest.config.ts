import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'mobile-app',
    globals: true,
    environment: 'node',
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**/*'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
