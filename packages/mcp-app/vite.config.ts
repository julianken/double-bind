import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const input = process.env.INPUT || 'src/ui/index.html';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: { input },
  },
});
