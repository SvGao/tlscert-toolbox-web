import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, proxy API calls to the backend container/service.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': { target: process.env.BACKEND_URL || 'http://localhost:8080', changeOrigin: true },
      '/download': { target: process.env.BACKEND_URL || 'http://localhost:8080', changeOrigin: true },
    },
  },
});
