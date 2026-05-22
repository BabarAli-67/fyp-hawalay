import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Hawalay client: React + Vite (SPA).
 * Resolve deps from this package's node_modules (Vercel installs in client/ or via workspace).
 * Do not alias react to ../node_modules — that path is missing on Vercel client-only installs.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
