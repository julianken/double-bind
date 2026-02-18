import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const isE2E = process.env.E2E_TEST === 'true';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Vite dev server configuration for Tauri
  server: {
    port: 5173,
    strictPort: true,
    // Allow Tauri to connect to the dev server
    host: true,
  },

  // Build output to dist/ for Tauri frontendDist
  build: {
    outDir: 'dist',
    // Tauri expects a single output directory
    emptyOutDir: true,
    // Generate source maps for debugging
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        settings: resolve(__dirname, 'settings.html'),
      },
      external: ['@tauri-apps/plugin-menu'],
    },
  },

  // Resolve aliases for cleaner imports
  resolve: {
    alias: {
      '@': '/src',
      // Tauri plugins are only available at runtime inside a Tauri window.
      // Provide stubs so Vite can resolve imports in dev/E2E mode.
      '@tauri-apps/plugin-menu': resolve(__dirname, 'src/stubs/tauri-plugin-menu.ts'),
      ...(isE2E && {
        '@tauri-apps/api/core': resolve(__dirname, 'test/e2e/setup/tauri-mock-module.ts'),
      }),
    },
  },

  // Define for E2E testing
  define: {
    __E2E_TEST__: JSON.stringify(isE2E),
  },
});
