import { defineConfig } from 'vitest/config';
import path from 'path';

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
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      // Map workspace package to source for testing
      '@double-bind/mobile': path.resolve(__dirname, '../mobile/src'),
    },
  },
});
