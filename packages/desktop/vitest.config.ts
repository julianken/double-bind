import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Stub the Tauri native menu plugin so dynamic imports in useContextMenu
      // resolve without error in the jsdom test environment.
      '@tauri-apps/plugin-menu': resolve(__dirname, 'test/stubs/tauri-plugin-menu.ts'),
    },
  },
  test: {
    name: 'desktop',
    globals: true,
    environment: 'jsdom',
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
    exclude: ['test/e2e/**/*', 'node_modules/**/*'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
