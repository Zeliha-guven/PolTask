/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Derleme web/dist'e; Flask onu "/" altında sunar. Geliştirmede /api, Flask'a (127.0.0.1:5000) proxy'lenir.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: { proxy: { '/api': 'http://127.0.0.1:5000' } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    watch: false,
    pool: 'threads',
    env: { TZ: 'Europe/Istanbul', LANG: 'tr_TR.UTF-8' },
    testTimeout: 20000,
  },
});
