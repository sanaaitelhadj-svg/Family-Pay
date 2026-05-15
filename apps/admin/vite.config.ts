import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': {
        target: 'https://familypaybackend-production.up.railway.app',
        changeOrigin: true,
      },
      '/admin': {
        target: 'https://familypaybackend-production.up.railway.app',
        changeOrigin: true,
      },
    },
  },
});
