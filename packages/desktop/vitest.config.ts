import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'desktop',
    globals: true,
    environment: 'jsdom',
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    // Exclude E2E tests (they use Playwright, not Vitest)
    exclude: ['test/e2e/**'],
  },
});
