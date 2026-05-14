import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3002,
    proxy: {
      '/api': { target: 'https://familypaybackend-production.up.railway.app', changeOrigin: true },
      '/socket.io': { target: 'https://familypaybackend-production.up.railway.app', ws: true },
    },
  },
  build: { outDir: 'dist' },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
