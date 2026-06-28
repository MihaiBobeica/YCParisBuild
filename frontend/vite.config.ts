import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:8000';
const usePolling = !!process.env.CHOKIDAR_USEPOLLING;

export default defineConfig({
  // Load VITE_* vars from the repo-root .env (shared with docker-compose backend).
  envDir: path.resolve(__dirname, '..'),
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
