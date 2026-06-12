/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import UnoCSS from 'unocss/vite';

// Ghost Tracks web — Vite config.
// Port 5180 is the locked frontend port (spec §13); /api proxies to the Hono
// gateway BFF on :3000 so the app is same-origin in dev.
export default defineConfig({
  plugins: [UnoCSS(), react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true
  }
});
