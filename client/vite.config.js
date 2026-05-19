import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootNodeModules = path.resolve(__dirname, '../node_modules');

/**
 * Hawalay client: React + Vite (SPA).
 * Resolve react from workspace root (npm hoists deps to monorepo root).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: path.join(rootNodeModules, 'react'),
      'react-dom': path.join(rootNodeModules, 'react-dom'),
      'react/jsx-runtime': path.join(rootNodeModules, 'react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.join(rootNodeModules, 'react/jsx-dev-runtime.js'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
});
