import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:8000';
const usePolling = !!process.env.CHOKIDAR_USEPOLLING;

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
    watch: usePolling ? { usePolling: true } : undefined,
    hmr: { clientPort: 5173 },
  },
});
