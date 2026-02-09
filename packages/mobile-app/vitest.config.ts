import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@double-bind/mobile': resolve(__dirname, '../mobile/src'),
      '@double-bind/types': resolve(__dirname, '../types/src'),
    },
  },
  test: {
    name: 'mobile-app',
    globals: true,
    environment: 'node',
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**/*'],
    setupFiles: ['./test/setup.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
