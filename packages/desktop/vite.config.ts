import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
  },

  // Resolve aliases for cleaner imports
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
