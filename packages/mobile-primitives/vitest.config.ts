import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      'react-native-reanimated': 'react-native-reanimated/mock',
    },
  },
});
