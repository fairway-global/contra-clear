import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3001';

  return {
    plugins: [
      react(),
      nodePolyfills({ include: ['buffer', 'crypto', 'stream', 'util'] }),
    ],
    server: {
      port: 5173,
      allowedHosts: ['super-ghost-intimate.ngrok-free.app'],
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '/health': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    define: {
      'process.env': {},
    },
  };
});
