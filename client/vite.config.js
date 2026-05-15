import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Hawalay client: React + Vite (SPA).
 * @see https://vite.dev/guide/
 */
export default defineConfig({
  plugins: [react()],
});
