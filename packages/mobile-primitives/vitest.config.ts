import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'mobile-primitives',
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
